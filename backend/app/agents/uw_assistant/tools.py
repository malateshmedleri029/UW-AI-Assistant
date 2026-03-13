"""
Agent tools -- each calls the backend data layer (source of truth).
The LLM receives this data and analyzes it; it never invents reasons.
"""

from app.data.mock_policies import get_policy_by_ref, update_policy_status as _update_status
from app.data.mock_qa_data import get_reasons_for_policy, get_rerating_history


def get_policy_reasons(policy_ref: str) -> dict:
    """Retrieve the underwriting Q&A pairs that caused a policy to be referred or declined.

    Use this tool whenever the user asks why a policy was referred, why it was declined,
    what caused the referral, what caused the decline, or what the underwriting reasons are.
    This tool works for both referral and decline policies — do not worry about the policy
    type when calling it.

    Args:
        policy_ref: The policy reference number (e.g. 25PL00012345 or 25CY00134567).

    Returns:
        The authoritative underwriting Q&A pairs including each question, the answer
        given by the insured, severity level (high/medium/low), and the specific flag
        that triggered the referral or decline. Also returns policy_type so you know
        whether to frame the analysis as a referral or decline explanation.
    """
    policy = get_policy_by_ref(policy_ref)
    if not policy:
        return {"error": f"Policy {policy_ref} not found"}

    reasons = get_reasons_for_policy(policy_ref)
    if not reasons:
        return {"error": f"No underwriting reasons data available for {policy_ref}"}

    return {
        "policy_ref": policy_ref,
        "insured_name": policy["insured_name"],
        "line_of_business": policy["lob_name"],
        "policy_type": policy["policy_type"],
        "qa_pairs": reasons,
    }


def get_rerating_history_tool(policy_ref: str) -> dict:
    """Retrieve the complete re-rating history for a policy including
    how many times it was re-rated, the reason for each re-rating,
    the premium before and after, and what changed.

    Args:
        policy_ref: The policy reference number (e.g. 25CY00045678).

    Returns:
        The re-rating count, each re-rating event with timestamps and
        premium changes, the initial premium, and the current premium.
    """
    policy = get_policy_by_ref(policy_ref)
    if not policy:
        return {"error": f"Policy {policy_ref} not found"}

    events = get_rerating_history(policy_ref)
    return {
        "policy_ref": policy_ref,
        "insured_name": policy["insured_name"],
        "line_of_business": policy["lob_name"],
        "rerate_count": policy["rerate_count"],
        "initial_premium": policy["initial_premium"],
        "current_premium": policy["current_premium"],
        "events": events if events else [],
    }


def generate_broker_email(policy_ref: str, include_rerating: bool = False) -> dict:
    """Prepare the context for generating a professional broker email.
    This tool gathers the policy details and reasons so the LLM can
    compose an email grounded strictly in API-sourced facts.

    Args:
        policy_ref: The policy reference number.
        include_rerating: Whether to include re-rating history in the email context.

    Returns:
        All the factual context needed to compose a broker email,
        including policy details, reasons, and optionally re-rating history.
    """
    policy = get_policy_by_ref(policy_ref)
    if not policy:
        return {"error": f"Policy {policy_ref} not found"}

    reasons = get_reasons_for_policy(policy_ref)
    context = {
        "policy_ref": policy_ref,
        "insured_name": policy["insured_name"],
        "broker": policy["broker"],
        "line_of_business": policy["lob_name"],
        "policy_type": policy["policy_type"],
        "current_premium": policy["current_premium"],
        "qa_pairs": reasons or [],
        "instruction": (
            "Draft a professional email to the broker explaining the "
            f"{'referral' if policy['policy_type'] == 'referral' else 'decline'} "
            "reasons. Be diplomatic and factual. Do NOT reveal internal "
            "underwriting authority thresholds or internal risk scores. "
            "Use only the facts provided in this context."
        ),
    }

    if include_rerating:
        events = get_rerating_history(policy_ref)
        context["rerating_history"] = {
            "rerate_count": policy["rerate_count"],
            "initial_premium": policy["initial_premium"],
            "events": events if events else [],
        }

    return context


def update_policy_status_tool(policy_ref: str, new_status: str) -> dict:
    """Update the workflow status of a policy.

    Args:
        policy_ref: The policy reference number.
        new_status: The new status to set. Must be one of: review, in_progress, completed.

    Returns:
        Confirmation of the status change with the old and new status.
    """
    valid_statuses = {"review", "in_progress", "completed"}
    if new_status not in valid_statuses:
        return {"error": f"Invalid status '{new_status}'. Must be one of: {', '.join(valid_statuses)}"}

    result = _update_status(policy_ref, new_status)
    if not result:
        return {"error": f"Policy {policy_ref} not found"}

    return {
        "policy_ref": policy_ref,
        "old_status": result["old_status"],
        "new_status": result["new_status"],
        "message": f"Policy {policy_ref} status updated from {result['old_status']} to {result['new_status']}",
    }
