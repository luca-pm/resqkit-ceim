from core.database import Base
from datetime import datetime
from sqlalchemy import Boolean, Column, DateTime, Float, Integer, String


class Incident_records(Base):
    __tablename__ = "incident_records"
    __table_args__ = {"extend_existing": True}

    id = Column(Integer, primary_key=True, index=True, autoincrement=True, nullable=False)
    context_type = Column(String, nullable=False)
    occurred_at = Column(String, nullable=False)
    location_summary = Column(String, nullable=True)
    latitude = Column(Float, nullable=True)
    longitude = Column(Float, nullable=True)
    location_accuracy = Column(Float, nullable=True)
    victim_count = Column(Integer, nullable=False)
    triage_summary = Column(String, nullable=True)
    hazards = Column(String, nullable=True)
    kit_items = Column(String, nullable=True)
    procedure_id = Column(String, index=True, nullable=True)
    interventions = Column(String, nullable=True)
    includes_health_data = Column(Boolean, nullable=True)
    called_112 = Column(String, nullable=False)
    brief_text = Column(String, nullable=True)
    content_pack_version = Column(String, nullable=True)
    retention_choice = Column(String, nullable=True)
    created_at = Column(DateTime(timezone=True), default=datetime.now)
    updated_at = Column(DateTime(timezone=True), default=datetime.now, onupdate=datetime.now)