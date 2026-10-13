import logging
import time
from datetime import datetime

import pandas as pd
import requests

logger = logging.getLogger(__name__)

API_URL = "https://api.open-meteo.com/v1/forecast"
LOCATION = {"name": "Mumbai (South Mumbai)", "latitude": 18.9220, "longitude": 72.8347}
TIMEZONE = "Asia/Kolkata"
CACHE_SECONDS = 600          # live data changes every 15 min; don't call the API on every question

# WMO weather codes used by Open-Meteo -> plain words
WEATHER_CODES = {
    0: "clear sky", 1: "mainly clear", 2: "partly cloudy", 3: "overcast",
    45: "fog", 48: "freezing fog",
    51: "light drizzle", 53: "drizzle", 55: "heavy drizzle",
    61: "light rain", 63: "rain", 65: "heavy rain",
    80: "light rain showers", 81: "rain showers", 82: "violent rain showers",
    95: "thunderstorm", 96: "thunderstorm with hail", 99: "severe thunderstorm with hail",
}


class ToolError(RuntimeError):
    """The tool could not get its data. The message is safe to show to the LLM / user."""


_cache: dict = {"time": 0.0, "data": None}


def _fetch() -> dict:
    """One API call with current, hourly (yesterday + today) and daily data. Cached for 10 minutes."""
    if _cache["data"] is not None and time.time() - _cache["time"] < CACHE_SECONDS:
        return _cache["data"]

    params = {
        "latitude": LOCATION["latitude"],
        "longitude": LOCATION["longitude"],
        "timezone": TIMEZONE,
        "current": "temperature_2m,apparent_temperature,relative_humidity_2m,precipitation,"
                   "weather_code,cloud_cover,wind_speed_10m",
        "hourly": "temperature_2m,shortwave_radiation,precipitation,precipitation_probability",
        "daily": "temperature_2m_max,temperature_2m_min",
        "past_days": 1,
        "forecast_days": 2,
    }
    for attempt in range(1, 4):
        try:
            response = requests.get(API_URL, params=params, timeout=10)
            response.raise_for_status()
            data = response.json()
            for key in ("current", "hourly", "daily"):
                if key not in data:
                    raise ToolError(f"Weather API reply is missing '{key}'.")
            _cache.update(time=time.time(), data=data)
            return data
        except (requests.Timeout, requests.ConnectionError) as error:
            logger.warning("Weather API not reachable (attempt %d/3): %s", attempt, error)
            time.sleep(2 * attempt)
        except requests.HTTPError as error:
            logger.error("Weather API error: %s", error)
            raise ToolError(f"The weather service returned an error ({error.response.status_code}).") from error
    raise ToolError("The live weather service is not reachable right now.")


def get_live_weather() -> dict:
    """Current Mumbai weather, the next 6 hours and today's max/min, in plain units."""
    data = _fetch()
    now = data["current"]

    hourly = pd.DataFrame(data["hourly"])
    hourly["time"] = pd.to_datetime(hourly["time"])
    current_time = datetime.fromisoformat(now["time"])
    upcoming = hourly[hourly["time"] > current_time].head(6)

    today = data["daily"]["time"].index(now["time"][:10])
    return {
        "location": LOCATION["name"],
        "observed_at": now["time"].replace("T", " ") + " IST",
        "now": {
            "temperature_c": now["temperature_2m"],
            "feels_like_c": now["apparent_temperature"],
            "humidity_pct": now["relative_humidity_2m"],
            "rain_last_15min_mm": now["precipitation"],
            "cloud_cover_pct": now["cloud_cover"],
            "wind_kmh": now["wind_speed_10m"],
            "condition": WEATHER_CODES.get(now["weather_code"], f"weather code {now['weather_code']}"),
        },
        "next_hours": [
            {"time": t.strftime("%H:%M"), "temperature_c": temp, "chance_of_rain_pct": prob}
            for t, temp, prob in zip(upcoming["time"], upcoming["temperature_2m"],
                                     upcoming["precipitation_probability"])
        ],
        "today": {
            "max_c": data["daily"]["temperature_2m_max"][today],
            "min_c": data["daily"]["temperature_2m_min"][today],
        },
        "source": "Open-Meteo forecast API (live model data)",
    }


def recent_hours(hours: int = 24) -> pd.DataFrame:
    """The last `hours` complete hours (oldest first): temperature, sunlight, rain. Used by the Day 1 model."""
    data = _fetch()
    df = pd.DataFrame(data["hourly"])
    df["time"] = pd.to_datetime(df["time"])
    current_time = datetime.fromisoformat(data["current"]["time"])
    past = df[df["time"] <= current_time].set_index("time").tail(hours)
    past = past[["temperature_2m", "shortwave_radiation", "precipitation"]]
    if len(past) < hours or past.isna().any().any():
        raise ToolError(f"Not enough recent hourly data (got {len(past)} of {hours} hours).")
    return past
