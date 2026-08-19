"""
Passive voice recognition (PVR) + websocket transcript streaming API.

Diagram: Request passive voice recognition (PVR) -> Websocket streaming
connection -> Websocket streaming block -> Receive AI API transcript, with
a REST fallback ('Continue call') and a logged termination entry when the
socket closes. See services/incident_stream.py for the chunked-ASR caveat.

Anonymous, like the rest of the session/log API. Not wired to the
frontend.
"""

import logging

from fastapi import APIRouter, Depends, HTTPException, WebSocket, WebSocketDisconnect
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from core.database import get_db
from services.incident_stream import IncidentStreamService

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/incident_sessions", tags=["incident_stream"])


class AudioChunkMessage(BaseModel):
    type: str = "audio_chunk"
    audio: str


@router.post("/{session_id}/pvr/request")
async def request_pvr(session_id: str, db: AsyncSession = Depends(get_db)):
    """'Request passive voice recognition (PVR)' - logs intent before the socket opens."""
    service = IncidentStreamService(db)
    result = await service.request_pvr(session_id)
    if not result:
        raise HTTPException(status_code=404, detail="Incident session not found")
    return result


@router.get("/{session_id}/transcript")
async def get_transcript(session_id: str, db: AsyncSession = Depends(get_db)):
    """REST fallback ('Continue call') for when a websocket can't be opened or kept alive."""
    service = IncidentStreamService(db)
    result = await service.get_transcript(session_id)
    if not result:
        raise HTTPException(status_code=404, detail="Incident session not found")
    return result


@router.websocket("/{session_id}/stream")
async def stream(websocket: WebSocket, session_id: str, db: AsyncSession = Depends(get_db)):
    """
    Websocket streaming connection/block.

    Client sends {"type": "audio_chunk", "audio": "<base64 data uri>"} for
    each short clip; server replies with {"type": "transcript", "text": ...}
    (or "transcript_error" on a failed AI call, which does not close the
    socket) and logs every segment into the session's LOG.
    """
    service = IncidentStreamService(db)
    await websocket.accept()

    if not await service.session_exists(session_id):
        await websocket.send_json({"type": "error", "message": "Incident session not found"})
        await websocket.close(code=4404)
        return

    await service.log_connected(session_id)
    reason = "client_disconnect"
    try:
        while True:
            message = await websocket.receive_json()
            msg_type = message.get("type")

            if msg_type == "audio_chunk":
                audio = message.get("audio")
                if not audio:
                    await websocket.send_json({"type": "error", "message": "Missing 'audio' field"})
                    continue
                result = await service.transcribe_chunk(session_id, audio)
                await websocket.send_json(result)

            elif msg_type == "ping":
                await websocket.send_json({"type": "pong"})

            elif msg_type == "close":
                reason = "client_close"
                break

            else:
                await websocket.send_json({"type": "error", "message": f"Unknown message type: {msg_type}"})

    except WebSocketDisconnect:
        reason = "client_disconnect"
    except Exception as exc:  # noqa: BLE001 - always log the termination before propagating
        logger.error(f"Websocket stream error for session {session_id}: {exc}", exc_info=True)
        reason = f"server_error: {exc}"
    finally:
        await service.log_terminated(session_id, reason)
