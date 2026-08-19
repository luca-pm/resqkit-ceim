"""
Pre-call triage question flow.

Diagram: Request Tool -> Pre-Call Questions -> Wait 7s response ->
Response in guide time / Unresponsive-Skip -> Unresponsive-Skip Fallback.
Everything here is recorded as IncidentEvent rows, so the session's event
log doubles as the state this state machine reasons from (no separate
"pending question" table).

The question set (PRE_CALL_QUESTIONS) stands in for the diagram's "Request
Tool" box. It is placeholder content: the source diagram itself marks this
whole cluster as an unconfirmed "Feature/Idea", not committed design.
"""

import logging
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from models.incident_sessions import IncidentEvent
from services.incident_sessions import IncidentSessionService

logger = logging.getLogger(__name__)

RESPONSE_WINDOW_SECONDS = 7

PRE_CALL_QUESTIONS: List[Dict[str, str]] = [
    {"id": "responsive", "prompt": "Is the person responsive?"},
    {"id": "breathing", "prompt": "Is the person breathing?"},
    {"id": "bleeding", "prompt": "Is there visible severe bleeding?"},
]

_ASKED = "pre_call_question_asked"
_RESOLVED_TYPES = {"response_in_guide_time", "unresponsive_skip_fallback"}


class PreCallTriageError(Exception):
    """State-machine violation: unknown session, no open question, etc."""


class PreCallTriageService:
    def __init__(self, db: AsyncSession):
        self.db = db
        self.sessions = IncidentSessionService(db)

    @staticmethod
    def list_questions() -> List[Dict[str, str]]:
        return PRE_CALL_QUESTIONS

    async def _events(self, session_id: str) -> List[IncidentEvent]:
        stmt = (
            select(IncidentEvent)
            .where(IncidentEvent.session_id == session_id)
            .order_by(IncidentEvent.id.asc())
        )
        result = await self.db.execute(stmt)
        return result.scalars().all()

    async def _open_question(self, events: List[IncidentEvent]) -> Optional[IncidentEvent]:
        """The most recently asked question that hasn't been resolved yet, if any."""
        open_event = None
        for event in events:
            if event.event_type == _ASKED:
                open_event = event
            elif event.event_type in _RESOLVED_TYPES:
                open_event = None
        return open_event

    async def ask_next(self, session_id: str) -> Dict[str, Any]:
        session = await self.sessions.get_session(session_id)
        if not session:
            raise PreCallTriageError("not_found")
        if session.status == "terminated":
            raise PreCallTriageError("session_terminated")

        events = await self._events(session_id)
        if await self._open_question(events):
            raise PreCallTriageError("question_already_open")

        asked_ids = {e.payload.get("question_id") for e in events if e.event_type == _ASKED and e.payload}
        remaining = [q for q in PRE_CALL_QUESTIONS if q["id"] not in asked_ids]
        if not remaining:
            return {"question": None}

        question = remaining[0]
        asked_event = await self.sessions.append_event(
            session_id, _ASKED, {"question_id": question["id"], "prompt": question["prompt"]}
        )
        return {
            "question": question,
            "asked_at": asked_event.created_at,
            "window_seconds": RESPONSE_WINDOW_SECONDS,
        }

    async def respond(
        self, session_id: str, question_id: str, answer: Optional[str], skipped: bool
    ) -> Dict[str, Any]:
        session = await self.sessions.get_session(session_id)
        if not session:
            raise PreCallTriageError("not_found")

        events = await self._events(session_id)
        open_event = await self._open_question(events)
        if not open_event or not open_event.payload or open_event.payload.get("question_id") != question_id:
            raise PreCallTriageError("no_open_question")

        asked_at = open_event.created_at
        now = datetime.now(timezone.utc) if asked_at.tzinfo else datetime.now()
        elapsed = (now - asked_at).total_seconds()

        in_guide_time = (not skipped) and answer is not None and elapsed <= RESPONSE_WINDOW_SECONDS

        if in_guide_time:
            await self.sessions.append_event(
                session_id,
                "response_in_guide_time",
                {"question_id": question_id, "answer": answer, "elapsed_seconds": round(elapsed, 2)},
            )
            return {"status": "recorded", "elapsed_seconds": round(elapsed, 2)}

        await self.sessions.append_event(
            session_id,
            "unresponsive_skip",
            {
                "question_id": question_id,
                "answer": answer,
                "skipped": skipped,
                "elapsed_seconds": round(elapsed, 2),
            },
        )
        fallback_message = (
            "No response captured in time - proceeding without this answer. Flagged for rescuer follow-up."
        )
        await self.sessions.append_event(
            session_id,
            "unresponsive_skip_fallback",
            {"question_id": question_id, "fallback_message": fallback_message},
        )
        return {
            "status": "fallback",
            "fallback_message": fallback_message,
            "elapsed_seconds": round(elapsed, 2),
        }
