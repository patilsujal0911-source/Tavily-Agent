import asyncio
import os
import json
import uuid
from typing import Annotated

from dotenv import load_dotenv
from flask import Flask, Response, request, render_template
from langchain_core.messages import HumanMessage
from langchain_groq import ChatGroq
from langchain_tavily import TavilySearch
from typing_extensions import TypedDict
from langgraph.checkpoint.memory import MemorySaver
from langgraph.graph import START, StateGraph
from langgraph.graph.message import add_messages
from langgraph.prebuilt import ToolNode, tools_condition


load_dotenv()

app = Flask(__name__)


graph = None


class State(TypedDict):
    messages: Annotated[list, add_messages]


def build_graph():
    if not os.getenv("GROQ_API_KEY"):
         raise RuntimeError("GROQ_API_KEY is not set")
    if not os.getenv("TAVILY_API_KEY"):
        raise RuntimeError("TAVILY_API_KEY is not set")

    llm = ChatGroq(
    model="llama-3.3-70b-versatile",
    temperature=0.4,
    timeout=25,
    max_retries=1,
    api_key=os.getenv("GROQ_API_KEY"),
)
    
    search_tool = TavilySearch(max_results=3)
    tools = [search_tool]
    llm_with_tools = llm.bind_tools(tools)

    def tool_calling_llm(state: State):
        return {"messages": [llm_with_tools.invoke(state["messages"])]}

    builder = StateGraph(State)
    builder.add_node("tool_calling_llm", tool_calling_llm)
    builder.add_node("tools", ToolNode(tools))

    builder.add_edge(START, "tool_calling_llm")
    builder.add_conditional_edges("tool_calling_llm", tools_condition)
    builder.add_edge("tools", "tool_calling_llm")

    memory = MemorySaver()
    return builder.compile(checkpointer=memory)


def get_graph():
    global graph
    if graph is None:
        graph = build_graph()
    return graph


def emit_sse(event: str, payload: dict) -> str:
    return f"event: {event}\ndata: {json.dumps(payload)}\n\n"


def extract_sources(payload) -> list[dict]:
    sources: list[dict] = []
    seen = set()

    def visit(value):
        if isinstance(value, dict):
            url = value.get("url")
            if isinstance(url, str) and url.startswith("http"):
                clean_url = url.strip()
                if clean_url not in seen:
                    title = value.get("title") or value.get("name") or value.get("source") or clean_url
                    sources.append({"title": str(title), "url": clean_url})
                    seen.add(clean_url)
            for key in ("results", "sources", "items", "data"):
                nested = value.get(key)
                if isinstance(nested, list):
                    for item in nested:
                        visit(item)
            for nested in value.values():
                if isinstance(nested, (dict, list)):
                    visit(nested)
        elif isinstance(value, list):
            for item in value:
                visit(item)
        elif hasattr(value, "content"):
            visit(value.content)

    visit(payload)
    return sources


def extract_text(content) -> str:
    if content is None:
        return ""
    if isinstance(content, str):
        return content
    if isinstance(content, list):
        parts = []
        for item in content:
            if isinstance(item, str):
                parts.append(item)
            elif isinstance(item, dict):
                if item.get("type") == "text":
                    parts.append(item.get("text", ""))
                elif item.get("type") == "tool_use":
                    parts.append(f"[tool: {item.get('name', 'tool')}]")
        return "".join(parts)
    if hasattr(content, "content"):
        return extract_text(content.content)
    return str(content)


def should_use_demo_mode() -> bool:
    return os.getenv("DEMO_MODE", "").strip().lower() in {"1", "true", "yes", "on"}


def is_unavailable_error(exc: Exception) -> bool:
    message = str(exc).lower()
    return any(token in message for token in ["api key", "not set", "credential", "quota", "resource_exhausted", "429", "rate limit", "timeout", "connection", "unavailable", "temporarily unavailable"])


def stream_demo_response(user_message: str):
    demo_text = (
        f"Demo mode is active for: {user_message or 'your request'}. "
        "The live model service is unavailable right now, so this polished placeholder response shows how the chat will feel once the API is available."
    )
    words = demo_text.split()

    yield emit_sse("tool_start", {"name": "demo", "message": "Preparing demo answer…"})
    for index, word in enumerate(words):
        suffix = " " if index < len(words) - 1 else ""
        yield emit_sse("token", {"text": f"{word}{suffix}"})
    yield emit_sse(
        "tool_end",
        {
            "name": "demo",
            "message": "Demo response ready.",
            "sources": [
                {"title": "Tavily Agent Demo", "url": "https://example.com/demo"}
            ],
        },
    )
    yield emit_sse("done", {"message": demo_text, "sources": [{"title": "Tavily Agent Demo", "url": "https://example.com/demo"}]})


@app.get("/")
def landing():
    return render_template("landing.html")


@app.get("/app")
def index():
    message = request.args.get("message", "").strip()
    return render_template("index.html", initial_message=message)


@app.post("/chat")
def chat():
    payload = request.get_json(silent=True) or {}
    user_message = (payload.get("message") or "").strip()
    thread_id = (payload.get("thread_id") or str(uuid.uuid4())).strip()

    if not user_message:
        return Response(
            emit_sse("error", {"message": "A message is required."}),
            mimetype="text/event-stream",
        )

    def generate():
        try:
            if should_use_demo_mode():
                yield from stream_demo_response(user_message)
                return

            agent = get_graph()
            config = {"configurable": {"thread_id": thread_id}}
            state = {"messages": [HumanMessage(content=user_message)]}

            full_text = ""
            sources: list[dict] = []
            async_events = agent.astream_events(state, config=config, version="v2")
            while True:
                try:
                    event = asyncio.run(async_events.__anext__())
                except StopAsyncIteration:
                    break
                except RuntimeError:
                    event = None

                if event is None:
                    continue

                event_name = event.get("event")
                data = event.get("data", {})

                if event_name == "on_chat_model_stream":
                    chunk = data.get("chunk")
                    token = extract_text(chunk)
                    if token:
                        full_text += token
                        yield emit_sse("token", {"text": token})

                elif event_name in {"on_tool_start", "on_tool_node_start"}:
                    tool_name = None
                    if isinstance(data.get("input"), dict):
                        tool_name = data["input"].get("tool_name") or data["input"].get("name")
                    tool_name = tool_name or data.get("tool_name") or data.get("name") or "tool"
                    yield emit_sse(
                        "tool_start",
                        {"name": tool_name, "message": f"Using {tool_name}…"},
                    )

                elif event_name in {"on_tool_end", "on_tool_node_end"}:
                    tool_name = None
                    if isinstance(data.get("output"), dict):
                        tool_name = data["output"].get("tool_name") or data["output"].get("name")
                    tool_name = tool_name or data.get("tool_name") or data.get("name") or "tool"
                    extracted_sources = extract_sources(data.get("output") or data)
                    if extracted_sources:
                        for source in extracted_sources:
                            if source not in sources:
                                sources.append(source)
                    yield emit_sse(
                        "tool_end",
                        {
                            "name": tool_name,
                            "message": f"Completed {tool_name} search.",
                            "sources": extracted_sources,
                        },
                    )

            if not full_text:
                final_state = agent.invoke(state, config=config)
                messages = final_state.get("messages", [])
                if messages:
                    full_text = extract_text(messages[-1].content)

            yield emit_sse("done", {"message": full_text, "sources": sources})

        except Exception as exc:
            if is_unavailable_error(exc):
                print(f"[DEMO FALLBACK] Real error was: {exc!r}")
                yield from stream_demo_response(user_message)
                return

            message = str(exc)
            lowered = message.lower()
            if "api key" in lowered or "not set" in lowered or "credential" in lowered:
                friendly_message = "The assistant is not configured correctly. Please check the API keys."
            elif "quota" in lowered or "resource_exhausted" in lowered or "429" in lowered or "rate limit" in lowered:
                friendly_message = "The assistant is temporarily unavailable because the model quota has been exceeded. Please try again shortly."
            else:
                friendly_message = "The assistant could not complete that request. Please try again."
            print(f"[UNHANDLED ERROR] {exc!r}")
            yield emit_sse("error", {"message": friendly_message})

    return Response(generate(), mimetype="text/event-stream")



if __name__ == "__main__":
    app.run(
        host="0.0.0.0",
        port=int(os.environ.get("PORT", 5000)),
        debug=False
    )