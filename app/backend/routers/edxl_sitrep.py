"""
EDXL-SitRep payload builder API (OASIS Emergency Data Exchange Language -
Situation Reporting v1.0).

NON-TRANSMITTING - see services/edxl_sitrep.py for what this does and does
not do. Anonymous, like the rest of the session/log API.
"""

import logging

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from core.database import get_db
from services.edxl_sitrep import EdxlSitRepError, EdxlSitRepService

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/incident_sessions", tags=["edxl_sitrep"])


@router.post("/{session_id}/edxl_sitrep/build")
async def build_edxl_sitrep_payload(session_id: str, db: AsyncSession = Depends(get_db)):
    """Build (never send) an EDXL-SitRep payload from the session's latest CEIM report."""
    service = EdxlSitRepService(db)
    try:
        return await service.build(session_id)
    except EdxlSitRepError as exc:
        detail = (
            "No CEIM report has been generated for this session yet."
            if str(exc) == "no_ceim_report"
            else str(exc)
        )
        status_code = 409 if str(exc) == "no_ceim_report" else 404
        raise HTTPException(status_code=status_code, detail=detail)
