import joblib
import pytest

import train
from train import EXPERIMENTS_DIR, load_config, mae, quality_gate, rmse


def write_yaml(tmp_path, text: str):
    path = tmp_path / "exp.yaml"
    path.write_text(text, encoding="utf-8")
    return path


# --- metrics -------------------------------------------------------------------------------------

def test_rmse_and_mae_by_hand():
    # errors are 3 and 4: RMSE = sqrt((9 + 16) / 2), MAE = (3 + 4) / 2
    assert rmse([0, 0], [3, 4]) == pytest.approx(3.5355, abs=1e-4)
    assert mae([0, 0], [3, 4]) == 3.5
    assert rmse([1, 2], [1, 2]) == 0


# --- experiment files ----------------------------------------------------------------------------

@pytest.mark.parametrize("path", sorted(EXPERIMENTS_DIR.glob("*.yaml")), ids=lambda p: p.name)
def test_every_experiment_file_is_valid(path):
    # CI runs this on every push, so a broken YAML is caught before anyone trains with it
    config = load_config(path)
    assert config["name"] == path.stem
    assert config["model"]["max_iter"] > 0
    assert 0 < config["model"]["learning_rate"] <= 1


def test_config_fills_in_defaults(tmp_path):
    config = load_config(write_yaml(tmp_path, "model:\n  max_iter: 10\n  learning_rate: 0.1\n"))
    assert config["model"]["random_state"] == 42
    assert config["name"] == "exp"


def test_config_rejects_a_missing_setting(tmp_path):
    with pytest.raises(SystemExit, match="missing"):
        load_config(write_yaml(tmp_path, "name: x\nmodel:\n  max_iter: 10\n"))


def test_config_rejects_a_typo(tmp_path):
    with pytest.raises(SystemExit, match="unknown model settings"):
        load_config(write_yaml(tmp_path, "name: x\nmodel:\n  max_iter: 10\n  learnign_rate: 0.1\n  learning_rate: 0.1\n"))


def test_config_rejects_a_file_without_a_model_section(tmp_path):
    with pytest.raises(SystemExit, match="model"):
        load_config(write_yaml(tmp_path, "name: x\n"))


# --- quality gate (uses a temporary model file, never the real one) ------------------------------

@pytest.fixture
def current_model(tmp_path, monkeypatch):
    """Point the gate at a temp file; return a function that 'saves' a current model with a given test RMSE."""
    path = tmp_path / "model.joblib"
    monkeypatch.setattr(train, "MODEL_PATH", path)

    def save(test_rmse: float):
        joblib.dump({"test_rmse": test_rmse}, path)
    return save


def scores(model_rmse: float, lazy_rmse: float = 0.85) -> dict:
    return {"model_rmse": model_rmse, "lazy_guess_rmse": lazy_rmse}


def test_gate_accepts_the_first_model_if_it_beats_the_lazy_guess(current_model):
    accepted, _ = quality_gate(scores(0.5))
    assert accepted


def test_gate_rejects_a_model_that_does_not_beat_the_lazy_guess(current_model):
    accepted, reason = quality_gate(scores(0.9))
    assert not accepted
    assert "lazy guess" in reason


def test_gate_rejects_a_model_worse_than_the_current_one(current_model):
    current_model(0.41)
    accepted, reason = quality_gate(scores(0.45))
    assert not accepted
    assert "worse than the current model" in reason


def test_gate_accepts_a_model_better_than_or_equal_to_the_current_one(current_model):
    current_model(0.41)
    assert quality_gate(scores(0.40))[0]
    assert quality_gate(scores(0.41))[0]
