"""
NG protocol payload builder (PIDF-LO + RFC 7852-style Additional Data).

Diagram: ... -> NG Protocol Transmission -> Call terminated.

NON-TRANSMITTING. This builds the payload shape only and logs that it was
built; nothing here sends anything to real emergency infrastructure. Per
the project's own ISU/NG112 notes (EdwardInput.docx), real transmission
requires an authorized channel via STS/ANCOM and is explicitly out of
scope until Phase 3 - this app's only real 112 channel today is the OS
dialer (tel:112) already used in the frontend.

Coverage is a deliberately partial, illustrative subset of RFC 7852/
PIDF-LO (location + provider info + a free-text comment folded from the
session's own log) - real integration would need the full data-block
catalog and a schema validated against whatever the receiving authority
actually accepts.

CEIM-aware (2026-09, per the mentor's canonical-model direction, see
ResQKit_Canonical_Incident_Model.md): if the session's event log has a
ceim_report_generated event, this is the NG112 "adapter" translating FROM
that canonical model rather than from ad hoc fields - the mentor's own
framing of "build the model once, add adapters on top." The request/
response contract is unchanged; callers that never generate a CEIM (or
sessions predating this feature) get byte-identical behavior via the
existing log-scanning fallback.
"""

import logging
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional
from xml.etree import ElementTree as ET

from services.incident_sessions import IncidentSessionService

logger = logging.getLogger(__name__)

PIDF_NS = "urn:ietf:params:xml:ns:pidf"
GEOPRIV_NS = "urn:ietf:params:xml:ns:pidf:geopriv10"
GML_NS = "http://www.opengis.net/gml"
GS_NS = "http://www.opengis.net/pidflo/1.0"
PROVIDER_NS = "urn:ietf:params:xml:ns:EmergencyCallData:ProviderInfo"
COMMENT_NS = "urn:ietf:params:xml:ns:EmergencyCallData:Comment"

# Conventional prefixes from the RFC 7852/PIDF-LO examples, so the output
# reads like the spec instead of ElementTree's auto-generated ns0/ns1/...
ET.register_namespace("", PIDF_NS)
ET.register_namespace("gp", GEOPRIV_NS)
ET.register_namespace("gml", GML_NS)
ET.register_namespace("gs", GS_NS)
ET.register_namespace("pi", PROVIDER_NS)
ET.register_namespace("ecc", COMMENT_NS)


def _q(ns: str, tag: str) -> str:
    return f"{{{ns}}}{tag}"


def _build_pidf_lo(
    latitude: Optional[float], longitude: Optional[float], accuracy_m: Optional[float]
) -> Optional[str]:
    """RFC 4119/5491-shaped location object. Uses ElementTree (not string
    concatenation) so any embedded text is XML-escaped automatically."""
    if latitude is None or longitude is None:
        return None

    presence = ET.Element(_q(PIDF_NS, "presence"), {"entity": "pres:incident@resqkit.local"})
    tuple_el = ET.SubElement(presence, _q(PIDF_NS, "tuple"), {"id": "loc1"})
    status = ET.SubElement(tuple_el, _q(PIDF_NS, "status"))
    geopriv = ET.SubElement(status, _q(GEOPRIV_NS, "geopriv"))
    location_info = ET.SubElement(geopriv, _q(GEOPRIV_NS, "location-info"))

    if accuracy_m is not None:
        circle = ET.SubElement(location_info, _q(GS_NS, "Circle"), {"srsName": "urn:ogc:def:crs:EPSG::4326"})
        pos = ET.SubElement(circle, _q(GML_NS, "pos"))
        pos.text = f"{latitude} {longitude}"
        radius = ET.SubElement(circle, _q(GS_NS, "radius"), {"uom": "urn:ogc:def:uom:EPSG::9001"})
        radius.text = str(accuracy_m)
    else:
        point = ET.SubElement(location_info, _q(GML_NS, "Point"), {"srsName": "urn:ogc:def:crs:EPSG::4326"})
        pos = ET.SubElement(point, _q(GML_NS, "pos"))
        pos.text = f"{latitude} {longitude}"

    usage_rules = ET.SubElement(geopriv, _q(GEOPRIV_NS, "usage-rules"))
    ET.SubElement(usage_rules, _q(GEOPRIV_NS, "retransmission-allowed")).text = "no"
    ET.SubElement(geopriv, _q(GEOPRIV_NS, "method")).text = "gps"
    ET.SubElement(tuple_el, _q(PIDF_NS, "timestamp")).text = datetime.now(timezone.utc).isoformat()

    return ET.tostring(presence, encoding="unicode")


def _build_provider_info(provider_name: str, incident_id: str) -> str:
    root = ET.Element(_q(PROVIDER_NS, "EmergencyCallData.ProviderInfo"))
    ET.SubElement(root, _q(PROVIDER_NS, "DataProviderReference")).text = incident_id
    ET.SubElement(root, _q(PROVIDER_NS, "ProviderID")).text = provider_name
    ET.SubElement(root, _q(PROVIDER_NS, "ProviderIDSeries")).text = "app"
    ET.SubElement(root, _q(PROVIDER_NS, "TypeOfProvider")).text = "Client"
    return ET.tostring(root, encoding="unicode")


def _build_comment(text: str, person_or_program: str = "ResQKit App") -> str:
    root = ET.Element(_q(COMMENT_NS, "EmergencyCallData.Comment"))
    ET.SubElement(root, _q(COMMENT_NS, "DateTime")).text = datetime.now(timezone.utc).isoformat()
    ET.SubElement(root, _q(COMMENT_NS, "Comment")).text = text
    ET.SubElement(root, _q(COMMENT_NS, "PersonOrProgram")).text = person_or_program
    return ET.tostring(root, encoding="unicode")


class NgProtocolError(Exception):
    pass


class NgProtocolService:
    def __init__(self, db):
        self.sessions = IncidentSessionService(db)

    @staticmethod
    def _summarize_log(session) -> str:
        """Fold pre-call answers + AI transcript segments into one comment string."""
        parts: List[str] = []
        for event in session.events:
            if event.event_type == "response_in_guide_time" and event.payload:
                qid = event.payload.get("question_id", "?")
                answer = event.payload.get("answer", "")
                parts.append(f"{qid}: {answer}")
            elif event.event_type == "ai_transcript_segment" and event.payload:
                text = event.payload.get("text")
                if text:
                    parts.append(text)
        return " | ".join(parts) if parts else "No triage data captured yet."

    @staticmethod
    def _extract_latest_ceim(session) -> Optional[Dict[str, Any]]:
        """Last ceim_report_generated event wins, mirroring _summarize_log's
        own scan-the-log approach. The stored payload is arbitrary JSON (a
        serialized CeimIncident), not a validated model, so every read below
        must be defensive."""
        for event in reversed(session.events):
            if event.event_type == "ceim_report_generated" and event.payload:
                ceim = event.payload.get("ceim")
                if isinstance(ceim, dict):
                    return ceim
        return None

    @staticmethod
    def _ceim_fact_value(ceim: Optional[Dict[str, Any]], *path: str) -> Any:
        """Walk a nested CEIM dict to one Fact's `value`, tolerating any
        missing/malformed step rather than raising."""
        node: Any = ceim
        for key in path:
            if not isinstance(node, dict):
                return None
            node = node.get(key)
        if isinstance(node, dict):
            return node.get("value")
        return None

    @classmethod
    def _comment_from_ceim(cls, ceim: Dict[str, Any]) -> str:
        """Deterministic, NO model call - folds scene_observations, hazard
        descriptions and victim condition text into one string, each fact
        suffixed with its confidence so a human reader can weigh it."""

        def fact_str(fact: Any) -> Optional[str]:
            if not isinstance(fact, dict):
                return None
            value = fact.get("value")
            if not value:
                return None
            confidence = fact.get("confidence", "low")
            return f"{value} [conf:{confidence}]"

        parts: List[str] = []

        victims = ceim.get("victims")
        if isinstance(victims, list):
            for victim in victims:
                if not isinstance(victim, dict):
                    continue
                for field_name in ("condition_description", "injury_type", "trapped"):
                    s = fact_str(victim.get(field_name))
                    if s:
                        parts.append(s)

        hazards = ceim.get("hazards")
        if isinstance(hazards, list):
            for hazard in hazards:
                if not isinstance(hazard, dict):
                    continue
                s = fact_str(hazard.get("description"))
                if s:
                    parts.append(f"hazard: {s}")

        observations = ceim.get("scene_observations")
        if isinstance(observations, list):
            for obs in observations:
                s = fact_str(obs)
                if s:
                    parts.append(s)

        notes = fact_str(ceim.get("additional_notes"))
        if notes:
            parts.append(notes)

        return " | ".join(parts) if parts else "CEIM report generated with no scene detail captured."

    async def build(
        self,
        session_id: str,
        latitude: Optional[float] = None,
        longitude: Optional[float] = None,
        accuracy_m: Optional[float] = None,
        comment_override: Optional[str] = None,
    ) -> Dict[str, Any]:
        session = await self.sessions.get_session(session_id)
        if not session:
            raise NgProtocolError("not_found")

        ceim = self._extract_latest_ceim(session)

        if comment_override:
            comment_text = comment_override
        elif ceim:
            comment_text = self._comment_from_ceim(ceim)
        else:
            comment_text = self._summarize_log(session)

        # Explicit args win; otherwise fall back to the CEIM's own location
        # facts (device_sensor-sourced) if a report exists.
        lat = latitude if latitude is not None else self._ceim_fact_value(ceim, "location", "latitude")
        lon = longitude if longitude is not None else self._ceim_fact_value(ceim, "location", "longitude")
        acc = accuracy_m if accuracy_m is not None else self._ceim_fact_value(ceim, "location", "accuracy_m")

        note = (
            "PROOF OF CONCEPT ONLY - not sent to any real emergency infrastructure. "
            "Real NG112/PIDF-LO transmission requires an authorized channel via STS/ANCOM "
            "(Phase 3 per project docs); this app's only real 112 channel today is the OS dialer."
        )
        if ceim:
            note += " Comment content is adapted from the session's Canonical Emergency Incident Model."

        payload: Dict[str, Any] = {
            "incident_id": session_id,
            "pidf_lo": _build_pidf_lo(lat, lon, acc),
            "additional_data": {
                "provider_info": _build_provider_info("ResQKit", session_id),
                "comment": _build_comment(comment_text),
            },
            "transmitted": False,
            "ceim_driven": ceim is not None,
            "note": note,
        }

        await self.sessions.append_event(
            session_id,
            "ng_protocol_payload_built",
            {"has_location": payload["pidf_lo"] is not None, "comment_length": len(comment_text)},
        )
        return payload
