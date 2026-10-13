# Questions new students ask: Weather Intelligence Assistant

These are the questions that came up while we built this project (some from the learner, some obvious ones).
Each has a short answer based on what we actually built. Use them as a checklist: if you can answer a question
in your own words, you understood that step.

The project: a Mumbai weather assistant. You ask a question to `POST /ask`; an agent decides whether to use live
weather, our own trained temperature model, or the IMD reference documents (RAG), and answers with sources.

---

## 1. Python, FastAPI and the basics we needed

1. **Why a virtual environment (venv)?**
   It gives the project its own copy of the packages. Our model was saved with scikit-learn 1.9.1 but the global
   Python had 1.6.1, which gave a version warning. A venv + pinned `requirements.txt` removes that problem.
2. **What does "pinning" a package mean (`scikit-learn==1.9.1`)?**
   Fixing the exact version, so every machine installs the same thing.
3. **What is `.gitignore` for? What did we ignore and why?**
   It tells git which files not to track: `.venv`, `.env` (secrets), `data/` (173 MB, GitHub rejects files over
   100 MB), `mlflow.db`, `mlruns/`.
4. **Why is the API key in `.env` and never in the code or git?**
   Anything pushed to git can be read by others. `.env` stays on your PC; `.env.example` shows the names only.
5. **Why use `logging` instead of `print`?**
   Logs have levels (INFO, WARNING, ERROR), timestamps and names, and can be sent to files. It is the habit
   for real services.
6. **What is a REST API? What is an endpoint?**
   A program that answers HTTP requests. An endpoint is one URL + method, e.g. `POST /ask`, `GET /health`.
7. **What is FastAPI and why not Flask?**
   A Python web framework with automatic validation, automatic docs (`/docs`) and type hints. Less code to check
   inputs.
8. **What is Pydantic and what does it do for us?**
   It checks the shape of data. `AskRequest` says `question` must be a string; wrong input is rejected with 422
   before our code runs.
9. **What do status codes 200, 422 and 503 mean in this project?**
   200 = OK; 422 = your input was invalid; 503 = a service we depend on (Gemini) is unavailable.
10. **Why does `/ask` return a `status` field (answered, incomplete, invalid_input, error)?**
    So the caller can tell what happened without parsing text.
11. **What is `/health` for?**
    A quick check: is the API up, and can it reach the database?
12. **Why catch errors and return a clean message instead of letting the app crash?**
    A user should never see a stack trace; the real error goes to the log.
13. **What is the difference between a library and an API?**
    A library is code you import; an API is a service you call over the network (Open-Meteo, Gemini).
14. **What is Docker? Image vs container?**
    Docker packs the app and everything it needs. The image is the recipe; the container is a running copy.
15. **Why does `docker compose` start two things (the app and Postgres)?**
    The app needs a database. Compose starts both and connects them.
16. **Why is the database on port 5434 and the API on 8001?**
    To avoid clashing with other things already using the default ports on the machine.
17. **Why does a "clean clone" test matter?**
    It proves the project runs from only what is in git: no hidden local files or packages.

---

## 2. ML model training

1. **What are we predicting?**
   Mumbai's temperature 1 hour ahead, from the last 24 hours of weather.
2. **Where does the data come from? What is ERA5?**
   Open-Meteo's archive API, hourly, 1980-2025. ERA5 is a "reanalysis": a physics model fitted to real
   observations, giving a complete gridded history.
3. **Why did we keep only one area (South Mumbai) when we downloaded three?**
   ERA5 cells are about 28 km wide, so all three points fall in the same cell. The temperatures were identical:
   the "three areas" were one dataset three times.
4. **What is a baseline? What is the "lazy guess" (persistence)?**
   The simplest forecast: "next hour = this hour". A model is only useful if it beats it.
5. **Why is beating persistence at 1 hour not very impressive on its own?**
   Temperature changes slowly hour to hour, so persistence is already decent. We still report how much better we are.
6. **What are RMSE and MAE? When does RMSE punish more?**
   Both are average error in °C. RMSE squares the errors first, so big misses cost more.
7. **What are lag features? Why `shift()`?**
   Past values used as inputs (e.g. the temperature 1, 2, 24 hours ago). `shift()` moves data down so a row
   only sees the past.
8. **What is data leakage? Give an example.**
   Using information the model would not have at prediction time, e.g. a feature that includes the next hour's value.
   It makes scores look great and then fails live.
9. **Why not shuffle the data when splitting?**
   Shuffling puts future rows in training and past rows in the test, which is cheating for time series. We split by time.
10. **What are train, validation and test? What years did we use?**
    Train up to 2021, validation 2022-2023 (to compare settings), test 2024-2025 (final exam, looked at once).
11. **Why do we need a validation set if we already have a test set?**
    If you pick settings by looking at the test score, the test is no longer unseen.
12. **Why did we refit on train + validation at the end?**
    More recent data for the final model, with the same settings. Test is still used once.
13. **Why gradient boosting and not only a line (Ridge)?**
    Trees can learn non-straight patterns. We compared on validation and it won.
14. **What does Ridge's `alpha` control? Why scale features for Ridge?**
    `alpha` is how strongly big weights are punished. Scaling puts features on the same range so the punishment is fair.
15. **What do `learning_rate` and `max_iter` do in gradient boosting?**
    `max_iter` is the number of trees (rounds); `learning_rate` is how much each tree is allowed to correct.
    A lower rate usually needs more rounds.
16. **What are our final numbers?**
    Test RMSE 0.4097 °C vs 0.8502 °C for the lazy guess (about 52% better). See `reports/metrics.json`.
17. **Why is the training error not the number to trust?**
    A model can memorise training data. Only unseen years show whether it generalises.
18. **Why save the model with `joblib`? What goes inside the file?**
    It stores the trained object. We also store the feature list, area and scikit-learn version, so the API
    can check it is using the model correctly.
19. **Why train in a script (`train.py`) when we already had a notebook?**
    A script is repeatable and runs the same on any machine. Notebooks are for exploring.
20. **What does `random_state=42` do?**
    Fixes the random choices so two runs give the same result.

---

## 3. RAG implementation

1. **What is RAG, in one sentence?**
   Find the relevant text first, then give it to the LLM and ask it to answer only from that text.
2. **Why not just ask the LLM directly?**
   It may invent thresholds or rules. With RAG the answer comes from the official IMD documents and can be cited.
3. **Which documents did we use?**
   IMD reference PDFs: warning criteria, FAQs, SOPs, glossary.
4. **What is an embedding?**
   A list of numbers (we use 768) that represents the meaning of a text. Similar meanings are close together.
5. **What is cosine similarity?**
   A score for how close two embeddings are in direction. Because our vectors are normalised, it equals the dot product.
6. **Which embedding model did we use? Why a different task type for questions and chunks?**
   `gemini-embedding-001`. Chunks use `RETRIEVAL_DOCUMENT`, questions use `RETRIEVAL_QUERY`; the model is tuned for that pairing.
7. **Why split documents into chunks?**
   A whole PDF is too big and too vague. Small pieces match a question precisely.
8. **How did we chunk? How many chunks?**
   By the document's own structure (FAQ questions, SOP section numbers, glossary terms), merging pieces under 100
   characters and splitting pieces over 1,000. Result: 219 chunks.
9. **What happens if chunks are too big or too small?**
   Too big: noise and diluted meaning. Too small: no context to answer from.
10. **Why a database (pgvector) and not a Python list?**
    It stores vectors, searches them fast with an index, survives restarts, and works with normal SQL.
11. **What is `top_k` and what did we use?**
    How many chunks to fetch. We use 3.
12. **What is the score gate (`min_score` = 0.6)?**
    If the best chunk scores below 0.6, we decide nothing relevant exists and do not call Gemini. This stops made-up answers.
13. **How do we make the LLM say "I don't know"?**
    The prompt says to use only the supplied text; the score gate catches questions with no match; the answer
    comes back as JSON with a status we check.
14. **Why ask Gemini for JSON? Why check it afterwards?**
    So we get answer + citations in a fixed shape (Pydantic checks it). If the format is wrong, we do not trust it.
15. **Why a low temperature (0.1)?**
    Less randomness: the same question gives the same, more factual answer.
16. **How do citations work?**
    Each chunk keeps its document title, page and URL. The answer lists the chunks it used.
17. **Why a backup chat model and retries?**
    A model can be overloaded. We retry, then try the second model, and only then report the service as unavailable.
18. **How did we test the RAG part?**
    A set of test questions with expected behaviour (8 of 8 passed), including questions that should be refused.
19. **Does the knowledge base need rebuilding each time?**
    No. `build_kb.py` loads the committed chunks and embeddings into the database in seconds, with no Gemini calls.

---

## 4. Agents and tool use

1. **What is the difference between a chatbot and an agent?**
   An agent can decide to call tools and use the results, in a loop, before answering.
2. **What is function (tool) calling?**
   You describe functions to the LLM; it replies with "call this function with these arguments"; your code runs it
   and returns the result.
3. **How does the LLM know what a tool does?**
   From the function's name, type hints and docstring. That is why the docstring is written as a clear description.
4. **What are our four tools?**
   `get_live_weather`, `predict_next_hour_temperature`, `backtest_temperature` and `search_imd_documents`.
5. **Why is the RAG pipeline a tool and not always on?**
   Not every question needs documents. "What is it right now?" needs live data; "What is a heat wave?" needs IMD text.
6. **What is LangGraph? What is the graph?**
   A library that runs the loop as a state graph: the agent step, a tools step, then back to the agent until it
   has a final answer.
7. **How does the agent choose a tool?**
   Gemini reads the question and the tool descriptions, then decides. We checked 6 routing cases.
8. **What happens if a tool fails?**
   It returns `{"error": ...}` instead of crashing, so the LLM can tell the user the data is unavailable.
9. **How do we stop the agent from inventing numbers?**
   Rules in the prompt: use tool results only, say when data is missing.
10. **What is "grounding"?**
    Tying every answer to a source: a tool result or an IMD document.
11. **Is the live weather the same data as the training data?**
    No. Live data comes from the Open-Meteo forecast model; training used ERA5 history. Values can differ a little.
12. **What is the backtest tool for?**
    It tests our model on a past hour (from the 24 real hours before it) and compares it with the truth and with the lazy guess.
13. **How does the agent remember a conversation?**
    The message history is passed in on each call (`chat.py` keeps it for you), so follow-ups like "and in one hour?" work.
14. **What if Gemini is down? What if the database is down?**
    Gemini down gives a 503. Database down: the agent still answers from the tools that do not need it.
15. **What is the same "features" file used for in the tool?**
    `features.py` defines the model's inputs once. Training and live prediction both use it, so they always compute
    features the same way ("training-serving consistency").
16. **What is prompt engineering here?**
    Writing clear tool descriptions and a system prompt: when to use each tool, what to do when data is missing.

---

## 5. MLOps

1. **What is MLOps, in simple words?**
   Treating model training like software work: tracked, repeatable and safe to change.
2. **What problem does MLflow solve?**
   Without it, you forget which settings gave which score. MLflow keeps a logbook of every run.
3. **What are a run, params, metrics, artifacts and tags?**
   Run = one training. Params = settings we chose. Metrics = numbers we got. Artifacts = files (model, `metrics.json`).
   Tags = labels, e.g. `quality_gate`.
4. **Where is the data stored? Why is it not in git?**
   `mlflow.db` and `mlruns/` on your PC. They are personal run history, so they are git-ignored; only the code is pushed.
5. **How do I open the dashboard?**
   `python -m mlflow ui --backend-store-uri sqlite:///mlflow.db`, then open http://localhost:5000.
6. **Why is MLflow in `requirements-dev.txt` and not in Docker?**
   The API only needs the trained model. MLflow is a development tool, and `train.py` works without it
   (`--no-mlflow` or when it is not installed).
7. **Why change only one setting per experiment?**
   Otherwise you cannot tell which change helped.
8. **Which score do I compare runs on? Why?**
   Validation RMSE. Use the test number only for the final check.
9. **What did our experiments show?**
   More rounds helped: 600 rounds gave validation 0.3962 and test 0.4097. A lower learning rate with many rounds was about the same.
10. **What is the quality gate?**
    `train.py` saves a new model only if it beats the lazy guess and is not worse than the current model.
11. **What happens to a rejected run?**
    It is still logged in MLflow (tagged `rejected` with a reason), but the saved model and `metrics.json` stay unchanged.
12. **Why is that important?**
    A pipeline must never replace a good model with a worse one by accident.
13. **Why log a failed or rejected run at all?**
    You learn from it, and you can show what was tried.
14. **Which MLOps parts did we skip, and why?**
    Data checks, monitoring and CI. They are valid next steps but were out of scope for this crash course.
15. **Why did the metric numbers change from 0.4116 to 0.4097?**
    We found better settings (600 rounds) and the gate accepted that model.
16. **What is reproducibility, and how do we get it?**
    The same code on a clean machine gives the same result: pinned packages, fixed `random_state`, a README with exact commands.
