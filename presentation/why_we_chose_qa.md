# "Why did you choose…?" Q&A: Weather Intelligence Assistant

**How to use:** read a question, answer aloud in your own words, then compare with **Say:**. The **If pushed:** line is the follow-up an examiner may ask.

**Honesty tags** (so you never claim more than you did):
- 🟢 **tested**: I measured or checked it
- 🔵 **requirement / constraint**: the PRD or my laptop forced it
- 🟡 **judgement call**: a sensible choice, but I did not benchmark alternatives. Say so if asked.

---

## A. Project-level decisions

**A1. Why a weather assistant for Mumbai?** 🔵
*Say:* The PRD story is operations staff who need plain-language weather answers backed by a trained model and official documents. It lets me cover ML, retrieval, an agent and deployment in one domain, with free data (Open-Meteo) and authoritative documents (IMD).

**A2. Why Mumbai only?** 🟢
*Say:* ERA5 has about 28 km resolution, so all my Mumbai points fall in the same grid cell and returned identical data. One location is enough, and the agent says "I only cover Mumbai" for other cities instead of guessing.

**A3. Why Python, and why 3.12?** 🔵/🟡
*Say:* Python is the PRD stack and has every library I need. 3.12 is the version on my laptop; `pyproject.toml` requires ≥3.12 and the Docker image uses `python:3.12-slim`, so all three match.

**A4. Why the IMD documents?** 🔵
*Say:* The PRD asks for answers grounded in reference documents. IMD is the official authority, and its heat-wave, rainfall, cyclone and warning definitions match the questions operations staff ask.

**A5. Why only 4 PDFs, and only some pages of the 347-page SOP?** 🟡
*Say:* I took only chapter 1 (rainfall terms, warning colours) and chapter 7 (heat and cold waves), pages 24–27 and 171–182. The rest is unrelated to weather questions and would add noise to search.

**A6. Why notebooks *and* scripts?** 🟡
*Say:* Notebooks show each step and its output, which is good for learning and demos. Anything the app, Docker or tests need is a `.py` file, so a clean clone can rebuild everything without opening a notebook.

---

## B. Data and the forecast model

**B1. Why Open-Meteo?** 🟡
*Say:* It is free, needs no API key, serves hourly ERA5 history back to 1940, and has a forecast API from the same provider for live data, with the same variable names.
*If pushed:* The trade-off is that the archive (ERA5) and the live forecast are different data sources, which causes some drift (see B20).

**B2. Why 1980–2025 and hourly data?** 🟡
*Say:* 45 years gives about 400,000 hourly rows: enough to learn daily and seasonal patterns. Hourly matches a 1-hour forecast horizon and the daily temperature cycle.

**B3. Why only three input columns (temperature, sunlight, rain)?** 🟢
*Say:* They explain the next hour's temperature: sunlight drives warming, rain stops it. My first model used 21 features (humidity, pressure, wind, cloud…) and scored 0.394 °C against 0.412 °C for the 6-feature model: a tiny loss for a model I can fully explain.

**B4. What cleaning did you do, and why?** 🟢
*Say:* Remove duplicate hours, add missing hours, fill gaps of at most 3 hours, clip negative values, and set sunlight to 0 at night.
*If pushed:* The gap limit is 3 hours because longer gaps would mean inventing data. The cleaning actually changed 0 values, because the data was already clean. The checks are protective.

**B5. Why predict 1 hour ahead?** 🟢
*Say:* It is the clearest, most demonstrable forecast, and it matches the live tool. A 24-hour model I tried earlier beat the baseline by only about 7 %, against about 52 % for 1 hour.

**B6. Why the "lazy guess" (persistence) baseline?** 🔵
*Say:* The PRD's example baseline. "Next hour = now" is a strong, honest benchmark for hourly temperature: if the model cannot beat it, it is useless.

**B7. Why split by time, not randomly?** 🟢
*Say:* A random split would let the model see hours right before and after its test hours, which leaks the future. I train on 1980–2021, check on 2022–2023, and test once on 2024–2025.

**B8. Why separate validation and test sets?** 🟢
*Say:* I can look at validation as often as I like when choosing settings. The test set is the final exam, used once, so the score stays honest.

**B9. Why refit on train + validation at the end?** 🟡
*Say:* More data with the same settings. The test set is still untouched, so the final score is fair.

**B10. Why gradient boosting (`HistGradientBoostingRegressor`)?** 🟡
*Say:* It handles non-linear patterns like the daily cycle, needs no feature scaling, and is fast on 400,000 rows. It is also easy to explain: many small trees, each correcting the previous one's errors.
*If pushed:* I tried a small neural network (MLP) early on, then chose boosting to keep the project simple to explain.

**B11. Why not XGBoost or LightGBM?** 🟡
*Say:* I did not benchmark them. `HistGradientBoosting` is the same family, already ships inside scikit-learn (no extra install), and already beats the baseline by half. On my company laptop, extra compiled libraries are also a real risk, because Application Control has blocked some.

**B12. Why not an LSTM or deep learning?** 🔵
*Say:* It needs PyTorch, which I did not install on this laptop. The data is a small table of 6 numbers, where boosting is usually strong. Simpler also means easier to explain.

**B13. Why `learning_rate=0.1`, `max_iter=300`, `random_state=42`?** 🟡
*Say:* 0.1 is the standard default, and 300 trees are enough. I tried 0.9 in a notebook, which was too aggressive. 42 is just a fixed number for reproducible results. I did not run a full hyper-parameter search.

**B14. Why RMSE and MAE?** 🔵/🟢
*Say:* MAE is the average error, easy to read ("about 0.3 °C"). RMSE punishes big mistakes more, which matters for sudden changes, and it is the metric the PRD names.

**B15. Why exactly these 6 features?** 🟢
*Say:* `temp_now` is the anchor (persistence), `temp_3h_ago` gives the trend, `temp_avg_24h` gives the day's level, `sunlight` drives warming, `rain` stops it, and `hour` captures the daily cycle.

**B16. Why one shared `features.py` for training and the live tool?** 🟢
*Say:* If the two sides computed features differently, the model would quietly give wrong predictions with no error. One shared function guarantees that training and serving use identical inputs.

**B17. Why `joblib` and saving a dictionary?** 🟡
*Say:* `joblib` is the standard way to save scikit-learn models. I store the feature list, test RMSE and library version with the model, so the tool can check them.
*If pushed:* Pickle-based files can run code when loaded, so I only load files I trained myself.

**B18. Is the model overfitting or underfitting?** 🟢
*Say:* Neither. The error on training years is 0.43 °C and on unseen years 0.41 °C, so it generalises. It halves the baseline's error (0.41 vs 0.85), so it learned real patterns.

**B19. Why is the test error slightly lower than the training error?** 🟢
*Say:* 2024–2025 is just easier to predict: even the lazy guess scores better there (0.85 vs 0.93). It is the data, not a trick.

**B20. Why is the error higher on live data?** 🟢
*Say:* The model learned from ERA5, but live data comes from Open-Meteo's forecast model, a different source. That is data drift: live error is about 0.7 °C against 0.4 °C on the test years. It still beats the lazy guess.

**B21. Why add a backtest tool?** 🟡
*Say:* So anyone can ask about a past date and see the prediction next to the real value. It also warns when that hour was in the training data (before 2024), because that is not a fair test.

---

## C. RAG (retrieval)

**C1. Why RAG and not just ask Gemini?** 🔵
*Say:* The PRD wants answers grounded in documents, not an LLM's memory. RAG gives exact IMD numbers and cites its sources.

**C2. Why `pypdf`?** 🟡
*Say:* It is pure Python, installs without system tools, and is enough for these text-based PDFs. I did not need OCR.

**C3. Why so much text cleaning?** 🟢
*Say:* PDF text is messy: repeated headers, links, broken words (`temp erature`), degree symbols turned into `400C`. Dirty text gives dirty chunks and worse search.
*If pushed:* The order matters: I remove links before fixing degree symbols, otherwise a link containing `%2C` became "2°C".

**C4. Why structure-based chunking?** 🟢
*Say:* I cut each document where it naturally starts a topic: each FAQ question, each SOP section number, groups of glossary terms. One chunk then holds one complete answer.
*If pushed:* Fixed-size chunks would cut answers in half.

**C5. What is the recursive fallback for?** 🟢
*Say:* Sections that are too long (over 1,000 characters) are split by paragraph, then by sentence, into parts of about 800, keeping the title and one sentence of overlap. Tiny pieces (under 100) are merged with a neighbour.

**C6. Why those sizes (100 / 1,000 / 800 / 600)?** 🟡
*Say:* Small enough to stay on one topic, big enough to hold a full answer. They came from looking at the section sizes, not from a benchmark.

**C7. Why overlap one sentence?** 🟡
*Say:* So an answer that continues across a split does not lose its lead-in.

**C8. Why group glossary terms?** 🟢
*Say:* The cyclone glossary is hundreds of tiny entries. One entry per chunk would be too small to carry meaning, so neighbours are grouped up to about 600 characters.

**C9. Why store page numbers, links and chunk ids?** 🟢
*Say:* They make citations possible: the answer can say `[heat_faq-004]`, the document and the page.

**C10. Why Gemini embeddings and not sentence-transformers?** 🔵
*Say:* Open-source embedding models need PyTorch, which I did not install. I already use a Gemini key, and its model supports separate document and query modes.

**C11. Why task types `RETRIEVAL_DOCUMENT` and `RETRIEVAL_QUERY`?** 🟡
*Say:* The model tunes the vectors so a question lands close to the passage that answers it, even when the words differ.

**C12. Why 768 dimensions?** 🟡
*Say:* Gemini lets you choose the size. 768 balances quality against storage and speed, and it stays under pgvector's 2,000-dimension limit for indexes, which the default 3,072 would exceed.

**C13. Why normalise the vectors?** 🟢
*Say:* Then cosine similarity equals a simple dot product, and every vector has length 1.

**C14. Why embed in batches of 100?** 🟡
*Say:* That is the maximum the embedding API accepts per request, which cuts the number of calls on a rate-limited free tier.

**C15. Why pgvector, not FAISS, Chroma or Pinecone?** 🔵
*Say:* The PRD asks for my own pgvector schema. It keeps vectors and metadata (pages, links) in one SQL database, so I can filter and join with normal SQL, and I already know PostgreSQL.

**C16. Why this schema (`documents` and `chunks`)?** 🟡
*Say:* Documents hold the title and link once; chunks hold the text, pages and vector, linked by a foreign key. No repeated data, and citations come from a simple join.

**C17. Why an HNSW index and cosine distance?** 🟡
*Say:* HNSW is a fast approximate nearest-neighbour index, and cosine compares meaning and ignores length. With only 219 rows Postgres may still scan everything, which is fine. The index shows the design scales.

**C18. Why top 3 chunks?** 🟡
*Say:* Enough context to answer without filling the prompt with unrelated text. I tested on 8 questions and did not run a large study.

**C19. Why a similarity threshold of 0.6?** 🟢
*Say:* I measured it: unrelated questions scored 0.51–0.57, relevant ones 0.70–0.82. 0.6 sits in the gap. Below it, the system answers "not covered" instead of guessing.

**C20. How do you stop the model inventing sources?** 🟢
*Say:* It must cite chunk ids. Any id that was not actually retrieved is removed and logged. If nothing valid is left, the answer counts as not covered.

**C21. Why are there two RAG paths (`pipeline.py` and the agent's search tool)?** 🟡
*Say:* `pipeline.py` is my original Day 2 RAG, which I built by hand to learn it. The agent's search tool reuses the same retrieval, and the agent writes the answer. The old path remains for the notebooks and could be removed.

**C22. Why commit `chunks.json` and the embeddings file?** 🟡
*Say:* They are small (under 1 MB). The app then starts without re-embedding, which would cost Gemini calls. `build_kb.py --rebuild` can still recreate them from the PDFs.

---

## D. Agent and LLM

**D1. Why an agent, not a fixed pipeline?** 🔵
*Say:* Questions differ: live weather, a forecast, an IMD rule, or a mix. An agent picks the tools each question needs; a fixed pipeline would run everything every time.

**D2. Why LangGraph?** 🔵/🟡
*Say:* It is in the PRD stack, and the loop is explicit and controllable: an agent node, a tools node and a rule for when to stop.
*If pushed:* I first built the same loop by hand with Gemini function calling, so I understand what LangGraph does for me.

**D3. Why not LangChain's ready-made agent?** 🟡
*Say:* A prebuilt agent hides the loop. Building the graph myself lets me explain every step. I still use LangGraph's `ToolNode` and `tools_condition`.

**D4. Why three Google/LangChain libraries (`google-genai`, `langchain-core`, `langchain-google-genai`)?** 🟡
*Say:* `google-genai` calls Gemini directly for embeddings and my original RAG. `langchain-core` provides `@tool` and message types, and `langchain-google-genai` connects Gemini to LangGraph with tool calling.

**D5. Why Gemini?** 🔵
*Say:* I had a Gemini key available, and Google also offers the embeddings. The PRD allows "an LLM API".

**D6. Why `gemini-3.5-flash-lite` with a backup model?** 🟢
*Say:* Flash-Lite is fast and cheap on the free tier. I added a backup (3.8 Flash) because one model returned 503 (overloaded) and another model had been retired (404).

**D7. Why no `temperature` setting?** 🟢
*Say:* The current Flash models ignore it. Consistency comes from the rules and the tools instead.

**D8. Why do tool descriptions matter?** 🟢
*Say:* LangChain turns each function's name, type hints and docstring into the schema Gemini sees. The docstring is the only thing Gemini has to choose the tool.

**D9. Why do tools return `{"error": …}` instead of raising?** 🟡
*Say:* The agent can then tell the user the data is unavailable instead of crashing, and it must not invent numbers.

**D10. Why four tools, and why is backtest separate?** 🟡
*Say:* Each has one clear job and one data source. The live forecast and the past-hour check use different inputs, so one description for both would confuse the agent.

**D11. Why a rulebook (`AGENT_RULES`)?** 🟢
*Say:* Without it the agent was over-eager: it used tools for a Fahrenheit conversion. The rules say which tool for which question, Mumbai only, facts only from tools, cite sources, and say when data is missing.

**D12. Why limit it to 8 steps?** 🟡
*Say:* A safety net against endless tool loops. A normal question needs 2–5 steps. If the limit is hit, the user gets a polite "could not finish".

**D13. Why does the terminal chat remember 20 messages?** 🟡
*Say:* Memory is what makes follow-ups like "and in one hour?" work. Sending the whole history every time would get slower and use more quota. I trim at a user question, so a tool result is never separated from its request.

**D14. Why does `/ask` have no memory?** 🟡
*Say:* An API is one question per call. Real per-user memory would need session ids and a store, so I kept it in the terminal chat.

**D15. Why cache live weather for 10 minutes?** 🟡
*Say:* The source updates about every 15 minutes, so calling it on every question is wasteful and risks rate limits.

**D16. Why Open-Meteo's forecast API for live data?** 🟡
*Say:* Same provider and variable names as the training data, free, and it also returns the last 24 hours the model needs.

**D17. Why a terminal chat (`chat.py`)?** 🔵
*Say:* The PRD says an API or simple CLI demo is enough, and it makes the agent's tool use visible: each answer shows the tools line.

**D18. Why `with_fallbacks` and `max_retries=6`?** 🟢
*Say:* The free tier allows about 15 requests a minute and models are sometimes overloaded. Retries with waiting, and a backup model, keep the demo working.

**D19. Why was function calling built by hand first?** 🟡
*Say:* To see what a framework hides: describe tools, the model asks for one, I run it, I send the result back, repeat.

---

## E. API and error handling

**E1. Why FastAPI?** 🔵/🟡
*Say:* It is in the PRD stack. Pydantic validation comes free, `/docs` gives an instant test page, and it is simple and fast.

**E2. Why a single `/ask` endpoint?** 🔵
*Say:* The PRD asks for one entry point. The agent decides internally what to do.

**E3. Why validate the question (not empty, at most 500 characters)?** 🟡
*Say:* Empty input has nothing to answer; very long input wastes quota and makes prompt abuse easier. Bad input gets a clear 422 message instead of a crash.

**E4. Why 422, 503 and 500?** 🟢
*Say:* 422 = your input is wrong. 503 = a service I depend on (Gemini) is unavailable, so try again. 500 = something unexpected on my side. Each is logged.

**E5. Why does a database outage still return 200?** 🟢
*Say:* Only one tool failed. The agent can still explain that the documents are unavailable, and the other tools keep working. If Gemini itself is down, nothing can be answered, so that is a 503.

**E6. Why `/health` and what does it check?** 🟡
*Say:* It tells Docker and me that the API is up and can reach the database.

**E7. Why uvicorn?** 🟡
*Say:* The standard server for FastAPI.

**E8. Why does the response include `tools_used`, `sources` and `steps`?** 🟡
*Say:* So the user (and I, in the demo) can see how an answer was produced: which tools ran and which documents were cited.

**E9. Why the `logging` module, not `print`?** 🔵
*Say:* The PRD says errors must be logged, not swallowed. Logging adds time, level and source, and I silence noisy libraries.

---

## F. Docker and deployment

**F1. Why Docker Compose and not one `docker run`?** 🔵/🟡
*Say:* The API needs the database next to it. Compose starts both, in order, with one command. The PRD's "docker run" requirement is met by one command from a clean clone.

**F2. Why `python:3.12-slim`?** 🟡
*Say:* Small, official, and matches my Python version.

**F3. Why the `pgvector/pgvector:pg17` image?** 🟡
*Say:* It is PostgreSQL with the pgvector extension already installed, so there is nothing to compile.

**F4. Why healthchecks and `--wait`?** 🟢
*Say:* The API must not start before the database is ready. `--wait` makes the command return only when both containers are healthy, so the chat works right away.

**F5. Why run as a non-root user?** 🟡
*Say:* Basic container security: if something went wrong inside, it would not have root.

**F6. Why `.dockerignore`, and where is the API key?** 🟢
*Say:* `.env` is excluded from the image and from git. Compose passes it to the container at run time, so the key never lives in an image layer.

**F7. Why are ports bound to `127.0.0.1`?** 🟢
*Say:* Only my laptop can reach the database and the API, not other computers on the network.

**F8. Why copy `requirements.txt` before the code?** 🟡
*Say:* Docker caches each step. Dependencies change rarely, so code edits rebuild in seconds.

**F9. Why does the container run `build_kb.py` at start?** 🟡
*Say:* It creates the schema and loads the committed chunks and vectors (about 5 s, no Gemini calls), so a fresh clone works without manual steps.

**F10. Why mount `data/` read-only?** 🟡
*Say:* The backtest tool needs the 14 MB history file, which I did not want inside the image.

---

## G. MLOps and MLflow

**G1. Why MLflow?** 🔵/🟡
*Say:* The PRD lists it (optional). It records every training run's settings, scores and model, so I can compare runs instead of trusting memory.

**G2. Why a local SQLite store?** 🟡
*Say:* One file, no server, enough for a solo project. It is git-ignored: my runs stay on my PC.

**G3. Why manual logging, not autolog?** 🟡
*Say:* I choose exactly what is saved, which is easier to explain. It also lets me log the lazy-guess comparison, which autolog does not know about.

**G4. Why is MLflow in the dev requirements, not in Docker?** 🟢
*Say:* The API uses a model; it never trains one. `train.py` still works without MLflow installed.

**G5. Why trust only one model type in MLflow's `skops` format?** 🟢
*Say:* skops refuses unknown object types for safety. I trained this model myself, so I trust exactly the one type gradient boosting needs, not everything.

**G6. Why pin package versions?** 🔵
*Say:* Every machine gets the same setup. scikit-learn is pinned to 1.6.1 because Windows Application Control blocked the 1.9 DLLs on my company laptop.

**G7. What MLOps do you actually have?** 🟢
*Say:* Rebuild scripts for the model and the knowledge base, pinned versions, one shared feature file, a model saved with its metadata, basic MLflow tracking and Docker packaging. No monitoring or CI yet.

---

## H. Code organisation and tooling

**H1. Why the `src/` layout and `pyproject.toml` with an editable install?** 🟡
*Say:* `import agent, rag, tools` then works from anywhere (notebooks, scripts, tests, Docker) without `sys.path` tricks.

**H2. Why a frozen settings dataclass read from `.env`?** 🟡
*Say:* One place for configuration (models, thresholds, limits); frozen so it cannot change at run time; secrets stay out of the code.

**H3. Why `.env` and `.env.example`?** 🔵
*Say:* The key is never committed; `.env.example` shows which values are needed.

**H4. Why are the scripts safe to run twice?** 🟢
*Say:* The schema uses `IF NOT EXISTS`, rows are upserted with `ON CONFLICT`, and chunks that no longer exist are deleted, so a rerun never duplicates data.

**H5. Why `psycopg` 3 and the `pgvector` Python package?** 🟡
*Say:* Psycopg 3 is the current driver and has binary wheels, so it installs on Windows without extra tools. The `pgvector` package lets me pass NumPy vectors straight into SQL.

**H6. Why retries with waiting on API calls?** 🟢
*Say:* The free Gemini tier has a per-minute limit and sometimes returns 429 or 503. Waiting and retrying makes those temporary errors invisible.

**H7. Why a separate `requirements-dev.txt`?** 🟢
*Say:* Notebooks and MLflow are needed for development, not for running the app, so the Docker image stays smaller.

**H8. Why did you push only notebooks without comments, and a separate branch with no names?** 🟡
*Say:* To keep the repository clean for reviewers: notebooks show headings, code and outputs; explanations stay in my local copies. The branch and commit author carry no personal names.

---

## I. Weak points: answer honestly

**I1. What is not done?** 🔵
*Say:* Fine-tuning (F5) and automated tests (F7). I chose to go deeper on the agent and a reproducible Docker setup first. F5 needs PyTorch, which I have not installed. Both are my next steps.

**I2. Where is your model weak?** 🟢
*Say:* Sudden events like pre-monsoon storms: it has no cloud or wind inputs. On steady monsoon-rain days the lazy guess is just as good, because the temperature barely changes. It also underestimates hot afternoon peaks on live data.

**I3. What happens with a question you did not plan for?** 🟢
*Say:* Greetings, other cities and off-topic questions get a short polite answer with no tool. A question the documents do not cover returns "not covered", not an invented rule.

**I4. Could someone trick the agent ("ignore your rules")?** 🟢
*Say:* I tested one such attempt and it refused politely. I have not tested prompt injection thoroughly, and I do not claim it is secure.

**I5. What are the limits of the free Gemini tier?** 🟢
*Say:* About 15 requests a minute, so an answer can take 30 seconds or more when it waits and retries. For real users I would use a paid tier.

**I6. Is this production-ready?** 🔵
*Say:* No: the PRD says production auth and uptime are non-goals. There is no login or rate limit, and no monitoring. It is a reproducible, tested-by-hand prototype.

**I7. What would you improve with one more week?** 🟡
*Say:* pytest for `/ask`, the fine-tuning comparison, monitoring (save each live forecast and compare it with reality), and a quality gate so a worse model never replaces the current one.

**I8. What was the hardest problem?** 🟢
*Say:* Hidden characters in the PDFs: two invisible bullet symbols became empty strings after a copy, which would have put a dash between every letter. I now compare the new output with the old output after every change, and the chunker's results matched exactly (219 chunks).

**I9. What did you learn the most from?** 🟡
*Say:* That most of an AI system is data preparation, retrieval and careful wiring. The LLM call is the smallest part.
