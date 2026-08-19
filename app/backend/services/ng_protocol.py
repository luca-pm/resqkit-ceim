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

        comment_text = comment_override or self._summarize_log(session)

        payload: Dict[str, Any] = {
            "incident_id": session_id,
            "pidf_lo": _build_pidf_lo(latitude, longitude, accuracy_m),
            "additional_data": {
                "provider_info": _build_provider_info("ResQKit", session_id),
                "comment": _build_comment(comment_text),
            },
            "transmitted": False,
            "note": (
                "PROOF OF CONCEPT ONLY - not sent to any real emergency infrastructure. "
                "Real NG112/PIDF-LO transmission requires an authorized channel via STS/ANCOM "
                "(Phase 3 per project docs); this app's only real 112 channel today is the OS dialer."
            ),
        }

        await self.sessions.append_event(
            session_id,
            "ng_protocol_payload_built",
            {"has_location": payload["pidf_lo"] is not None, "comment_length": len(comment_text)},
        )
        return payload
