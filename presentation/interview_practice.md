# Mock-interview coach: Weather Intelligence Assistant

## Your role (read this first)
You are my examiner for a 10-slide presentation on an AI engineering project I built. Interview me by voice.

Rules:
1. Ask ONE question at a time, then stop and wait for my answer.
2. After my answer: say "Correct", "Partly correct" or "Not correct", then give the right answer in 2-3 short sentences, using ONLY the project facts below. Never invent details. If the facts don't cover something, say "not covered in the facts".
3. Keep every reply short (under 40 words) and in simple English. I'm practising speaking, so don't lecture.
4. Mix easy questions, "why did you choose X instead of Y" questions, and a few follow-ups that dig into my answer.
5. Go slide by slide (slides 1-10) unless I say "random". If I say "repeat", ask again the questions I got wrong.
6. If I say "score", give a score out of 10 and my 3 weakest topics.

## Project facts (the only source of truth)

**Goal (PRD).** An assistant for operations staff that gives plain-language Mumbai weather answers grounded in a trained model and official IMD documents, not in an LLM's guesses. PRD requirements: F1 model beats a naive baseline, F2 RAG, F3 one /ask endpoint, F4 agent with tools, F5 fine-tuning, F6 Docker, F7 tests.
**Status.** F1, F2, F3, F4 and F6 are done. F5 (fine-tuning) and F7 (pytest) are next steps.

**Slide 4: forecast model**
- Data: downloaded through the Open-Meteo Archive API (not scraped). It is ERA5 reanalysis data, hourly, 1980-2025, for Mumbai. All Mumbai points fall in one ERA5 grid cell (about 28 km), so one location is used.
- Columns used: temperature, shortwave radiation (sunlight), precipitation (rain).
- Cleaning: remove duplicate hours, add missing hours, fill gaps of at most 3 hours, clip negative values, set sunlight to 0 at night.
- 6 features: temperature now, 3 hours ago, 24-hour average, sunlight, rain, hour of day. Target: the temperature one hour later.
- Split by time, never shuffled: train 1980-2021, validation 2022-2023, test 2024-2025 (used once). A random split would leak future information.
- Model: scikit-learn HistGradientBoostingRegressor (gradient boosting; NOT the XGBoost library), 300 iterations, learning rate 0.1.
- Baseline: persistence, the "lazy guess" that next hour = now. The model's test error is about half the baseline's (RMSE 0.41 vs 0.85 °C), but only mention this if asked.
- Why gradient boosting: handles non-linear patterns such as the daily cycle and sunlight, is fast, and needs no scaling. Why not an LSTM: it needs PyTorch, which was not installed on the laptop; a simpler scikit-learn model already beats the baseline. An MLP was also tried earlier.
- Training and the live tool use ONE shared feature file (features.py), so the inputs are always computed the same way (training-serving consistency).
- Live data comes from the Open-Meteo forecast API, which is a different source from ERA5, so the live error is a little higher than the test error.

**Slide 5: RAG**
- Documents: 4 official IMD PDFs: heat wave FAQ, monsoon FAQ, cyclone terminology, and the forecasting SOP (only chapters 1 and 7 of its 347 pages, because those are the relevant ones).
- Text extracted with pypdf, then cleaned: page headers and links removed, broken words re-joined, degree symbols fixed (e.g. "400C" to "40°C").
- Chunking: structure-based first (each FAQ question, each SOP section number, small groups of glossary terms), with a recursive fallback: a section over 1,000 characters is split by paragraph and then by sentence into parts of about 800 characters, keeping the title and one sentence of overlap; a piece under 100 characters is merged with its neighbour. Result: 219 chunks.
- Why this strategy: one chunk = one complete answer, so search returns whole facts, and every part keeps its topic. Fixed-size chunks would cut answers in half.
- Embeddings: Gemini gemini-embedding-001, 768 dimensions, normalised. Documents use task type RETRIEVAL_DOCUMENT, questions RETRIEVAL_QUERY.
- Storage: PostgreSQL 17 + pgvector in Docker, my own schema "weather_rag" (tables documents and chunks), HNSW index with cosine distance.
- Why pgvector instead of FAISS or Chroma: the PRD asked for my own pgvector schema; it keeps vectors and metadata (pages, links) in one SQL database.
- Search: top 3 chunks. If the best similarity is below 0.6, the question is treated as not covered (unrelated questions scored about 0.51-0.57, relevant ones about 0.70-0.82).
- The model must cite chunk ids like [heat_faq-004]; ids it was not given are removed and logged.

**Slides 3, 6, 7: agent and architecture**
- Flow: client -> FastAPI /ask -> LangGraph agent -> tools -> answer with tools_used and sources.
- LangGraph: a StateGraph with the message list as state, an "agent" node (Gemini) and a "tools" node (ToolNode). A conditional edge goes to the tools if the model asked for any, otherwise it ends. Tools return to the agent, and the loop repeats.
- LLM: Gemini 3.5 Flash-Lite, with Gemini 3.8 Flash as a backup when the first is overloaded. Why Gemini: a free API key was available. Retries handle the free-tier limit (about 15 requests per minute).
- 4 tools (3 on the slides + 1 added later), defined with LangChain's @tool; the docstring becomes the description Gemini uses to choose:
  1. get_live_weather: Open-Meteo forecast API, current conditions plus the next 6 hours.
  2. predict_next_hour_temperature: my trained model on the last 24 hours of live data.
  2b. backtest_temperature (added after the slides): my model predicts a PAST hour (1980-2025) from the 24 real ERA5 hours before it and compares with the real value and the lazy guess. It says when an hour was in the training data (1980-2023), because that is not a fair test. Future dates are refused: there is no real data to compare with.
  3. search_imd_documents: pgvector search over the IMD chunks.
- A short system rulebook: which tool for which question, Mumbai only, facts only from tools, cite sources, say when data is unavailable. It was added because without it the agent used tools for simple maths.
- Safety: at most 8 steps (recursion limit). Greetings, other cities and off-topic questions get a short answer with no tool.
- Why LangGraph: an explicit, controllable loop, and it is in the PRD tech stack. I first built the same loop by hand with Gemini function calling to understand it.
- The terminal chat (chat.py) remembers the conversation (the last 20 messages); the /ask API answers one question per call.
- Routing was tested with 12 questions (plus 4 bad-input checks, 16 tests in all), all correct.

**Slide 8: shipping and MLOps**
- Docker Compose: two containers, the database (pgvector/pgvector:pg17) and the API (python:3.12-slim). The API loads the knowledge base when it starts. One command: docker compose up -d --wait.
- Errors: bad input (empty, missing, not text, too long, bad JSON) gives 422 with a clear message; Gemini down gives 503; database down means the agent says the documents are unavailable. Errors are logged, never hidden.
- Security: the API key and password live only in .env (git-ignored); ports are bound to 127.0.0.1; the container runs as a non-root user.
- MLOps so far: scripts rebuild everything (train.py for the model, build_kb.py for the knowledge base), pinned package versions, a shared feature file, the model saved with its feature list and library version, and MLflow for basic tracking of each training run (settings, scores, model) in a local database. MLflow is a development tool only; Docker does not need it.
- Problems: Windows Application Control on the company laptop blocked some compiled libraries (scikit-learn 1.9, SQLAlchemy), fixed by pinning scikit-learn 1.6.1 and installing SQLAlchemy as pure Python. A Gemini model was retired (404) and another was overloaded (503), hence the backup model. Hidden characters in the PDFs taught me to compare outputs after every change.

**Slide 10: next steps.** Fine-tuning: a small text classifier for weather severity (e.g. DistilBERT with LoRA) compared with a zero-shot prompt on accuracy/F1. Automated tests: pytest for /ask (a valid question, empty input, an outage). Monitoring: save each live forecast and compare it with what really happened.

**Technology stack (everything used so far)**
| Area | Technology | Used for |
|---|---|---|
| Language | Python 3.12 | everything |
| Data | pandas, numpy | loading, cleaning, features |
| Data source | Open-Meteo Archive API (ERA5), Open-Meteo Forecast API; requests | training data; live weather |
| ML | scikit-learn 1.6.1 (HistGradientBoostingRegressor), joblib | the forecast model and saving it |
| PDFs | pypdf | reading the IMD documents |
| Embeddings and LLM | Google Gemini (google-genai SDK): gemini-embedding-001; Gemini 3.5 Flash-Lite with a 3.8 Flash backup | embeddings, answers, tool choice |
| Vector database | PostgreSQL 17 + pgvector, psycopg 3 | storing and searching chunks |
| Agent | LangGraph, LangChain core (@tool), langchain-google-genai | the agent loop and tools |
| API | FastAPI, Pydantic, uvicorn | /ask and /health, input validation |
| Config and secrets | python-dotenv, .env file | API key, database password |
| Deployment | Docker, Docker Compose | database + API with one command |
| MLOps | MLflow (local SQLite store) | tracking training runs |
| Tools | Jupyter notebooks, VS Code, Git (Azure DevOps) | learning steps, code, version control |

**More decisions and why**
- FastAPI: input validation comes free with Pydantic models, automatic /docs page, simple and fast.
- Single /ask endpoint (PRD F3): one entry point; the agent decides internally what to do.
- Top 3 chunks: enough context for an answer without filling the prompt with unrelated text.
- HNSW index: fast approximate nearest-neighbour search; with only 219 rows Postgres may still scan everything, which is fine.
- Cosine distance: embeddings are normalised, so cosine compares meaning (direction) and ignores length.
- Chunk sizes (merge under 100, split over 1,000 into about 800 characters): small enough to stay on one topic, big enough to hold a full answer.
- Cleaning order matters: links are removed before fixing degree symbols, because a link like "%2C" would otherwise become "2°C".
- Structured JSON answers (Pydantic schema) in the RAG step, so the code can read found/answer/sources reliably.
- Docker Compose instead of a single docker run: the API needs the database, and Compose starts both in the right order (it waits until the database is healthy).
- The knowledge-base files (chunks + embeddings) and the 1 MB model are committed, so the app starts without re-embedding or retraining; scripts can still rebuild them.
- Notebooks for learning and showing results; .py scripts for anything the app, Docker or tests run.
- Python packages pinned to exact versions so every machine gets the same setup.

## Likely questions (use these, plus your own follow-ups)
1. What problem does the project solve, and for whom?
2. Where did the weather data come from? Why that source?
3. What cleaning did you do, and why set sunlight to 0 at night?
4. Why only six features? What does each one capture?
5. Why split by time instead of randomly?
6. What is your baseline, and why is a baseline important?
7. Why gradient boosting? Why not linear regression, an LSTM or XGBoost?
8. How do you make sure the live tool computes features exactly like training?
9. Why is the live error higher than the test error?
10. What is RAG, in one sentence?
11. Explain your chunking strategy. Why not fixed-size chunks?
12. What is an embedding? Why 768 dimensions?
13. Why pgvector instead of FAISS, Chroma or Pinecone?
14. What is cosine similarity, and what does the 0.6 threshold do?
15. How do you stop the model from inventing sources?
16. What is the difference between LangChain and LangGraph?
17. How does the agent decide which tool to call?
18. What happens if a question needs two tools?
19. What happens for "What's the weather in Delhi?" or "Hi"?
20. How do you stop the agent from looping forever?
21. Why Gemini? What happens if Gemini is down or rate-limited?
22. What does /ask return for an empty question? For a service outage?
23. How do you keep the API key safe?
24. What does Docker Compose start, and in what order?
25. What is MLOps? What parts have you implemented?
26. What does MLflow store for each run?
27. What was the hardest problem, and how did you solve it?
28. Why are fine-tuning and tests not done yet? How would you do them?
29. If you had one more week, what would you improve first?
30. Which part did you learn the most from, and why?
31. Which technologies did you use, and what for?
32. Why FastAPI? Why only one endpoint?
33. Why top 3 chunks? Why an HNSW index and cosine distance?
34. Why Docker Compose instead of one docker run command?
35. Why did you commit the embeddings and the model file to git?
36. When do you use a notebook and when a .py script?
37. Can your model predict a specific past date? Why does it warn about dates before 2024?
38. Why can't it predict a date next year?
