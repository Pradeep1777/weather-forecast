import logging

from langchain_core.tools import tool

from rag.config import get_settings
from rag.retrieval import ServiceUnavailable, retrieve
from tools.live_weather import ToolError
from tools.live_weather import get_live_weather as _live_weather
from tools.temperature_model import backtest_temperature as _backtest
from tools.temperature_model import predict_next_hour_temperature as _predict

logger = logging.getLogger(__name__)


@tool
def get_live_weather() -> dict:
    """LIVE Mumbai weather right now: temperature, feels-like, humidity, rain, clouds, wind and condition,
    plus Open-Meteo's forecast for the next 6 hours (temperature, chance of rain) and today's max/min."""
    try:
        return _live_weather()
    except ToolError as error:
        logger.warning("get_live_weather failed: %s", error)
        return {"error": str(error)}


@tool
def predict_next_hour_temperature() -> dict:
    """Our own trained ML model (Day 1, gradient boosting): predicts Mumbai's temperature for the NEXT HOUR
    from the last 24 hours of live data."""
    try:
        return _predict()
    except ToolError as error:
        logger.warning("predict_next_hour_temperature failed: %s", error)
        return {"error": str(error)}


@tool(parse_docstring=True)
def backtest_temperature(date_time: str) -> dict:
    """Check our trained ML model on a PAST hour in Mumbai (1980-2025): the model predicts that hour from the
    24 real hours before it (ERA5 history), and the result is compared with the real temperature and with the
    lazy guess (next hour = now). Use for questions about a specific past date, or to test the model's accuracy.

    Args:
        date_time: the hour to predict, Mumbai local time, as "YYYY-MM-DD HH:00", e.g. "2025-01-29 10:00"
    """
    try:
        return _backtest(date_time)
    except ToolError as error:
        logger.warning("backtest_temperature failed: %s", error)
        return {"error": str(error)}


@tool(parse_docstring=True)
def search_imd_documents(query: str) -> dict:
    """Search the official IMD (India Meteorological Department) reference documents: heat wave and cold wave
    criteria, rainfall intensity categories, monsoon facts, cyclone terminology, warning colour codes and
    safety advice. Use for definitions, thresholds, rules and official guidance.

    Args:
        query: what to look up, written as a short question, e.g. "heat wave criteria for coastal stations"
    """
    try:
        hits = retrieve(query)
    except ServiceUnavailable as error:
        logger.warning("search_imd_documents failed: %s", error)
        return {"error": str(error)}

    best = float(hits[0]["score"]) if hits else 0.0
    if best < get_settings().min_score:
        return {"found": False, "note": "No relevant passage in the IMD documents.", "best_score": round(best, 3)}
    return {
        "found": True,
        "passages": [{
            "chunk_id": h["chunk_id"],
            "document": h["doc_title"],
            "pages": f"{h['page_start']}-{h['page_end']}",
            "url": h["source_url"],
            "score": round(float(h["score"]), 3),
            "text": h["content"],
        } for h in hits],
    }


TOOLS = [get_live_weather, predict_next_hour_temperature, backtest_temperature, search_imd_documents]
