import json
import logging
import re
from functools import lru_cache

from google.genai import errors as genai_errors
from langchain_core.messages import AIMessage, HumanMessage, SystemMessage, ToolMessage
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_google_genai._common import GoogleGenerativeAIError
from langgraph.errors import GraphRecursionError
from langgraph.graph import START, MessagesState, StateGraph
from langgraph.prebuilt import ToolNode, tools_condition

from rag.config import get_settings
from rag.retrieval import ServiceUnavailable

from .tools import TOOLS

logger = logging.getLogger(__name__)

AGENT_RULES = """You are a weather assistant for operations staff in Mumbai, India.

Which tool to use:
- Weather right now, or rain/conditions over the next hours: get_live_weather.
- Temperature in the NEXT HOUR: predict_next_hour_temperature (our own trained model). Say it is our model's prediction.
- A specific PAST date and hour (1980-2025), or "how accurate is the model" on real data: backtest_temperature.
  Report the predicted and the real temperature and the error, and say whether that hour was in the training data.
  If no hour is given for a past date, use 12:00. Future dates: say the model only predicts the next hour from now.
- Definitions, thresholds, rules, warning levels or official advice: search_imd_documents.
- A question may need more than one tool (e.g. "is the current temperature a heat wave?" needs live data AND the IMD criteria).
- Greetings or questions about what you can do: answer directly, no tool.

Rules:
- You only cover Mumbai. For other places, say so.
- Use only facts from tool results. Never invent numbers or rules.
- When you use IMD document passages, put their chunk id in square brackets after the fact, e.g. [heat_faq-004].
- If a tool returns an error or finds nothing, say the information is unavailable.
- Be short and plain: 1-4 sentences."""

MAX_STEPS = 8  # LangGraph "recursion limit": stops endless tool loops
MAX_HISTORY = 20  # messages of earlier conversation sent along with a follow-up question


def _make_llm():
    settings = get_settings()
    # No temperature: the current Gemini Flash models use fixed sampling and ignore it.
    # Consistent, grounded answers come from AGENT_RULES and the tools, not from sampling settings.
    models = [ChatGoogleGenerativeAI(model=name, api_key=settings.gemini_api_key, max_retries=6).bind_tools(TOOLS)
              for name in settings.chat_models]
    return models[0].with_fallbacks(models[1:]) if len(models) > 1 else models[0]


@lru_cache
def build_agent():
    llm = _make_llm()

    def agent_node(state: MessagesState) -> dict:
        reply = llm.invoke([SystemMessage(AGENT_RULES)] + state["messages"])
        return {"messages": [reply]}

    graph = StateGraph(MessagesState)
    graph.add_node("agent", agent_node)
    graph.add_node("tools", ToolNode(TOOLS))
    graph.add_edge(START, "agent")
    graph.add_conditional_edges("agent", tools_condition)   # tool calls -> "tools", otherwise -> END
    graph.add_edge("tools", "agent")
    return graph.compile()


def _sources(messages: list, answer: str) -> list[dict]:
    """IMD passages the answer cites with [chunk_id] (only ids the search tool really returned)."""
    returned = {}
    for m in messages:
        if isinstance(m, ToolMessage) and m.name == "search_imd_documents":
            try:
                for p in json.loads(m.content).get("passages", []):
                    returned[p["chunk_id"]] = p
            except (json.JSONDecodeError, TypeError):
                continue
    # every chunk id inside square brackets, also several in one: [forecast_sop-168, cyclone_terms-159]
    cited = dict.fromkeys(cid for group in re.findall(r"\[([^\]]+)\]", answer)
                          for cid in re.findall(r"[a-z_]+-\d{3}", group))
    invented = [c for c in cited if c not in returned]
    if invented:
        logger.warning("Agent cited unknown chunk ids %s - ignored", invented)
    return [{k: returned[c][k] for k in ("chunk_id", "document", "pages", "url")} for c in cited if c in returned]


def trim_history(messages: list, max_messages: int = MAX_HISTORY) -> list:
    """Keep the recent part of a conversation, always starting at a user question
    (so a tool result is never separated from the tool call that asked for it)."""
    if len(messages) <= max_messages:
        return messages
    recent = messages[-max_messages:]
    for i, m in enumerate(recent):
        if isinstance(m, HumanMessage):
            return recent[i:]
    return []


def run_agent(question: str, history: list | None = None) -> dict:
    """Answer one question. Pass the previous result's "messages" as history for a follow-up."""
    history = trim_history(history or [])
    try:
        result = build_agent().invoke({"messages": history + [HumanMessage(question)]},
                                      config={"recursion_limit": MAX_STEPS})
    except GraphRecursionError:
        logger.warning("Agent hit the %d-step limit for question %r", MAX_STEPS, question[:80])
        return {"status": "incomplete", "answer": "Sorry, I could not finish answering that question. Please ask it more simply.",
                "tools_used": [], "sources": [], "steps": MAX_STEPS, "messages": history}
    except (GoogleGenerativeAIError, genai_errors.APIError) as error:
        # every model (main + backup) failed, even after retries: the LLM service is down or out of quota
        logger.error("Gemini failed for all models: %s", error)
        raise ServiceUnavailable("The language model is not reachable right now.") from error

    messages = result["messages"]
    turn = messages[len(history):]          # only this question's messages, not the earlier turns
    final = messages[-1]
    answer = final.text.strip() if isinstance(final, AIMessage) else ""
    tools_used = [call["name"] for m in turn if isinstance(m, AIMessage) for call in m.tool_calls]
    return {
        "status": "answered",
        "answer": answer or "Sorry, I could not produce an answer.",
        "tools_used": tools_used,
        "sources": _sources(turn, answer),
        "steps": len(turn),
        "messages": messages,               # the whole conversation, to pass back as history
    }
