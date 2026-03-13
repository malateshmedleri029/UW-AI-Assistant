# UW Smart AI Assistant — Complete Codebase Guide

Every folder and every file explained in full detail.
Use this as the developer reference before reading, editing, or extending any part of the system.

---

## Table of Contents

1. [Repository Root](#1-repository-root)
2. [backend/](#2-backend)
   - [backend/app/](#21-backendapp)
   - [backend/app/agents/](#22-backendappagents)
   - [backend/app/data/](#23-backendappdata)
   - [backend/app/models/](#24-backendappmodels)
   - [backend/app/routers/](#25-backendapprouters)
   - [backend/evals/](#26-backendevals)
3. [frontend/](#3-frontend)
   - [frontend/src/app/components/](#31-frontendsrcappcomponents)
   - [frontend/src/app/models/](#32-frontendsrcappmodels)
   - [frontend/src/app/pages/](#33-frontendsrcapppages)
   - [frontend/src/app/services/](#34-frontendsrcappservices)
   - [frontend/src/environments/](#35-frontendsrcenvironments)
   - [frontend/src/ (root files)](#36-frontendsrc-root-files)
   - [frontend/ (config files)](#37-frontend-config-files)

---

## 1. Repository Root

```
UW-AI-Assistant/
├── README.md
├── CODEBASE_GUIDE.md   ← this file
├── PLAN.md
├── .gitignore
├── backend/
└── frontend/
```

---

### `README.md`
The public-facing GitHub documentation. Contains:
- Architecture overview diagram
- Tech stack table
- Step-by-step local development setup
- Full API reference with every endpoint, method, query params and response shapes
- SSE event types documentation
- Session management explanation
- Guardrails summary
- Production considerations table
- Known limitations

**Audience:** Any developer cloning the repo for the first time.

---

### `PLAN.md`
The original system design document written during the build phase.
Contains the architectural decisions, LLM selection rationale (why Gemini 2.0 Flash),
MCP rationale, evaluation metric justification, and detailed UI layout descriptions.

**Audience:** Architects and technical leads reviewing design decisions.
Not needed to run or extend the system — use README.md instead.

---

### `.gitignore`
Tells Git which files and folders to never commit.

Critical entries:
```
backend/.env          ← your real GOOGLE_API_KEY — NEVER commit this
backend/.venv/        ← Python virtual environment (recreatable from requirements.txt)
frontend/node_modules/ ← npm packages (recreatable from package.json)
frontend/dist/        ← compiled build output
backend/sessions.db   ← local SQLite session data
*.log                 ← log files
.DS_Store             ← macOS metadata
```

**Why this matters:** Without `.gitignore`, a `git add .` would push your API key,
400MB of node_modules, and compiled binaries to GitHub.

---

## 2. backend/

The Python FastAPI application. Serves REST endpoints for policy data and an SSE endpoint
for the AI chat. Runs on port 8000.

```
backend/
├── app/
│   ├── __init__.py
│   ├── main.py
│   ├── config.py
│   ├── agents/
│   ├── data/
│   ├── models/
│   └── routers/
├── evals/
├── requirements.txt
├── .env.example
└── .env              (not committed — created from .env.example)
```

---

### `backend/requirements.txt`
Lists every Python package the backend needs.

```
google-adk         ← Google Agent Development Kit — agent orchestration, tool calling, callbacks
google-genai       ← Google Generative AI SDK — direct Gemini API access used by ADK internally
fastapi            ← The web framework: routing, request parsing, response serialization
uvicorn[standard]  ← ASGI server that runs FastAPI (with websocket + http2 support)
pydantic           ← Data validation: models, type checking, serialization
pydantic-settings  ← Reads .env files and environment variables into typed Settings objects
sse-starlette      ← Adds Server-Sent Events (SSE) support to FastAPI/Starlette
python-dotenv      ← Loads .env file variables into os.environ at startup
httpx              ← Async HTTP client used internally by ADK for Gemini API calls
```

Install with:
```bash
uv pip install -r requirements.txt
# or: pip install -r requirements.txt
```

---

### `backend/.env.example`
A template showing which environment variables are required.
Committed to Git — safe because it has placeholder values, not real keys.

```bash
GOOGLE_API_KEY=your_google_ai_studio_api_key_here
SESSION_DB_URL=sqlite:///./sessions.db
```

**How to use:**
```bash
cp .env.example .env
# then edit .env and replace with your real GOOGLE_API_KEY
```

---

### `backend/.env`
The real environment file with your actual API key.
**NEVER committed to Git** (protected by `.gitignore`).

```bash
GOOGLE_API_KEY=AIzaSyDyqejC39g-iLQJeX4UDVuyJPBcSORGukM
SESSION_DB_URL=sqlite:///./sessions.db
```

Get a free API key at: https://aistudio.google.com/app/apikey

---

## 2.1 backend/app/

### `backend/app/__init__.py`
Empty file. Makes the `app` directory a Python package so its modules can be imported
with `from app.config import get_settings`.

---

### `backend/app/main.py`
**The FastAPI application entry point. The first file Python executes when the server starts.**

```python
from dotenv import load_dotenv
load_dotenv()              # ← MUST be lines 1-2, before any other import
```

**Why `load_dotenv()` must come first:**
ADK reads `GOOGLE_API_KEY` from `os.environ` when `LlmAgent` is first imported
(at module load time, not at request time). If `load_dotenv()` runs after the
agent module is imported, the key is not in the environment yet and every single
chat request fails with "No API key provided".

**What else it does:**
- Creates the `FastAPI()` app instance with the app name from config
- Attaches `CORSMiddleware` with allowed origins from config
- Registers the policies router (all `/api/policies/*` routes)
- Registers the chat router (`/api/chat` route)
- Exposes `GET /api/health` — returns `{"status":"ok"}`. Used by ALB health checks
  and monitoring tools to verify the service is alive.

---

### `backend/app/config.py`
**Central configuration management using pydantic-settings.**

```python
class Settings(BaseSettings):
    google_api_key: str = ""
    app_name: str = "UW Smart AI Assistant"
    cors_origins: list[str] = ["http://localhost:4200"]
    session_db_url: str = "sqlite:///./sessions.db"

    model_config = {"env_file": ".env"}
```

`BaseSettings` automatically reads values from:
1. Environment variables (highest priority)
2. `.env` file
3. Default values in the class definition (lowest priority)

`@lru_cache` on `get_settings()` means the Settings object is created exactly once
on first call and cached. All subsequent calls return the same object — no repeated
file I/O.

**Note:** `session_db_url` is defined here but is currently not used by `chat.py`.
See the Known Limitations section in README.md.

---

## 2.2 backend/app/agents/

```
agents/
├── __init__.py
└── uw_assistant/
    ├── __init__.py   ← re-exports uw_assistant_agent
    ├── agent.py      ← LlmAgent definition
    ├── tools.py      ← 5 callable tool functions
    └── guardrails.py ← 4 ADK callback hooks
```

### `backend/app/agents/__init__.py`
Empty. Makes `agents` a package.

### `backend/app/agents/uw_assistant/__init__.py`
```python
from .agent import uw_assistant_agent
```
Re-exports the agent so `chat.py` can import it cleanly:
```python
from app.agents.uw_assistant import uw_assistant_agent
```
Without this, `chat.py` would need the longer path `from app.agents.uw_assistant.agent import uw_assistant_agent`.

---

### `backend/app/agents/uw_assistant/agent.py`
**Defines the AI agent — the brain of the system.**

```python
uw_assistant_agent = LlmAgent(
    name="uw_smart_ai_assistant",
    model="gemini-2.0-flash",
    instruction=SYSTEM_INSTRUCTION,
    tools=[
        get_referral_reasons,
        get_decline_reasons,
        get_rerating_history_tool,
        generate_broker_email,
        update_policy_status_tool,
    ],
    before_model_callback=before_model_callback,
    before_tool_callback=before_tool_callback,
    after_model_callback=after_model_callback,
    after_tool_callback=after_tool_callback,
)
```

**`model="gemini-2.0-flash"`**
Chosen for:
- Free tier: 1,500 requests/day (vs 20/day for gemini-2.5-flash)
- Strong tool-calling accuracy
- Fast response time suitable for streaming UX
- Cost-efficient for multi-tool agentic workflows

**`SYSTEM_INSTRUCTION`** (the ~500 word system prompt) establishes:
- Role: expert underwriting analyst for specialty commercial lines
- Core principle: only use facts from tool responses, never invent data
- Capability list: referral analysis, decline analysis, re-rating, email drafting, status updates
- Response structure guidance: key findings first, severity-ordered
- Email rules: diplomatic tone, no internal thresholds, invite discussion
- Follow-up behaviour: always suggest next actions after analysis

**Why the tools list matters:**
ADK parses each function's Python docstring to generate a JSON schema for Gemini.
Gemini sees a description like "Retrieve the exact Q&A pairs that caused a policy to be referred"
and decides when to call it based on the user's question. The docstring quality directly
affects tool-calling accuracy.

---

### `backend/app/agents/uw_assistant/tools.py`
**The 5 Python functions that the LLM can call. These are the only way the agent
accesses real data — it never generates data from memory.**

#### `get_referral_reasons(policy_ref: str) → dict`
Called when: user asks why a policy was referred.

Flow:
1. Validates the policy exists via `get_policy_by_ref()`
2. Confirms `policy_type == "referral"` (returns error if it's a decline)
3. Fetches QA pairs from `get_reasons_for_policy()`
4. Returns: `{policy_ref, insured_name, line_of_business, policy_type, qa_pairs}`

The `qa_pairs` list is what Gemini analyses. Each pair has `question`, `answer`,
`severity` (high/medium/low), and `flag` (why that answer triggered the referral).

---

#### `get_decline_reasons(policy_ref: str) → dict`
Called when: user asks why a policy was declined.

Identical structure to `get_referral_reasons` but validates `policy_type == "decline"`.
This separation prevents Gemini from accidentally calling the wrong tool for a decline policy.

---

#### `get_rerating_history_tool(policy_ref: str) → dict`
Called when: user asks about re-rating, premium changes, or pricing history.

Returns:
```json
{
  "policy_ref": "25CY00045678",
  "insured_name": "DataVault Technologies",
  "rerate_count": 3,
  "initial_premium": 450000,
  "current_premium": 380000,
  "events": [
    {
      "rerate_number": 1,
      "date": "2025-02-15",
      "reason": "Completed penetration test",
      "premium_before": 450000,
      "premium_after": 420000,
      "changes": ["Pen test completed", "Critical findings remediated"]
    }
  ]
}
```

Works for both referral and decline policies (re-ratings can happen to both types).

---

#### `generate_broker_email(policy_ref: str, include_rerating: bool = False) → dict`
Called when: user asks to "frame email", "draft email", or "write to broker".

This tool does NOT write the email itself — it gathers and returns all the factual
context the LLM needs to compose the email:
- Policy details (ref, insured, broker, LOB, type)
- All QA pairs (reasons for referral/decline)
- Re-rating history (if `include_rerating=True`)
- An `instruction` field telling the LLM exactly what to do with the context

The LLM then uses this context to compose the email text. This design ensures:
- Every fact in the email came from the API (not hallucinated)
- The LLM applies professional writing skills to API-sourced facts
- The `instruction` field explicitly prohibits disclosing internal thresholds

---

#### `update_policy_status_tool(policy_ref: str, new_status: str) → dict`
Called when: user says "mark as completed", "set to in progress", etc.

Validates `new_status` is one of `review`, `in_progress`, `completed`, then calls
`update_policy_status()` from the data layer. Returns the old and new status for
the LLM to confirm to the user.

Note: in the current implementation, status changes are in-memory only and lost
on server restart. Replace the data layer for production persistence.

---

### `backend/app/agents/uw_assistant/guardrails.py`
**4 ADK callback functions that intercept every step of agent execution.**

All callbacks use keyword-only argument signatures (required by ADK v1.x):
```python
def before_model_callback(*, callback_context, llm_request): ...
def before_tool_callback(*, tool, args, tool_context): ...
def after_model_callback(*, callback_context, llm_response): ...
def after_tool_callback(*, tool, args, tool_context, tool_response): ...
```

#### `before_model_callback` — Input guardrail
Fires before every call to the Gemini API.

1. **PII check:** Scans user input for 8 patterns (SSN, date of birth, credit card,
   bank account, etc.). If found → returns a blocking response immediately without
   calling the LLM. The `_block_response()` helper creates an `LlmResponse` object
   that ADK treats as if the LLM replied, ending the turn early.

2. **Off-topic check:** Counts how many off-topic keywords appear (weather, sports,
   recipe, joke, movie, etc.). If 2+ off-topic keywords AND no underwriting keywords
   (policy, referral, decline, premium, broker) → blocks and redirects.

3. **Audit log:** Records every user input with timestamp to the Python logger.

#### `before_tool_callback` — Tool execution guardrail
Fires before every tool function call.

1. **Policy ref format validation:** If the args contain `policy_ref`, validates it
   matches `^\d{2}[A-Z]{2}\d{8}$`. A malformed ref (like "ABC123") returns an error
   dict immediately — the tool function never executes.

2. **Session rate limit:** Reads `tool_call_count` from ADK session state. If ≥ 20
   → returns error. Otherwise increments the counter. The counter is stored in the
   session (not a global variable) so each conversation has its own independent limit.

#### `after_model_callback` — Output guardrail
Fires after Gemini generates a response.

Scans the response text for 4 regex patterns that indicate internal threshold
disclosure (e.g., "$5M authority threshold", "internal risk score"). Currently
logs a warning — in production this would redact or replace the sensitive text.

#### `after_tool_callback` — Audit logging
Fires after every tool executes.

Writes a structured audit log entry: `tool_name, args, timestamp`.
Also logs a warning if the tool returned a dict containing `"error"`.
Used for compliance auditing and debugging.

**Helper functions:**
- `_extract_user_text(llm_request)` — safely navigates the ADK request object to
  get the latest user message text
- `_extract_response_text(llm_response)` — safely navigates the ADK response object
  to get the generated text
- `_block_response(message)` — creates a synthetic LlmResponse that short-circuits
  the normal flow

---

## 2.3 backend/app/data/

### `backend/app/data/__init__.py`
Empty. Makes `data` a package.

---

### `backend/app/data/mock_policies.py`
**The in-memory policy inventory. The single source of truth for all policy data.**

Contains a Python list of 20+ policy dictionaries. Each policy has:

```python
{
    "policy_ref": "25PL00012345",          # 2 digits + 2 letters + 8 digits
    "insured_name": "Meridian Consulting Group",
    "broker": "Aon Risk Solutions",
    "line_of_business": "PL",              # code: PL, DO, EO, CY, MC, EL, AV, XS
    "lob_name": "Professional Liability",
    "policy_type": "referral",             # or "decline"
    "submission_date": "2025-01-15",
    "status": "review",                    # review | in_progress | completed
    "assigned_uw": "Sarah Mitchell",
    "current_premium": 245000.0,
    "initial_premium": 310000.0,
    "rerate_count": 2,
}
```

Policy reference naming convention:
```
25 PL 00012345
│  │  └─ 8-digit sequence number
│  └──── 2-letter LOB code (PL=Professional Liability, CY=Cyber, DO=Directors & Officers...)
└─────── 2-digit year (25 = 2025, 26 = 2026)
```

**Key functions:**

`get_all_policies() → list[dict]`
Returns the full list. No filtering — filtering is done in the router.

`get_policy_by_ref(policy_ref: str) → dict | None`
Linear scan of the list for a matching `policy_ref`. Returns `None` if not found.

`update_policy_status(policy_ref: str, new_status: str) → dict | None`
Mutates the dict in-place. Returns `{"old_status": ..., "new_status": ...}`.
Because it mutates a Python list in RAM, changes persist for the server's lifetime
but are lost on restart.

**To replace with a real database:**
Keep these exact function signatures. Change the implementation inside each function
to query your database. The rest of the app will continue working unchanged.

---

### `backend/app/data/mock_qa_data.py`
**The authoritative referral/decline reasons and re-rating history.
This is the data the LLM analyses — it never generates reasons itself.**

Structure: a Python dict keyed by `policy_ref`, containing either:
- `"type": "referral"` with a list of QA pairs
- `"type": "decline"` with a list of QA pairs
- Plus re-rating event lists for policies that have been re-rated

**QA pair format:**
```python
{
    "question": "How many prior claims has the insured had in the last 5 years?",
    "answer": "3 claims totaling $2.1M",
    "severity": "high",
    "flag": "Exceeds 2-claim threshold for Professional Liability authority"
}
```

Severity levels and their meaning:
- `"high"` — likely a primary driver of referral/decline; given prominent coverage in analysis
- `"medium"` — contributing factor; mentioned but secondary
- `"low"` — noted for completeness; minor risk flag

**`get_reasons_for_policy(policy_ref: str) → list[dict] | None`**
Returns the list of QA pairs for a policy. Returns `None` if no data exists for that ref.

**`get_rerating_history(policy_ref: str) → list[dict]`**
Returns the list of re-rating events. Returns empty list `[]` if no re-ratings.

Each re-rating event:
```python
{
    "rerate_number": 1,
    "date": "2025-02-15",
    "reason": "Completed SOC 2 Type II audit",
    "premium_before": 450000,
    "premium_after": 420000,
    "changes": ["SOC 2 Type II certification obtained", "Controls assessment completed"]
}
```

---

## 2.4 backend/app/models/

### `backend/app/models/__init__.py`
Empty. Makes `models` a package.

---

### `backend/app/models/schemas.py`
**All Pydantic models used as request bodies, response shapes, and data contracts.**

FastAPI uses these models for:
- **Request validation:** Incoming JSON is parsed and type-checked. Invalid requests
  return 422 automatically.
- **Response serialization:** Return values are converted to JSON matching the model shape.
- **OpenAPI documentation:** FastAPI auto-generates `/docs` from these models.

**Enums:**

`PolicyType` — `"referral"` | `"decline"`
`PolicyStatus` — `"review"` | `"in_progress"` | `"completed"`
`LineOfBusiness` — `"PL"` | `"DO"` | `"EO"` | `"CY"` | `"MC"` | `"EL"` | `"AV"` | `"XS"`

**Models explained:**

| Model | Used by | Key fields |
|---|---|---|
| `QAPair` | `PolicyReasons`, tools | question, answer, severity, flag |
| `ReratingEvent` | `ReratingHistory`, tools | rerate_number, premium_before, premium_after, changes |
| `PolicySummary` | `GET /api/policies` list | policy_ref, insured_name, broker, lob_name, policy_type, status |
| `PolicyDetail` | `GET /api/policies/{ref}` | extends PolicySummary, adds current_premium, rerate_count |
| `PolicyReasons` | `GET /api/policies/{ref}/reasons` | policy_ref, policy_type, qa_pairs list |
| `ReratingHistory` | `GET /api/policies/{ref}/rerating-history` | rerate_count, initial_premium, current_premium, events list |
| `StatusUpdateRequest` | `PATCH /api/policies/{ref}/status` body | status (PolicyStatus enum) |
| `StatusUpdateResponse` | `PATCH /api/policies/{ref}/status` response | old_status, new_status, message |
| `ChatRequest` | `POST /api/chat` body | policy_ref, message, session_id (optional) |

`LOB_NAMES` — a plain dict mapping LOB codes to full names:
```python
{"PL": "Professional Liability", "DO": "Directors & Officers", ...}
```
Used in routers when building responses that need the full name from the code.

---

## 2.5 backend/app/routers/

### `backend/app/routers/__init__.py`
Empty. Makes `routers` a package.

---

### `backend/app/routers/policies.py`
**REST API endpoints for the policy inventory.**

All routes are prefixed with `/api/policies` (set at router creation).

**`GET /api/policies`**
Query params: `?status=review` `?type=referral` `?lob=CY` `?search=metro`
Returns: `list[PolicySummary]`

Applies filters in sequence on the full policy list. All filters are optional and combinable.
The `search` filter does case-insensitive substring matching on `policy_ref`, `insured_name`,
and `broker` fields simultaneously.

**`GET /api/policies/{policy_ref}`**
Returns: `PolicyDetail`
Raises 404 if the policy ref is not found.

**`GET /api/policies/{policy_ref}/reasons`**
Returns: `PolicyReasons` (the QA pairs)
Raises 404 if no reasons data exists for that policy.

**`GET /api/policies/{policy_ref}/rerating-history`**
Returns: `ReratingHistory`
Always returns a valid response (empty `events` list if no re-ratings occurred).

**`PATCH /api/policies/{policy_ref}/status`**
Body: `{"status": "review" | "in_progress" | "completed"}`
Returns: `StatusUpdateResponse`
Called by the Angular status dropdown in the policy table. Updates the in-memory data
and returns the old and new status for confirmation.

---

### `backend/app/routers/chat.py`
**The SSE streaming chat endpoint — the most complex file in the backend.**

**Module-level singletons (created once at startup):**
```python
session_service = InMemorySessionService()   # ADK session store — in RAM
runner = Runner(                              # ADK execution engine
    agent=uw_assistant_agent,
    app_name="uw_smart_ai_assistant",
    session_service=session_service,
)
_session_registry: dict[str, str] = {}       # maps policy_ref → session_id
```

**`_get_or_create_session(policy_ref, session_id)`**

On first message (no session_id):
1. Generates a new UUID as session_id
2. Fetches policy details to seed the session state
3. Calls `session_service.create_session()` with pre-populated state:
   ```python
   state = {
       "policy_ref": ...,
       "insured_name": ...,
       "policy_type": ...,
       "line_of_business": ...,
       "broker": ...,
       "tool_call_count": 0,   # guardrail counter
   }
   ```
4. Stores mapping in `_session_registry` for both `session_id` and `policy_ref` keys

On subsequent messages (session_id provided):
1. Checks `_session_registry` for the session_id
2. Returns the existing ADK session id
3. ADK automatically loads full conversation history for that session

**`POST /api/chat`** — the streaming endpoint

Context prefix injection:
```python
context_prefix = "[Context: Policy 25PL00012345, Insured: Meridian Consulting, ...]"
```
Every message sent to the agent includes this prefix so the LLM always knows
which policy it's discussing, even on the very first message.

SSE event types yielded:
```
event: message     ← a text token from Gemini (many per response)
event: tool_call   ← Gemini decided to call a tool (informational)
event: suggestions ← follow-up prompt suggestions after agent finishes
event: error       ← structured error message (quota, unavailable, key error)
event: done        ← stream is complete
```

Error handling distinguishes between:
- `429 RESOURCE_EXHAUSTED` → rate limit message with wait time
- `503 UNAVAILABLE` → temporary unavailability message
- API key errors → configuration error message

**`_get_prompt_suggestions(policy_ref, last_message)`**
Contextual follow-up suggestions based on what the user just asked:
- After referral/decline explanation → "Frame email to broker", "Show re-rating history"
- After re-rating history → "Frame email to broker", "Show premium progression"
- After email drafting → "Mark as In Progress", "Mark as Completed"
- After status update → "Any other concerns?"
- Default (first message) → type-specific starter prompts

---

## 2.6 backend/evals/

The evaluation framework using the Google ADK evaluation approach.
Used to measure agent quality before deploying changes to production.

```
evals/
├── test_config.json
├── rubrics/
│   └── email_quality.txt
└── datasets/
    ├── referral_queries.json    (18 test cases)
    ├── decline_queries.json     (12 test cases)
    ├── rerating_queries.json    (10 test cases)
    ├── email_generation.json    (12 test cases)
    ├── edge_cases.json          (5 test cases)
    └── multi_turn.json          (8 test cases — 4 messages each)
```

---

### `backend/evals/test_config.json`
**The evaluation runner configuration.**

```json
{
  "agent_name": "uw_smart_ai_assistant",
  "criteria": [
    { "metric": "tool_trajectory_avg_score", "match_type": "EXACT" },
    { "metric": "response_match_score" },
    { "metric": "final_response_match_v2" },
    { "metric": "hallucinations_v1" },
    { "metric": "safety_v1" },
    { "metric": "rubric_based_final_response_quality_v1",
      "rubric_file": "rubrics/email_quality.txt" }
  ],
  "eval_sets": ["datasets/referral_queries.json", ...]
}
```

Metrics explained:

| Metric | What it measures | Target |
|---|---|---|
| `tool_trajectory_avg_score` | Did the agent call the right tools in the right order? EXACT means it must match perfectly | ≥ 0.85 |
| `response_match_score` | How closely does the response match the reference answer? | ≥ 0.80 |
| `final_response_match_v2` | Semantic similarity of final response to reference | ≥ 0.80 |
| `hallucinations_v1` | Did the agent invent facts not present in tool results? | ≤ 0.05 (5%) |
| `safety_v1` | Did any responses violate safety guidelines? | ≥ 0.95 |
| `rubric_based_final_response_quality_v1` | Scores emails against the custom rubric | ≥ 0.80 |

---

### `backend/evals/rubrics/email_quality.txt`
**A 100-point rubric for scoring broker emails on 5 dimensions.**

```
1. PROFESSIONAL TONE         (0-20 pts)
   Proper greeting, professional sign-off, diplomatic language, no accusatory phrasing

2. FACTUAL ACCURACY          (0-25 pts)
   All reasons from tool data, correct policy ref, no fabricated details

3. COMPLETENESS              (0-20 pts)
   All significant QA factors mentioned, high severity items emphasized

4. CONFIDENTIALITY           (0-20 pts)
   No internal authority thresholds, no internal risk scores, no guideline names

5. ACTIONABILITY             (0-15 pts)
   Clear next steps, constructive framing, invites broker response
```

Score is converted to 0.0–1.0. Target: ≥ 0.80 (80/100 points).

---

### `backend/evals/datasets/referral_queries.json`
**18 test cases for referral analysis questions.**

Each test case structure:
```json
{
  "name": "referral_pl_revenue_claims",
  "data": [{
    "query": "What caused policy 25PL00012345 to be referred?",
    "expected_tool_use": [{
      "tool_name": "get_referral_reasons",
      "tool_input": { "policy_ref": "25PL00012345" }
    }],
    "reference": "Policy 25PL00012345 was referred for two high-severity reasons:
                  (1) annual revenue of $500M exceeds threshold..."
  }]
}
```

`expected_tool_use` specifies exactly which tool the agent should call and with
what arguments. ADK compares this against the actual tool call trajectory.
`reference` is the ideal response text used for semantic similarity scoring.

---

### `backend/evals/datasets/decline_queries.json`
**12 test cases for decline analysis questions.**

Covers:
- Cryptocurrency exchange (excluded industry + security incident)
- D&O with DOJ/SEC investigation (active fraud investigation)
- Each test verifies the agent calls `get_decline_reasons` with the correct policy ref

---

### `backend/evals/datasets/rerating_queries.json`
**10 test cases for re-rating history questions.**

Covers:
- Policy with 3 re-rating events (premium reduction through security improvements)
- Policy with no re-rating history (agent should say "no re-ratings")
- Questions about premium trajectory and what drove each change

---

### `backend/evals/datasets/email_generation.json`
**12 test cases for broker email drafting.**

Covers:
- Referral email with re-rating history included
- Decline email (no re-rating)
- Email after analysis has already been done in the session (context reuse)
- Verifies `generate_broker_email` is called with correct `include_rerating` flag

---

### `backend/evals/datasets/edge_cases.json`
**5 test cases specifically designed to test guardrails and error handling.**

| Test | What it verifies |
|---|---|
| `invalid_policy_ref_format` | Asking about "ABC123" → agent should explain valid format |
| `off_topic_request` | "What's the weather?" → agent should redirect politely |
| `referral_tool_on_decline_policy` | Asking "why was this referred?" for a declined policy → agent should use decline tool |
| `nonexistent_policy` | Policy ref that doesn't exist → agent should report not found |
| (PII test) | Asking for SSN → before_model_callback should block |

---

### `backend/evals/datasets/multi_turn.json`
**8 multi-turn conversation test cases. Each has 4 sequential messages.**

The most important test type. Verifies:
1. Message 1: "What caused the referral?" → calls `get_referral_reasons`
2. Message 2: "Show the re-rating history" → calls `get_rerating_history_tool`, references policy from context
3. Message 3: "Frame an email to the broker about this" → calls `generate_broker_email`, references both previous tool results
4. Message 4: "Mark this as completed" → calls `update_policy_status_tool`

This tests that the session correctly carries context across all four turns so the
agent knows the policy ref and remembered facts throughout.

---

## 3. frontend/

The Angular 17 application. Runs on port 4200. Uses standalone components throughout
(no NgModules).

```
frontend/
├── angular.json           ← Angular CLI build config
├── package.json           ← npm dependencies
├── package-lock.json      ← exact dependency tree (committed to Git)
├── tsconfig.json          ← TypeScript compiler options
├── tsconfig.app.json      ← TypeScript config for app compilation
└── src/
    ├── index.html         ← HTML shell
    ├── main.ts            ← Angular bootstrap
    ├── styles.scss        ← Global styles + brand design tokens
    ├── environments/
    │   ├── environment.ts       ← Dev config
    │   └── environment.prod.ts  ← Prod config
    └── app/
        ├── app.component.ts
        ├── app.routes.ts
        ├── components/
        ├── models/
        ├── pages/
        └── services/
```

---

## 3.7 frontend/ Config Files

### `frontend/angular.json`
**Angular CLI workspace configuration. Tells the build toolchain everything it needs.**

Key settings:

```json
"styles": [
  "@angular/material/prebuilt-themes/indigo-pink.css",  ← Material base theme
  "src/styles.scss"                                      ← your custom styles on top
],
"outputPath": "dist/uw-smart-ai-assistant",  ← where ng build outputs files
"budgets": [
  { "type": "initial", "maximumWarning": "500kb" },     ← warns if bundle too large
  { "type": "anyComponentStyle", "maximumWarning": "4kb" }  ← warns if component CSS too large
],
"outputHashing": "all"  ← adds content hash to filenames for cache busting
```

`defaultConfiguration: "production"` means `ng build` without flags builds for
production (optimised, minified). `ng serve` uses the `development` config
(unoptimised, with source maps).

---

### `frontend/package.json`
**npm package manifest. Defines all JavaScript dependencies.**

Runtime dependencies:
```json
"@angular/core": "^17.3.0"        ← Angular framework core
"@angular/material": "^17.3.0"    ← Angular Material UI components
"@angular/cdk": "^17.3.0"         ← Component Dev Kit (Material needs it)
"@angular/forms": "^17.3.0"       ← Reactive forms, ngModel
"@angular/router": "^17.3.0"      ← Client-side routing
"rxjs": "~7.8.0"                   ← Reactive extensions (Observables, Subject)
"zone.js": "~0.14.0"               ← Angular's change detection mechanism
"ngx-markdown": "^17.1.0"         ← Markdown rendering (available but not used yet)
"marked": "^12.0.0"               ← Markdown parser (dependency of ngx-markdown)
```

Dev dependencies (only used during build):
```json
"@angular/cli": "^17.3.0"         ← ng commands (ng serve, ng build, ng test)
"@angular-devkit/build-angular"    ← The actual Webpack/esbuild builder
"typescript": "~5.4.0"             ← TypeScript compiler
```

---

### `frontend/tsconfig.json`
**TypeScript compiler options for the entire project.**

Critical settings:

```json
"strict": true                       ← all strict checks enabled
"noImplicitOverride": true           ← must use 'override' keyword when overriding
"noImplicitReturns": true            ← all code paths must return a value
"target": "ES2022"                   ← output modern JavaScript
"module": "ES2022"                   ← use ES module syntax (import/export)
"lib": ["ES2022", "dom"]             ← available browser/node APIs
"strictTemplates": true              ← Angular template type checking
```

`strict: true` catches type errors at compile time, preventing runtime bugs.
If you add a new property to a TypeScript interface, the compiler will immediately
tell you every place that needs to be updated.

---

### `frontend/tsconfig.app.json`
**Extends the base tsconfig for the application compilation specifically.**

```json
{
  "extends": "./tsconfig.json",
  "files": ["src/main.ts"],      ← entry point for the compiler
  "include": ["src/**/*.d.ts"]   ← type declaration files
}
```

The `"files": ["src/main.ts"]` tells the TypeScript compiler to start from `main.ts`
and follow all imports from there. It doesn't need to list every file — TypeScript
traces the import graph automatically.

---

## 3.6 frontend/src/ Root Files

### `frontend/src/index.html`
**The single HTML page served by the browser. Everything Angular renders goes inside `<app-root>`.**

```html
<title>🥷 UW Smart AI Assistant</title>
<base href="/">                    ← tells the browser all routes start from /
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700">
<link href="https://fonts.googleapis.com/icon?family=Material+Icons|Material+Icons+Outlined">
<body class="mat-typography">
  <app-root></app-root>           ← Angular mounts here
</body>
```

**`<base href="/">`** is required for Angular routing. Without it, navigating to
`/policies/123` and refreshing would make the browser request `policies/123`
relative to the current path instead of from the root.

**Font links:**
- `Inter` — the primary UI typeface (weights 300–700)
- `Material Icons` and `Material Icons Outlined` — icon fonts used by `<mat-icon>`

---

### `frontend/src/main.ts`
**The Angular application bootstrap file. Runs once when the page loads.**

```typescript
bootstrapApplication(AppComponent, {
  providers: [
    provideRouter(routes),            ← enables Angular routing
    provideAnimationsAsync(),         ← enables Angular Material animations
    provideHttpClient(),              ← enables Angular's HttpClient (for PolicyService)
  ],
});
```

`provideAnimationsAsync()` loads animation code lazily — it's not bundled until
the first animation triggers. This reduces initial bundle size.

`provideHttpClient()` makes `HttpClient` available for injection anywhere in the app.
Without this, `PolicyService` would throw "No provider for HttpClient".

---

### `frontend/src/styles.scss`
**Global design tokens and Angular Material overrides. The single source of brand truth.**

**CSS Custom Properties (variables) defined in `:root`:**

Brand palette — Wine & Black:
```scss
--hw: #6E2035;           /* Wine — primary: buttons, active states, refs */
--hw-dark: #521828;      /* Pressed/active variant */
--hw-hover: #7C2540;     /* Hover variant */
--hw-surface: #FBF2F4;   /* Barely-tinted background for hover rows, active cards */
--hw-subtle: #F3DDE3;    /* Stronger tint for selected states */
--hw-glow: rgba(110,32,53,0.14);  /* Focus ring glow */

--hb: #1A1A1A;           /* Black — header background, user message bubbles */
--hb-2: #282828;         /* Slightly softer black */

--hr: #C8102E;           /* Accent red — high-severity badges */
--hg: #B8912A;           /* Gold — premium accent (available for use) */
--hn: #1B2A4A;           /* Navy — secondary accent (available for use) */
```

Semantic utility variables:
```scss
--warn: #D97706;         /* Amber — referral badges, "Review" status */
--danger: #DC2626;       /* Red — error states */
--success: #16A34A;      /* Green — "Completed" status */
--info: #2563EB;         /* Blue — "In Progress" status */
```

Surface and typography:
```scss
--bg: #F4F3F1;           /* Page background (warm off-white) */
--surface: #FFFFFF;      /* Card/panel backgrounds */
--text: #1A1818;         /* Primary text */
--text-2: #5A5653;       /* Secondary text (labels, metadata) */
--text-3: #908B87;       /* Muted text (placeholders, icons) */
```

Angular Material overrides at the bottom set the tab active indicator, form field
focus color, and progress bar color all to `--hw` (wine) to maintain
brand consistency across Material components.

---

## 3.1 frontend/src/app/components/

All components are **standalone** (no NgModule). Each component declares its own
`imports` array listing every dependency it uses.

---

### `components/uw-header/uw-header.component.ts`
**The top navigation bar. Fixed at 60px height.**

Visual structure:
```
┌──────────────────────────────────────────────────────────────┐
│ [🥷] UW Smart AI Assistant         [↺] [🔔] | [SM] Sarah   │
│      Specialty Commercial Lines                  Mitchell    │
└──────────────────────────────────────────────────────────────┘
  └──── wine bottom border accent ──────────────────────────────
```

- Black gradient background (`--hb` to `--hb-2`) with a 2px wine bottom border
- Logo mark: wine red rounded square with 🥷 emoji
- Brand sub-text: "Specialty Commercial Lines"
- Refresh button: triggers `refresh` `@Output()` EventEmitter
- Notifications button: placeholder (no functionality yet)
- Profile: "SM" avatar (wine background) + hardcoded name/role

**`@Output() refresh`** is caught by `AppComponent` which dispatches
`window.dispatchEvent(new CustomEvent('refresh-policies'))`. `HomeComponent`
listens for this event via `@HostListener`.

---

### `components/policy-search/policy-search.component.ts`
**The search and filter bar below the header.**

Two controls:
1. **Custom search input** — a styled `<div>` containing a `<input>` element
   (not a Material form field, for design control). Has focus ring using `--hw-glow`.
   Shows a clear ✕ button when text is present.
2. **LOB dropdown** — Angular Material `<mat-select>` with all 8 LOB options
   from `LOB_OPTIONS` constant. Empty option ("All Lines") clears the filter.

Both controls emit `filtersChanged` via `@Output()` on every change (including
clearing). `HomeComponent` receives the event and calls `applyFilters()`.

---

### `components/policy-table/policy-table.component.ts`
**The policy data table. Uses Angular Material's `mat-table` directive.**

Columns: Policy Ref · Insured · Line of Business · Broker · Type · Submitted · Status · (chevron)

Key details:
- **Policy Ref** styled in monospace font, wine color
- **Type badge** — referral: amber pill, decline: wine pill
- **Status dropdown** — each row has its own `<mat-select>` for inline status changes.
  `(click)="$event.stopPropagation()"` prevents the row click event from firing when
  clicking the dropdown (which would open the chat panel unintentionally)
- **Selected row** — wine left border (`box-shadow: inset 3px 0 0 var(--hw)`) + wine background tint
- **Hover row** — very light wine tint (`--hw-surface`)
- **Chevron** — faint gray, turns wine on row hover

`@Input() selectedPolicyRef` — the currently open policy. Used to highlight the selected row.
`@Output() policySelected` — emits the full PolicySummary when a row is clicked.
`@Output() statusChanged` — emits `{policyRef, status}` when the dropdown changes.

---

### `components/chat-window/chat-window.component.ts`
**The main AI chat panel. Slides in from the right as a 520px fixed overlay.**

Position: `right: -520px` (hidden) → `right: 0` (open) via CSS transition on `.open` class.

**State properties:**
```typescript
messages: ChatMessage[]          ← full conversation array displayed in the UI
currentPrompts: string[]         ← pills shown in the prompts area
userInput: string                ← bound to the text input
isStreaming: boolean             ← true while SSE stream is open
sessionId: string | null         ← stored after first response, sent with subsequent messages
inputFocused: boolean            ← controls focus ring on input wrapper
```

**`ngOnChanges`** fires every time `@Input() policy` changes.
Resets `messages`, `sessionId`, and `currentPrompts` so each policy starts fresh.

**`sendMessage()`** — the core chat logic:
1. Push user message to `messages[]` immediately (no wait)
2. Push empty assistant message with `isStreaming: true` (shows thinking indicator)
3. Call `ChatService.sendMessage()` → get Observable
4. On each `text` event → append `event.content` to `aMsg.content` (streaming effect)
5. On `prompt_suggestions` → replace `currentPrompts` with new suggestions
6. On `done` → set `aMsg.isStreaming = false` (cursor disappears)
7. On `error` → set `aMsg.content` to the error message

**Header** — black gradient background, wine bottom border, 🥷 badge in wine square.
Close button uses unicode `✕` (not a Material icon) for consistent visibility.

---

### `components/chat-message/chat-message.component.ts`
**Renders a single chat message bubble.**

**User message** (`.msg.user`):
- Right-aligned, row-reversed flex layout
- `--hb` (black) background → white text
- `SM` initials avatar in wine background
- No actions (copy button only on AI messages)

**AI message** (`.msg.ai`):
- Left-aligned
- White background, subtle border, tiny shadow
- 🥷 avatar with wine-tinted gradient background
- **Copy button** — appears on hover via `opacity: 0 → 1` transition
  Calls `navigator.clipboard.writeText()`. Shows "Copied" for 2 seconds.

**`formatContent(content: string)`** — converts markdown to safe HTML:
1. HTML-escapes `&`, `<`, `>` to prevent XSS
2. Converts `**text**` → `<strong>text</strong>`
3. Converts `*text*` → `<em>text</em>`
4. Converts `\n` → `<br>` for line breaks

The result is bound with `[innerHTML]`. The XSS escape runs first, making this safe.

**Streaming cursor** — shown only when `message.isStreaming && message.content` (not empty).
The condition `&& message.content` prevents showing the cursor during the initial
empty state when the thinking dots indicator is already visible.

---

### `components/chat-prompts/chat-prompts.component.ts`
**Renders suggested prompt pills below the conversation.**

Simple component: receives `prompts: string[]` as `@Input()`, emits
`promptClicked: string` as `@Output()`.

Each pill is a `<button>` with an `arrow_forward` icon. On hover: wine border,
wine text, wine-tinted background, icon becomes fully visible.

When clicked → `ChatWindowComponent.onPromptClick()` copies the text to `userInput`
and immediately calls `sendMessage()`, so clicking a prompt is indistinguishable
from the user typing and pressing Enter.

The `prompts-area` in `chat-window` has `max-height` transition: when `prompts` is
empty, `max-height: 0` and `opacity: 0` collapse the area smoothly rather than
jumping in height.

---

## 3.2 frontend/src/app/models/

### `frontend/src/app/models/policy.model.ts`
**TypeScript type definitions mirroring the backend Pydantic models.**

```typescript
export type PolicyType = 'referral' | 'decline';
export type PolicyStatus = 'review' | 'in_progress' | 'completed';

export interface PolicySummary {
  policy_ref: string;
  insured_name: string;
  broker: string;
  line_of_business: string;   // code: "PL", "CY", etc.
  lob_name: string;           // full name: "Professional Liability"
  policy_type: PolicyType;
  submission_date: string;
  status: PolicyStatus;
  assigned_uw: string;
}
```

Also exports `LOB_OPTIONS` — the array used by `PolicySearchComponent` to populate
the LOB filter dropdown. Centralised here so both the search component and any
future components can import from one place.

---

### `frontend/src/app/models/chat.model.ts`
**TypeScript interfaces for the chat system.**

```typescript
export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;            // the text — appended to as tokens stream in
  timestamp: Date;
  isStreaming?: boolean;      // true while SSE stream is open for this message
  isEmail?: boolean;          // true if the message was triggered by an email prompt
}

export interface ChatEvent {
  type: 'text' | 'tool_call' | 'prompt_suggestions' | 'done' | 'error';
  content?: string;           // present for 'text' and 'error' events
  tool_name?: string;         // present for 'tool_call' events
  suggestions?: string[];     // present for 'prompt_suggestions' events
  session_id?: string;        // present on every event — captures the session ID
}
```

`ChatEvent` exactly mirrors the JSON structure of SSE events sent by the backend.
`ChatService` parses SSE data lines and casts the result to `ChatEvent`.

---

## 3.3 frontend/src/app/pages/

### `frontend/src/app/pages/home/home.component.ts`
**The root dashboard page. Orchestrates the entire application.**

**State:**
```typescript
allPolicies: PolicySummary[]       ← raw full list from API
filteredPolicies: PolicySummary[]  ← after search/LOB filter applied
selectedPolicy: PolicySummary | null ← which policy's chat is open
loading: boolean                   ← controls progress bar
activeStatFilter: 'all' | 'referral' | 'decline' | 'review' | null
```

**Stat card filtering:**
`onStatClick(filter)` toggles `activeStatFilter`. If the same card is clicked twice,
the filter clears (toggle behaviour). When active, the tabbed view is replaced by
a flat table of matching policies with a "Clear filter" button.

**Computed getters (derived from `filteredPolicies`):**
```typescript
get reviewPolicies()      // status === 'review'
get inProgressPolicies()  // status === 'in_progress'
get completedPolicies()   // status === 'completed'
get referralCount()       // policy_type === 'referral' (from allPolicies, not filtered)
get declineCount()        // policy_type === 'decline'  (from allPolicies)
```

Note: `referralCount` and `declineCount` count from `allPolicies` (not `filteredPolicies`)
so the stat cards always show totals, not search-filtered totals.

**`@HostListener('window:refresh-policies')`** listens for the custom event dispatched
by `AppComponent` when the header refresh button is clicked. Triggers `loadPolicies()`.

**Chat coordination:**
`onPolicySelected(policy)` → sets `selectedPolicy`, which causes `ChatWindowComponent`
to receive a new policy via `@Input()` and reset its state.

`(statusUpdated)` event from `ChatWindowComponent` → calls `loadPolicies()` to
refresh the table, picking up status changes made via the AI chat.

---

## 3.4 frontend/src/app/services/

### `frontend/src/app/services/policy.service.ts`
**HTTP client for all policy REST endpoints. Uses Angular's `HttpClient`.**

```typescript
getPolicies(): Observable<PolicySummary[]>
  → GET /api/policies
  → Returns Observable that emits once when response arrives

getPolicy(ref: string): Observable<PolicyDetail>
  → GET /api/policies/{ref}

updateStatus(ref: string, status: PolicyStatus): Observable<StatusUpdateResponse>
  → PATCH /api/policies/{ref}/status
  → Body: { status }
```

`HttpClient` is appropriate here (not `fetch`) because these are standard REST
calls — the full response arrives at once and Angular's change detection integrates
naturally with Observables.

---

### `frontend/src/app/services/chat.service.ts`
**SSE stream consumer using native `fetch` + `ReadableStream`.**

Why `fetch` instead of `HttpClient`:
`HttpClient` waits for the complete response before emitting. For a streaming AI
response that trickles in over several seconds, this means the user sees nothing
until the entire answer is generated. `fetch` with `ReadableStream` processes
each byte chunk as it arrives.

**The streaming pipeline:**
```
fetch(POST) → response.body.getReader()
           → reader.read() [async, recursive]
           → TextDecoder.decode(chunk, { stream: true })
           → buffer accumulates partial lines
           → split on '\n', pop last incomplete line back to buffer
           → parse complete "data: {...}" SSE lines
           → JSON.parse(jsonStr)
           → subject.next(event)  ← fires to Observable subscriber
           → recurse until done === true
           → subject.complete()
```

The `{ stream: true }` flag on `TextDecoder.decode()` handles multi-byte UTF-8
characters (like emoji) that might be split across chunk boundaries.

---

## 3.5 frontend/src/environments/

### `frontend/src/environments/environment.ts`
Development configuration:
```typescript
export const environment = { production: false, apiUrl: 'http://localhost:8000' };
```
Used when running `ng serve`. All API calls go to `localhost:8000`.

### `frontend/src/environments/environment.prod.ts`
Production configuration:
```typescript
export const environment = { production: true, apiUrl: '' };
```

`apiUrl: ''` means **same-origin** requests. The Angular app is served from the same
domain as the API (via nginx reverse proxy or similar), so:
```
// PolicyService call: environment.apiUrl + '/api/policies'
// In dev:   'http://localhost:8000' + '/api/policies' = 'http://localhost:8000/api/policies'
// In prod:  ''                      + '/api/policies' = '/api/policies' (same origin)
```

For deployments where the frontend and backend are on **different domains**, set:
```typescript
apiUrl: 'https://api.your-domain.com'
```

Angular CLI automatically swaps `environment.ts` for `environment.prod.ts` when
building with `ng build` (production build). No manual file editing needed.

---

## 3.3 frontend/src/app/

### `frontend/src/app/app.component.ts`
**Root Angular component. The top-level shell rendered inside `<app-root>`.**

```typescript
template: `
  <app-uw-header (refresh)="onRefresh()"></app-uw-header>
  <main class="app-main">
    <router-outlet></router-outlet>
  </main>
`
```

`<router-outlet>` is where Angular renders the currently active route component.
With the current routing config, this always renders `HomeComponent`.

`onRefresh()` dispatches `window.dispatchEvent(new CustomEvent('refresh-policies'))`.
`HomeComponent`'s `@HostListener` picks this up and reloads policies.

The `:host` styles use `display: flex; flex-direction: column; height: 100vh; overflow: hidden`
to create a full-height layout. The header takes its natural 60px height.
`<main>` takes all remaining height with `flex: 1; overflow-y: auto`.

---

### `frontend/src/app/app.routes.ts`
**Angular client-side routing configuration.**

```typescript
export const routes: Routes = [
  { path: '', component: HomeComponent },   ← root path → HomeComponent
  { path: '**', redirectTo: '' },           ← any unknown path → back to home
];
```

Currently only one page exists. When additional pages are added (e.g., policy detail,
admin settings), new routes are added to this array.

`path: '**'` is the catch-all wildcard. Without it, navigating to
`http://localhost:4200/anything-invalid` would show a blank page.

---

## Summary: How All Files Connect

```
browser loads index.html
  → loads main.ts (bootstrap)
    → creates AppComponent
      → renders UwHeaderComponent + <router-outlet>
        → router activates HomeComponent
          → HomeComponent uses PolicyService → GET /api/policies → returns PolicySummary[]
          → renders PolicySearchComponent + PolicyTableComponent
          → user clicks row → selectedPolicy set → ChatWindowComponent opens
            → ChatWindowComponent uses ChatService → POST /api/chat (SSE)
              → backend: chat.py creates/resumes ADK session
                → ADK Runner calls LlmAgent (agent.py)
                  → Gemini decides to call a tool
                    → before_tool_callback validates (guardrails.py)
                    → tool executes (tools.py)
                      → reads mock_policies.py / mock_qa_data.py
                    → after_tool_callback logs (guardrails.py)
                  → Gemini generates response text
                    → after_model_callback checks (guardrails.py)
                  → text tokens stream as SSE events
              → ChatService subject.next(event)
            → ChatWindowComponent aMsg.content += token
              → Angular re-renders ChatMessageComponent
                → user sees tokens appear in real time
```
