# Weather Intelligence Assistant: Learning & Build Plan

This plan follows the PRD (`docs/prd.pdf`), Days 1–5, requirements F1–F7.
It is set up as a **tutoring plan**: every step starts with learning, and code only gets written after that.

---

## How we work (the loop for every lesson)

1. **Learn**: watch or read the linked resources for the concept.
2. **Check**: answer 2–4 short questions in your own words. If an answer is shaky, we go back to step 1.
3. **Design**: you describe the logic in plain words or pseudocode (what goes in, what comes out, which steps).
4. **Write**: the AI turns your design into code, keeping it small (one function or file section at a time).
5. **Explain back**: you read the code and explain each line or block. Anything you can't explain gets rewritten or simplified.
6. **Run & verify**: run it, look at the output, and confirm it matches what you expected.
7. **Commit**: one git commit per finished lesson, with a message you write.

> Rule: one lesson per session turn. We don't move on until the "Done when" box is ticked.

---

## Part A: Codebase audit (state as of 2026-10-03)

### What exists and works
| File | Status | Notes |
|---|---|---|
| `download_weather.py` (root) | ✅ Works | Downloads hourly ERA5 data from the Open-Meteo archive API for Mumbai areas (1980–2025). Has caching, retries, validation, and a quality report. |
| `data/mumbai_area_weather_1980_2025.csv` | ✅ Exists | 173 MB, ~1.2M rows, 23 columns, **0 missing values**. Only **3 of the 10** areas were downloaded (the API rate limit hit). |
| `data/raw_areas/*.csv` | ✅ Cache | South, Central, Western Mumbai (~403k hourly rows each). |
| `src/train.py` | ✅ Works | Lag features → time-based split at 2024-01-01 → Ridge regression → saves `models/baseline_temperature_model.joblib`. |
| `models/baseline_temperature_model.joblib` | ✅ Exists | Test RMSE **0.635 °C** vs persistence **0.850 °C** (**25.3% better**). On paper, F1 is already met. |

### Empty or placeholder files
`README.md`, `.gitignore`, `src/evaluate.py`, `notebooks/day1_exploration.ipynb`, `src/data_processing.ipynb`, and `models/weather_model.pkl` are all **0 bytes**.

### Problems found (we fix these during Day 1, and each one is a lesson)
1. **The three "areas" are effectively the same data.** All three map to the same ERA5 grid cell `(19.0, 73.0)`. South_Mumbai and Western_Mumbai temperatures are **100% identical** in every hour. Central differs by only 0.05 °C on average. ERA5 has ~0.25° (~28 km) resolution, so points a few km apart land on the same cell. The model trains on the same rows three times, and the "spatial variation" claim isn't real. Multi-region forecasting is also a PRD non-goal.
2. **Not a git repository.** Nothing is committed yet, and "reproducible from a clean clone" needs git.
3. **The data file can't go to GitHub.** It is 173 MB and GitHub rejects files over 100 MB. The clean-clone path has to **re-download** the data with a script, so `data/` must be git-ignored.
4. **`download_weather.py` exists twice** (root and `src/`). The `src/` copy has a path bug: `BASE_DIR` points at `src/`, so it would write to `src/data/`.
5. **Unpinned dependencies and no virtual environment.** The model was saved with scikit-learn **1.9.1**, but the global Python has **1.6.1**. Loading it prints an `InconsistentVersionWarning`. That is exactly the "hidden local dependency" the PRD forbids.
6. **No validation set.** `train.py` has only train/test. If we tune anything (alpha, model type), we must tune on a validation slice, not the test set.
7. **Calendar features are raw integers.** `hour = 23` and `hour = 0` are numerically far apart but are neighbours in time. Cyclic (sin/cos) encoding fixes this.
8. **The horizon is only 1 hour ahead.** Persistence is very strong at 1 h, so "beating the baseline" is easy. A forecast that is useful to the Day 3 agent ("what will tomorrow look like?") probably needs a longer horizon. This is a design decision for Lesson 1.4.
9. **`print` instead of `logging`.** The PRD's robustness requirement says errors are logged. We switch to `logging` on Day 1 so it's a habit by Day 5.
10. **Leftover files.** `data/weather.csv` is Berlin sample data (lat 52.5, lon 13.4) and is unrelated to the project. `models/weather_model.pkl` is empty.
11. **Ownership.** The PRD says *"no requirement may be satisfied by code someone else wrote."* You must be able to explain every line of `train.py`. In Lessons 1.3–1.6 you rebuild it step by step yourself, and the current file serves only as a reference to check against.

---

## Part B: Day 1, Baseline Model (F1) ← **we are here**

**Deliverable:** a model that beats a naive baseline on a held-out test set and is reproducible from a clean clone.

### Lesson 1.0: Project hygiene (venv, git, requirements)
- **Learn**
  - 🎥 Corey Schafer: [VENV on Windows](https://www.youtube.com/watch?v=APOPm01BVrk)
  - 🎥 Corey Schafer: [Git Tutorial for Beginners: Command-Line Fundamentals](https://www.youtube.com/watch?v=HVsySz-h9r4)
  - 📄 [Python docs: venv](https://docs.python.org/3/library/venv.html)
- **Check:** Why does a venv fix problem #5? What does `.gitignore` do? Why pin `scikit-learn==x.y.z`?
- **Build:** `git init`; create `.venv`; pinned `requirements.txt`; a real `.gitignore` (venv, `data/`, models, `__pycache__`); delete the duplicate downloader and the leftover files; first commit.
- **Done when:** ☐ `pip install -r requirements.txt` works in a fresh venv ☐ first commit made

### Lesson 1.1: Know your data (EDA with pandas)
- **Learn**
  - 🎥 Corey Schafer: [Pandas playlist](https://www.youtube.com/playlist?list=PLSLQ7uyfNIItZf404-TviaeM01pnebr5K). Parts 1–3, 9 (cleaning), and **10 (dates & time series)** are essential.
  - 📄 [Open-Meteo Historical Weather API docs](https://open-meteo.com/en/docs/historical-weather-api) (read the ERA5 resolution section)
- **Check:** What is a reanalysis dataset? Why do three different coordinates give the same numbers?
- **Build:** fill in `notebooks/day1_data_exploration.ipynb` (originally `day1_exploration.ipynb`): load data, `.describe()`, plot temperature over a week, a year, and 45 years, find the daily and seasonal cycles, and **prove problem #1 yourself**.
- **Decide:** keep one location (recommended) or download genuinely distant points?
- **Done when:** ☐ you can explain the daily and seasonal pattern of Mumbai temperature ☐ the dataset decision is made

### Lesson 1.2: What a "naive baseline" is and how to score forecasts
- **Learn**
  - 📄 Forecasting: Principles & Practice (free book): [5.8 Evaluating point forecast accuracy](https://otexts.com/fpp3/accuracy.html). Read the naive / seasonal naive parts and MAE vs RMSE.
  - 📄 FPP2: [3.4 Evaluating forecast accuracy](https://otexts.com/fpp2/accuracy.html)
- **Check:** What is persistence? What is *seasonal* naive (t − 24 h)? When does RMSE punish more than MAE?
- **Build:** a `baselines.py` with persistence and seasonal-naive, scored on the test period.
- **Done when:** ☐ you can state both baseline numbers and say which is harder to beat

### Lesson 1.3: Time-series features and data leakage
- **Learn**
  - 📄 scikit-learn: [Lagged features for time series forecasting](https://scikit-learn.org/stable/auto_examples/applications/plot_time_series_lagged_features.html)
  - 📄 [scikit-learn: Common pitfalls (data leakage)](https://scikit-learn.org/stable/common_pitfalls.html)
  - 📄 [Lag selection guide](https://temporalcv.readthedocs.io/en/latest/tutorials/lag_selection.html) (optional)
- **Check:** Why `groupby(...).shift()`? Why is a random shuffle split cheating for time series? Why sin/cos for hour and month?
- **Build:** a `features.py` with lags, diffs, rolling means, and cyclic calendar features.
- **Done when:** ☐ you can point at every feature and say *"this only uses information available at time t"*

### Lesson 1.4: Forecast horizon and train/validation/test split
- **Learn:** the same FPP chapter (train/test sets for time series), plus [scikit-learn `TimeSeriesSplit`](https://scikit-learn.org/stable/modules/generated/sklearn.model_selection.TimeSeriesSplit.html)
- **Check:** Why do we need a validation set if we already have a test set?
- **Decide:** horizon of 1 h, 24 h, or several horizons (affects the Day 3 tool).
- **Build:** split into train (≤ 2021), validation (2022–2023), and test (2024–2025).

### Lesson 1.5: Linear model → Ridge regression
- **Learn**
  - 🎥 StatQuest: [Linear Regression, Clearly Explained](https://www.youtube.com/watch?v=7ArmBVF2dCs)
  - 🎥 StatQuest: [Regularization Part 1: Ridge (L2) Regression](https://www.youtube.com/watch?v=Q81RR3yKn30)
  - 🎥 StatQuest: [Ridge vs Lasso, Visualized](https://www.youtube.com/watch?v=Xm2C_gTAl8c)
- **Check:** What does `alpha` control? Why does feature scaling matter for Ridge? (→ `Pipeline` + `StandardScaler`)
- **Build:** a rewritten `src/train.py` with a scaled Ridge pipeline, alpha tuned on validation, and `logging`.

### Lesson 1.6: A stronger model (gradient boosting)
- **Learn:** 🎥 StatQuest: [Gradient Boost Part 1: Regression Main Ideas](https://www.youtube.com/watch?v=3CC4N4z3GJc)
- **Check:** How is a tree ensemble different from a line? Why can trees handle `hour` without sin/cos?
- **Build:** compare Ridge with `HistGradientBoostingRegressor` on validation, pick the winner, and evaluate on test **once**.

### Lesson 1.7: `evaluate.py` and the metrics report
- **Build:** `src/evaluate.py` loads the saved model, recomputes the metrics against both baselines, writes `reports/metrics.json`, and plots predicted vs actual.
- **Done when:** ☐ the model beats both baselines on the test set, with numbers in the report

### Lesson 1.8: Reproducible from a clean clone
- **Learn:** what "clean clone" means: no data, no models, no venv, only what's in git.
- **Build:** a `README.md` with the exact commands (`venv → pip install → download → train → evaluate`), fixed `random_state`, then push to GitHub.
- **Test it:** clone into a temp folder and run the README commands word for word.
- **Done when:** ☐ the clean clone reproduces the metrics ✅ **Day 1 / F1 complete**

---

## Part C: Days 2–5 (outline; detailed lessons are written when we arrive)

> Video links for these days get verified and added at the start of each day, so they're current.

### Day 2: RAG + `/ask` endpoint (F2, F3)
- **Concepts:** REST APIs and FastAPI; PostgreSQL basics; embeddings; text chunking; vector similarity (cosine); pgvector; the RAG pattern; grounding and "I don't know" answers.
- **Decision (2026-10-04):** use **Google Gemini** for both embeddings and answers (user's available key; stored in `.env`, never committed).
- **Starting resources:** [FastAPI tutorial](https://fastapi.tiangolo.com/tutorial/) · [pgvector README](https://github.com/pgvector/pgvector) · [Open-Meteo docs](https://open-meteo.com/en/docs)
- **Build:** Postgres + pgvector in Docker → collect reference docs (e.g. IMD warning criteria, heat/rain severity definitions) → chunk → embed → store → retrieve top-k → LLM answers with citations → `POST /ask` with input validation (Pydantic).
- **Deliverable:** grounded answers for ≥ 3 test questions, and empty or garbage input handled gracefully.

### Day 3: Agents & tool use (F4)
- **Concepts:** LLM tool/function calling; JSON schema; prompt engineering (few-shot, structured output); LangGraph state graphs and routing.
- **Build:** tools `get_live_weather` (Open-Meteo forecast API) and `predict_temperature` (**the Day 1 model**) → an agent decides between tool, RAG, or a plain answer → wire it into `/ask`.
- **Deliverable:** the agent calls the tool for "current/forecast" questions and answers gracefully when no tool applies.

### Day 4: Fine-tuning (F5)
- **Concepts:** classification metrics (accuracy, F1, confusion matrix); zero-shot baseline; transfer learning; Hugging Face Transformers; LoRA/PEFT; quantization basics.
- **Starting resources:** [Hugging Face LLM course](https://huggingface.co/learn/llm-course) · [PEFT docs](https://huggingface.co/docs/peft)
- **Build:** a labeled severity dataset (e.g. labels derived from weather thresholds + text descriptions) → zero-shot LLM baseline → LoRA fine-tune of a small model (e.g. DistilBERT) → the same test set → a comparison table.
- **Deliverable:** a measurable accuracy/F1 improvement over zero-shot.

### Day 5: Docker, tests, demo (F6, F7)
- **Concepts:** Dockerfile layers; images vs containers; env vars and secrets (`.env`, never commit keys); pytest and FastAPI `TestClient`; structured logging.
- **Starting resources:** [Docker get started](https://docs.docker.com/get-started/) · [FastAPI testing](https://fastapi.tiangolo.com/tutorial/testing/) · [pytest docs](https://docs.pytest.org/)
- **Build:** Dockerfile + docker-compose (app + pgvector) → ≥ 2 pytest tests for `/ask` → clean-clone dry run → demo script (`/ask`, tool use, fine-tune comparison).
- **Deliverable:** `docker run` works from a clean clone, tests pass, live demo.

---

## Part D: MLOps track (decided 2026-10-10)

Decisions: lessons M1-M3 only (M4 data checks, M5 monitoring, M6 CI not now); MLOps BEFORE pytest;
full tutor mode (concept + docs, questions, then build, one lesson per turn); MLflow runs stay local
(mlflow.db git-ignored, only code is pushed). MLflow goes in requirements-dev.txt, not the Docker image.
No PyTorch / no fine-tuning (F5 open by choice).

### Lesson M1: Experiment tracking with MLflow
- **Concept:** run, parameters, metrics, artifacts, tags; tracking store (local `mlflow.db`); the UI.
- **Build:** install check (Application Control!), `train.py` logs params + metrics + metrics.json + model;
  still works without MLflow (`--no-mlflow`, clean clone, Docker).
- **Done when:** one run visible in `mlflow ui` with the same test RMSE as `reports/metrics.json` (0.4116).

### Lesson M2: Running and comparing experiments
- **Concept:** change one thing at a time; compare on validation, look at the test set only for the final choice.
- **Build:** `--learning-rate` and `--max-iter` options; the user runs 4-5 experiments and compares them in the UI.
- **Done when:** the user can say which settings are best and why, from the dashboard.

### Lesson M3: Quality gate
- **Concept:** a pipeline must never ship a worse model by accident.
- **Build:** `train.py` replaces models/gb_simple_h1.joblib only if the new model beats the lazy guess
  AND is not worse than the current model; the decision is logged to MLflow as a tag.
- **Done when:** a deliberately bad run (e.g. learning rate 0.9) is tracked but NOT saved as the model.

Then: pytest for /ask (F7) -> clean-clone dry run -> demo script.

## Part E: Finish line plan (made 2026-10-13)

Where we are: Days 1-3 done, Day 4 skipped by choice, MLOps M1-M3 done, Docker done. Left: tests, clean clone, demo.
Same tutor loop for every lesson (concept + links, check questions, you design, I write, you explain back, run).

| # | Lesson | Goal | Done when |
|---|---|---|---|
| E1 | pytest basics | What a test is; assert; run `pytest`; tests/ folder; add pytest to requirements-dev.txt | one tiny test of `rmse()` or `quality_gate()` passes |
| E2 | Testing `/ask` (F7) | FastAPI `TestClient`; fake the agent with a stub so tests never call Gemini or the database | 3+ tests pass offline: good question -> status answered; empty/garbage input -> 422 / invalid_input; Gemini down -> 503 |
| E3 | Test the quality gate (M3 loose end) | monkeypatch `MODEL_PATH` to a temp file; test accept and reject | gate tests pass without touching the real model |
| E4 | Clean-clone dry run (F6) | Clone to a temp folder, follow README word for word: venv -> install -> download -> train -> build_kb -> `docker compose up -d --build` -> `/ask` | every README command works as written; fix README where it does not |
| E5 | Demo script | One script: a docs question (RAG), a live-weather question (tool), a "predict next hour" question (model), a garbage input, and the MLflow UI with the gate rejection | runs end to end in under 5 min, with expected output written down |
| E6 | Final tidy | Sync `publish/` copy, refresh stale numbers (0.4116 -> 0.4097) in the lesson notes and presentation files, final commit | `git status` clean, README numbers equal `reports/metrics.json` |

Order: E1 -> E2 -> E3 -> E4 -> E5 -> E6. E1-E3 are the pytest work (F7); E4 is the F6 proof; E5-E6 are the demo.
Risks: tests must not need Docker, a Gemini key or the network (that is why E2 uses a stub); E4 needs Docker running
and a free port 8001; the data download is slow (rate limit), so E4 may reuse the cached `data/raw_areas`.
Out of scope by choice: PyTorch/fine-tuning (F5), MLOps M4-M6.

## Part F: YAML experiments, CI and AWS (planned 2026-10-13)
Full plan with diagrams: [docs/mlops_aws_plan.md](docs/mlops_aws_plan.md). Phases: F1 YAML experiments -> F2 CI on push ->
F3 remote MLflow + S3 artifacts -> F4 data in S3 -> F5 deploy on AWS -> F6 monitoring and cost. F1 done 2026-10-13 (experiments/*.yaml, --config replaces --learning-rate/--max-iter, YAML + git_sha logged to MLflow). MLOps tests done 2026-10-13 (tests/test_train.py, 12 passing: metrics, every experiment YAML, config checks, quality gate on a temp model file = E1 + E3). F2 part 1 done 2026-10-13: first commit 4df9086 pushed to github.com/Pradeep1777/weather-forecast (decks git-ignored); .github/workflows/ci.yml runs pytest on every push, first run green. Training in CI waits for data (F4). E2 + CI level 2 done 2026-10-14: tests/test_api.py (13 tests: /ask good/bad input/503/500, /health, tool errors; stub agent + fake settings) + ruff (E,F rules) in CI; 25 tests total. F2-F6 not started; the user
chooses when (Part E, the tests and demo, comes first unless they say otherwise).

## Progress tracker
- [x] 1.0 Hygiene  - [x] 1.1 EDA (decision: use only South_Mumbai)  - [x] 1.2 Baselines  - [x] 1.3 Features  - [x] 1.4 Split/horizon
- [x] 1.5 Ridge  - [x] 1.6 Boosting  - [x] 1.7 Evaluate  - [x] 1.8 Clean clone
  (1.2-1.8 built by Claude at the user's request so learning time goes to Day 2; results in README.md)
- [x] Day 2 RAG + /ask: [x] 2.1 embeddings (concept)  [x] 2.2 chunking (219 chunks)  [x] 2.3 Gemini embeddings  [x] 2.4 pgvector (weather_rag schema)  [x] 2.5 grounded answers (8/8 tests)  [x] 2.6 FastAPI /ask (src/app.py, port 8001)
- [x] Day 3 Agent: [x] 3.1 function calling by hand  [x] 3.2 live weather tool (Open-Meteo)  [x] 3.3 model tool (live backtest 0.64 vs lazy 1.08)  [x] 3.4 LangGraph agent, 3 tools (routing 6/6)  [x] 3.5 agent behind /ask (10/10 HTTP checks; Gemini down -> 503, DB down -> graceful answer)
- [~] Reproducible build (notebooks -> scripts; decision: option 2 = scripts + commit small built files):
  [x] A shared features (src/tools/features.py)  [x] B src/train.py (test 0.4116, same as notebook)  [x] C src/build_kb.py + rag/chunking.py + rag/embedding.py (same 219 chunks, byte-identical; tested on an empty DB)  [~] D schema: build_kb.py creates it (Dockerfile on Day 5)  [x] E clean-up (old models/reports/hook removed, data_processing.ipynb -> docs/notebooks)
- [-] Day 4 Fine-tune (F5): skipped by the user's choice (no PyTorch)
- [ ] MLOps (Part D): [x] M1 MLflow tracking (mlflow 3.17.0; sqlalchemy pure-Python for App Control; run 4e613ef6 test 0.4116 = metrics.json; UI via python -m mlflow)  [x] M2 experiments (--learning-rate/--max-iter; 5 runs done by Claude at the user's request: best val 0.3962 = max_iter 600, lr 0.1; it became the model, test 0.4097)  [x] M3 quality gate (lr 0.9 run rejected, model unchanged; default run accepted)
- [~] Day 5 Docker + tests + demo (F6, F7): [x] Dockerfile + compose (docker compose up -d --build; tested: 3 tools, 422, chat in container) [x] README rewritten  [ ] pytest for /ask  [ ] clean-clone dry run  [ ] demo script
