from fastapi import APIRouter, HTTPException, Query
from app.models.schemas import (
    PolicySummary, PolicyDetail, PolicyReasons, ReratingHistory,
    StatusUpdateRequest, StatusUpdateResponse, PolicyStatus,
    QAPair, ReratingEvent, LOB_NAMES,
)
from app.data.mock_policies import get_all_policies, get_policy_by_ref, update_policy_status
from app.data.mock_qa_data import get_reasons_for_policy, get_rerating_history

router = APIRouter(prefix="/api/policies", tags=["policies"])


@router.get("", response_model=list[PolicySummary])
def list_policies(
    status: PolicyStatus | None = Query(None),
    policy_type: str | None = Query(None, alias="type"),
    lob: str | None = Query(None),
    search: str | None = Query(None),
):
    policies = get_all_policies()

    if status:
        policies = [p for p in policies if p["status"] == status.value]
    if policy_type:
        policies = [p for p in policies if p["policy_type"] == policy_type]
    if lob:
        policies = [p for p in policies if p["line_of_business"] == lob.upper()]
    if search:
        q = search.lower()
        policies = [
            p for p in policies
            if q in p["policy_ref"].lower()
            or q in p["insured_name"].lower()
            or q in p["broker"].lower()
        ]

    return [
        PolicySummary(
            policy_ref=p["policy_ref"],
            insured_name=p["insured_name"],
            broker=p["broker"],
            line_of_business=p["line_of_business"],
            lob_name=LOB_NAMES.get(p["line_of_business"], p["line_of_business"]),
            policy_type=p["policy_type"],
            submission_date=p["submission_date"],
            status=p["status"],
            assigned_uw=p["assigned_uw"],
        )
        for p in policies
    ]


@router.get("/{policy_ref}", response_model=PolicyDetail)
def get_policy(policy_ref: str):
    p = get_policy_by_ref(policy_ref)
    if not p:
        raise HTTPException(status_code=404, detail=f"Policy {policy_ref} not found")
    return PolicyDetail(
        policy_ref=p["policy_ref"],
        insured_name=p["insured_name"],
        broker=p["broker"],
        line_of_business=p["line_of_business"],
        lob_name=LOB_NAMES.get(p["line_of_business"], p["line_of_business"]),
        policy_type=p["policy_type"],
        submission_date=p["submission_date"],
        status=p["status"],
        assigned_uw=p["assigned_uw"],
        current_premium=p["current_premium"],
        rerate_count=p["rerate_count"],
    )


@router.get("/{policy_ref}/reasons", response_model=PolicyReasons)
def get_policy_reasons(policy_ref: str):
    p = get_policy_by_ref(policy_ref)
    if not p:
        raise HTTPException(status_code=404, detail=f"Policy {policy_ref} not found")

    reasons = get_reasons_for_policy(policy_ref)
    if reasons is None:
        raise HTTPException(status_code=404, detail=f"No reasons data for {policy_ref}")

    return PolicyReasons(
        policy_ref=policy_ref,
        policy_type=p["policy_type"],
        qa_pairs=[QAPair(**r) for r in reasons],
    )


@router.get("/{policy_ref}/rerating-history", response_model=ReratingHistory)
def get_policy_rerating_history(policy_ref: str):
    p = get_policy_by_ref(policy_ref)
    if not p:
        raise HTTPException(status_code=404, detail=f"Policy {policy_ref} not found")

    events = get_rerating_history(policy_ref)
    return ReratingHistory(
        policy_ref=policy_ref,
        rerate_count=p["rerate_count"],
        current_premium=p["current_premium"],
        initial_premium=p["initial_premium"],
        events=[ReratingEvent(**e) for e in events],
    )


@router.patch("/{policy_ref}/status", response_model=StatusUpdateResponse)
def patch_policy_status(policy_ref: str, body: StatusUpdateRequest):
    result = update_policy_status(policy_ref, body.status.value)
    if not result:
        raise HTTPException(status_code=404, detail=f"Policy {policy_ref} not found")

    return StatusUpdateResponse(
        policy_ref=policy_ref,
        old_status=result["old_status"],
        new_status=result["new_status"],
        message=f"Policy {policy_ref} status updated from {result['old_status']} to {result['new_status']}",
    )
