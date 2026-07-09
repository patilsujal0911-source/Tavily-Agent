# Tavily-Agent

A lightweight Flask-based AI search agent that combines Google Gemini generative responses with Tavily-powered live web search. The app streams answer content over Server-Sent Events (SSE) and enriches replies with source links extracted from tool results.

## Features

- Live conversational search with streaming answer updates
- Integration with `langchain-google-genai` and `langchain-tavily`
- Tool-enabled reasoning via `langgraph`
- Source extraction from web results for transparent responses
- Simple modern UI with separate landing and chat interfaces

## Repository Structure

- `app.py` – Flask application, AI graph builder, SSE chat endpoint, and source extraction logic
- `requirements.txt` – Python dependencies
- `templates/` – HTML templates for landing page and chat interface
- `static/` – CSS and JavaScript for client UI
- `tests/test_app.py` – basic unit test for SSE payload formatting
- `LICENSE` – project license

## Requirements

- Python 3.11+ (recommended)
- Windows / PowerShell or compatible terminal
- Valid API keys for:
  - `GEMINI_API_KEY` for Google Gemini generative API
  - `TAVILY_API_KEY` for Tavily search integration

## Setup

1. Clone the repository:

   ```powershell
   git clone <repo-url> "Tavily-Agent"
   cd "Tavily-Agent"
   ```

2. Create and activate a virtual environment:

   ```powershell
   python -m venv .venv
   .\.venv\Scripts\Activate.ps1
   ```

3. Install dependencies:

   ```powershell
   pip install -r requirements.txt
   ```

4. Create a `.env` file in the project root with your API keys:

   ```text
   GEMINI_API_KEY=your_gemini_api_key_here
   TAVILY_API_KEY=your_tavily_api_key_here
   ```

## Running the Application

Start the Flask server with:

```powershell
python app.py
```

Then open your browser to:

- `http://localhost:5000` – landing page
- `http://localhost:5000/app` – chat interface

## Usage

The chat UI sends a `POST` request to `/chat` containing JSON like:

```json
{
  "message": "Your question here",
  "thread_id": "optional-thread-id"
}
```

The server replies using SSE events:

- `token` – partial answer text chunks
- `tool_start` / `tool_end` – tool execution status events
- `done` – final answer message and aggregated sources
- `error` – error messages when something fails

## Configuration

Required environment variables:

- `GEMINI_API_KEY` – Google Gemini API key
- `TAVILY_API_KEY` – Tavily search API key

Optional Flask settings can be passed through environment variables or modified in `app.py`.

## Testing

Run the unit tests with:

```powershell
python -m unittest tests/test_app.py
```

## Architecture Overview

`app.py` builds an AI agent graph using `langgraph`:

- `ChatGoogleGenerativeAI` is initialized with the Gemini model `gemini-2.0-flash`
- `TavilySearch` is registered as a tool for live search
- The graph alternates between chat model invocation and tool execution
- `MemorySaver` persists state across threads (via `thread_id`)
- Source URLs are extracted from tool outputs and returned to the client

The UI is served by Flask templates:

- `templates/landing.html` – marketing-style landing page
- `templates/index.html` – interactive AI chat shell

## Troubleshooting

- If the server fails on startup, verify `GEMINI_API_KEY` and `TAVILY_API_KEY` are set in `.env`
- If responses are missing or delayed, ensure network access to the Google Gemini and Tavily APIs
- Use `python app.py` output to inspect runtime errors

## Notes

- This project is intended as a demo/prototype for AI-assisted search
- The app uses SSE streaming to provide a real-time conversational experience

## License

See the `LICENSE` file for license details.
