import sys
import requests
import pandas as pd
import time
from pathlib import Path

# Ensure UTF-8 output on Windows terminals
if sys.stdout and hasattr(sys.stdout, "reconfigure"):
    try:
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    except Exception:
        pass
if sys.stderr and hasattr(sys.stderr, "reconfigure"):
    try:
        sys.stderr.reconfigure(encoding="utf-8", errors="replace")
    except Exception:
        pass



# ============================================================
# 1. CONFIGURATION
# ============================================================

START_DATE = "1980-01-01"
END_DATE = "2025-12-31"

API_URL = "https://archive-api.open-meteo.com/v1/archive"

# Resolve path relative to this script directory
BASE_DIR = Path(__file__).resolve().parent
OUTPUT_FILE = BASE_DIR / "data" / "mumbai_area_weather_1980_2025.csv"

TIMEZONE = "Asia/Kolkata"

# Use ERA5 for consistent long-term historical analysis
MODEL = "era5"


# ============================================================
# 2. MUMBAI LOCATION
# ============================================================
#
# ERA5 has ~0.25 deg (~28 km) resolution, so every point inside
# Mumbai falls in the same grid cell (19.0, 73.0). Downloading
# several Mumbai areas only produced identical copies of the
# same series (checked in notebooks/day1_data_exploration.ipynb),
# so we download a single representative point.
#
# ============================================================

MUMBAI_AREAS = {
    "South_Mumbai": {
        "latitude": 18.9220,
        "longitude": 72.8347,
    },
}


# ============================================================
# 3. WEATHER VARIABLES
# ============================================================

HOURLY_VARIABLES = (
    "temperature_2m,"
    "relative_humidity_2m,"
    "dew_point_2m,"
    "precipitation,"
    "rain,"
    "weather_code,"
    "pressure_msl,"
    "surface_pressure,"
    "cloud_cover,"
    "cloud_cover_low,"
    "cloud_cover_mid,"
    "cloud_cover_high,"
    "wind_speed_10m,"
    "wind_direction_10m,"
    "wind_gusts_10m,"
    "shortwave_radiation"
)


# ============================================================
# 4. DOWNLOAD ONE LOCATION
# ============================================================

def download_location_weather(location, latitude, longitude):

    print()
    print("=" * 70)
    print(f"Downloading: {location}")
    print(f"Coordinates: {latitude}, {longitude}")
    print("=" * 70)

    params = {
        "latitude": latitude,
        "longitude": longitude,

        "start_date": START_DATE,
        "end_date": END_DATE,

        "hourly": HOURLY_VARIABLES,

        "timezone": TIMEZONE,

        "temperature_unit": "celsius",
        "wind_speed_unit": "kmh",
        "precipitation_unit": "mm",

        # Long-term consistent historical model
        "models": MODEL,

        # Prefer land grid cells
        "cell_selection": "land",
    }

    for attempt in range(5):

        try:

            response = requests.get(
                API_URL,
                params=params,
                timeout=300
            )

            if response.status_code == 429:
                try:
                    err_msg = response.json().get("reason", response.text)
                except Exception:
                    err_msg = response.text
                print(f"\n[RATE LIMIT] Open-Meteo returned 429: {err_msg}")
                raise requests.exceptions.HTTPError(
                    f"429 Client Error: {err_msg}", response=response
                )

            response.raise_for_status()

            data = response.json()

            break

        except requests.exceptions.HTTPError as error:

            if error.response is not None and error.response.status_code == 429:
                # Stop immediately on rate limit to prevent futile loops
                raise

            print(
                f"Request failed "
                f"(attempt {attempt + 1}/5): {error}"
            )

            if attempt == 4:
                raise

            time.sleep(5 * (attempt + 1))

        except requests.RequestException as error:

            print(
                f"Request failed "
                f"(attempt {attempt + 1}/5): {error}"
            )

            if attempt == 4:
                raise

            time.sleep(5 * (attempt + 1))

    if "hourly" not in data:

        raise ValueError(
            f"No hourly data returned for {location}"
        )

    hourly = data["hourly"]

    df = pd.DataFrame(hourly)

    # --------------------------------------------------------
    # Add geographic metadata
    # --------------------------------------------------------

    df["area"] = location
    df["requested_latitude"] = latitude
    df["requested_longitude"] = longitude

    # Actual grid location used by Open-Meteo
    df["grid_latitude"] = data.get("latitude")
    df["grid_longitude"] = data.get("longitude")

    df["source_model"] = MODEL

    # --------------------------------------------------------
    # Move metadata to beginning
    # --------------------------------------------------------

    first_columns = [
        "time",
        "area",
        "requested_latitude",
        "requested_longitude",
        "grid_latitude",
        "grid_longitude",
        "source_model",
    ]

    remaining_columns = [
        column
        for column in df.columns
        if column not in first_columns
    ]

    df = df[
        first_columns + remaining_columns
    ]

    print(
        f"Downloaded {len(df):,} rows "
        f"for {location}"
    )

    return df


# ============================================================
# 5. CLEAN DATA
# ============================================================

def clean_location_data(df):

    # --------------------------------------------------------
    # Convert timestamp
    # --------------------------------------------------------

    df["time"] = pd.to_datetime(
        df["time"],
        errors="coerce"
    )

    # Remove invalid timestamps
    df = df.dropna(
        subset=["time"]
    )

    # --------------------------------------------------------
    # Remove duplicate timestamps
    # --------------------------------------------------------

    df = df.drop_duplicates(
        subset=["area", "time"]
    )

    # --------------------------------------------------------
    # Sort chronologically
    # --------------------------------------------------------

    df = df.sort_values(
        ["area", "time"]
    )

    # --------------------------------------------------------
    # Numeric columns
    # --------------------------------------------------------

    numeric_columns = [
        "requested_latitude",
        "requested_longitude",
        "grid_latitude",
        "grid_longitude",
        "temperature_2m",
        "relative_humidity_2m",
        "dew_point_2m",
        "precipitation",
        "rain",
        "weather_code",
        "pressure_msl",
        "surface_pressure",
        "cloud_cover",
        "cloud_cover_low",
        "cloud_cover_mid",
        "cloud_cover_high",
        "wind_speed_10m",
        "wind_direction_10m",
        "wind_gusts_10m",
        "shortwave_radiation",
    ]

    for column in numeric_columns:

        if column in df.columns:

            df[column] = pd.to_numeric(
                df[column],
                errors="coerce"
            )

    # --------------------------------------------------------
    # Validate humidity
    # --------------------------------------------------------

    df.loc[
        (df["relative_humidity_2m"] < 0) |
        (df["relative_humidity_2m"] > 100),
        "relative_humidity_2m"
    ] = pd.NA

    # --------------------------------------------------------
    # Validate cloud cover
    # --------------------------------------------------------

    cloud_columns = [
        "cloud_cover",
        "cloud_cover_low",
        "cloud_cover_mid",
        "cloud_cover_high",
    ]

    for column in cloud_columns:

        df.loc[
            (df[column] < 0) |
            (df[column] > 100),
            column
        ] = pd.NA

    # --------------------------------------------------------
    # Validate wind direction
    # --------------------------------------------------------

    df.loc[
        (df["wind_direction_10m"] < 0) |
        (df["wind_direction_10m"] > 360),
        "wind_direction_10m"
    ] = pd.NA

    # --------------------------------------------------------
    # Validate non-negative variables
    # --------------------------------------------------------

    non_negative_columns = [
        "precipitation",
        "rain",
        "wind_speed_10m",
        "wind_gusts_10m",
        "shortwave_radiation",
    ]

    for column in non_negative_columns:

        df.loc[
            df[column] < 0,
            column
        ] = pd.NA

    # --------------------------------------------------------
    # We DON'T interpolate here.
    #
    # Keep the raw historical data intact.
    # We'll handle missing values during ML preprocessing.
    # --------------------------------------------------------

    df = df.sort_values(
        ["area", "time"]
    )

    df = df.reset_index(
        drop=True
    )

    return df


# ============================================================
# 6. CHECK HOURLY CONTINUITY
# ============================================================

def check_missing_hours(df):

    print()
    print("=" * 70)
    print("CHECKING HOURLY CONTINUITY")
    print("=" * 70)

    for area in df["area"].unique():

        area_df = df[
            df["area"] == area
        ].sort_values("time")

        expected = pd.date_range(
            start=area_df["time"].min(),
            end=area_df["time"].max(),
            freq="h"
        )

        actual = pd.DatetimeIndex(
            area_df["time"]
        )

        missing_hours = expected.difference(
            actual
        )

        print(
            f"{area:20} "
            f"Missing hours: {len(missing_hours):,}"
        )


# ============================================================
# 7. DATA QUALITY REPORT
# ============================================================

def print_quality_report(df):

    print()
    print("=" * 70)
    print("FINAL DATA QUALITY REPORT")
    print("=" * 70)

    print(
        f"\nTotal rows: "
        f"{len(df):,}"
    )

    print(
        f"Total columns: "
        f"{len(df.columns)}"
    )

    print(
        f"\nNumber of areas: "
        f"{df['area'].nunique()}"
    )

    print("\nRows per area:")

    print(
        df.groupby("area")
        .size()
        .sort_index()
    )

    print("\nDate range:")

    print(
        "Start:",
        df["time"].min()
    )

    print(
        "End:",
        df["time"].max()
    )

    print("\nDuplicate timestamps:")

    print(
        df.duplicated(
            subset=["area", "time"]
        ).sum()
    )

    print("\nMissing values:")

    missing = df.isnull().sum()

    print(
        missing[
            missing > 0
        ].sort_values(
            ascending=False
        )
    )


# ============================================================
# 8. MAIN PROGRAM
# ============================================================

def main():

    print()
    print("=" * 70)
    print("MUMBAI AREA HISTORICAL WEATHER DATASET")
    print("=" * 70)

    print(
        f"Period: "
        f"{START_DATE} -> {END_DATE}"
    )

    print(
        f"Areas: "
        f"{len(MUMBAI_AREAS)}"
    )

    raw_dir = BASE_DIR / "data" / "raw_areas"
    raw_dir.mkdir(parents=True, exist_ok=True)

    all_data = []

    # --------------------------------------------------------
    # Download every Mumbai area (with caching)
    # --------------------------------------------------------

    for i, (area, coordinates) in enumerate(MUMBAI_AREAS.items()):

        cache_file = raw_dir / f"{area}.csv"

        if cache_file.exists():
            print()
            print("=" * 70)
            print(f"Loading cached: {area}")
            print(f"File: {cache_file}")
            print("=" * 70)
            df = pd.read_csv(cache_file)
            print(f"Loaded {len(df):,} rows for {area} from cache.")
            all_data.append(df)
            continue

        try:

            df = download_location_weather(
                location=area,
                latitude=coordinates["latitude"],
                longitude=coordinates["longitude"]
            )

            df = clean_location_data(
                df
            )

            # Save individual area to cache immediately
            df.to_csv(cache_file, index=False)
            print(f"Saved {area} to cache: {cache_file}")

            all_data.append(
                df
            )

            # Polite pause between API calls to avoid rate limits
            if i < len(MUMBAI_AREAS) - 1:
                time.sleep(3)

        except Exception as error:

            print()
            print(
                f"ERROR downloading {area}"
            )
            print(error)

            if "429" in str(error):
                print(
                    "\n[NOTE] Open-Meteo hourly API request limit exceeded.\n"
                    "Progress has been preserved in 'data/raw_areas/'.\n"
                    "Generating dataset with successfully downloaded areas so far.\n"
                    "You can re-run this script later to automatically download remaining areas."
                )
                break


    # --------------------------------------------------------
    # Make sure something was downloaded
    # --------------------------------------------------------

    if not all_data:

        raise RuntimeError(
            "No weather data was downloaded."
        )

    # --------------------------------------------------------
    # Combine
    # --------------------------------------------------------

    final_df = pd.concat(
        all_data,
        ignore_index=True
    )

    # --------------------------------------------------------
    # Sort
    # --------------------------------------------------------

    final_df = final_df.sort_values(
        ["time", "area"]
    )

    final_df = final_df.reset_index(
        drop=True
    )

    # --------------------------------------------------------
    # Quality checks
    # --------------------------------------------------------

    check_missing_hours(
        final_df
    )

    print_quality_report(
        final_df
    )

    # --------------------------------------------------------
    # Save
    # --------------------------------------------------------

    output_path = Path(
        OUTPUT_FILE
    )

    output_path.parent.mkdir(
        parents=True,
        exist_ok=True
    )

    print(f"\nSaving dataset to {output_path} ...")
    final_df.to_csv(
        output_path,
        index=False
    )

    print()
    print("=" * 70)
    print("DOWNLOAD + CLEANING COMPLETE")
    print("=" * 70)

    print(
        f"\nOutput file:"
        f"\n{output_path}"
    )

    print(
        f"\nTotal rows:"
        f" {len(final_df):,}"
    )

    print(
        f"Total columns:"
        f" {len(final_df.columns)}"
    )

    print("\nFirst 10 rows:")

    print(
        final_df.head(10)
        .to_string(index=False)
    )


# ============================================================
# 9. RUN
# ============================================================

if __name__ == "__main__":
    main()
