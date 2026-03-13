import json
import uuid
import logging
from fastapi import APIRouter
from sse_starlette.sse import EventSourceResponse
from google.adk.runners import Runner
from google.adk.sessions import InMemorySessionService
from google.genai import types
from app.models.schemas import ChatRequest
from app.agents.uw_assistant import uw_assistant_agent
from app.data.mock_policies import get_policy_by_ref

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api", tags=["chat"])

session_service = InMemorySessionService()

runner = Runner(
    agent=uw_assistant_agent,
    app_name="uw_smart_ai_assistant",
    session_service=session_service,
)

_session_registry: dict[str, str] = {}


async def _get_or_create_session(policy_ref: str, session_id: str | None) -> str:
    """Get existing session for a policy or create a new one."""
    registry_key = f"{policy_ref}:{session_id}" if session_id else policy_ref

    if session_id and session_id in _session_registry:
        return _session_registry[session_id]

    if policy_ref in _session_registry and not session_id:
        return _session_registry[policy_ref]

    new_session_id = session_id or str(uuid.uuid4())

    policy = get_policy_by_ref(policy_ref)
    initial_state = {}
    if policy:
        initial_state = {
            "policy_ref": policy_ref,
            "insured_name": policy["insured_name"],
            "policy_type": policy["policy_type"],
            "line_of_business": policy["lob_name"],
            "broker": policy["broker"],
            "tool_call_count": 0,
        }

    session = await session_service.create_session(
        app_name="uw_smart_ai_assistant",
        user_id="sarah_mitchell",
        session_id=new_session_id,
        state=initial_state,
    )

    _session_registry[new_session_id] = session.id
    _session_registry[policy_ref] = session.id

    return session.id


@router.post("/chat")
async def chat_endpoint(request: ChatRequest):
    """SSE streaming chat endpoint. Sends user message to the ADK agent
    and streams the response tokens back to the client."""

    session_id = await _get_or_create_session(request.policy_ref, request.session_id)

    policy = get_policy_by_ref(request.policy_ref)
    context_prefix = ""
    if policy:
        context_prefix = (
            f"[Context: Policy {request.policy_ref}, "
            f"Insured: {policy['insured_name']}, "
            f"Type: {policy['policy_type']}, "
            f"LOB: {policy['lob_name']}, "
            f"Broker: {policy['broker']}] "
        )

    user_content = types.Content(
        role="user",
        parts=[types.Part(text=context_prefix + request.message)],
    )

    async def event_generator():
        try:
            async for event in runner.run_async(
                user_id="sarah_mitchell",
                session_id=session_id,
                new_message=user_content,
            ):
                if event.content and event.content.parts:
                    for part in event.content.parts:
                        if part.text:
                            yield {
                                "event": "message",
                                "data": json.dumps({
                                    "type": "text",
                                    "content": part.text,
                                    "session_id": session_id,
                                }),
                            }
                        elif part.function_call:
                            yield {
                                "event": "tool_call",
                                "data": json.dumps({
                                    "type": "tool_call",
                                    "tool_name": part.function_call.name,
                                    "session_id": session_id,
                                }),
                            }

            prompt_suggestions = _get_prompt_suggestions(request.policy_ref, request.message)
            if prompt_suggestions:
                yield {
                    "event": "suggestions",
                    "data": json.dumps({
                        "type": "prompt_suggestions",
                        "suggestions": prompt_suggestions,
                        "session_id": session_id,
                    }),
                }

            yield {
                "event": "done",
                "data": json.dumps({
                    "type": "done",
                    "session_id": session_id,
                }),
            }

        except Exception as e:
            logger.error(f"Chat error: {e}", exc_info=True)
            err_str = str(e)
            if "429" in err_str or "RESOURCE_EXHAUSTED" in err_str:
                user_msg = (
                    "⚠️ The AI model is temporarily rate-limited (free tier quota reached). "
                    "Please wait 30–60 seconds and try again. "
                    "This is a free-tier API limit — the assistant will be available shortly."
                )
            elif "503" in err_str or "UNAVAILABLE" in err_str:
                user_msg = (
                    "⚠️ The AI model is temporarily unavailable due to high demand. "
                    "Please try again in a moment."
                )
            elif "API key" in err_str or "api_key" in err_str:
                user_msg = (
                    "⚠️ API key configuration error. "
                    "Please ensure GOOGLE_API_KEY is set correctly in the backend .env file."
                )
            else:
                user_msg = (
                    "⚠️ An error occurred while processing your request. "
                    "Please try again."
                )
            yield {
                "event": "error",
                "data": json.dumps({
                    "type": "error",
                    "content": user_msg,
                    "session_id": session_id,
                }),
            }

    return EventSourceResponse(event_generator())


def _get_prompt_suggestions(policy_ref: str, last_message: str) -> list[str]:
    """Return context-aware follow-up prompt suggestions."""
    policy = get_policy_by_ref(policy_ref)
    if not policy:
        return []

    msg_lower = last_message.lower()

    if any(kw in msg_lower for kw in ["referral", "decline", "caused", "reason", "why"]):
        suggestions = ["Frame email to broker", "Show re-rating history", "Summarize key risk factors"]
    elif any(kw in msg_lower for kw in ["rerat", "premium", "history"]):
        suggestions = ["Frame email to broker", "Show premium progression"]
    elif any(kw in msg_lower for kw in ["email", "broker", "draft"]):
        suggestions = ["Mark as In Progress", "Mark as Completed", "Any other concerns?"]
    elif any(kw in msg_lower for kw in ["status", "mark", "progress", "complete"]):
        suggestions = ["Any other concerns?"]
    else:
        if policy["policy_type"] == "referral":
            suggestions = [
                "What caused this referral?",
                "Show re-rating history",
                "What is the current premium?",
            ]
        else:
            suggestions = [
                "What caused this decline?",
                "Show re-rating history",
                "How many times was this re-rated?",
            ]

    return suggestions
