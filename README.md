# 🥷 UW Smart AI Assistant

An agentic AI portal for specialty commercial lines underwriters.
Underwriters view referral and decline policies, open an AI-powered chat panel per policy,
and receive synthesised analysis, re-rating history, and professionally drafted broker emails —
all grounded in API data, never hallucinated.

---

## Demo

<!-- Replace demo.mp4 with your actual video file name once added to the repo -->
https://github.com/malateshmedleri029/UW-AI-Assistant/assets/demo.mp4

---

## Table of Contents
- [System Design](PLAN.md)
- [Architecture Overview](#architecture-overview)
- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
- [Backend — File by File](#backend--file-by-file)
- [Frontend — File by File](#frontend--file-by-file)
- [Evaluation Framework](#evaluation-framework)
- [Local Development Setup](#local-development-setup)
- [Environment Variables](#environment-variables)
- [API Reference](#api-reference)
- [How the AI Agent Works](#how-the-ai-agent-works)
- [How Streaming Works](#how-streaming-works)
- [Session Management](#session-management)
- [Guardrails](#guardrails)
- [Production Considerations](#production-considerations)
- [Known Limitations](#known-limitations)

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                    BROWSER (Angular 17)                      │
│                                                              │
│  UwHeaderComponent          PolicySearchComponent           │
│  HomeComponent (dashboard)  PolicyTableComponent            │
│  ChatWindowComponent  ──── ChatMessageComponent             │
│                        └── ChatPromptsComponent             │
│                                                              │
│  PolicyService (HTTP)       ChatService (fetch + SSE)       │
└────────────────────────────┬────────────────────────────────┘
                             │ HTTP / SSE
┌────────────────────────────▼────────────────────────────────┐
│                  FastAPI Backend (Python)                     │
│                                                              │
│  /api/policies  (REST)     /api/chat  (SSE stream)          │
│  policies router           chat router                       │
│                                 │                           │
│  mock_policies.py          ADK Runner                        │
│  mock_qa_data.py           LlmAgent (Gemini 2.5 Flash Lite)  │
│                                 │                           │
│                            Tool calls:                       │
│                            ├── get_referral_reasons         │
│                            ├── get_decline_reasons          │
│                            ├── get_rerating_history_tool    │
│                            ├── generate_broker_email        │
│                            └── update_policy_status_tool    │
│                                                              │
│  Guardrails: before_model / before_tool / after_model /     │
│              after_tool callbacks                           │
└─────────────────────────────────────────────────────────────┘
```

**Key design principle:** The LLM never invents policy data. It always calls a tool first,
receives the API response, then synthesises and presents only those facts to the underwriter.

---

## Tech Stack

| Layer | Technology | Purpose |
|---|---|---|
| Frontend | Angular 17 (standalone components) | Dashboard + chat UI |
| UI Library | Angular Material 17 | Components, tables, tabs |
| Styling | SCSS + CSS Custom Properties | Wine & Black brand palette |
| HTTP/Stream | Native `fetch` + `ReadableStream` | SSE consumption |
| Backend | FastAPI (Python 3.12) | REST API + SSE endpoint |
| AI Framework | Google ADK (Agent Development Kit) | Agent orchestration |
| LLM | Gemini 2.5 Flash Lite | Analysis + email drafting |
| Streaming | `sse-starlette` | Server-Sent Events |
| Config | `pydantic-settings` + `python-dotenv` | Environment management |
| Package mgr | `uv` (Python) / `npm` (Node) | Dependency management |

---

## Project Structure

```
UW-AI-Assistant/
│
├── backend/                        # Python FastAPI application
│   ├── app/
│   │   ├── main.py                 # FastAPI app entry point
│   │   ├── config.py               # Settings (pydantic-settings)
│   │   ├── agents/
│   │   │   └── uw_assistant/
│   │   │       ├── agent.py        # LlmAgent definition
│   │   │       ├── tools.py        # 5 tool functions for the LLM
│   │   │       └── guardrails.py   # 4 ADK callback guardrails
│   │   ├── data/
│   │   │   ├── mock_policies.py    # Synthetic policy inventory
│   │   │   └── mock_qa_data.py     # Referral/decline Q&A + re-rating data
│   │   ├── models/
│   │   │   └── schemas.py          # Pydantic models (request/response shapes)
│   │   └── routers/
│   │       ├── policies.py         # REST endpoints for policy CRUD
│   │       └── chat.py             # SSE streaming chat endpoint
│   ├── evals/                      # ADK evaluation framework
│   │   ├── test_config.json        # Metrics config and thresholds
│   │   ├── rubrics/
│   │   │   └── email_quality.txt   # Custom rubric for email scoring
│   │   └── datasets/               # 65 test cases across 6 files
│   ├── requirements.txt
│   └── .env.example
│
└── frontend/                       # Angular 17 application
    ├── src/
    │   ├── app/
    │   │   ├── app.component.ts    # Root component
    │   │   ├── app.routes.ts       # Routing config
    │   │   ├── components/
    │   │   │   ├── uw-header/      # Top navigation bar
    │   │   │   ├── policy-search/  # Search + LOB filter bar
    │   │   │   ├── policy-table/   # Policy data table
    │   │   │   ├── chat-window/    # Main chat slide-in panel
    │   │   │   ├── chat-message/   # Individual message bubble
    │   │   │   └── chat-prompts/   # Suggested prompt pills
    │   │   ├── models/
    │   │   │   ├── policy.model.ts # PolicySummary TypeScript interface
    │   │   │   └── chat.model.ts   # ChatMessage, ChatEvent interfaces
    │   │   ├── pages/
    │   │   │   └── home/           # Dashboard page (stats + table + chat)
    │   │   └── services/
    │   │       ├── policy.service.ts  # HTTP calls to /api/policies
    │   │       └── chat.service.ts    # SSE streaming via fetch
    │   ├── environments/
    │   │   ├── environment.ts         # Dev: apiUrl = localhost:8000
    │   │   └── environment.prod.ts    # Prod: apiUrl = '' (same-origin)
    │   ├── index.html
    │   ├── main.ts
    │   └── styles.scss             # Global styles + brand design tokens
    ├── angular.json
    └── package.json
```

---

## Backend — File by File

### `backend/app/main.py`
**Entry point for the FastAPI application.**

```
Critical responsibilities:
1. load_dotenv() — MUST be the very first line before any ADK import.
   ADK reads GOOGLE_API_KEY at module-load time. If dotenv runs after,
   the key is not in os.environ and every chat request fails.
2. Creates the FastAPI() app instance.
3. Mounts CORS middleware (allow origins from config).
4. Registers the two routers: policies and chat.
5. Exposes GET /api/health for load balancer health checks.
```

---

### `backend/app/config.py`
**Central configuration using pydantic-settings.**

```python
class Settings(BaseSettings):
    google_api_key: str = ""
    app_name: str = "UW Smart AI Assistant"
    cors_origins: list[str] = ["http://localhost:4200"]
    session_db_url: str = "sqlite:///./sessions.db"  # wired but unused — see Known Limitations
```

`@lru_cache` on `get_settings()` ensures the settings object is loaded once and reused.
Values are read from `.env` file and environment variables automatically.

---

### `backend/app/models/schemas.py`
**All Pydantic models that define the data contracts between layers.**

| Model | Purpose |
|---|---|
| `PolicySummary` | Shape returned by `GET /api/policies` list |
| `PolicyDetail` | Extends summary, adds premium + rerate count |
| `QAPair` | One underwriting question + answer + severity + flag |
| `ReratingEvent` | Single re-rating event with before/after premium |
| `ReratingHistory` | Full re-rating trajectory for a policy |
| `StatusUpdateRequest` | Body for `PATCH /api/policies/{ref}/status` |
| `StatusUpdateResponse` | Confirmation with old and new status |
| `ChatRequest` | Body for `POST /api/chat` |
| `PolicyType` | Enum: `referral` or `decline` |
| `PolicyStatus` | Enum: `review`, `in_progress`, `completed` |
| `LineOfBusiness` | Enum: PL, DO, EO, CY, MC, EL, AV, XS |

These models enforce type safety at the API boundary. FastAPI validates all
incoming request bodies and outgoing response bodies against them automatically.

---

### `backend/app/data/mock_policies.py`
**Synthetic policy inventory — the source of truth for policy data.**

Contains 22 synthetic specialty commercial lines policies (12 referral, 10 decline) with the naming pattern:
```
2 digits + 2 uppercase letters + 8 digits
Example: 25PL00012345  (year=25, LOB=PL, sequence=00012345)
```

**Key functions:**
- `get_all_policies()` — returns full list, supports in-memory filtering
- `get_policy_by_ref(policy_ref)` — single policy lookup by reference
- `update_policy_status(policy_ref, new_status)` — mutates status in memory, returns `{old_status, new_status}`

> **Replace this file when connecting to a real database.** The interfaces
> (`get_all_policies`, `get_policy_by_ref`, `update_policy_status`) are the
> contract the rest of the app depends on.

---

### `backend/app/data/mock_qa_data.py`
**Authoritative referral/decline reasons and re-rating history.**

Two functions:
- `get_reasons_for_policy(policy_ref)` — returns a list of `QAPair` dicts for that policy
- `get_rerating_history(policy_ref)` — returns a list of `ReratingEvent` dicts

Each Q&A pair contains:
```json
{
  "question": "Does the insured operate in any high-risk jurisdictions?",
  "answer": "Yes — operations in California and New York",
  "severity": "high",
  "flag": "Multi-state operations exceed standard territory threshold"
}
```

> **This is what the LLM analyses.** The LLM never generates reasons — it receives
> these QA pairs from the tool call and explains what they mean in context.

---

### `backend/app/agents/uw_assistant/agent.py`
**Defines the Google ADK `LlmAgent` with all tools and guardrails wired.**

```python
uw_assistant_agent = LlmAgent(
    name="uw_smart_ai_assistant",
    model="gemini-2.5-flash-lite",     # best available free-tier model
    instruction=SYSTEM_INSTRUCTION,    # system prompt
    tools=[...5 tool functions...],
    before_model_callback=...,         # input guardrail
    before_tool_callback=...,          # tool execution guardrail
    after_model_callback=...,          # output guardrail
    after_tool_callback=...,           # audit logging
)
```

The `SYSTEM_INSTRUCTION` establishes:
- The agent's persona and role scope
- The "API as source of truth" rule (never invent data)
- How to structure referral/decline analysis
- Email drafting guidelines (no internal thresholds)
- When to suggest follow-up actions

---

### `backend/app/agents/uw_assistant/tools.py`
**The 5 Python functions exposed to Gemini as callable tools.**

| Tool | When called | What it returns |
|---|---|---|
| `get_referral_reasons` | "What caused this referral?" | policy metadata + QA pairs |
| `get_decline_reasons` | "What caused this decline?" | policy metadata + QA pairs |
| `get_rerating_history_tool` | "Show re-rating history" | premium trajectory + events |
| `generate_broker_email` | "Frame email to broker" | all facts needed to draft email |
| `update_policy_status_tool` | "Mark as completed" | confirmation with old/new status |

Each tool has detailed Google-style docstrings. ADK parses these docstrings to
build the function schemas that tell Gemini exactly what each tool does and what
arguments it accepts.

---

### `backend/app/agents/uw_assistant/guardrails.py`
**4 ADK callback hooks implementing runtime safety.**

| Callback | Fires | What it does |
|---|---|---|
| `before_model_callback` | Before every LLM call | Blocks off-topic requests; blocks PII extraction (SSN, DOB, credit cards) |
| `before_tool_callback` | Before every tool execution | Validates policy ref format (`^\d{2}[A-Z]{2}\d{8}$`); enforces 20 tool calls per session |
| `after_model_callback` | After LLM generates a response | Logs warning if internal thresholds appear in output |
| `after_tool_callback` | After tool returns data | Audit log of tool name, args, timestamp; logs tool errors |

Callbacks use keyword-only argument signatures required by ADK v1.x:
```python
def before_tool_callback(*, tool, args, tool_context): ...
def before_model_callback(*, callback_context, llm_request): ...
```

---

### `backend/app/routers/policies.py`
**REST endpoints for the policy inventory.**

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/api/policies` | List policies with optional filters (`?status=review&type=referral&lob=CY&search=metro`) |
| `GET` | `/api/policies/{ref}` | Single policy detail (includes premium, rerate count) |
| `GET` | `/api/policies/{ref}/reasons` | Referral/decline Q&A pairs |
| `GET` | `/api/policies/{ref}/rerating-history` | Full re-rating event timeline |
| `PATCH` | `/api/policies/{ref}/status` | Update workflow status |

---

### `backend/app/routers/chat.py`
**The SSE streaming chat endpoint — most complex file in the backend.**

Critical components:

**1. Session management**
```python
_session_registry: dict[str, str] = {}   # in-memory: policy_ref → session_id
session_service = InMemorySessionService()  # ADK session store
```
On first message for a policy, a new ADK session is created with policy context
pre-seeded in state. Subsequent messages include the `session_id` so the runner
resumes the same conversation with full history.

**2. Context prefix injection**
```python
context_prefix = f"[Context: Policy {ref}, Insured: ..., Type: ..., LOB: ..., Broker: ...]"
user_content = types.Content(role="user", parts=[types.Part(text=context_prefix + message)])
```
Every message sent to the agent includes a structured context prefix so the LLM
always knows which policy it is discussing, even on the first turn.

**3. SSE event streaming**
```python
async for event in runner.run_async(...):
    if part.text:
        yield {"event": "message", "data": json.dumps({"type": "text", "content": part.text})}
    elif part.function_call:
        yield {"event": "tool_call", "data": json.dumps({"type": "tool_call", ...})}
```

**4. Follow-up suggestions**
After the agent finishes, `_get_prompt_suggestions()` reads the last user message
and returns contextually relevant next prompts (e.g., after explaining a referral,
suggests "Frame email to broker" and "Show re-rating history").

**5. Structured error messages**
Catches `429 RESOURCE_EXHAUSTED`, `503 UNAVAILABLE`, and API key errors separately,
returning user-friendly messages instead of raw exception text.

---

## Frontend — File by File

### `frontend/src/styles.scss`
**Global design tokens using CSS Custom Properties.**

Brand palette:
```scss
--hw: #6E2035;        /* Wine — primary brand color */
--hw-dark: #521828;   /* Deep wine for pressed states */
--hb: #1A1A1A;        /* Black — header background, user bubbles */
--hr: #C8102E;        /* Accent red — critical alerts */
--hg: #B8912A;        /* Gold — accent color */
```

All components reference these variables. To rebrand, change values here only.

---

### `frontend/src/app/app.component.ts`
**Root component. Renders the header and router outlet.**

Listens for the `refresh-policies` custom window event (dispatched when the
header refresh button is clicked) and re-triggers policy loading in child
components via Angular's event system.

---

### `frontend/src/app/pages/home/home.component.ts`
**The main dashboard page. Orchestrates all other components.**

Critical logic:
- **Stat card filtering** — clicking Total/Referrals/Declines/Awaiting Review
  toggles `activeStatFilter`, replacing the tabbed view with a flat filtered table.
  Clicking the same card again clears the filter.
- **Tab views** — Review / In Progress / Completed derive from `filteredPolicies`
  (the search/LOB-filtered subset of `allPolicies`).
- **Chat coordination** — sets `selectedPolicy` when a row is clicked, passing
  it as `@Input()` to `ChatWindowComponent`. Clears it when chat is closed.
- **Status change** — calls `PolicyService.updateStatus()` then reloads the full
  policy list to reflect the change in the table.
- **Refresh** — `@HostListener('window:refresh-policies')` responds to the
  header button event.

---

### `frontend/src/app/components/chat-window/chat-window.component.ts`
**The slide-in AI chat panel. Heart of the user experience.**

Critical logic:
- **Session continuity** — stores `sessionId` from the first SSE response and
  sends it with every subsequent message.
- **Streaming append** — creates an empty assistant message, then appends tokens
  as they stream in: `aMsg.content += event.content`.
- **Prompt lifecycle** — starts with type-specific initial prompts; replaces them
  with server-sent follow-up suggestions after each response.
- **`isStreaming` flag** — disables the input and shows the thinking indicator
  while a response is in progress.
- **`ngOnChanges`** — resets state (messages, sessionId, prompts) whenever a
  different policy is selected.

---

### `frontend/src/app/services/chat.service.ts`
**SSE consumer using native `fetch` + `ReadableStream`.**

Why not `HttpClient`: Angular's HttpClient buffers the full response before
emitting. `fetch` with `ReadableStream` processes each byte chunk as it arrives,
enabling real-time token streaming.

Key pattern:
```typescript
const reader = response.body.getReader();
const decoder = new TextDecoder();
let buffer = '';  // handles chunk boundaries that split SSE lines

const processStream = (): Promise<void> =>
  reader.read().then(({ done, value }) => {
    if (done) { subject.complete(); return; }
    buffer += decoder.decode(value, { stream: true });
    // split on newline, pop last (potentially incomplete) line back to buffer
    // parse complete "data: {...}" lines and emit to RxJS Subject
    return processStream();  // recurse until stream closes
  });
```

---

### `frontend/src/app/services/policy.service.ts`
**HTTP client for all policy REST endpoints.**

Uses Angular's `HttpClient` (appropriate here — policies are standard request/
response, not streams). Methods:
- `getPolicies()` → `GET /api/policies`
- `getPolicy(ref)` → `GET /api/policies/{ref}`
- `updateStatus(ref, status)` → `PATCH /api/policies/{ref}/status`

---

### `frontend/src/environments/`

```typescript
// environment.ts (dev)
export const environment = { production: false, apiUrl: 'http://localhost:8000' };

// environment.prod.ts (prod)
export const environment = { production: true, apiUrl: '' };
```

`apiUrl: ''` in production means same-origin requests. When Angular is served from
the same domain as the API (e.g., behind an nginx reverse proxy), no CORS is needed
and no URL needs to change. For split-deploy (separate domains), set `apiUrl` to
your API domain here.

---

## Evaluation Framework

Located in `backend/evals/`. Uses the Google ADK evaluation approach.

### `test_config.json` — Metrics and thresholds

```json
{
  "metrics": {
    "tool_trajectory_avg_score": { "threshold": 0.85 },
    "response_match_score":      { "threshold": 0.80 },
    "hallucination_rate":        { "threshold": 0.05 },
    "safety_score":              { "threshold": 0.95 },
    "email_quality_score":       { "threshold": 0.80 }
  }
}
```

### Test datasets (65 test cases total)

| File | Cases | Tests |
|---|---|---|
| `referral_queries.json` | 18 | Questions about referral causes |
| `decline_queries.json` | 12 | Questions about decline causes |
| `rerating_queries.json` | 10 | Re-rating and premium questions |
| `email_generation.json` | 12 | Broker email drafting |
| `multi_turn.json` | 8 | Multi-message conversation flows |
| `edge_cases.json` | 5 | Off-topic, PII, invalid refs |

### `rubrics/email_quality.txt` — Custom email scoring rubric

Defines criteria for evaluating broker email quality: professional tone, factual
accuracy, appropriate detail level, no internal threshold disclosure, and clear
call to action.

---

## Local Development Setup

> **Windows users:** All commands are written for **PowerShell**. If you are using Git Bash on Windows, use the macOS/Linux commands instead — they work as-is.

---

### Prerequisites

| Requirement | Version | Notes |
|---|---|---|
| Python | 3.10+ (3.12 recommended) | https://www.python.org/downloads/ |
| Node.js | 18+ (20 LTS recommended) | Installed via fnm in Step 3 below — do not skip |
| Git | Any recent version | https://git-scm.com/downloads |
| Google AI Studio API key | — | https://aistudio.google.com/app/apikey — free tier is sufficient |

---

### Step 1 — Clone the repository

**macOS / Linux**
```bash
git clone https://github.com/your-org/uw-smart-ai-assistant.git
cd uw-smart-ai-assistant
```

**Windows (PowerShell)**
```powershell
git clone https://github.com/your-org/uw-smart-ai-assistant.git
cd uw-smart-ai-assistant
```

---

### Step 2 — Set up the Python backend

#### macOS / Linux

```bash
cd backend

# Install uv using the official installer (recommended — works even if pip is not on PATH)
curl -LsSf https://astral.sh/uv/install.sh | sh
source $HOME/.local/bin/env   # make uv available in this session without restarting terminal

# Alternatively, if you have pip3: pip3 install uv

# Create a Python 3.12 virtual environment
# uv will automatically download Python 3.12 if it is not already installed on your system
uv venv --python 3.12

# Activate the virtual environment
source .venv/bin/activate

# Install all Python dependencies
uv pip install -r requirements.txt

# Create your local environment file from the template
cp .env.example .env
```

Now open `backend/.env` in any text editor and replace the placeholder with your real key:
```
GOOGLE_API_KEY=your_google_ai_studio_api_key_here
```

#### Windows (PowerShell)

**Step 2a — Install uv**

Run this first:
```powershell
powershell -ExecutionPolicy ByPass -c "irm https://astral.sh/uv/install.ps1 | iex"
```

> **Close PowerShell and reopen it** before continuing — the installer adds uv to your PATH and this only takes effect in a new session.

**Step 2b — Create the virtual environment and install dependencies**

In the new PowerShell window:
```powershell
cd backend

# Create a Python 3.12 virtual environment
# uv will automatically download Python 3.12 if it is not already installed on your system
uv venv --python 3.12

# Activate the virtual environment
# If you get a script execution policy error, first run:
#   Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
.venv\Scripts\Activate.ps1

# Install all Python dependencies
uv pip install -r requirements.txt

# Create your local environment file from the template
Copy-Item .env.example .env
```

Now open `backend\.env` in any text editor and replace the placeholder with your real key:
```
GOOGLE_API_KEY=your_google_ai_studio_api_key_here
```

> **uv not available?** Use the standard venv module instead:
> - macOS/Linux: `python3 -m venv .venv && source .venv/bin/activate && pip install -r requirements.txt`
> - Windows: `python -m venv .venv && .venv\Scripts\Activate.ps1 && pip install -r requirements.txt`

---

### Step 3 — Install Node.js

First check whether you already have Node 18 or higher:

```bash
node --version   # must print v18.x.x or higher
```

If the command is not found, or the version is below 18, follow the instructions for your OS below.

#### macOS / Linux — install via fnm (recommended)

```bash
# 1. Install fnm
curl -fsSL https://fnm.vercel.app/install | bash

# 2. Add fnm initialisation to your shell profile so it loads in every new terminal.
#    For zsh (default on macOS):
echo 'eval "$(fnm env --use-on-cd --shell zsh)"' >> ~/.zshrc

#    For bash (Linux / older macOS):
#    echo 'eval "$(fnm env --use-on-cd --shell bash)"' >> ~/.bashrc

# 3. Reload your shell profile to activate fnm in this session
source ~/.zshrc
#    bash users: source ~/.bashrc

# 4. Install and activate Node 20 LTS
fnm install 20
fnm use 20

# 5. Set Node 20 as the default so every new terminal automatically has it on PATH
#    Without this, opening a new terminal (e.g. for the frontend) will not find npm
fnm default 20

# 6. Verify
node --version   # should print v20.x.x
npm --version    # should print 10.x.x
```

> **Troubleshooting:** If `fnm` is still not found after step 3, close the terminal completely, open a new one, and run steps 4–6 again.

#### macOS — alternative via Homebrew

```bash
brew install node
node --version
```

#### Windows (PowerShell) — Option A: Node.js installer (simplest)

1. Go to https://nodejs.org and download the **Windows LTS installer (.msi)**
2. Run the installer — it adds `node` and `npm` to your PATH automatically
3. **Close and reopen PowerShell**, then verify:

```powershell
node --version
npm --version
```

#### Windows (PowerShell) — Option B: via fnm

```powershell
# 1. Install fnm via Windows Package Manager
winget install Schniz.fnm
```

> **Close PowerShell and reopen it** before continuing.

```powershell
# 2. Add fnm shell integration to your PowerShell profile so every new terminal loads Node
#    This creates the profile file if it doesn't exist, then appends the fnm init line
if (!(Test-Path $PROFILE)) { New-Item -Force $PROFILE | Out-Null }
Add-Content $PROFILE "`nfnm env --use-on-cd | Out-String | Invoke-Expression"

# 3. Reload the profile to activate fnm in this session
. $PROFILE

# 4. Install Node 20 LTS and set it as the default for all new terminals
fnm install 20
fnm use 20
fnm default 20

# 5. Verify
node --version
npm --version
```

#### Windows (PowerShell) — Option C: via Chocolatey

```powershell
choco install nodejs-lts
# Restart PowerShell, then verify: node --version
```

---

### Step 4 — Install frontend dependencies

**macOS / Linux**
```bash
cd frontend
npm install
```

**Windows (PowerShell)**
```powershell
cd frontend
npm install
```

This installs all Angular packages into `frontend/node_modules/`. It takes about 30–60 seconds on first run.

> **Windows — `npm` not found?** If you installed Node via Option B (fnm), open a fresh PowerShell window (so the profile loads), navigate back to the `frontend` folder, and retry.

---

### Step 5 — Start the backend

Open a terminal in the project root and run:

**macOS / Linux**
```bash
cd backend
source .venv/bin/activate
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

**Windows (PowerShell)**
```powershell
cd backend
.venv\Scripts\Activate.ps1
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

You should see:
```
INFO:     Uvicorn running on http://0.0.0.0:8000 (Press CTRL+C to quit)
INFO:     Application startup complete.
```

Verify in your browser or a new terminal tab:
- Health check: http://localhost:8000/api/health → `{"status":"ok","app":"UW Smart AI Assistant"}`
- Interactive API docs: http://localhost:8000/docs

**Leave this terminal running.** Open a new terminal for Step 6.

---

### Step 6 — Start the frontend

In a **new terminal**, run:

**macOS / Linux**
```bash
cd frontend
npm start
```

**Windows (PowerShell)**
```powershell
cd frontend
npm start
```

You should see:
```
Application bundle generation complete.
  ➜  Local:   http://localhost:4200/
```

Open **http://localhost:4200** in your browser. The app should load and display the policy dashboard.

---

### Running both servers — quick reference

You need **two terminal windows** open at the same time:

| Terminal | macOS / Linux | Windows (PowerShell) |
|---|---|---|
| **1 — Backend** | `cd backend && source .venv/bin/activate && uvicorn app.main:app --reload --port 8000` | `cd backend; .venv\Scripts\Activate.ps1; uvicorn app.main:app --reload --port 8000` |
| **2 — Frontend** | `cd frontend && npm start` | `cd frontend; npm start` |

Both servers support **hot reload** — changes to Python or TypeScript files are picked up automatically without restarting.

URLs at a glance:

| URL | What it is |
|---|---|
| http://localhost:4200 | Angular app (main UI) |
| http://localhost:8000/api/health | Backend health check |
| http://localhost:8000/docs | Interactive API docs (Swagger UI) |

---

### Cleaning a previous build

If you need to rebuild from scratch or clear stale cache artefacts:

**macOS / Linux**
```bash
# Frontend — removes compiled output and build caches
rm -rf frontend/dist frontend/.angular frontend/node_modules/.cache

# Backend virtual environment (recreate from scratch with Step 2)
rm -rf backend/.venv
```

**Windows (PowerShell)**
```powershell
# Frontend
Remove-Item -Recurse -Force frontend\dist, frontend\.angular, frontend\node_modules\.cache

# Backend virtual environment
Remove-Item -Recurse -Force backend\.venv
```

---

### Common issues

| Symptom | Likely cause | Fix |
|---|---|---|
| `npm: command not found` or `node: command not found` | Node not on PATH / fnm not initialised in this shell session | macOS: run `source ~/.zshrc` then retry. Windows: close and reopen PowerShell |
| `uvicorn: command not found` | Virtual environment not activated | Run `source .venv/bin/activate` (Mac) or `.venv\Scripts\Activate.ps1` (Windows) first |
| `Application startup complete` not shown | `.env` missing or `GOOGLE_API_KEY` empty | Confirm `backend/.env` exists and contains your real key (not the placeholder) |
| Chat returns "API key error" | Invalid Gemini key | Get a free key at https://aistudio.google.com/app/apikey |
| Browser shows CORS error | Backend not running or wrong port | Ensure backend is on port 8000 and frontend on port 4200 |
| `uv: command not found` | uv not installed | Run the official installer: `curl -LsSf https://astral.sh/uv/install.sh | sh` (Mac/Linux) or see Step 2 (Windows) |
| PowerShell script execution error | Execution policy blocks `.ps1` scripts | Run `Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser` once |
| `npm` not found when opening a new terminal | `fnm default 20` was never set | Run `fnm default 20` once, then open a fresh terminal |
| `address already in use` on port 8000 or 4200 | Another process is using that port | Mac: `lsof -ti:8000 \| xargs kill` or `lsof -ti:4200 \| xargs kill`. Windows: `netstat -ano \| findstr :8000` then `taskkill /PID <pid> /F` |

---

## Environment Variables

### Backend `.env`

| Variable | Required | Default | Description |
|---|---|---|---|
| `GOOGLE_API_KEY` | **Yes** | — | Google AI Studio API key for Gemini |
| `SESSION_DB_URL` | No | `sqlite:///./sessions.db` | Database URL for session persistence (currently unused — see Known Limitations) |

### Frontend `environment.ts`

| Variable | Dev value | Prod value | Description |
|---|---|---|---|
| `apiUrl` | `http://localhost:8000` | `''` (same-origin) | Base URL for all API calls |

---

## API Reference

### Policies

```
GET  /api/policies
     ?status=review|in_progress|completed
     ?type=referral|decline
     ?lob=PL|DO|EO|CY|MC|EL|AV|XS
     ?search=<text>
     → PolicySummary[]

GET  /api/policies/{ref}
     → PolicyDetail

GET  /api/policies/{ref}/reasons
     → PolicyReasons (list of QAPairs)

GET  /api/policies/{ref}/rerating-history
     → ReratingHistory

PATCH /api/policies/{ref}/status
      Body: { "status": "review|in_progress|completed" }
      → StatusUpdateResponse
```

### Chat

```
POST /api/chat
     Body: {
       "policy_ref": "25PL00012345",
       "message": "What caused this referral?",
       "session_id": null | "uuid-string"
     }
     → SSE stream

     SSE event types:
       event: message  data: {"type":"text",      "content":"...", "session_id":"..."}
       event: tool_call data: {"type":"tool_call", "tool_name":"...", "session_id":"..."}
       event: suggestions data: {"type":"prompt_suggestions", "suggestions":[...]}
       event: error    data: {"type":"error",     "content":"...", "session_id":"..."}
       event: done     data: {"type":"done",       "session_id":"..."}
```

### Health

```
GET /api/health → {"status": "ok", "app": "UW Smart AI Assistant"}
```

---

## How the AI Agent Works

### Tool-calling flow for "What caused this referral?"

```
1. POST /api/chat { message: "What caused this referral?", policy_ref: "25PL00012345" }

2. Backend prepends context:
   "[Context: Policy 25PL00012345, Insured: Meridian Consulting Group, Type: referral, ...]
    What caused this referral?"

3. ADK Runner sends to Gemini 2.5 Flash Lite

4. Gemini decides to call: get_referral_reasons("25PL00012345")
   ↓ SSE yields: {"type":"tool_call","tool_name":"get_referral_reasons"}

5. before_tool_callback fires:
   - validates "25PL00012345" matches regex ^\d{2}[A-Z]{2}\d{8}$  ✓
   - increments session tool_call_count (1 of 20)

6. Tool executes: reads mock_qa_data.py → returns 5 QA pairs

7. after_tool_callback fires: audit log entry written

8. Gemini receives tool result, generates analysis
   ↓ SSE yields multiple {"type":"text","content":"..."} tokens

9. after_model_callback fires: checks for internal threshold disclosure

10. Stream ends → {"type":"done"}
    Backend sends follow-up suggestions: ["Frame email to broker", "Show re-rating history", "Summarize key risk factors"]
```

### Dynamic thinking budget

The system instruction guides Gemini to apply appropriate depth:
- **Simple routing** (which tool to call): minimal reasoning
- **Analysis** (explain referral factors): medium depth
- **Email drafting**: detailed, structured output

---

## How Streaming Works

The backend uses Server-Sent Events (SSE) via `sse-starlette`. The frontend
uses the native `fetch` API with `ReadableStream` (not Angular's `HttpClient`
which buffers full responses).

```
Backend: async generator yields SSE frames as Gemini tokens arrive
                ↓ HTTP keep-alive connection
Frontend: reader.read() in a recursive Promise chain
                ↓ TextDecoder + line buffer for chunk boundary safety
                ↓ JSON.parse each "data: {...}" line
                ↓ subject.next(event) → RxJS Observable
                ↓ aMsg.content += event.content (Angular re-renders each token)
```

---

## Session Management

Each policy conversation gets an ADK session with:
- Full message history (user, model, tool call, tool result)
- Policy context pre-seeded in state on creation
- Tool call counter for rate limiting

**Current implementation:** `InMemorySessionService` — sessions live in RAM.
Sessions are lost on server restart. Suitable for development only.

**For production:** Replace with `DatabaseSessionService` in `chat.py`:
```python
from google.adk.sessions import DatabaseSessionService
session_service = DatabaseSessionService(
    db_url=os.getenv("SESSION_DB_URL")  # postgresql://... for multi-instance
)
```

---

## Guardrails

Four ADK callback hooks protect the system:

| Guardrail | Blocks |
|---|---|
| PII extraction | SSN, date of birth, credit card, bank account requests |
| Off-topic | Non-insurance queries (2+ off-topic keywords, no policy keywords) |
| Invalid policy ref | References not matching `^\d{2}[A-Z]{2}\d{8}$` |
| Session rate limit | More than 20 tool calls in a single session |
| Internal threshold disclosure | Logged (redaction ready for production) |

---

## Production Considerations

| Concern | Current State | Production Fix |
|---|---|---|
| Session storage | In-memory (lost on restart) | `DatabaseSessionService` with PostgreSQL/RDS |
| Session registry | Python dict (single process) | Redis (ElastiCache) |
| CORS origins | `localhost:4200` | Set `CORS_ORIGINS` env var to your domain |
| API key storage | `.env` file | AWS Secrets Manager / Parameter Store |
| Frontend API URL | `http://localhost:8000` | Set `environment.prod.ts` or use same-origin proxy |
| ALB idle timeout | N/A | Set to 120s+ for SSE connections |
| SSE keepalive | Not implemented | Add 15s ping yields in event_generator |
| Sticky sessions | N/A | Not needed once Redis is in place |
| Gemini quota | Free tier (`gemini-2.5-flash-lite`) | Upgrade to paid tier for production load |

---

## Known Limitations

1. **`SESSION_DB_URL` is defined but not wired.** `config.py` loads the variable
   but `chat.py` hardcodes `InMemorySessionService()`. See the code change required
   in the Production Considerations section.

2. **Mock data only.** `mock_policies.py` and `mock_qa_data.py` use in-memory
   Python dicts. Replace with real database queries using the same function
   signatures (`get_all_policies`, `get_policy_by_ref`, etc.).

3. **Status updates are not persisted.** `update_policy_status` mutates the
   in-memory dict. On server restart, all status changes are lost.

4. **Single user only.** `user_id` is hardcoded as `"sarah_mitchell"`. Authentication
   and multi-user session isolation are not implemented.

5. **No auth.** There is no JWT, OAuth, or session cookie on any endpoint.
   Do not deploy to the internet without adding authentication middleware.

6. **Free-tier LLM (`gemini-2.5-flash-lite`).** This is the best available free-tier model.
   Production deployments with high request volumes require a paid Google AI Studio account.

---

## Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/your-feature`
3. Backend changes: ensure `uvicorn --reload` picks them up and test against `/docs`
4. Frontend changes: `ng serve` hot-reloads automatically
5. Run the eval datasets against your changes before submitting a PR
6. Open a pull request with a description of what changed and why

---

## License

MIT License. See `LICENSE` for details.
