"""
ResQKit custom API routes.

All AI calls are server-side. Camera frames are accepted in the request body,
used for a single inference, and never written to disk or object storage.
"""

import logging
from typing import List, Optional

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from services.resqkit_ai import NARRATIVE_MODEL, RECOGNITION_MODEL, ResQKitAIService

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/resqkit", tags=["resqkit"])

_service = ResQKitAIService()


class RecognizeKitRequest(BaseModel):
    """Single camera frame plus the declared scene context."""

    image: str = Field(..., description="Camera frame as a base64 image data URI.")
    context: str = Field(default="other", description="road | office | maritime | mountain | other")
    expected_items: Optional[List[str]] = Field(
        default=None,
        description="Optional narrowed whitelist of kit item codes expected in this context.",
    )


class PolishBriefRequest(BaseModel):
    """A fully composed deterministic scene brief."""

    brief_text: str = Field(..., description="The deterministic rescuer brief to narrate.")


@router.post("/recognize_kit")
async def recognize_kit(payload: RecognizeKitRequest):
    """
    Identify visible first-aid kit items and observable hazards in one frame.

    Always returns 200 with a `degraded` flag on recognition failure so the
    frontend can fall back to manual kit selection without treating it as an
    error state.
    """
    result = await _service.recognize_kit(
        image_data_uri=payload.image,
        context=payload.context,
        expected_codes=payload.expected_items,
    )
    return result


@router.post("/polish_brief")
async def polish_brief(payload: PolishBriefRequest):
    """Rewrite the deterministic brief as a short spoken handover."""
    return await _service.polish_brief(payload.brief_text)


@router.get("/health")
async def health():
    """Lightweight readiness probe for the ResQKit API surface."""
    try:
        return {"status": "ok", "recognition": RECOGNITION_MODEL, "narrative": NARRATIVE_MODEL}
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=500, detail=str(exc)) from exc