from core.database import Base
from datetime import datetime
from sqlalchemy import Column, DateTime, Integer, String


class Registered_kits(Base):
    __tablename__ = "registered_kits"
    __table_args__ = {"extend_existing": True}

    id = Column(Integer, primary_key=True, index=True, autoincrement=True, nullable=False)
    kit_type = Column(String, nullable=False)
    label = Column(String, nullable=False)
    location_note = Column(String, nullable=True)
    contents = Column(String, nullable=True)
    missing_items = Column(String, nullable=True)
    last_checked = Column(String, nullable=True)
    created_at = Column(DateTime(timezone=True), default=datetime.now)
    updated_at = Column(DateTime(timezone=True), default=datetime.now, onupdate=datetime.now)