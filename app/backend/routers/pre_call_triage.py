"""
Pre-call triage question flow API.

Diagram: Request Tool -> Pre-Call Questions -> Wait 7s response ->
Response in guide time / Unresponsive-Skip -> Unresponsive-Skip Fallback.
See services/pre_call_triage.py for the state machine and content caveats.

Anonymous, like the session/log API this builds on. Not wired to the
frontend - the existing manual triage form in Emergency.tsx is untouched.
"""

import logging
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from core.database import get_db
from services.pre_call_triage import PreCallTriageError, PreCallTriageService

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1", tags=["pre_call_triage"])

_ERROR_STATUS = {
    "not_found": 404,
    "session_terminated": 400,
    "question_already_open": 409,
    "no_open_question": 409,
}


def _raise(exc: PreCallTriageError):
    raise HTTPException(status_code=_ERROR_STATUS.get(str(exc), 400), detail=str(exc))


class RespondRequest(BaseModel):
    question_id: str
    answer: Optional[str] = None
    skipped: bool = False


@router.get("/pre_call/questions")
async def list_pre_call_questions():
    """The 'Request Tool' - the fixed set of pre-call questions available."""
    return {"questions": PreCallTriageService.list_questions()}


@router.post("/incident_sessions/{session_id}/pre_call/ask")
async def ask_next_question(session_id: str, db: AsyncSession = Depends(get_db)):
    """Ask the next unanswered pre-call question and open its 7s response window."""
    service = PreCallTriageService(db)
    try:
        return await service.ask_next(session_id)
    except PreCallTriageError as exc:
        _raise(exc)


@router.post("/incident_sessions/{session_id}/pre_call/respond")
async def respond_to_question(session_id: str, payload: RespondRequest, db: AsyncSession = Depends(get_db)):
    """Answer (or skip) the currently open question; resolves to in-guide-time or fallback."""
    service = PreCallTriageService(db)
    try:
        return await service.respond(session_id, payload.question_id, payload.answer, payload.skipped)
    except PreCallTriageError as exc:
        _raise(exc)
