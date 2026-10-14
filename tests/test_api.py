import pytest
from fastapi.testclient import TestClient

import app as api
from agent import tools as agent_tools
from rag import ServiceUnavailable
from rag.config import get_settings
from tools.live_weather import ToolError


@pytest.fixture(autouse=True)
def fake_settings(monkeypatch):
    """CI has no .env: give the settings fake values, so nothing real (Gemini, the database) is ever reached."""
    for name, value in {"GEMINI_API_KEY": "test-key", "POSTGRES_USER": "test", "POSTGRES_PASSWORD": "test",
                        "POSTGRES_DB": "test", "POSTGRES_HOST": "localhost", "POSTGRES_PORT": "1"}.items():
        monkeypatch.setenv(name, value)
    get_settings.cache_clear()
    yield
    get_settings.cache_clear()


@pytest.fixture
def client():
    # raise_server_exceptions=False: see the 500 response the user would get, instead of the Python error
    return TestClient(api.app, raise_server_exceptions=False)


def stub_agent(monkeypatch, result=None, error=None):
    """Replace the real agent (Gemini + tools) with a stub that answers instantly; returns the questions it got."""
    asked = []

    def fake_run_agent(question, history=None):
        asked.append(question)
        if error:
            raise error
        return result
    monkeypatch.setattr(api, "run_agent", fake_run_agent)
    return asked


ANSWER = {
    "status": "answered",
    "answer": "A heat wave is declared when ...",
    "tools_used": ["search_imd_documents"],
    "sources": [{"chunk_id": "heat_faq_003", "document": "FAQ Heat Wave", "pages": "2-2", "url": "https://example.org"}],
    "steps": 3,
    "messages": ["the conversation, not part of the API answer"],
}


# --- /ask: good input ----------------------------------------------------------------------------

def test_ask_returns_the_agent_answer(client, monkeypatch):
    asked = stub_agent(monkeypatch, result=dict(ANSWER))
    response = client.post("/ask", json={"question": "  What is a heat wave?  "})
    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "answered"
    assert body["tools_used"] == ["search_imd_documents"]
    assert body["sources"][0]["chunk_id"] == "heat_faq_003"
    assert "messages" not in body                 # conversation memory is not sent back by the API
    assert asked == ["What is a heat wave?"]      # spaces trimmed before the agent sees the question


# --- /ask: bad input never reaches the agent ------------------------------------------------------

@pytest.mark.parametrize("payload, expected", [
    ({"question": "   "}, "must not be empty"),
    ({"question": "x" * 501}, "too long"),
    ({}, "Please send JSON"),
    ({"question": 123}, "must be text"),
], ids=["empty", "too-long", "missing-field", "not-text"])
def test_ask_rejects_bad_input(client, monkeypatch, payload, expected):
    asked = stub_agent(monkeypatch, result=dict(ANSWER))
    response = client.post("/ask", json=payload)
    assert response.status_code == 422
    assert response.json()["status"] == "invalid_input"
    assert expected in response.json()["answer"]
    assert asked == []


def test_ask_rejects_broken_json(client, monkeypatch):
    stub_agent(monkeypatch, result=dict(ANSWER))
    response = client.post("/ask", content="{not json", headers={"Content-Type": "application/json"})
    assert response.status_code == 422
    assert "not valid JSON" in response.json()["answer"]


# --- /ask: failures ------------------------------------------------------------------------------

def test_ask_returns_503_when_gemini_is_down(client, monkeypatch):
    stub_agent(monkeypatch, error=ServiceUnavailable("The language model is not reachable right now."))
    response = client.post("/ask", json={"question": "Will it rain today?"})
    assert response.status_code == 503
    assert response.json()["status"] == "error"
    assert "try again" in response.json()["answer"]


def test_ask_hides_unexpected_errors(client, monkeypatch):
    stub_agent(monkeypatch, error=RuntimeError("secret internal detail"))
    response = client.post("/ask", json={"question": "Will it rain today?"})
    assert response.status_code == 500
    assert response.json()["answer"] == "Something went wrong on our side."
    assert "secret" not in response.text


# --- /health -------------------------------------------------------------------------------------

@pytest.mark.parametrize("db_ok, code, status", [(True, 200, "ok"), (False, 503, "degraded")])
def test_health_reports_the_database(client, monkeypatch, db_ok, code, status):
    monkeypatch.setattr(api, "database_ok", lambda: db_ok)
    response = client.get("/health")
    assert response.status_code == code
    assert response.json() == {"status": status, "database": db_ok}


# --- tools: a failing service gives {"error": ...}, never a crash ---------------------------------

def test_document_search_reports_a_database_problem(monkeypatch):
    def database_down(query):
        raise ServiceUnavailable("The document database is not reachable.")
    monkeypatch.setattr(agent_tools, "retrieve", database_down)
    assert agent_tools.search_imd_documents.invoke({"query": "heat wave"}) == {
        "error": "The document database is not reachable."}


def test_document_search_says_not_found_below_the_score_gate(monkeypatch):
    monkeypatch.setattr(agent_tools, "retrieve", lambda query: [{"score": 0.2}])
    result = agent_tools.search_imd_documents.invoke({"query": "football scores"})
    assert result["found"] is False


def test_live_weather_reports_an_api_problem(monkeypatch):
    def api_down():
        raise ToolError("Open-Meteo is not reachable.")
    monkeypatch.setattr(agent_tools, "_live_weather", api_down)
    assert agent_tools.get_live_weather.invoke({}) == {"error": "Open-Meteo is not reachable."}
