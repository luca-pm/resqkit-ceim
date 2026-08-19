import uuid
from datetime import datetime

from core.database import Base
from sqlalchemy import Column, DateTime, ForeignKey, Integer, JSON, String
from sqlalchemy.orm import relationship


class IncidentSession(Base):
    """A live incident session (diagram: 'User request session' / 'Get Session').

    Anonymous by design — the emergency wizard has no login gate, so a session
    is addressed by an unguessable UUID rather than tied to a user account.
    Only written to when the frontend's "Real data mode" setting is on
    (see app/frontend/src/lib/institutionalActions.ts) — kept separate from
    the local-first incident flow by default, since sending real incident
    data to a live session is an explicit, separately-approved opt-in.
    """

    __tablename__ = "incident_sessions"
    __table_args__ = {"extend_existing": True}

    id = Column(String, primary_key=True, default=lambda: uuid.uuid4().hex, nullable=False)
    # Short, human-typeable pairing code for the ISU dashboard demo (diagram:
    # a second user enters this to watch the session live). The `id` above is
    # a 32-char UUID and deliberately unsuitable for a person to read aloud.
    join_code = Column(String, unique=True, index=True, nullable=True)
    status = Column(String, nullable=False, default="active")  # active | terminated
    context_type = Column(String, nullable=True)
    called_112 = Column(String, nullable=True)  # not_confirmed | called | already_called
    created_at = Column(DateTime(timezone=True), default=datetime.now)
    updated_at = Column(DateTime(timezone=True), default=datetime.now, onupdate=datetime.now)
    terminated_at = Column(DateTime(timezone=True), nullable=True)

    events = relationship(
        "IncidentEvent", order_by="IncidentEvent.id", back_populates="session", cascade="all, delete-orphan"
    )


class IncidentEvent(Base):
    """One append-only entry in a session's log (diagram: the central 'LOG' box).

    event_type is a free-form label rather than an enum: the diagram's
    Feature/Idea cluster (Pre-Call Questions, Wait 7s, Unresponsive/Skip,
    websocket termination, etc.) is not yet implemented, so the set of event
    kinds a future stage will emit isn't fixed yet.
    """

    __tablename__ = "incident_events"
    __table_args__ = {"extend_existing": True}

    id = Column(Integer, primary_key=True, index=True, autoincrement=True, nullable=False)
    session_id = Column(String, ForeignKey("incident_sessions.id"), index=True, nullable=False)
    event_type = Column(String, index=True, nullable=False)
    payload = Column(JSON, nullable=True)
    created_at = Column(DateTime(timezone=True), default=datetime.now)

    session = relationship("IncidentSession", back_populates="events")
