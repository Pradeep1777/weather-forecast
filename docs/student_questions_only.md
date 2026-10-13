# Student Questions: AI Engineering Crash Course

## 1. Python, FastAPI and Basics
1. Why do we use a virtual environment (venv)?
2. What does "pinning" a package version mean?
3. What is `.gitignore` for, and what kinds of files should go in it?
4. Why do we keep API keys in `.env` and never in code or git?
5. Why use `logging` instead of `print`?
6. What is a REST API, and what is an endpoint?
7. What is FastAPI, and why use it instead of Flask?
8. What is Pydantic, and what does it do for us?
9. What do the status codes 200, 422 and 503 mean?
10. Why does an API response include a `status` field?
11. What is a `/health` endpoint for?
12. Why catch errors and return a clean message instead of letting the app crash?
13. What is the difference between a library and an API?
14. What is Docker? What is the difference between an image and a container?
15. Why does `docker compose` start more than one service (app + database)?
16. Why do we run services on different ports?
17. Why does a "clean clone" test matter?

## 2. ML Model Training
1. What is a baseline model, and what is a "lazy guess" (persistence)?
2. Why is beating a simple baseline not always impressive?
3. What are RMSE and MAE, and when does RMSE punish errors more?
4. What are lag features, and why do we use `shift()`?
5. What is data leakage? Give an example.
6. Why can't we shuffle the data when splitting a time series?
7. What are the train, validation and test sets?
8. Why do we need a validation set if we already have a test set?
9. Why do we refit the final model on train + validation?
10. Why use gradient boosting instead of only a linear model?
11. What does Ridge's `alpha` control, and why do we scale features for it?
12. What do `learning_rate` and `max_iter` do in gradient boosting?
13. Why is training error not the number to trust?
14. Why save the model with `joblib`, and what should be stored with it?
15. Why train with a script when we already have a notebook?
16. What does `random_state` do?

## 3. RAG Implementation
1. What is RAG, in one sentence?
2. Why not just ask the LLM directly?
3. What is an embedding?
4. What is cosine similarity?
5. Why use different task types for embedding questions and documents?
6. Why do we split documents into chunks?
7. How should we decide the chunk size and chunking strategy?
8. What goes wrong if chunks are too big or too small?
9. Why use a vector database (pgvector) instead of a Python list?
10. What is `top_k`, and how do we choose it?
11. What is a score threshold gate, and why use one?
12. How do we make the LLM say "I don't know"?
13. Why ask the LLM for JSON output, and why validate it afterwards?
14. Why use a low temperature?
15. How do citations work in a RAG answer?
16. Why use a backup model and retries?
17. How do we test a RAG system?
18. Do we need to rebuild the knowledge base every time?

## 4. Agents and Tool Use
1. What is the difference between a chatbot and an agent?
2. What is function (tool) calling?
3. How does the LLM know what a tool does?
4. Why is RAG a tool in an agent instead of always running?
5. What is LangGraph, and what is the graph?
6. How does the agent choose which tool to call?
7. What should happen when a tool fails?
8. How do we stop the agent from inventing numbers?
9. What is "grounding"?
10. How does the agent remember a conversation?
11. What should happen if the LLM service or the database is down?
12. Why define model features in one shared file (training-serving consistency)?
13. What is prompt engineering in an agent?

## 5. MLOps
1. What is MLOps, in simple words?
2. What problem does MLflow solve?
3. What are a run, params, metrics, artifacts and tags?
4. Where does MLflow store its data, and why is it not in git?
5. How do I open the MLflow dashboard?
6. Why is MLflow a dev dependency and not in the Docker image?
7. Why change only one setting per experiment?
8. Which score do we compare runs on, and why?
9. What is a quality gate?
10. What should happen to a rejected run?
11. Why is a quality gate important?
12. Why log failed or rejected runs at all?
13. What MLOps topics did we skip (data checks, monitoring, CI), and why?
14. What is reproducibility, and how do we achieve it?
