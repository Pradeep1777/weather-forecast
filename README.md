# Weather Intelligence Assistant

A weather assistant for **Mumbai**: ask a question in plain English and an agent answers it with
**live weather data**, **our own trained forecast model**, or the **official IMD documents** (with sources).

```
question ──► agent (LangGraph + Gemini) ──► picks the tools it needs ──► answer + tools used + sources
                                             ├─ get_live_weather              live data (Open-Meteo)
                                             ├─ predict_next_hour_temperature our ML model (Day 1), next hour
                                             ├─ backtest_temperature          our ML model on a past hour vs reality
                                             └─ search_imd_documents          RAG over IMD PDFs (pgvector)
```

## Quick start (Docker, one command)

Needs Docker Desktop and a free Gemini API key (https://aistudio.google.com → Get API key).

```bash
git clone <repo-url>
cd weather-intelligence-assistant

cp .env.example .env          # then fill in GEMINI_API_KEY and POSTGRES_PASSWORD (any password)
docker compose up -d --build --wait   # builds the API, starts the database, loads the knowledge base;
                                      # --wait: returns only when both containers are healthy (~20 s)
```

When the command finishes, both containers are **healthy** (check any time with `docker compose ps`). Then:

| What | How |
|---|---|
| Try the API in the browser | http://localhost:8001/docs → `POST /ask` → *Try it out* |
| Health check | http://localhost:8001/health → `{"status": "ok", "database": true}` |
| Chat in the terminal (remembers the conversation) | `docker compose exec api python chat.py` |
| Logs | `docker compose logs -f api` |
| Stop | `docker compose down` (the database keeps its data) |

```bash
curl -X POST http://localhost:8001/ask -H "Content-Type: application/json" \
     -d '{"question": "Is it a heat wave in Mumbai right now?"}'
```
```json
{"status": "answered",
 "answer": "Mumbai's current temperature is 35.6°C ... a heat wave for coastal stations requires 37°C or more [heat_faq-004] ...",
 "tools_used": ["get_live_weather", "search_imd_documents"],
 "sources": [{"chunk_id": "heat_faq-004", "document": "IMD: FAQ on Heat Wave", "pages": "2-2", "url": "https://mausam.imd.gov.in/..."}],
 "steps": 5}
```

## The `/ask` endpoint

| Request | Response |
|---|---|
| weather question about Mumbai | `200`, `status: answered`, answer + `tools_used` + `sources` (IMD document, pages, link) |
| greeting, other city, off-topic | `200`, a short polite answer, no tools |
| empty / missing / not text / too long / bad JSON | `422`, `status: invalid_input` with a clear message |
| Gemini unreachable or out of quota | `503`, `status: error` (logged) |
| database down | `200`, the agent says the documents are unavailable (logged) |

## Example questions

| Question | Tools the agent uses |
|---|---|
| How hot is it in Mumbai right now? | `get_live_weather` |
| What will the temperature be in one hour? | `predict_next_hour_temperature` |
| What counts as very heavy rainfall? | `search_imd_documents` → 115.6–204.4 mm in 24 h |
| Is it a heat wave in Mumbai now? | live weather **and** IMD criteria |
| Predict 10:00 on 29 January 2025 and compare with reality | `backtest_temperature` → prediction, real value, error |
| What's the weather in Delhi? | none: "I only cover Mumbai" |

## How it was built

### 1. Temperature forecast model (F1)

Predicts Mumbai's temperature **1 hour ahead** from hourly ERA5 data (1980–2025), with gradient boosting
on 6 features: `temp_now`, `temp_3h_ago`, `temp_avg_24h`, `sunlight`, `rain`, `hour`
(defined once in `src/tools/features.py`, used by training **and** by the live prediction tool).

| Split | Period | Used for |
|---|---|---|
| Train | 1980 – 2021 | fitting the model |
| Validation | 2022 – 2023 | checking the settings |
| Test | 2024 – 2025 | final score (used once) |

| Test set 2024–2025 | RMSE | MAE |
|---|---|---|
| Lazy guess ("next hour = now") | 0.850 °C | 0.567 °C |
| **HistGradientBoosting** | **0.412 °C** | **0.297 °C** (51.6 % better) |

Full numbers: `reports/metrics.json`.

### 2. RAG over IMD documents (F2)

IMD heat-wave FAQ, monsoon FAQ, cyclone terminology and the forecasting SOP (§1.7 + chapter 7)
→ cleaned and cut at their own structure (questions, section numbers, glossary terms) → **219 chunks**
→ Gemini embeddings (768 numbers each) → PostgreSQL + **pgvector** (`weather_rag` schema, HNSW cosine index).
A search only counts as a match above a similarity of 0.6; the agent must cite the chunk ids it used,
and citations of chunks that were not retrieved are dropped.

### 3. Agent (F3, F4)

A LangGraph loop: Gemini decides which tools to call, the tools run, Gemini writes the answer from their
results. Rules: Mumbai only, facts only from tools, cite IMD sources, say so when data is unavailable.
At most 8 steps per question; a backup Gemini model is used when the first one is overloaded.

## Run without Docker (for development)

Needs Python 3.12.

```bash
python -m venv .venv
.venv\Scripts\activate             # macOS / Linux: source .venv/bin/activate
pip install -r requirements-dev.txt
pip install -e . --config-settings editable_mode=compat   # so `import agent, rag, tools` works everywhere

docker compose up -d db            # only the database
python src/build_kb.py             # load the knowledge base (~5 s, no Gemini calls)
python chat.py                     # terminal chat
uvicorn app:app --app-dir src --port 8001   # or the API
```

Rebuild everything from the original sources:

```bash
python download_weather.py         # ~1-2 min: hourly ERA5 data -> data/mumbai_area_weather_1980_2025.csv
python src/train.py                # ~10 s: clean, train, test -> models/gb_simple_h1.joblib + reports/metrics.json
python src/build_kb.py --rebuild   # PDFs (missing ones are downloaded from IMD) -> chunks -> embeddings -> pgvector
                                   # only new or changed chunks are sent to Gemini
```

## Experiment tracking (MLflow)

Every `python src/train.py` run is logged to a local MLflow logbook (`mlflow.db` + `mlruns/`, git-ignored):
parameters (learning rate, max_iter, features, data period), metrics (validation/test RMSE and MAE, the lazy
guess, improvement %), `metrics.json` and the model itself.

```bash
pip install -r requirements-dev.txt                        # includes mlflow
python src/train.py                                        # trains and logs a run
python -m mlflow ui --backend-store-uri sqlite:///mlflow.db --port 5000   # http://localhost:5000
python src/train.py --no-mlflow                            # train without logging
python src/train.py --config experiments/exp_001_baseline.yaml   # train with another experiment file
```

**Experiment files:** the model settings live in `experiments/*.yaml`, one file per iteration (never edit a file after
it has run: copy it to a new number). `python src/train.py` uses the current best, `exp_002_iter600.yaml`. Each MLflow
run is named after its file and stores the YAML (artifact `config/`) and the git commit (tag `git_sha`).

**Quality gate:** `train.py` replaces `models/gb_simple_h1.joblib` and `reports/metrics.json` only if the new model
beats the lazy guess and is not worse than the current model on the test set. A rejected run is still logged
(tags `quality_gate` and `quality_gate_reason`) but the saved model stays as it was. Compare runs on `val_rmse`
and use the test number only for the final check.

**Model Registry:** every accepted model is also registered in MLflow as a new version of `mumbai-temperature`, and
the alias `champion` moves to it (version tags: experiment, val/test RMSE, run id). Rejected runs are not registered.
Load the live model by name instead of by file: `mlflow.sklearn.load_model("models:/mumbai-temperature@champion")`.

MLflow is a development tool only: the Docker image and the API do not need it, and `train.py` still works
when it is not installed.

## Project layout

```
src/app.py               FastAPI: POST /ask, GET /health
src/agent/               LangGraph agent (graph.py) and its 4 tools (tools.py)
src/tools/               live weather API, the forecast model tool, the shared model features
src/rag/                 settings, retrieval (pgvector), chunking, embeddings, grounded answers
src/train.py, data.py    train the forecast model
src/build_kb.py          build the knowledge base
chat.py                  terminal chat with conversation memory
download_weather.py      download the ERA5 training data
sql/001_schema.sql       the pgvector schema
notebooks/               every step, one notebook each, with outputs (day1 -> day3.4)
data/, models/           small built files (219 chunks + embeddings, the 1 MB model); big data is downloaded
docs/reference/          IMD source PDFs (the 22 MB SOP is downloaded when needed)
Dockerfile, docker-compose.yml
```

## Notes

- **Secrets** live only in `.env` (git-ignored); `.env.example` shows the keys. The database and API
  ports are bound to `127.0.0.1`, so other computers on the network cannot reach them.
- **One location.** ERA5 has ~28 km resolution, so all Mumbai points fall in the same grid cell
  (checked in `notebooks/day1_data_exploration.ipynb`).
- **No leakage.** Features at time *t* use only data from *t* and earlier; splits are by time, never shuffled.
- **Live vs training data.** Training uses ERA5 history, live predictions use the Open-Meteo forecast API:
  a different source, so the live error is a little higher than the test error (checked in `day3.3`).
- **scikit-learn is pinned to 1.6.1** because newer Windows wheels were blocked by the dev laptop's
  Application Control policy.
- **Free Gemini tier** (~15 requests/minute): the code waits and retries when the limit is hit, so an
  answer can occasionally take 30+ seconds.
