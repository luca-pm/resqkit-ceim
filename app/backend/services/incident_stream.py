"""
Passive voice recognition (PVR) + websocket transcript streaming.

Diagram: Request passive voice recognition (PVR) -> Websocket streaming
connection -> Websocket streaming block -> Receive AI API transcript, with
a websocket fallback that still writes a termination entry to the LOG.

This is chunked, not continuously-streaming, ASR: the only speech-to-text
available in this codebase (services/aihub.py AIHubService.transcribe) is
one-shot-per-clip, so the client sends short audio chunks over the socket
and each is transcribed independently, matching the "recognize_kit" /
"polish_brief" pattern elsewhere of degrading gracefully on AI failure
rather than breaking the surrounding flow.
"""

import logging
import time
from typing import Any, Dict, List, Optional

from schemas.aihub import TranscribeAudioRequest
from services.aihub import AIHubService
from services.incident_sessions import IncidentSessionService

logger = logging.getLogger(__name__)


class IncidentStreamService:
    def __init__(self, db):
        self.sessions = IncidentSessionService(db)
        self.ai = AIHubService()

    async def request_pvr(self, session_id: str) -> Optional[Dict[str, Any]]:
        session = await self.sessions.get_session(session_id)
        if not session:
            return None
        await self.sessions.append_event(session_id, "pvr_requested", None)
        return {"status": "requested"}

    async def session_exists(self, session_id: str) -> bool:
        return (await self.sessions.get_session(session_id)) is not None

    async def log_connected(self, session_id: str) -> None:
        await self.sessions.append_event(session_id, "websocket_connected", None)

    async def log_terminated(self, session_id: str, reason: str) -> None:
        """Diagram: 'Store in Log termination of websocket'."""
        await self.sessions.append_event(session_id, "websocket_terminated", {"reason": reason})

    async def transcribe_chunk(self, session_id: str, audio_data_uri: str) -> Dict[str, Any]:
        started = time.monotonic()
        try:
            result = await self.ai.transcribe(TranscribeAudioRequest(audio=audio_data_uri))
            elapsed_ms = round((time.monotonic() - started) * 1000, 1)
            await self.sessions.append_event(
                session_id,
                "ai_transcript_segment",
                {"text": result.text, "model": result.model, "elapsed_ms": elapsed_ms},
            )
            return {"type": "transcript", "text": result.text, "elapsed_ms": elapsed_ms}
        except Exception as exc:  # noqa: BLE001 - never kill the socket over one bad chunk
            logger.warning(f"Transcription failed for session {session_id}: {exc}")
            await self.sessions.append_event(session_id, "ai_transcript_error", {"error": str(exc)})
            return {"type": "transcript_error", "error": str(exc)}

    async def get_transcript(self, session_id: str) -> Optional[Dict[str, Any]]:
        """REST fallback for when a websocket can't be opened/kept alive ('Continue call')."""
        session = await self.sessions.get_session(session_id)
        if not session:
            return None
        segments: List[Dict[str, Any]] = [
            {"text": e.payload.get("text"), "created_at": e.created_at.isoformat()}
            for e in session.events
            if e.event_type == "ai_transcript_segment" and e.payload
        ]
        return {"session_id": session_id, "segments": segments}
