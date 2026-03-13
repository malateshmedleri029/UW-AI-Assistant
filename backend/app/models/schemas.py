from pydantic import BaseModel, Field
from enum import Enum


class PolicyType(str, Enum):
    REFERRAL = "referral"
    DECLINE = "decline"


class PolicyStatus(str, Enum):
    REVIEW = "review"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"


class LineOfBusiness(str, Enum):
    PL = "PL"
    DO = "DO"
    EO = "EO"
    CY = "CY"
    MC = "MC"
    EL = "EL"
    AV = "AV"
    XS = "XS"


LOB_NAMES = {
    "PL": "Professional Liability",
    "DO": "Directors & Officers",
    "EO": "Errors & Omissions",
    "CY": "Cyber Liability",
    "MC": "Marine Cargo",
    "EL": "Environmental Liability",
    "AV": "Aviation",
    "XS": "Excess & Surplus",
}


class QAPair(BaseModel):
    question: str
    answer: str
    severity: str = Field(description="high, medium, or low")
    flag: str = Field(description="Brief reason this answer triggered the referral/decline")


class ReratingEvent(BaseModel):
    rerate_number: int
    date: str
    reason: str
    premium_before: float
    premium_after: float
    changes: list[str]


class PolicySummary(BaseModel):
    policy_ref: str
    insured_name: str
    broker: str
    line_of_business: str
    lob_name: str
    policy_type: PolicyType
    submission_date: str
    status: PolicyStatus
    assigned_uw: str


class PolicyDetail(PolicySummary):
    current_premium: float
    rerate_count: int


class PolicyReasons(BaseModel):
    policy_ref: str
    policy_type: PolicyType
    qa_pairs: list[QAPair]


class ReratingHistory(BaseModel):
    policy_ref: str
    rerate_count: int
    current_premium: float
    initial_premium: float
    events: list[ReratingEvent]


class StatusUpdateRequest(BaseModel):
    status: PolicyStatus


class StatusUpdateResponse(BaseModel):
    policy_ref: str
    old_status: PolicyStatus
    new_status: PolicyStatus
    message: str


class ChatRequest(BaseModel):
    session_id: str | None = None
    policy_ref: str
    message: str
