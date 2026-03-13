"""
ADK callback guardrails for the UW Smart AI Assistant.
Four hooks intercepting the agent execution lifecycle.
Signatures match google-adk v1.27.0 canonical callback API.
"""

import re
import logging
from datetime import datetime, timezone
from google.genai import types

logger = logging.getLogger(__name__)

POLICY_REF_PATTERN = re.compile(r"^\d{2}[A-Z]{2}\d{8}$")

OFF_TOPIC_KEYWORDS = [
    "weather", "sports", "recipe", "joke", "movie", "song",
    "personal", "dating", "politics", "religion",
]

PII_REQUEST_PATTERNS = [
    r"social security",
    r"ssn",
    r"date of birth",
    r"home address",
    r"phone number",
    r"credit card",
    r"bank account",
]


def before_model_callback(*, callback_context, llm_request):
    """Input guardrail -- fires before every LLM call.
    - Blocks off-topic requests
    - Prevents PII extraction attempts
    """
    try:
        user_text = _extract_user_text(llm_request)
        if not user_text:
            return None

        text_lower = user_text.lower()

        for pattern in PII_REQUEST_PATTERNS:
            if re.search(pattern, text_lower):
                logger.warning(f"PII request blocked: {user_text[:100]}")
                return _block_response(
                    "I cannot share or process personal identification information. "
                    "I can help you with policy referral analysis, decline reasons, "
                    "re-rating history, and broker email drafting."
                )

        off_topic_count = sum(1 for kw in OFF_TOPIC_KEYWORDS if kw in text_lower)
        if off_topic_count >= 2 and not any(
            kw in text_lower
            for kw in ["policy", "referral", "decline", "premium", "broker", "underwriting", "rerat"]
        ):
            logger.warning(f"Off-topic request blocked: {user_text[:100]}")
            return _block_response(
                "I'm the UW Smart AI Assistant -- I can help with policy referral "
                "and decline analysis, re-rating history, premium details, broker "
                "emails, and status updates. How can I assist with your policies?"
            )

        logger.info(f"Audit: user input at {datetime.now(timezone.utc).isoformat()}: {user_text[:200]}")
    except Exception as e:
        logger.error(f"Error in before_model_callback: {e}")

    return None


def before_tool_callback(*, tool, args, tool_context):
    """Tool execution guardrail -- fires before every tool call.
    - Validates policy reference format
    - Enforces session rate limits
    """
    try:
        if "policy_ref" in args:
            ref = args["policy_ref"]
            if not POLICY_REF_PATTERN.match(ref):
                logger.warning(f"Invalid policy ref format: {ref}")
                return {
                    "error": (
                        f"Invalid policy reference format '{ref}'. "
                        "Expected pattern: 2 digits + 2 uppercase letters + 8 digits (e.g., 25PL00012345)"
                    )
                }

        state = tool_context.state
        call_count = state.get("tool_call_count", 0)
        if call_count >= 20:
            logger.warning("Tool call rate limit exceeded")
            return {"error": "Tool call limit exceeded for this session. Please start a new conversation."}
        state["tool_call_count"] = call_count + 1

    except Exception as e:
        logger.error(f"Error in before_tool_callback: {e}")

    return None


def after_model_callback(*, callback_context, llm_response):
    """Output guardrail -- fires after LLM generates a response.
    - Flags responses containing internal thresholds
    """
    try:
        response_text = _extract_response_text(llm_response)
        if not response_text:
            return None

        threshold_patterns = [
            r"\$\d+[MBK]?\s*authority\s*threshold",
            r"authority\s*limit\s*of\s*\$",
            r"internal\s*(?:risk\s*)?score",
            r"underwriting\s*authority\s*level",
        ]
        for pattern in threshold_patterns:
            if re.search(pattern, response_text, re.IGNORECASE):
                logger.warning("Internal threshold detected in response -- redaction would apply in production")

    except Exception as e:
        logger.error(f"Error in after_model_callback: {e}")

    return None


def after_tool_callback(*, tool, args, tool_context, tool_response):
    """Tool result guardrail -- fires after tool returns data.
    - Logs tool results for audit
    """
    try:
        tool_name = tool.name if hasattr(tool, "name") else str(tool)
        logger.info(
            f"Tool executed: {tool_name} with args {args} "
            f"at {datetime.now(timezone.utc).isoformat()}"
        )

        if isinstance(tool_response, dict) and "error" in tool_response:
            logger.warning(f"Tool {tool_name} returned error: {tool_response['error']}")

    except Exception as e:
        logger.error(f"Error in after_tool_callback: {e}")

    return None


def _extract_user_text(llm_request) -> str | None:
    """Extract user text from an LLM request."""
    try:
        if hasattr(llm_request, "contents") and llm_request.contents:
            for content in reversed(llm_request.contents):
                if hasattr(content, "role") and content.role == "user" and hasattr(content, "parts"):
                    for part in content.parts:
                        if hasattr(part, "text") and part.text:
                            return part.text
    except Exception:
        pass
    return None


def _extract_response_text(llm_response) -> str | None:
    """Extract text from an LLM response."""
    try:
        if hasattr(llm_response, "content") and llm_response.content:
            if hasattr(llm_response.content, "parts"):
                for part in llm_response.content.parts:
                    if hasattr(part, "text") and part.text:
                        return part.text
    except Exception:
        pass
    return None


def _block_response(message: str):
    """Create a blocking LLM response."""
    from google.adk.agents.llm_agent import LlmResponse
    return LlmResponse(
        content=types.Content(
            role="model",
            parts=[types.Part(text=message)],
        )
    )
