"""
Canonical Emergency Incident Model (CEIM) generation.

Structures the AI scene interview's free-text answers, plus already-known
button/sensor facts, into one CEIM report (schemas/ceim.py). Reuses the exact
prompt-for-JSON -> manual parse -> one repair call -> graceful-degrade
pattern already proven in resqkit_ai.py's recognize_kit, rather than
attempting real JSON-mode/schema-constrained decoding - nothing like that is
proven against this project's Ollama setup.

Safety invariant: _merge_extracted() below NEVER lets the model's output
touch a victim's responsive/breathing facts, no matter what the free text
says. This mirrors resqkit_ai.py's own emergency-guard precedent - "that
guarantee does not depend on the model following instructions." Covered by
an adversarial test in the CEIM endpoint's verification (see the plan doc).

The AI never authors medical guidance here. This service only gathers and
structures bystander-reported information; knowledge.ts's routeProcedure()
and curated PROCEDURES remain the sole source of guidance shown to the user,
completely untouched by CEIM.
"""

import json
import logging
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from schemas.aihub import GenTxtRequest
from schemas.ceim import (
    CeimGenerateResponse,
    CeimHazard,
    CeimIncident,
    CeimLocation,
    CeimVictim,
    Fact,
    InterviewAnswerIn,
    KnownFacts,
)
from schemas.aihub import ChatMessage
from services.aihub import AIHubService
from services.resqkit_ai import HAZARD_WHITELIST, KIT_ITEM_WHITELIST, NARRATIVE_MODEL, _extract_json_block

logger = logging.getLogger(__name__)

# Bounds applied after parsing, before anything is stored or re-rendered -
# mirrors _sanitize_recognition's whitelist-filtering role, but for free text
# there's no whitelist to filter against, only size to bound.
MAX_LIST_ITEMS = 10
MAX_FIELD_CHARS = 400


def _cap(text: Any) -> str:
    s = str(text or "").strip()
    if len(s) > MAX_FIELD_CHARS:
        s = s[:MAX_FIELD_CHARS].rstrip() + "..."
    return s


class CeimService:
    def __init__(self) -> None:
        self._aihub = AIHubService()

    # ------------------------------------------------------------------ #
    # Deterministic skeleton - no model call, never touched by AI output
    # ------------------------------------------------------------------ #

    def _known_facts_to_ceim_skeleton(
        self, known: KnownFacts, content_pack_version: str
    ) -> CeimIncident:
        def button(value: Optional[Any]) -> Optional[Fact]:
            if value is None or value == "":
                return None
            return Fact(value=value, source="button_selected", confidence="high")

        def sensor(value: Optional[float]) -> Optional[Fact]:
            if value is None:
                return None
            return Fact(value=value, source="device_sensor", confidence="high")

        victim = CeimVictim(
            index=0,
            responsive=button(known.responsive),
            breathing=button(known.breathing),
            age_band=button(known.age_band),
            injury_type=button(known.injury),
            trapped=button(known.trapped),
        )

        hazards = [
            CeimHazard(
                code=Fact(value=code, source="button_selected", confidence="high"),
                description=Fact(
                    value=HAZARD_WHITELIST.get(code, code), source="button_selected", confidence="high"
                ),
            )
            for code in known.hazards
        ]
        kit_items = [
            Fact(value=KIT_ITEM_WHITELIST.get(code, code), source="button_selected", confidence="high")
            for code in known.kit_items
        ]

        return CeimIncident(
            generated_at=datetime.now(timezone.utc),
            content_pack_version=content_pack_version,
            incident_type=button(known.incident_type),
            called_112=button(known.called_112),
            location=CeimLocation(
                latitude=sensor(known.latitude),
                longitude=sensor(known.longitude),
                accuracy_m=sensor(known.accuracy_m),
                description=button(known.location_note),
            ),
            victim_count=button(known.victim_count),
            victims=[victim],
            hazards=hazards,
            kit_items=kit_items,
        )

    # ------------------------------------------------------------------ #
    # AI extraction from free-text interview answers
    # ------------------------------------------------------------------ #

    def _extraction_prompt(self, qa_text: str) -> str:
        hazard_codes = "\n".join(f"- {code}: {name}" for code, name in HAZARD_WHITELIST.items())
        return (
            "You are structuring a bystander's free-text answers about an emergency "
            "scene into a report. You identify OBSERVATIONS ONLY. You must never give "
            "medical advice, never diagnose, never invent facts not present in the "
            "answers below.\n\n"
            "ANSWERS\n"
            f"{qa_text}\n\n"
            "TASK\n"
            "Extract: (1) victim condition detail beyond simple yes/no fields, injury "
            "type in the bystander's own words, and whether they are trapped/hard to "
            "reach; (2) hazards mentioned, each with a short description and, only if "
            "it clearly matches, one of these exact codes (omit code otherwise):\n"
            f"{hazard_codes}\n"
            "(3) other scene observations as short standalone strings; (4) anything "
            "else worth noting as additional_notes.\n\n"
            "STRICT RULES\n"
            "1. Never invent anything not stated or clearly implied in the answers.\n"
            "2. Do NOT include any field named 'responsive' or 'breathing' anywhere in "
            "your output - those are decided elsewhere and any value you provide for "
            "them will be discarded.\n"
            "3. If an answer is empty, unclear or says nothing useful, omit it rather "
            "than guessing.\n"
            "4. Each fact belongs in exactly one place. A hazard already listed under "
            "'hazards' must NOT also appear in 'scene_observations' - put only genuinely "
            "different information there (weather, number of people, vehicles, anything "
            "not already captured as a victim detail or a hazard).\n\n"
            "OUTPUT\n"
            "Return ONLY valid JSON, no prose, in exactly this shape:\n"
            '{"victims":[{"index":0,"condition_description":"...","injury_type":"...",'
            '"trapped":"..."}],"hazards":[{"code":"traffic","description":"..."}],'
            '"scene_observations":["...","..."],"additional_notes":"..."}'
        )

    def _merge_extracted(self, ceim: CeimIncident, parsed: Dict[str, Any]) -> None:
        """
        Fold AI-extracted content into the skeleton.

        Never reads/writes responsive or breathing on any victim, regardless
        of what `parsed` contains for those keys - this is the code-level
        enforcement of A1, not just prompt wording.
        """
        victims_in = parsed.get("victims")
        if isinstance(victims_in, list) and ceim.victims:
            v0 = victims_in[0] if victims_in and isinstance(victims_in[0], dict) else {}
            target = ceim.victims[0]
            for field_name in ("condition_description", "injury_type", "trapped"):
                raw = v0.get(field_name)
                if raw:
                    setattr(
                        target,
                        field_name,
                        Fact(value=_cap(raw), source="ai_inferred", confidence="medium"),
                    )

        hazards_in = parsed.get("hazards")
        if isinstance(hazards_in, list):
            for entry in hazards_in[:MAX_LIST_ITEMS]:
                if not isinstance(entry, dict):
                    continue
                description = _cap(entry.get("description"))
                if not description:
                    continue
                code = str(entry.get("code") or "").strip()
                code_fact = (
                    Fact(value=code, source="ai_inferred", confidence="medium")
                    if code in HAZARD_WHITELIST
                    else None
                )
                ceim.hazards.append(
                    CeimHazard(
                        code=code_fact,
                        description=Fact(value=description, source="bystander_stated", confidence="medium"),
                    )
                )

        observations_in = parsed.get("scene_observations")
        if isinstance(observations_in, list):
            for text in observations_in[:MAX_LIST_ITEMS]:
                capped = _cap(text)
                if capped:
                    ceim.scene_observations.append(
                        Fact(value=capped, source="bystander_stated", confidence="medium")
                    )

        notes = _cap(parsed.get("additional_notes"))
        if notes:
            ceim.additional_notes = Fact(value=notes, source="bystander_stated", confidence="medium")

    # ------------------------------------------------------------------ #
    # Public entry point
    # ------------------------------------------------------------------ #

    async def generate(
        self,
        known_facts: KnownFacts,
        interview_answers: List[InterviewAnswerIn],
        content_pack_version: str,
    ) -> CeimGenerateResponse:
        ceim = self._known_facts_to_ceim_skeleton(known_facts, content_pack_version)

        qa_text = "\n".join(
            f"Q: {a.prompt_text}\nA: {a.answer_text.strip()}"
            for a in interview_answers
            if a.answer_text and a.answer_text.strip()
        )
        if not qa_text:
            return CeimGenerateResponse(ceim=ceim, degraded=False, model="none")

        request = GenTxtRequest(
            messages=[
                ChatMessage(role="system", content="Return ONLY valid JSON. No explanations."),
                ChatMessage(role="user", content=self._extraction_prompt(qa_text)),
            ],
            model=NARRATIVE_MODEL,
            stream=False,
            temperature=0.1,
            max_tokens=1200,
        )

        payload: Optional[Dict[str, Any]] = None
        try:
            response = await self._aihub.gentxt(request)
            raw = (response.content or "").strip()
            try:
                candidate = json.loads(_extract_json_block(raw))
                if isinstance(candidate, dict):
                    payload = candidate
            except json.JSONDecodeError:
                payload = None

            if payload is None:
                # One repair attempt, mirroring recognize_kit's pattern exactly.
                repair = GenTxtRequest(
                    messages=[
                        ChatMessage(
                            role="system",
                            content=(
                                "Convert the following into valid JSON matching "
                                '{"victims":[{"index":0,"condition_description":str,'
                                '"injury_type":str,"trapped":str}],'
                                '"hazards":[{"code":str,"description":str}],'
                                '"scene_observations":[str],"additional_notes":str}. '
                                "Return JSON only."
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
                    logger.warning("CEIM extraction repair failed: %s", exc)
                    payload = None
        except Exception as exc:  # noqa: BLE001 - must degrade, never crash the flow
            logger.warning("CEIM extraction call failed: %s", exc)
            payload = None

        if payload is None:
            # Cheap non-AI fallback: fold each raw answer in directly as a
            # low-confidence observation, so the report is still useful.
            for a in interview_answers:
                if a.answer_text and a.answer_text.strip():
                    ceim.scene_observations.append(
                        Fact(value=_cap(a.answer_text), source="bystander_stated", confidence="low")
                    )
            ceim.degraded = True
            return CeimGenerateResponse(ceim=ceim, degraded=True, model=NARRATIVE_MODEL)

        self._merge_extracted(ceim, payload)
        return CeimGenerateResponse(ceim=ceim, degraded=False, model=NARRATIVE_MODEL)
