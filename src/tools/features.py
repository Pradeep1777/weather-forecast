import pandas as pd

INPUT_COLUMNS = ["temperature_2m", "shortwave_radiation", "precipitation"]
FEATURES = ["temp_now", "temp_3h_ago", "temp_avg_24h", "sunlight", "rain", "hour"]
TARGET = "temp_next_hour"
WINDOW_HOURS = 24  # temp_avg_24h needs the last 24 hours


def make_features(hourly: pd.DataFrame) -> pd.DataFrame:
    """One row of features per hour. `hourly` has a time index and the INPUT_COLUMNS.

    The first 23 rows have no 24-hour average yet (NaN); training drops them,
    and for a live 24-hour window only the last row is used.
    """
    temp = hourly["temperature_2m"]
    return pd.DataFrame({
        "temp_now": temp,
        "temp_3h_ago": temp.shift(3),
        "temp_avg_24h": temp.rolling(WINDOW_HOURS).mean(),
        "sunlight": hourly["shortwave_radiation"],
        "rain": hourly["precipitation"],
        "hour": hourly.index.hour,
    }, index=hourly.index)[FEATURES]


def make_training_table(hourly: pd.DataFrame) -> pd.DataFrame:
    """Features + the target (the temperature one hour later), without incomplete rows."""
    table = make_features(hourly)
    table[TARGET] = hourly["temperature_2m"].shift(-1)
    return table.dropna()
