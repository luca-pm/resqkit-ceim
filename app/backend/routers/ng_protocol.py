"""
NG protocol payload builder API (PIDF-LO + RFC 7852-style Additional Data).

NON-TRANSMITTING - see services/ng_protocol.py for what this does and does
not do. Anonymous, like the rest of the session/log API. Not wired to the
frontend.
"""

import logging
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from core.database import get_db
from services.ng_protocol import NgProtocolError, NgProtocolService

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/incident_sessions", tags=["ng_protocol"])


class BuildNgPayloadRequest(BaseModel):
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    accuracy_m: Optional[float] = None
    comment_override: Optional[str] = None


@router.post("/{session_id}/ng_protocol/build")
async def build_ng_protocol_payload(
    session_id: str,
    payload: BuildNgPayloadRequest = BuildNgPayloadRequest(),
    db: AsyncSession = Depends(get_db),
):
    """Build (never send) a PIDF-LO + Additional-Data payload from the session's log."""
    service = NgProtocolService(db)
    try:
        return await service.build(
            session_id,
            latitude=payload.latitude,
            longitude=payload.longitude,
            accuracy_m=payload.accuracy_m,
            comment_override=payload.comment_override,
        )
    except NgProtocolError as exc:
        raise HTTPException(status_code=404, detail=str(exc))
