import logging
import sys

from agent import run_agent
from rag import ServiceUnavailable
from rag.config import get_settings

GREY, GREEN, RED, RESET = "\033[90m", "\033[92m", "\033[91m", "\033[0m"


def main() -> None:
    sys.stdout.reconfigure(encoding="utf-8")   # so "°C" prints correctly in the Windows terminal
    logging.basicConfig(level=logging.WARNING, format=f"{GREY}%(levelname)s %(name)s: %(message)s{RESET}")
    for noisy in ("httpx", "google_genai", "langchain_google_genai"):
        logging.getLogger(noisy).setLevel(logging.ERROR)

    limit = get_settings().max_question_chars
    history: list = []
    print("Mumbai weather assistant. Ask a question, /reset to start over, /exit to quit.\n")

    while True:
        try:
            question = input("You: ").strip()
        except (KeyboardInterrupt, EOFError):
            print("\nBye!")
            return

        if not question:
            continue
        if question.lower() in ("/exit", "/quit", "exit", "quit"):
            print("Bye!")
            return
        if question.lower() == "/reset":
            history = []
            print(f"{GREY}(conversation forgotten){RESET}\n")
            continue
        if len(question) > limit:
            print(f"{RED}The question is too long (max {limit} characters).{RESET}\n")
            continue

        print(f"{GREY}thinking...{RESET}", end="\r")
        try:
            result = run_agent(question, history)
        except ServiceUnavailable as error:
            print(f"{RED}Bot: {error} Please try again in a moment.{RESET}\n")
            continue
        except KeyboardInterrupt:
            print("\n(cancelled)\n")
            continue

        history = result["messages"]
        print(f"{GREEN}Bot:{RESET} {result['answer']}")
        details = f"tools: {', '.join(result['tools_used']) or 'none'}"
        if result["sources"]:
            details += "   sources: " + ", ".join(f"[{s['chunk_id']}] p.{s['pages']}" for s in result["sources"])
        print(f"{GREY}     {details}{RESET}\n")


if __name__ == "__main__":
    main()
