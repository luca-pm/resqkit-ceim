"""
Canonical Emergency Incident Model (CEIM).

A versioned, provenance-tracked intermediate representation of one incident,
per the mentor's 2026-09-02 direction: the AI never generates a
protocol-specific format directly. It populates this internal model, and
protocol-specific adapters (NG112 today, EDXL-SitRep planned) translate FROM
it on demand. See ResQKit_Canonical_Incident_Model.md for the full design
rationale and the EDXL-SitRep/NG112 background.

Every meaningful fact is wrapped in `Fact`, carrying WHERE it came from and
HOW confident we are — the thing today's IncidentState/brief.ts has none of.

Safety invariant (enforced in services/ceim.py, not just here): a victim's
`responsive`/`breathing` facts must always carry source="button_selected".
The AI is never allowed to originate or overwrite those two fields, because
they are what routes routeProcedure() to CPR. CEIM is never itself a source
of medical guidance — knowledge.ts's curated PROCEDURES remain the only
guidance shown to the user.
"""

from datetime import datetime
from typing import Generic, List, Literal, Optional, TypeVar

from pydantic import BaseModel, Field

CEIM_SCHEMA_VERSION = "0.1.0"

T = TypeVar("T")

CeimSource = Literal[
    "bystander_stated",  # free text from the AI interview, folded in verbatim
    "button_selected",  # fixed-choice triage/hazards/kit UI - always highest confidence
    "device_sensor",  # GPS fix etc.
    "ai_inferred",  # model-extracted/derived from bystander_stated text
    "not_recorded",
]

CeimConfidence = Literal["high", "medium", "low"]


class Fact(BaseModel, Generic[T]):
    """One piece of information, with where it came from and how sure we are."""

    value: Optional[T] = Field(default=None, description="The fact's value, or null if unknown.")
    source: CeimSource = Field(default="not_recorded", description="Where this fact came from.")
    confidence: CeimConfidence = Field(default="low", description="How confident we are in this fact.")
    note: Optional[str] = Field(
        default=None, description="Short justification, mainly used for ai_inferred facts."
    )


class CeimLocation(BaseModel):
    """Scene location, mixing device-sensor facts with bystander description."""

    latitude: Optional[Fact[float]] = None
    longitude: Optional[Fact[float]] = None
    accuracy_m: Optional[Fact[float]] = None
    description: Optional[Fact[str]] = Field(
        default=None, description="Free-text location note (landmark, address detail)."
    )


class CeimVictim(BaseModel):
    """
    One victim's state.

    `responsive`/`breathing` MUST always carry source="button_selected" -
    see the module docstring's safety invariant. Everything else may carry
    richer bystander-stated or ai_inferred detail.
    """

    index: int = Field(..., description="0-based victim index, matching the app's completedSteps ordering.")
    responsive: Optional[Fact[str]] = None
    breathing: Optional[Fact[str]] = None
    age_band: Optional[Fact[str]] = None
    injury_type: Optional[Fact[str]] = None
    trapped: Optional[Fact[str]] = None
    condition_description: Optional[Fact[str]] = Field(
        default=None, description="Free-text detail beyond the fixed triage fields."
    )


class CeimHazard(BaseModel):
    """One observed hazard, matched against the app's hazard whitelist where possible."""

    code: Optional[Fact[str]] = Field(
        default=None, description="Whitelist hazard code if the description matched one."
    )
    description: Fact[str] = Field(..., description="Raw hazard text, always present.")


class CeimIncident(BaseModel):
    """The full canonical model for one incident."""

    ceim_schema_version: str = Field(default=CEIM_SCHEMA_VERSION)
    generated_at: datetime = Field(..., description="When this report was generated.")
    content_pack_version: str = Field(..., description="Content pack version active when generated.")
    incident_type: Optional[Fact[str]] = None
    called_112: Optional[Fact[str]] = None
    location: CeimLocation = Field(default_factory=CeimLocation)
    victim_count: Optional[Fact[int]] = None
    victims: List[CeimVictim] = Field(default_factory=list)
    hazards: List[CeimHazard] = Field(default_factory=list)
    kit_items: List[Fact[str]] = Field(
        default_factory=list, description="Equipment confirmed on scene, button_selected from the kit stage."
    )
    scene_observations: List[Fact[str]] = Field(
        default_factory=list, description="Free-text narrative snippets, one per interview prompt."
    )
    additional_notes: Optional[Fact[str]] = None
    degraded: bool = Field(
        default=False, description="True if AI extraction failed and this is skeleton-only."
    )


class KnownFacts(BaseModel):
    """
    Already-captured, button/sensor-sourced incident fields (never AI-touched).

    `hazards`/`kit_items` are optional because the interview stage runs
    BEFORE the hazards/kit stages in the wizard - a first report generation
    naturally has neither. A "Regenerate report" action, fired once those
    stages are done, resends this same request with them populated.
    """

    incident_type: Optional[str] = None
    called_112: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    accuracy_m: Optional[float] = None
    location_note: Optional[str] = None
    victim_count: Optional[int] = None
    responsive: Optional[str] = None
    breathing: Optional[str] = None
    injury: Optional[str] = None
    age_band: Optional[str] = None
    trapped: Optional[str] = None
    hazards: List[str] = Field(default_factory=list, description="Confirmed hazard whitelist codes.")
    kit_items: List[str] = Field(default_factory=list, description="Confirmed kit item whitelist codes.")


class InterviewAnswerIn(BaseModel):
    """One answered (or skipped) interview prompt."""

    prompt_id: str = Field(..., description="Stable id matching INTERVIEW_PROMPTS on the client.")
    prompt_text: str = Field(..., description="The prompt text shown to the user, for model context.")
    answer_text: str = Field(default="", description="The bystander's free-text answer, if any.")


class CeimGenerateRequest(BaseModel):
    """Everything needed to generate one CEIM report."""

    known_facts: KnownFacts = Field(..., description="Already-captured button/sensor facts.")
    interview_answers: List[InterviewAnswerIn] = Field(
        default_factory=list, description="Free-text interview answers, in prompt order."
    )
    content_pack_version: str = Field(default="unknown")


class CeimGenerateResponse(BaseModel):
    """Always 200 - see CeimService.generate for the graceful-degrade contract."""

    ceim: CeimIncident
    degraded: bool = Field(..., description="True if the model call failed or produced no extraction.")
    model: str = Field(..., description="Model used, or 'none' if no interview text was provided.")
