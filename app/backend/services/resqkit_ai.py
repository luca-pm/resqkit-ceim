"""
ResQKit AI services.

Both capabilities run on open-source models self-hosted locally via Ollama's
OpenAI-compatible API (see `core/config.py: resqkit_vision_model` /
`resqkit_text_model`, and `APP_AI_BASE_URL`) — inference never leaves this
machine unless an operator explicitly repoints `APP_AI_BASE_URL` at a remote
provider. Both capabilities are deliberately constrained:

1. `recognize_kit` — multimodal recognition of first-aid kit contents and scene
   context from a camera frame, using the configured open-source vision model
   (default: `moondream`). The model may ONLY return item codes from a
   server-side whitelist. Anything outside the whitelist is discarded. No
   image is ever persisted: the base64 frame lives in the request body and is
   dropped when the request ends.

2. `polish_brief` — rewrites an ALREADY COMPOSED rescuer brief into fluent
   handover prose using the configured open-source text model (default:
   `llama3.2:3b`). The model is forbidden from adding facts. If the output
   introduces content the deterministic brief did not contain, the caller
   keeps the deterministic text.

Neither model is allowed to author medical procedures or legal statements.
Those come exclusively from the curated content pack in the frontend
(`src/lib/knowledge.ts`), which is itself sourced from the research
deliverables in the repository root.

3. `chat` — free-text first-aid Q&A ("ResQKit AI"). Unlike the two methods
   above, free text cannot be whitelist- or fact-checked, so it is
   constrained behaviorally instead: a strict system prompt, low
   temperature, and — critically — a pre-model heuristic guard that
   short-circuits to a hardcoded "call 112" response for messages that read
   like an active, in-progress emergency rather than a general question, so
   that guarantee does not depend on the model following instructions.
"""

import json
import logging
import re
from typing import Any, Dict, List, Optional

from core.config import settings
from fastapi import HTTPException

from schemas.aihub import ChatMessage, GenTxtRequest
from services.aihub import AIHubService

logger = logging.getLogger(__name__)

RECOGNITION_MODEL = settings.resqkit_vision_model
NARRATIVE_MODEL = settings.resqkit_text_model

# Whitelist of recognisable kit items, mirroring src/lib/knowledge.ts.
# The model can never introduce an item outside this mapping.
KIT_ITEM_WHITELIST: Dict[str, str] = {
    "gloves": "Disposable gloves",
    "pressure_bandage": "Pressure bandage",
    "sterile_gauze": "Sterile gauze pads",
    "triangular_bandage": "Triangular bandage",
    "tourniquet": "Tourniquet",
    "adhesive_plaster": "Adhesive plasters",
    "antiseptic": "Antiseptic wipes or solution",
    "burn_dressing": "Burn dressing or gel pad",
    "thermal_blanket": "Thermal / foil blanket",
    "scissors": "Shears or scissors",
    "cpr_shield": "CPR face shield or pocket mask",
    "aed": "AED (defibrillator)",
    "eyewash": "Eyewash / saline",
    "cold_pack": "Instant cold pack",
    "splint": "Mouldable splint",
    "warning_triangle": "Warning triangle",
    "hi_vis_vest": "High-visibility vest",
    "fire_extinguisher": "Fire extinguisher",
    "life_jacket": "Life jacket / buoyancy aid",
    "throw_line": "Throw line or ring buoy",
    "whistle": "Whistle",
    "bivvy_bag": "Bivvy bag / emergency shelter",
    "headlamp": "Headlamp or torch",
}

# Observable hazard whitelist, mirroring the frontend hazard taxonomy.
HAZARD_WHITELIST: Dict[str, str] = {
    "traffic": "Moving traffic",
    "fire": "Fire or smoke",
    "fuel_spill": "Fuel or chemical spill",
    "electrical": "Electrical / high voltage",
    "ev_battery": "Electric vehicle / traction battery",
    "water": "Water / drowning risk",
    "unstable_structure": "Unstable structure or load",
    "gas": "Gas smell or confined space",
    "exposure": "Cold, heat or exposure",
    "rockfall": "Rockfall, avalanche or steep drop",
    "aggression": "Aggression or crowd",
}

VALID_CONTEXTS = {"road", "office", "maritime", "mountain", "other"}

CHAT_MODEL = settings.resqkit_text_model
CHAT_MAX_HISTORY_TURNS = 8

# Phrasing that suggests an ACTIVE, in-progress emergency rather than a
# general question. Deliberately conservative (biased toward false positives
# — an unnecessary "call 112" reminder costs nothing; a missed one could
# cost a lot). Checked against the latest user message only.
_ACTIVE_EMERGENCY_PATTERNS = [
    r"\bnot breathing\b", r"\bstopped breathing\b", r"\bcan'?t breathe\b",
    r"\bno pulse\b", r"\bunconscious\b", r"\bunresponsive\b", r"\bcollapsed\b",
    r"\bpassed out\b", r"\bnot waking up\b", r"\bwon'?t wake up\b",
    r"\bbleeding (a lot|heavily|badly|won'?t stop)\b", r"\bsevere bleeding\b",
    r"\bchoking\b(?! on the word)", r"\bheart attack\b", r"\bstroke\b",
    r"\bseizure\b", r"\bconvulsing\b", r"\banaphylax", r"\ballergic reaction\b.*\b(now|right now|happening)\b",
    r"\bright now\b.*\b(help|dying|bleeding|breathing)\b", r"\bhe'?s dying\b", r"\bshe'?s dying\b",
    r"\bthey'?re dying\b", r"\bcall (an )?ambulance\b", r"\bin (a car|water|the water) and\b",
    r"\bhelp me now\b", r"\bwhat do i do (right )?now\b.*\b(bleeding|breathing|unconscious)\b",
]
_ACTIVE_EMERGENCY_RE = re.compile("|".join(_ACTIVE_EMERGENCY_PATTERNS), re.IGNORECASE)

CHAT_EMERGENCY_SHORT_CIRCUIT_REPLY = (
    "This sounds like it might be happening right now. Call 112 immediately — "
    "this chat is for general first-aid questions, not for live emergencies. "
    "If you've already called, follow the operator's instructions; the "
    "guided steps in this app can help while you wait."
)

CHAT_DEGRADED_REPLY = (
    "I couldn't reach the assistant right now. For general guidance, see the "
    "Learn section's step-by-step guides. If this is an active emergency, "
    "call 112."
)

CHAT_SYSTEM_PROMPT = (
    "You are the ResQKit AI assistant, answering general first-aid questions "
    "for bystanders inside a first-aid companion app.\n\n"
    "STRICT RULES\n"
    "1. Answer only general first-aid education questions (how a technique "
    "works, what an item in a kit is for, how to prepare). Do not diagnose, "
    "do not prescribe medication or dosages, do not give advice specific to "
    "one person's described symptoms as if examining them.\n"
    "2. If the message describes what sounds like an active, in-progress "
    "emergency, your entire reply must be to tell the user to call 112 "
    "immediately — do not attempt to answer the question first.\n"
    "3. Never claim ResQKit or this chat contacts emergency services. The "
    "only real 112 channel is the phone's own dialer.\n"
    "4. Keep answers short (under 120 words), plain language, no medical "
    "jargon without explanation.\n"
    "5. If you are not confident in an answer, say so and suggest the "
    "Learn section instead of guessing."
)


def _looks_like_active_emergency(message: str) -> bool:
    return bool(_ACTIVE_EMERGENCY_RE.search(message))


def _extract_json_block(text: str) -> str:
    """Pull the first JSON object out of a possibly fenced model response."""
    cleaned = text.strip()
    if cleaned.startswith("```"):
        match = re.search(r"```(?:json)?\s*\n(.*?)```", cleaned, re.DOTALL)
        if match:
            cleaned = match.group(1).strip()
    start = cleaned.find("{")
    end = cleaned.rfind("}")
    if start >= 0 and end > start:
        return cleaned[start : end + 1]
    return cleaned


class ResQKitAIService:
    """Knowledge-constrained AI helpers for ResQKit."""

    def __init__(self) -> None:
        self._aihub = AIHubService()

    # ------------------------------------------------------------------ #
    # Kit / scene recognition
    # ------------------------------------------------------------------ #

    def _recognition_prompt(self, context: str, expected_codes: List[str]) -> str:
        allowed = "\n".join(f"- {code}: {KIT_ITEM_WHITELIST[code]}" for code in expected_codes)
        hazards = "\n".join(f"- {code}: {name}" for code, name in HAZARD_WHITELIST.items())
        return (
            "You are a visual identification component inside an emergency first-aid "
            "assistance app. You identify OBJECTS ONLY. You must never give medical "
            "advice, never describe injuries, and never identify people.\n\n"
            f"Scene context declared by the user: {context}\n\n"
            "TASK\n"
            "Look at the photo and report which of the following first-aid kit items "
            "are clearly visible. Use ONLY these exact codes:\n"
            f"{allowed}\n\n"
            "Also report any of these observable environmental hazards that are "
            "clearly visible in the frame. Use ONLY these exact codes:\n"
            f"{hazards}\n\n"
            "STRICT RULES\n"
            "1. Only report an item if you can actually see it. Do not guess what a "
            "closed kit probably contains.\n"
            "2. Never invent a code. If something is visible but not in the lists, omit it.\n"
            "3. Give each item a confidence between 0 and 1. Use below 0.5 when unsure.\n"
            "4. Do not describe or count people. Do not comment on injuries or blood.\n"
            "5. `scene_note` must be at most 20 words and purely descriptive of the "
            "physical environment (for example: 'open car boot, daylight, roadside gravel').\n\n"
            "OUTPUT\n"
            "Return ONLY valid JSON, no prose, in exactly this shape:\n"
            '{"items": [{"code": "gloves", "confidence": 0.9}], '
            '"hazards": [{"code": "traffic", "confidence": 0.6}], '
            '"scene_note": "..."}'
        )

    def _sanitize_recognition(
        self, payload: Dict[str, Any], expected_codes: List[str]
    ) -> Dict[str, Any]:
        """Drop everything the model returned that is not on the whitelist."""
        allowed_items = set(expected_codes)
        items: List[Dict[str, Any]] = []
        seen: set = set()

        for entry in payload.get("items") or []:
            if not isinstance(entry, dict):
                continue
            code = str(entry.get("code", "")).strip()
            if code not in allowed_items or code in seen:
                continue
            try:
                confidence = float(entry.get("confidence", 0.0))
            except (TypeError, ValueError):
                confidence = 0.0
            confidence = max(0.0, min(1.0, confidence))
            seen.add(code)
            items.append(
                {
                    "code": code,
                    "name": KIT_ITEM_WHITELIST[code],
                    "confidence": round(confidence, 2),
                }
            )

        hazards: List[Dict[str, Any]] = []
        hazard_seen: set = set()
        for entry in payload.get("hazards") or []:
            if not isinstance(entry, dict):
                continue
            code = str(entry.get("code", "")).strip()
            if code not in HAZARD_WHITELIST or code in hazard_seen:
                continue
            try:
                confidence = float(entry.get("confidence", 0.0))
            except (TypeError, ValueError):
                confidence = 0.0
            hazard_seen.add(code)
            hazards.append(
                {
                    "code": code,
                    "name": HAZARD_WHITELIST[code],
                    "confidence": round(max(0.0, min(1.0, confidence)), 2),
                }
            )

        note = str(payload.get("scene_note") or "").strip()
        if len(note) > 160:
            note = note[:160].rstrip() + "..."

        items.sort(key=lambda entry: entry["confidence"], reverse=True)
        hazards.sort(key=lambda entry: entry["confidence"], reverse=True)

        return {"items": items, "hazards": hazards, "scene_note": note}

    async def recognize_kit(
        self, image_data_uri: str, context: str, expected_codes: Optional[List[str]] = None
    ) -> Dict[str, Any]:
        """
        Identify visible kit items and hazards in a single camera frame.

        The frame is processed in memory only; nothing is written to storage.
        Returns a whitelist-filtered result plus a `degraded` flag so the
        frontend can fall back to manual selection.
        """
        if not image_data_uri or not image_data_uri.startswith("data:image/"):
            raise HTTPException(
                status_code=400, detail="A base64 image data URI is required for recognition."
            )

        safe_context = context if context in VALID_CONTEXTS else "other"
        codes = [code for code in (expected_codes or []) if code in KIT_ITEM_WHITELIST]
        if not codes:
            codes = list(KIT_ITEM_WHITELIST.keys())

        request = GenTxtRequest(
            messages=[
                ChatMessage(role="system", content="Return ONLY valid JSON. No explanations."),
                ChatMessage(
                    role="user",
                    content=[
                        {"type": "text", "text": self._recognition_prompt(safe_context, codes)},
                        {"type": "image_url", "image_url": {"url": image_data_uri}},
                    ],
                ),
            ],
            model=RECOGNITION_MODEL,
            stream=False,
            temperature=0.1,
            max_tokens=1200,
        )

        try:
            response = await self._aihub.gentxt(request)
        except Exception as exc:  # noqa: BLE001 — recognition must degrade, never crash the flow
            logger.warning("ResQKit recognition call failed: %s", exc)
            return {
                "items": [],
                "hazards": [],
                "scene_note": "",
                "degraded": True,
                "message": "Recognition unavailable. Select your kit items manually.",
                "model": RECOGNITION_MODEL,
            }

        raw = (response.content or "").strip()
        payload: Optional[Dict[str, Any]] = None

        try:
            candidate = json.loads(_extract_json_block(raw))
            if isinstance(candidate, dict):
                payload = candidate
        except json.JSONDecodeError:
            payload = None

        if payload is None:
            # One repair attempt before degrading to manual selection.
            repair = GenTxtRequest(
                messages=[
                    ChatMessage(
                        role="system",
                        content=(
                            "Convert the following into valid JSON matching "
                            '{"items":[{"code":str,"confidence":number}],'
                            '"hazards":[{"code":str,"confidence":number}],'
                            '"scene_note":str}. Return JSON only.'
                        ),
                    ),
                    ChatMessage(role="user", content=raw[:4000]),
                ],
                model=NARRATIVE_MODEL,
                stream=False,
                temperature=0.0,
                max_tokens=800,
            )
            try:
                repaired = await self._aihub.gentxt(repair)
                candidate = json.loads(_extract_json_block((repaired.content or "").strip()))
                if isinstance(candidate, dict):
                    payload = candidate
            except (json.JSONDecodeError, Exception) as exc:  # noqa: BLE001
                logger.warning("ResQKit recognition repair failed: %s", exc)
                payload = None

        if payload is None:
            return {
                "items": [],
                "hazards": [],
                "scene_note": "",
                "degraded": True,
                "message": "Could not read the recognition result. Select your kit items manually.",
                "model": RECOGNITION_MODEL,
            }

        result = self._sanitize_recognition(payload, codes)
        result["degraded"] = len(result["items"]) == 0
        result["message"] = (
            "No kit items identified in this frame. Select them manually."
            if result["degraded"]
            else f"Identified {len(result['items'])} item(s)."
        )
        result["model"] = RECOGNITION_MODEL
        return result

    # ------------------------------------------------------------------ #
    # Handover narrative
    # ------------------------------------------------------------------ #

    async def polish_brief(self, brief_text: str) -> Dict[str, Any]:
        """
        Turn the deterministic brief into a spoken handover paragraph.

        The model receives the finished brief and is forbidden from adding
        anything. On any failure the caller keeps the deterministic text, so
        this is always a best-effort enhancement rather than a dependency.
        """
        if not brief_text or not brief_text.strip():
            raise HTTPException(status_code=400, detail="brief_text is required.")

        request = GenTxtRequest(
            messages=[
                ChatMessage(
                    role="system",
                    content=(
                        "You rewrite an emergency scene brief into a short spoken handover "
                        "for arriving paramedics.\n"
                        "ABSOLUTE RULES:\n"
                        "1. Use ONLY facts present in the input. Never add, infer or estimate "
                        "anything, including injuries, causes, vital signs or treatment advice.\n"
                        "2. Never give medical or legal advice.\n"
                        "3. If a field says not recorded, unsure or not confirmed, say so plainly.\n"
                        "4. Order: location, victims, status, hazards, medical info, actions taken.\n"
                        "5. Maximum 130 words, plain sentences, no headings, no bullet points.\n"
                        "6. If the brief says the 112 call is not confirmed, state that explicitly."
                    ),
                ),
                ChatMessage(role="user", content=brief_text[:6000]),
            ],
            model=NARRATIVE_MODEL,
            stream=False,
            temperature=0.2,
            max_tokens=600,
        )

        try:
            response = await self._aihub.gentxt(request)
        except Exception as exc:  # noqa: BLE001
            logger.warning("ResQKit brief narration failed: %s", exc)
            raise HTTPException(
                status_code=503,
                detail="Spoken handover could not be generated. The written brief is still complete.",
            ) from exc

        spoken = (response.content or "").strip()
        if not spoken:
            raise HTTPException(
                status_code=503,
                detail="Spoken handover came back empty. The written brief is still complete.",
            )

        return {"spoken": spoken, "model": NARRATIVE_MODEL}

    # ------------------------------------------------------------------ #
    # ResQKit AI chat
    # ------------------------------------------------------------------ #

    async def chat(self, messages: List[Dict[str, str]]) -> Dict[str, Any]:
        """
        Answer a general first-aid question. History is capped server-side
        and never persisted — the caller (client) owns conversation history,
        matching the app's local-first ethos.

        Unlike recognize_kit/polish_brief, free text can't be whitelist- or
        fact-checked, so the active-emergency guard runs BEFORE any model
        call: that guarantee must not depend on the model following
        instructions.
        """
        if not messages:
            raise HTTPException(status_code=400, detail="messages is required.")

        last_user = next((m for m in reversed(messages) if m.get("role") == "user"), None)
        if last_user and _looks_like_active_emergency(str(last_user.get("content", ""))):
            return {"reply": CHAT_EMERGENCY_SHORT_CIRCUIT_REPLY, "degraded": False, "model": "guard"}

        capped = messages[-(CHAT_MAX_HISTORY_TURNS * 2):]
        request = GenTxtRequest(
            messages=[
                ChatMessage(role="system", content=CHAT_SYSTEM_PROMPT),
                *[ChatMessage(role=m["role"], content=m["content"]) for m in capped],
            ],
            model=CHAT_MODEL,
            stream=False,
            temperature=0.2,
            max_tokens=500,
        )

        try:
            response = await self._aihub.gentxt(request)
        except Exception as exc:  # noqa: BLE001 — chat must degrade, never dead-end
            logger.warning("ResQKit chat call failed: %s", exc)
            return {"reply": CHAT_DEGRADED_REPLY, "degraded": True, "model": CHAT_MODEL}

        reply = (response.content or "").strip()
        if not reply:
            return {"reply": CHAT_DEGRADED_REPLY, "degraded": True, "model": CHAT_MODEL}

        return {"reply": reply, "degraded": False, "model": CHAT_MODEL}