import logging
from pathlib import Path

import pandas as pd

from tools.features import INPUT_COLUMNS

logger = logging.getLogger(__name__)

BASE_DIR = Path(__file__).resolve().parent.parent
RAW_PATH = BASE_DIR / "data" / "mumbai_area_weather_1980_2025.csv"
CLEAN_PATH = BASE_DIR / "data" / "mumbai_clean.csv"

# All Mumbai points share one ERA5 grid cell, so we use one area.
AREA = "South_Mumbai"
NIGHT_HOURS = [21, 22, 23, 0, 1, 2, 3, 4]

# Split by time (never shuffle a time series):
#   train 1980-2021 -> fit | validation 2022-2023 -> check settings | test 2024-2025 -> final score, once
VAL_START = "2022-01-01"
TEST_START = "2024-01-01"


def load_raw(path: Path = RAW_PATH, area: str = AREA) -> pd.DataFrame:
    if not path.exists():
        raise FileNotFoundError(f"{path} not found. Run: python download_weather.py")
    raw = pd.read_csv(path, usecols=["time", "area"] + INPUT_COLUMNS, parse_dates=["time"])
    df = raw[raw["area"] == area].drop(columns="area").set_index("time").sort_index()
    if df.empty:
        raise ValueError(f"No rows for area {area!r} in {path}")
    return df


def clean(df: pd.DataFrame) -> pd.DataFrame:
    """Same steps as day1_data_exploration.ipynb, step 8."""
    out = df[~df.index.duplicated(keep="first")]
    out = out.reindex(pd.date_range(out.index.min(), out.index.max(), freq="h"))   # add missing hours
    out.index.name = "time"
    out = out.interpolate(limit=3)                                                  # fill short gaps only

    out["shortwave_radiation"] = out["shortwave_radiation"].clip(lower=0)
    out["precipitation"] = out["precipitation"].clip(lower=0)
    out.loc[out.index.hour.isin(NIGHT_HOURS), "shortwave_radiation"] = 0            # no sunlight at night

    changed = (out.reindex(df.index) != df).sum().sum() + (len(out) - len(df))
    logger.info("Cleaning changed or added %d values; %d still missing", changed, out.isna().sum().sum())
    return out


def load_clean(rebuild: bool = False) -> pd.DataFrame:
    """The clean hourly data; made from the raw download the first time (or when rebuild=True)."""
    if CLEAN_PATH.exists() and not rebuild:
        return pd.read_csv(CLEAN_PATH, parse_dates=["time"], index_col="time")
    df = clean(load_raw())
    CLEAN_PATH.parent.mkdir(parents=True, exist_ok=True)
    df.to_csv(CLEAN_PATH)
    logger.info("Saved %s clean hours to %s", f"{len(df):,}", CLEAN_PATH)
    return df


def split_by_time(table: pd.DataFrame) -> tuple[pd.DataFrame, pd.DataFrame, pd.DataFrame]:
    train = table[table.index < VAL_START]
    val = table[(table.index >= VAL_START) & (table.index < TEST_START)]
    test = table[table.index >= TEST_START]
    return train, val, test
