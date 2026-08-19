import logging
from datetime import datetime
from typing import Any, Dict, List, Optional

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from models.incident_sessions import IncidentEvent, IncidentSession

logger = logging.getLogger(__name__)


class IncidentSessionService:
    """Service layer for the live incident session + append-only event log."""

    def __init__(self, db: AsyncSession):
        self.db = db

    async def create_session(self, context_type: Optional[str] = None) -> IncidentSession:
        session = IncidentSession(context_type=context_type, called_112="not_confirmed")
        self.db.add(session)
        await self.db.commit()
        logger.info(f"Created incident_session {session.id}")
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

    async def update_session(self, session_id: str, updates: Dict[str, Any]) -> Optional[IncidentSession]:
        session = await self.get_session(session_id)
        if not session:
            return None
        for key, value in updates.items():
            if value is not None and hasattr(session, key):
                setattr(session, key, value)
        await self.db.commit()
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
        return event

    async def terminate_session(self, session_id: str) -> Optional[IncidentSession]:
        session = await self.get_session(session_id)
        if not session:
            return None
        if session.status != "terminated":
            session.status = "terminated"
            session.terminated_at = datetime.now()
            self.db.add(IncidentEvent(session_id=session_id, event_type="session_terminated", payload=None))
            await self.db.commit()
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
