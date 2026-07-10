# Tavily Agent

A lightweight Flask-based AI search agent that combines a Groq-hosted LLM with Tavily-powered live web search. The app streams answers over Server-Sent Events (SSE) and enriches replies with source links extracted from tool results. If the model or search backend is unavailable, the app gracefully falls back to a demo response instead of crashing.

## Features

- Live conversational search with streaming, token-by-token answer updates
- Tool-using AI agent built with `langgraph`, powered by `langchain-groq` and `langchain-tavily`
- Automatic source extraction from Tavily search results for transparent, cited responses
- Per-thread conversation memory via `MemorySaver` and a `thread_id`
- Graceful demo-mode fallback when API keys are missing, quota is exceeded, or the service is unavailable
- Simple, modern UI with a separate landing page and chat interface

## Repository Structure

```
Tavily-Agent/
├── app.py                 # Flask app, LangGraph agent, SSE /chat endpoint, source extraction
├── requirements.txt        # Python dependencies
├── templates/
│   ├── landing.html        # Marketing-style landing page
│   └── index.html          # Chat interface shell
├── static/
│   ├── script.js            # Chat UI logic, SSE client, rendering
│   └── style.css            # Styling for landing + chat UI
├── tests/
│   └── test_app.py          # Unit tests for SSE formatting and demo-mode fallback
└── LICENSE                  # MIT License
```

## Requirements

- Python 3.11+ (recommended)
- API keys for:
  - `GROQ_API_KEY` – Groq API key (used to run the `llama-3.3-70b-versatile` model)
  - `TAVILY_API_KEY` – Tavily search API key

## Setup

1. Clone the repository:

   ```bash
   git clone https://github.com/patilsujal0911-source/Tavily-Agent.git
   cd Tavily-Agent
   ```

2. Create and activate a virtual environment:

   ```bash
   python -m venv .venv
   source .venv/bin/activate      # macOS/Linux
   .\.venv\Scripts\Activate.ps1   # Windows PowerShell
   ```

3. Install dependencies:

   ```bash
   pip install -r requirements.txt
   ```

   > **Note:** `app.py` imports `langchain_groq`, so make sure `langchain-groq` is installed (add it to `requirements.txt` if it isn't already listed) alongside the other dependencies.

4. Create a `.env` file in the project root with your API keys:

   ```env
   GROQ_API_KEY=your_groq_api_key_here
   TAVILY_API_KEY=your_tavily_api_key_here
   ```

   Optionally enable demo mode without any keys:

   ```env
   DEMO_MODE=true
   ```

## Running the Application

Start the Flask development server:

```bash
python app.py
```

Then open your browser to:

- `http://localhost:5000` – landing page
- `http://localhost:5000/app` – chat interface

## Usage

The chat UI sends a `POST` request to `/chat` with a JSON body:

```json
{
  "message": "Your question here",
  "thread_id": "optional-thread-id"
}
```

The server responds with a stream of SSE events:

| Event         | Description                                              |
|---------------|------------------------------------------------------------|
| `token`       | Partial answer text chunks as they're generated            |
| `tool_start`  | A tool (e.g. web search) has started running                |
| `tool_end`    | A tool has finished, includes any extracted sources          |
| `done`        | Final answer text plus the aggregated list of sources        |
| `error`       | A user-facing error message when something goes wrong        |

## Architecture Overview

`app.py` builds a tool-using agent graph with `langgraph`:

1. `ChatGroq` is initialized with the `llama-3.3-70b-versatile` model and bound to a `TavilySearch` tool.
2. The graph alternates between the LLM node (`tool_calling_llm`) and a `ToolNode` that executes Tavily searches, using `tools_condition` to decide when a tool call is needed.
3. `MemorySaver` persists conversation state per `thread_id`, enabling multi-turn context.
4. As the agent streams events (`astream_events`), the app relays model tokens and tool activity to the client over SSE, extracting and deduplicating source URLs from tool outputs along the way.
5. If the agent raises an error that looks like a missing key, quota limit, or connectivity issue, the app transparently switches to `stream_demo_response`, so the UI still returns a complete (placeholder) response instead of failing.

The UI is served by Flask templates:

- `templates/landing.html` – marketing-style landing page
- `templates/index.html` – interactive chat shell that consumes the SSE stream (see `static/script.js`)

## Testing

Run the unit tests with:

```bash
python -m unittest tests/test_app.py
```

The test suite covers SSE payload formatting, the demo-mode fallback path when the model is unavailable, and query-string prefilling of the chat input.

## Troubleshooting

- **Server fails on startup / "not set" errors** – verify `GROQ_API_KEY` and `TAVILY_API_KEY` are set in `.env`, or set `DEMO_MODE=true` to bypass live API calls entirely.
- **Responses fall back to demo mode unexpectedly** – check the server logs for a `[DEMO FALLBACK]` line, which prints the underlying error (often a rate limit, timeout, or invalid credential).
- **Missing `langchain_groq` module** – it's used in `app.py` but may not be pinned in `requirements.txt`; install it manually with `pip install langchain-groq`.
- **No sources returned** – confirm your `TAVILY_API_KEY` is valid and that the query actually triggers a tool call (some questions may be answered directly by the LLM without searching).

## Notes

- This project is a demo/prototype for AI-assisted, source-cited web search.
- The app is designed to degrade gracefully: if live APIs are unreachable, users still get a coherent (demo) response rather than a broken UI.

## License

MIT License — see the [LICENSE](LICENSE) file for details.
