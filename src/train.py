import argparse
import json
import logging
import os
import subprocess
from datetime import datetime, timezone
from pathlib import Path

import joblib
import numpy as np
import pandas as pd
import sklearn
import yaml
from sklearn.ensemble import HistGradientBoostingRegressor

from data import AREA, BASE_DIR, load_clean, split_by_time
from tools.features import FEATURES, TARGET, make_training_table
from tools.temperature_model import MODEL_PATH

logger = logging.getLogger("train")

METRICS_PATH = BASE_DIR / "reports" / "metrics.json"
# MLflow logbook: one local SQLite file, git-ignored (each person keeps their own runs)
TRACKING_URI = f"sqlite:///{(BASE_DIR / 'mlflow.db').as_posix()}"
ARTIFACTS_DIR = BASE_DIR / "mlruns"
EXPERIMENT = "mumbai-temperature-1h"
# Model Registry: every model the quality gate accepts becomes a new version; the alias points at the live one
REGISTERED_MODEL = "mumbai-temperature"
CHAMPION_ALIAS = "champion"
TRUSTED_MODEL_TYPES = ["sklearn.ensemble._hist_gradient_boosting.predictor.TreePredictor"]
EXPERIMENTS_DIR = BASE_DIR / "experiments"
DEFAULT_CONFIG = EXPERIMENTS_DIR / "exp_002_iter600.yaml"
MODEL_KEYS = {"max_iter", "learning_rate", "random_state"}


def rmse(actual, predicted) -> float:
    return float(np.sqrt(np.mean((np.asarray(actual) - np.asarray(predicted)) ** 2)))


def mae(actual, predicted) -> float:
    return float(np.mean(np.abs(np.asarray(actual) - np.asarray(predicted))))


def load_config(path: Path) -> dict:
    """Read one experiment file (experiments/*.yaml) and check it, so a typo fails here and not halfway through training."""
    config = yaml.safe_load(path.read_text(encoding="utf-8"))
    if not isinstance(config, dict) or not isinstance(config.get("model"), dict):
        raise SystemExit(f"{path}: needs a 'name' and a 'model:' section (see experiments/exp_001_baseline.yaml)")
    if missing := {"max_iter", "learning_rate"} - config["model"].keys():
        raise SystemExit(f"{path}: model is missing {sorted(missing)}")
    if unknown := config["model"].keys() - MODEL_KEYS:
        raise SystemExit(f"{path}: unknown model settings {sorted(unknown)} (allowed: {sorted(MODEL_KEYS)})")
    config["model"].setdefault("random_state", 42)
    config.setdefault("name", path.stem)
    return config


def git_sha() -> str:
    """The commit this run was made from (so a run can be traced to its code), or 'unknown'."""
    try:
        out = subprocess.run(["git", "rev-parse", "--short", "HEAD"], cwd=BASE_DIR, capture_output=True, text=True, timeout=10)
        return out.stdout.strip() if out.returncode == 0 and out.stdout.strip() else "unknown"
    except (OSError, subprocess.SubprocessError):
        return "unknown"


def new_model(settings: dict) -> HistGradientBoostingRegressor:
    return HistGradientBoostingRegressor(**settings)


def score(model, part) -> dict:
    """Model vs lazy guess on one part of the data."""
    predicted = model.predict(part[FEATURES])
    model_rmse, lazy_rmse = rmse(part[TARGET], predicted), rmse(part[TARGET], part["temp_now"])
    return {
        "rows": len(part),
        "model_rmse": round(model_rmse, 4),
        "model_mae": round(mae(part[TARGET], predicted), 4),
        "lazy_guess_rmse": round(lazy_rmse, 4),
        "lazy_guess_mae": round(mae(part[TARGET], part["temp_now"]), 4),
        "improvement_pct": round(100 * (1 - model_rmse / lazy_rmse), 1),
    }


def quality_gate(test_scores: dict) -> tuple[bool, str]:
    """Never ship a worse model by accident: it must beat the lazy guess AND not be worse than the current model."""
    if test_scores["model_rmse"] >= test_scores["lazy_guess_rmse"]:
        return False, "does not beat the lazy guess"
    if MODEL_PATH.exists():
        try:
            current = joblib.load(MODEL_PATH)["test_rmse"]
        except Exception:
            logger.warning("Could not read the current model, so there is nothing to compare with")
            return True, "beats the lazy guess; current model unreadable"
        if test_scores["model_rmse"] > current:
            return False, f"worse than the current model ({test_scores['model_rmse']} > {current})"
    return True, "beats the lazy guess and is not worse than the current model"


def main() -> None:
    parser = argparse.ArgumentParser(description="Train the 1-hour-ahead temperature model.")
    parser.add_argument("--rebuild", action="store_true", help="re-clean the data from the raw download")
    parser.add_argument("--no-mlflow", action="store_true", help="do not log this run to MLflow")
    parser.add_argument("--config", type=Path, default=DEFAULT_CONFIG,
                        help="experiment file with the model settings (default %(default)s)")
    args = parser.parse_args()
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")
    config_path = args.config if args.config.is_absolute() else Path.cwd() / args.config
    config = load_config(config_path)
    settings = config["model"]
    logger.info("Experiment %s (%s): %s", config["name"], config_path.name, settings)

    table = make_training_table(load_clean(rebuild=args.rebuild))
    train, val, test = split_by_time(table)
    logger.info("Rows: train %s | validation %s | test %s", f"{len(train):,}", f"{len(val):,}", f"{len(test):,}")

    # Validation: is the model better than the lazy guess on years it has not seen?
    model = new_model(settings).fit(train[FEATURES], train[TARGET])
    val_scores = score(model, val)
    logger.info("Validation RMSE: model %.4f C vs lazy guess %.4f C (%.1f%% better)",
                val_scores["model_rmse"], val_scores["lazy_guess_rmse"], val_scores["improvement_pct"])

    # Final model: same settings, more data (train + validation). The test set is used once, here.
    train_val = pd.concat([train, val])
    final_model = new_model(settings).fit(train_val[FEATURES], train_val[TARGET])
    test_scores = score(final_model, test)
    passed = test_scores["model_rmse"] < test_scores["lazy_guess_rmse"]
    logger.info("TEST RMSE: model %.4f C vs lazy guess %.4f C (%.1f%% better) -> F1 %s",
                test_scores["model_rmse"], test_scores["lazy_guess_rmse"], test_scores["improvement_pct"],
                "PASSED" if passed else "FAILED")

    accepted, reason = quality_gate(test_scores)
    logger.info("Quality gate: %s (%s)", "ACCEPTED" if accepted else "REJECTED", reason)

    report = {
        "model": "HistGradientBoostingRegressor",
        "experiment": config["name"],
        "description": config.get("description", ""),
        "settings": settings,
        "features": FEATURES,
        "target": "temperature 1 hour ahead (C)",
        "area": AREA,
        "trained_on": f"{train_val.index.min():%Y-%m-%d} to {train_val.index.max():%Y-%m-%d}",
        "validation_2022_2023": val_scores,
        "test_2024_2025": test_scores,
        "beats_baseline": passed,
        "sklearn_version": sklearn.__version__,
        "created_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
    }
    if accepted:
        MODEL_PATH.parent.mkdir(parents=True, exist_ok=True)
        joblib.dump({
            "model": final_model,
            "features": FEATURES,
            "area": AREA,
            "test_rmse": test_scores["model_rmse"],
            "sklearn_version": sklearn.__version__,
        }, MODEL_PATH)
        logger.info("Saved model to %s", MODEL_PATH.relative_to(BASE_DIR))
        METRICS_PATH.parent.mkdir(parents=True, exist_ok=True)
        METRICS_PATH.write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
        logger.info("Saved metrics to %s", METRICS_PATH.relative_to(BASE_DIR))
    else:
        logger.warning("The current model and reports/metrics.json were left unchanged")

    if args.no_mlflow:
        logger.info("MLflow tracking skipped (--no-mlflow)")
        if accepted:
            logger.warning("The new model was saved but NOT registered: the Model Registry champion is now older than models/")
    else:
        try:
            log_to_mlflow(report, final_model, sample=test[FEATURES].head(5), gate=(accepted, reason), config_path=config_path)
        except Exception:
            # the model (if accepted) and metrics.json are already saved; a tracking problem must not undo that
            logger.exception("MLflow logging failed: the model was saved, but this run is not tracked")


def log_to_mlflow(report: dict, model, sample: pd.DataFrame, gate: tuple[bool, str], config_path: Path) -> None:
    """Write this training run to the MLflow logbook (mlflow.db): what we tried, what we got, the files."""
    try:
        os.environ.setdefault("MLFLOW_DISABLE_AGENT_HINT", "1")
        import mlflow
        import mlflow.sklearn
    except ImportError:
        # MLflow is a dev tool (requirements-dev.txt): training still works without it, e.g. in Docker
        logger.warning("MLflow is not installed: run not tracked (pip install -r requirements-dev.txt)")
        return
    for noisy in ("alembic", "mlflow"):
        logging.getLogger(noisy).setLevel(logging.WARNING)

    mlflow.set_tracking_uri(os.environ.get("MLFLOW_TRACKING_URI", TRACKING_URI))
    if mlflow.get_experiment_by_name(EXPERIMENT) is None:
        # run files (model, metrics.json) always go to <project>/mlruns, whatever folder we run from
        mlflow.create_experiment(EXPERIMENT, artifact_location=ARTIFACTS_DIR.as_uri())
    mlflow.set_experiment(EXPERIMENT)
    with mlflow.start_run(run_name=report["experiment"], description=report["description"]) as run:
        # parameters = the settings we CHOSE before training
        mlflow.log_params({
            **report["settings"],
            "model": report["model"],
            "features": ",".join(report["features"]),
            "area": report["area"],
            "trained_on": report["trained_on"],
        })
        # metrics = the numbers we GOT
        for part, key in (("val", "validation_2022_2023"), ("test", "test_2024_2025")):
            scores = report[key]
            mlflow.log_metrics({
                f"{part}_rmse": scores["model_rmse"],
                f"{part}_mae": scores["model_mae"],
                f"{part}_lazy_rmse": scores["lazy_guess_rmse"],
                f"{part}_improvement_pct": scores["improvement_pct"],
            })
        mlflow.set_tags({"beats_baseline": str(report["beats_baseline"]), "sklearn_version": report["sklearn_version"],
                         "quality_gate": "accepted" if gate[0] else "rejected", "quality_gate_reason": gate[1],
                         "config_file": config_path.name, "git_sha": git_sha()})
        # artifacts = files saved with the run
        mlflow.log_dict(report, "metrics.json")
        mlflow.log_artifact(str(config_path), artifact_path="config")  # the exact YAML this run used
        # MLflow saves the model with skops (a safe format), which only loads object types it was told
        # to trust. We trained this model ourselves, so we trust exactly the one type gradient boosting uses.
        # pip_requirements: the model only needs scikit-learn (saves MLflow ~30 s of guessing it)
        # registered_model_name: only an ACCEPTED model goes into the registry (rejected runs keep their model as a run file)
        model_info = mlflow.sklearn.log_model(sk_model=model, name="model", input_example=sample,
                                              skops_trusted_types=TRUSTED_MODEL_TYPES,
                                              pip_requirements=[f"scikit-learn=={sklearn.__version__}"],
                                              registered_model_name=REGISTERED_MODEL if gate[0] else None)
        if gate[0]:
            promote_to_champion(mlflow.MlflowClient(), model_info.registered_model_version, report, run.info.run_id)
    logger.info("MLflow: run %s logged to experiment %r. View all runs (from the project folder): "
                "mlflow ui --backend-store-uri sqlite:///mlflow.db", run.info.run_id[:8], EXPERIMENT)


def promote_to_champion(client, version: str, report: dict, run_id: str) -> None:
    """Move the 'champion' alias to the new version, so the app (and later CI/AWS) can ask for 'the live model'."""
    old = None
    try:
        old = client.get_model_version_by_alias(REGISTERED_MODEL, CHAMPION_ALIAS).version
    except Exception:
        pass  # no champion yet: this is the first accepted model
    client.set_registered_model_alias(REGISTERED_MODEL, CHAMPION_ALIAS, version)
    for key, value in {"experiment": report["experiment"], "test_rmse": str(report["test_2024_2025"]["model_rmse"]),
                       "val_rmse": str(report["validation_2022_2023"]["model_rmse"]), "run_id": run_id}.items():
        client.set_model_version_tag(REGISTERED_MODEL, version, key, value)
    logger.info("Model Registry: %s version %s is now %r (was version %s)", REGISTERED_MODEL, version,
                CHAMPION_ALIAS, old or "none")


if __name__ == "__main__":
    main()
