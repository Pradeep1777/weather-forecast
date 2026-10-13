import logging
from functools import lru_cache
from pathlib import Path

import joblib
import pandas as pd
import sklearn

from .features import INPUT_COLUMNS, WINDOW_HOURS, make_features
from .live_weather import ToolError, recent_hours

logger = logging.getLogger(__name__)

MODEL_PATH = Path(__file__).resolve().parents[2] / "models" / "gb_simple_h1.joblib"
HISTORY_PATH = Path(__file__).resolve().parents[2] / "data" / "mumbai_clean.csv"
TRAINED_UNTIL = pd.Timestamp("2024-01-01")   # the final model was trained on 1980-2023


@lru_cache
def load_model() -> dict:
    if not MODEL_PATH.exists():
        raise ToolError("The temperature model file is missing. Run: python src/train.py")
    saved = joblib.load(MODEL_PATH)
    if saved["sklearn_version"] != sklearn.__version__:
        logger.warning("Model saved with scikit-learn %s, running %s", saved["sklearn_version"], sklearn.__version__)
    return saved


def build_features(last_24h: pd.DataFrame) -> pd.DataFrame:
    """The 6 training features (tools/features.py) for the LAST hour of a 24-hour window."""
    if len(last_24h) != WINDOW_HOURS:
        raise ToolError(f"Need exactly {WINDOW_HOURS} hourly rows, got {len(last_24h)}.")
    if not (last_24h.index.to_series().diff().dropna() == pd.Timedelta(hours=1)).all():
        raise ToolError("The 24 hours must be consecutive.")
    if last_24h[INPUT_COLUMNS].isna().any().any():
        raise ToolError("The recent weather data has missing values.")
    return make_features(last_24h).iloc[[-1]]


def predict_from_window(last_24h: pd.DataFrame) -> float:
    saved = load_model()
    features = build_features(last_24h)[saved["features"]]
    return round(float(saved["model"].predict(features)[0]), 1)


def predict_next_hour_temperature() -> dict:
    """Predict the temperature for the next hour in Mumbai, using the trained Day 1 model."""
    last_24h = recent_hours(24)
    based_on = last_24h.index[-1]
    predicted = predict_from_window(last_24h)
    last_temp = float(last_24h["temperature_2m"].iloc[-1])
    return {
        "location": "Mumbai (South Mumbai)",
        "based_on_hour": based_on.strftime("%Y-%m-%d %H:%M") + " IST",
        "forecast_for": (based_on + pd.Timedelta(hours=1)).strftime("%Y-%m-%d %H:%M") + " IST",
        "last_observed_temperature_c": last_temp,
        "predicted_temperature_c": predicted,
        "change_c": round(predicted - last_temp, 1),
        "model": "Day 1 gradient boosting (6 features), trained on ERA5 1980-2023",
        "model_test_error_c": round(load_model()["test_rmse"], 2),
        "note": "Prediction from our own ML model; live inputs come from a different data source than training.",
    }


@lru_cache
def load_history() -> pd.DataFrame:
    """The clean hourly ERA5 history (data/mumbai_clean.csv, made by src/train.py), Mumbai local time."""
    if not HISTORY_PATH.exists():
        raise ToolError("The historical weather data is not available here. Run: python download_weather.py "
                        "and python src/train.py")
    return pd.read_csv(HISTORY_PATH, parse_dates=["time"], index_col="time")


def backtest_temperature(when: str) -> dict:
    """Predict one past hour from the 24 real hours before it, and compare with what really happened."""
    try:
        target = pd.Timestamp(when).floor("h")
    except (ValueError, TypeError):
        raise ToolError(f"Could not read the date and time {when!r}. Use the form YYYY-MM-DD HH:00.") from None
    history = load_history()
    based_on = target - pd.Timedelta(hours=1)
    first_possible = history.index.min() + pd.Timedelta(hours=WINDOW_HOURS)
    if not first_possible <= target <= history.index.max():
        raise ToolError(f"Pick an hour between {first_possible:%Y-%m-%d %H:%M} and {history.index.max():%Y-%m-%d %H:%M}. "
                        "Future hours have no real data to compare with.")

    window = history.loc[based_on - pd.Timedelta(hours=WINDOW_HOURS - 1): based_on]
    predicted = predict_from_window(window)
    actual = round(float(history.loc[target, "temperature_2m"]), 1)
    lazy = round(float(window["temperature_2m"].iloc[-1]), 1)
    seen = target < TRAINED_UNTIL
    return {
        "location": "Mumbai (South Mumbai)",
        "predicted_hour": target.strftime("%Y-%m-%d %H:%M") + " IST",
        "based_on_24_hours_until": based_on.strftime("%Y-%m-%d %H:%M") + " IST",
        "predicted_temperature_c": predicted,
        "actual_temperature_c": actual,
        "model_error_c": round(predicted - actual, 1),
        "lazy_guess_c": lazy,
        "lazy_guess_error_c": round(lazy - actual, 1),
        "data": "ERA5 history (the same source the model was trained on)",
        "note": ("This hour was part of the training data (1980-2023), so it is not a fair test."
                 if seen else "This hour is from the test years (2024-2025): the model never saw it."),
    }
