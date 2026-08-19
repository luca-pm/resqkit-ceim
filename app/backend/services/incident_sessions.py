import logging
import secrets
from datetime import datetime
from typing import Any, Dict, List, Optional

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from models.incident_sessions import IncidentEvent, IncidentSession
from services import session_broadcast

logger = logging.getLogger(__name__)

# Crockford-style alphabet minus ambiguous characters (0/O, 1/I/L/U) so a
# spoken-aloud or hand-typed join code doesn't misread.
_JOIN_CODE_ALPHABET = "23456789ABCDEFGHJKMNPQRSTVWXYZ"
_JOIN_CODE_LENGTH = 6


class IncidentSessionService:
    """Service layer for the live incident session + append-only event log."""

    def __init__(self, db: AsyncSession):
        self.db = db

    def _generate_join_code(self) -> str:
        return "".join(secrets.choice(_JOIN_CODE_ALPHABET) for _ in range(_JOIN_CODE_LENGTH))

    async def _unique_join_code(self) -> str:
        for _ in range(10):
            code = self._generate_join_code()
            if not await self.get_session_by_code(code):
                return code
        # Astronomically unlikely at demo scale (30^6 codes), but never loop forever.
        raise RuntimeError("Could not generate a unique join code")

    async def create_session(self, context_type: Optional[str] = None) -> IncidentSession:
        join_code = await self._unique_join_code()
        session = IncidentSession(context_type=context_type, called_112="not_confirmed", join_code=join_code)
        self.db.add(session)
        await self.db.commit()
        logger.info(f"Created incident_session {session.id} (join_code={join_code})")
        # Refresh alone doesn't eager-load `events`; re-fetch with selectinload
        # so the response model can serialize it without a lazy-load I/O error.
        return await self.get_session(session.id)

    async def get_session(self, session_id: str) -> Optional[IncidentSession]:
        stmt = (
            select(IncidentSession)
            .options(selectinload(IncidentSession.events))
            .where(IncidentSession.id == session_id)
        )
        result = await self.db.execute(stmt)
        return result.scalar_one_or_none()

    async def get_session_by_code(self, join_code: str) -> Optional[IncidentSession]:
        stmt = (
            select(IncidentSession)
            .options(selectinload(IncidentSession.events))
            .where(IncidentSession.join_code == join_code.upper())
        )
        result = await self.db.execute(stmt)
        return result.scalar_one_or_none()

    async def update_session(self, session_id: str, updates: Dict[str, Any]) -> Optional[IncidentSession]:
        session = await self.get_session(session_id)
        if not session:
            return None
        changed: Dict[str, Any] = {}
        for key, value in updates.items():
            if value is not None and hasattr(session, key):
                if getattr(session, key) != value:
                    changed[key] = value
                setattr(session, key, value)
        await self.db.commit()
        if changed:
            # Field updates (e.g. called_112) are otherwise invisible to
            # anything watching the session's log - log them as an event too,
            # via the same append_event() choke point everything else uses,
            # so dashboard spectators see status changes live, not just
            # explicit events.
            await self.append_event(session_id, "session_updated", changed)
        # Re-fetch rather than refresh(): refresh() would expire the eager-loaded
        # `events` relationship, forcing a lazy load outside the async context.
        return await self.get_session(session_id)

    async def append_event(
        self, session_id: str, event_type: str, payload: Optional[Dict[str, Any]]
    ) -> Optional[IncidentEvent]:
        session = await self.get_session(session_id)
        if not session:
            return None
        event = IncidentEvent(session_id=session_id, event_type=event_type, payload=payload)
        self.db.add(event)
        await self.db.commit()
        await self.db.refresh(event)
        logger.info(f"Appended event '{event_type}' to incident_session {session_id}")
        # Every event-creation path in the app funnels through here, so this
        # single call is enough to feed any live dashboard watching the session.
        session_broadcast.publish(
            session_id,
            {
                "id": event.id,
                "session_id": event.session_id,
                "event_type": event.event_type,
                "payload": event.payload,
                "created_at": event.created_at.isoformat() if event.created_at else None,
            },
        )
        return event

    async def terminate_session(self, session_id: str) -> Optional[IncidentSession]:
        session = await self.get_session(session_id)
        if not session:
            return None
        if session.status != "terminated":
            session.status = "terminated"
            session.terminated_at = datetime.now()
            await self.db.commit()
            await self.append_event(session_id, "session_terminated", None)
            return await self.get_session(session_id)
        return session

    async def list_events(self, session_id: str) -> List[IncidentEvent]:
        stmt = (
            select(IncidentEvent)
            .where(IncidentEvent.session_id == session_id)
            .order_by(IncidentEvent.id.asc())
        )
        result = await self.db.execute(stmt)
        return result.scalars().all()
