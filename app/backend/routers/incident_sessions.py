"""
Live incident session + append-only event log.

Foundational plumbing for the "API Triage Architecture" diagram's
session/LOG concept (User request session -> Get Session -> ... -> central
LOG). Deliberately anonymous, matching the public, un-gated /emergency
wizard: a session is addressed by an unguessable id rather than a user
account.

Not yet wired to the frontend. The existing incident wizard stays
local-first (see app/frontend/src/lib/localStore.ts) until sending real
incident data to a live session is a separate, explicitly approved change -
this router only provides the API surface.
"""

import logging
from datetime import datetime
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from core.database import get_db
from services.incident_sessions import IncidentSessionService

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/incident_sessions", tags=["incident_sessions"])


class CreateSessionRequest(BaseModel):
    context_type: Optional[str] = None


class UpdateSessionRequest(BaseModel):
    context_type: Optional[str] = None
    called_112: Optional[str] = None


class AppendEventRequest(BaseModel):
    event_type: str
    payload: Optional[Dict[str, Any]] = None


class EventResponse(BaseModel):
    id: int
    session_id: str
    event_type: str
    payload: Optional[Dict[str, Any]] = None
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class SessionResponse(BaseModel):
    id: str
    status: str
    context_type: Optional[str] = None
    called_112: Optional[str] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
    terminated_at: Optional[datetime] = None
    events: List[EventResponse] = []

    class Config:
        from_attributes = True


@router.post("", response_model=SessionResponse, status_code=201)
async def create_session(payload: CreateSessionRequest = CreateSessionRequest(), db: AsyncSession = Depends(get_db)):
    """Start a new incident session ('User request session' / 'Get Session')."""
    service = IncidentSessionService(db)
    session = await service.create_session(context_type=payload.context_type)
    return session


@router.get("/{session_id}", response_model=SessionResponse)
async def get_session(session_id: str, db: AsyncSession = Depends(get_db)):
    """Fetch a session and its full event log."""
    service = IncidentSessionService(db)
    session = await service.get_session(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Incident session not found")
    return session


@router.patch("/{session_id}", response_model=SessionResponse)
async def update_session(session_id: str, payload: UpdateSessionRequest, db: AsyncSession = Depends(get_db)):
    """Update top-level session state (e.g. context_type, called_112 status)."""
    service = IncidentSessionService(db)
    session = await service.update_session(session_id, payload.model_dump(exclude_unset=True))
    if not session:
        raise HTTPException(status_code=404, detail="Incident session not found")
    return session


@router.post("/{session_id}/events", response_model=EventResponse, status_code=201)
async def append_event(session_id: str, payload: AppendEventRequest, db: AsyncSession = Depends(get_db)):
    """Append one entry to the session's log."""
    service = IncidentSessionService(db)
    event = await service.append_event(session_id, payload.event_type, payload.payload)
    if not event:
        raise HTTPException(status_code=404, detail="Incident session not found")
    return event


@router.post("/{session_id}/terminate", response_model=SessionResponse)
async def terminate_session(session_id: str, db: AsyncSession = Depends(get_db)):
    """Mark a session terminated ('Call terminated'). Idempotent."""
    service = IncidentSessionService(db)
    session = await service.terminate_session(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Incident session not found")
    return session
