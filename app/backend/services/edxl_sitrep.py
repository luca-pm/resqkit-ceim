"""
CEIM -> EDXL-SitRep adapter (OASIS Emergency Data Exchange Language -
Situation Reporting v1.0). See ResQKit_Canonical_Incident_Model.md section
6 for the plain-language background and the full mapping table.

NON-TRANSMITTING, same posture as ng_protocol.py: this builds an XML
document and stops there. Nothing here sends anything anywhere.

Element names, required fields, and enum values below were read directly
from the real published schema (fetched at build time from
docs.oasis-open.org, since the mentor's original link,
".../schemas/EDXLSitRep.xsd", 404s - the real filename is
"EDXLSitRep-v1.0.xsd"), not guessed. The root type is `SitRepType`; the
report body uses the abstract `IReport` type via `xsi:type`, concretely
`FieldObservationType` - the field-observation report type mentioned in the
design doc, and the best structural fit for a bystander's free-text scene
description (observationLocation / immediateNeeds / immediateNeedsCategory
/ observationText).

Known, stated incompleteness: `preparedBy`/`authorizedBy` are mandatory on
SitRepType and require a `ct:PersonTimePairType` -> `ct:PersonDetailsType`
-> (CIQ) `xpil:PersonDetailsType`, which in turn requires at least one
`xnl:personName`. The minimal valid personName is empty content
(`nameElement` is optional in PersonNameType), so this is populated with a
single named element identifying the app rather than a real person -
correct per the schema, but there is no "reporter" concept in CEIM to map
here since no bystander name is collected.

Full recursive XSD validation succeeded during development: `xmlschema`,
pointed at the real OASIS URL (`XSD_ROOT_URL`), resolved the ENTIRE
transitive schema tree over HTTPS - this schema -> CT -> GSF -> GML 3.2
(opengis.net) -> CIQ/xPIL/xNL for the person types - and validated a sample
document as schema-valid. One earlier attempt to fetch a single supporting
file directly (outside xmlschema's own resolver) did hit a transient
connection error; xmlschema's resolver succeeded regardless, so this is not
a standing limitation, just worth knowing the network path is real and can
occasionally hiccup. Three real bugs were found and fixed this way before it
passed: an element (`EDXLGeoLocation`) took its containing schema's
namespace rather than its content type's namespace; GSF's location choice
uses lowercase `gml:point`, not GML 3.2's own `gml:Point`; and that same
element requires a `gml:Id` identity attribute plus an unprefixed,
capitalized `SrsName` - this project's "EDXL GML Simple Features Profile"
convention, not vanilla GML 3.2's `srsName`. None of this was guessed -
`validate_edxl_sitrep()` below re-runs the same real validation on demand.
"""

import logging
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional
from xml.etree import ElementTree as ET

from services.incident_sessions import IncidentSessionService

logger = logging.getLogger(__name__)

SITREP_NS = "urn:oasis:names:tc:emergency:EDXL:SitRep:1.0"
CT_NS = "urn:oasis:names:tc:emergency:edxl:ct:1.0"
GSF_NS = "urn:oasis:names:tc:emergency:edxl:gsf:1.0"
GML_NS = "http://www.opengis.net/gml/3.2"
XPIL_NS = "urn:oasis:names:tc:emergency:edxl:ciq:1.0:xpil"
XNL_NS = "urn:oasis:names:tc:emergency:edxl:ciq:1.0:xnl"
XSI_NS = "http://www.w3.org/2001/XMLSchema-instance"

# Deliberately NOT registering "" (default namespace) here: ET.register_namespace
# writes to a process-global registry (xml.etree.ElementTree._namespace_map),
# and ng_protocol.py - loaded in the same process via routers auto-discovery -
# also registers "" for its OWN, different namespace (PIDF). Whichever
# module's registration runs last at import time wins the "" slot process-wide,
# silently stripping the OTHER module's default-namespace declaration from its
# serialized output. Since `xsi:type="FieldObservationType"` below is an
# unprefixed value that resolves against whatever default namespace is in
# scope, losing it broke type resolution with "global component
# 'FieldObservationType' not found" - reproducible only when both modules
# were loaded together, which is exactly why standalone tests of this file
# alone never caught it. Using an explicit "sitrep" prefix instead of ""
# sidesteps the collision entirely, and xsi:type is written fully qualified
# (see build_edxl_sitrep) rather than relying on ambient default-namespace
# resolution at all.
ET.register_namespace("sitrep", SITREP_NS)
ET.register_namespace("ct", CT_NS)
ET.register_namespace("edxl-gsf", GSF_NS)
ET.register_namespace("gml3", GML_NS)
ET.register_namespace("xpil", XPIL_NS)
ET.register_namespace("n", XNL_NS)
ET.register_namespace("xsi", XSI_NS)

# The original OASIS URLs, used only for real XSD validation attempts
# (services.edxl_sitrep.validate) - never for building the document itself.
XSD_ROOT_URL = "https://docs.oasis-open.org/emergency/edxl-sitrep/v1.0/cs02/schemas/EDXLSitRep-v1.0.xsd"

# EDXLDateTimeType's XSD pattern is \d{4}-\d\d-\d\dT\d\d:\d\d:\d\d[-,+]\d\d:\d\d -
# no fractional seconds allowed, offset required (Z is not accepted, unlike
# most ISO 8601 consumers). datetime.isoformat() include microseconds unless
# stripped first.
def _edxl_datetime(dt: datetime) -> str:
    return dt.replace(microsecond=0).isoformat()


def _q(ns: str, tag: str) -> str:
    return f"{{{ns}}}{tag}"


# CEIM confidence -> SitRep's report-level ConfidenceDefaultValues. SitRep
# confidence is per-REPORT, not per-fact like CEIM - this takes the lowest
# confidence among the facts that actually made it into the report, which is
# the conservative (not overstating certainty) choice.
_CONFIDENCE_ORDER = ["low", "medium", "high"]
_CONFIDENCE_TO_SITREP = {
    "high": "HighlyConfident",
    "medium": "SomewhatConfident",
    "low": "Unsure",
}


def _overall_confidence(ceim: Dict[str, Any]) -> str:
    seen: List[str] = []

    def collect(fact: Any) -> None:
        if isinstance(fact, dict) and fact.get("value") not in (None, ""):
            c = fact.get("confidence")
            if c in _CONFIDENCE_ORDER:
                seen.append(c)

    for victim in ceim.get("victims") or []:
        if isinstance(victim, dict):
            for key in ("condition_description", "injury_type", "trapped"):
                collect(victim.get(key))
    for hazard in ceim.get("hazards") or []:
        if isinstance(hazard, dict):
            collect(hazard.get("description"))
    for obs in ceim.get("scene_observations") or []:
        collect(obs)

    if not seen:
        return "NoConfidence"
    worst = min(seen, key=_CONFIDENCE_ORDER.index)
    return _CONFIDENCE_TO_SITREP[worst]


def _fact_text(fact: Any) -> Optional[str]:
    if isinstance(fact, dict):
        value = fact.get("value")
        if value not in (None, ""):
            return str(value)
    return None


def _observation_text(ceim: Dict[str, Any]) -> str:
    """Folds victim/hazard/observation facts into FieldObservationType's
    free-text observationText - the actual narrative content of the report."""
    parts: List[str] = []
    for victim in ceim.get("victims") or []:
        if not isinstance(victim, dict):
            continue
        for key in ("condition_description", "injury_type", "trapped"):
            text = _fact_text(victim.get(key))
            if text:
                parts.append(text)
    for hazard in ceim.get("hazards") or []:
        if isinstance(hazard, dict):
            text = _fact_text(hazard.get("description"))
            if text:
                parts.append(f"Hazard: {text}")
    for obs in ceim.get("scene_observations") or []:
        text = _fact_text(obs)
        if text:
            parts.append(text)
    notes = _fact_text(ceim.get("additional_notes"))
    if notes:
        parts.append(notes)
    return " | ".join(parts) if parts else "No scene detail captured."


def _immediate_needs_categories(ceim: Dict[str, Any]) -> List[str]:
    """Heuristic mapping from CEIM hazard/victim content to SitRep's fixed
    ImmediateNeedsCategoryDefaultValues enum. Deliberately conservative -
    only the two categories a bystander app can plausibly infer."""
    categories = ["EmergencyMedicalServices"]
    for hazard in ceim.get("hazards") or []:
        code = None
        if isinstance(hazard, dict) and isinstance(hazard.get("code"), dict):
            code = hazard["code"].get("value")
        if code in ("fire", "electrical", "fuel_spill", "gas"):
            categories.append("FireAndHazardousMaterials")
            break
    return categories


def _build_person_time_pair(label: str, when: datetime) -> ET.Element:
    """Minimal valid ct:PersonTimePairType. See module docstring for why
    this identifies the app rather than a real person - CEIM has no
    reporter-name concept to map here."""
    pair = ET.Element(_q(CT_NS, "personTimePairPlaceholder"))  # replaced by caller's tag
    person_details = ET.SubElement(pair, _q(CT_NS, "personDetails"))
    person_name = ET.SubElement(person_details, _q(XNL_NS, "personName"))
    name_element = ET.SubElement(person_name, _q(XNL_NS, "nameElement"))
    name_element.text = label
    ET.SubElement(pair, _q(CT_NS, "timeValue")).text = _edxl_datetime(when)
    return pair


def _build_location(
    latitude: Optional[float], longitude: Optional[float], description: Optional[str] = None
) -> Optional[ET.Element]:
    """observationLocation is mandatory on FieldObservationType with no
    "unknown" option, so a bystander report with no GPS fix (permission
    denied, simulated mode, indoors) still needs a valid choice. Falls back
    to EDXLGeoPoliticalLocation's `geoCode` (a generic value-list pair) with
    a placeholder vocabulary URI carrying the free-text location note, over
    the schema's other alternative (a full xAL postal address, which CEIM
    has no structured data for). Returns None only when there is truly
    nothing to report."""
    if latitude is not None and longitude is not None:
        location = ET.Element(_q(CT_NS, "locationPlaceholder"))
        geo = ET.SubElement(location, _q(CT_NS, "EDXLGeoLocation"))
        point = ET.SubElement(
            geo, _q(GML_NS, "point"), {_q(GML_NS, "Id"): "loc1", "SrsName": "urn:ogc:def:crs:EPSG::4326"}
        )
        ET.SubElement(point, _q(GML_NS, "pos")).text = f"{latitude} {longitude}"
        return location

    if description:
        location = ET.Element(_q(CT_NS, "locationPlaceholder"))
        geo_political = ET.SubElement(location, _q(CT_NS, "EDXLGeoPoliticalLocation"))
        geo_code = ET.SubElement(geo_political, _q(CT_NS, "geoCode"))
        ET.SubElement(geo_code, _q(CT_NS, "valueListURI")).text = "urn:resqkit:location-note"
        ET.SubElement(geo_code, _q(CT_NS, "value")).text = description[:1023]
        return location

    return None


def build_edxl_sitrep(ceim: Dict[str, Any], session_id: str) -> str:
    """Pure function: CEIM dict (as stored in a ceim_report_generated event
    payload, or a freshly-generated CeimGenerateResponse.ceim.model_dump())
    -> a serialized EDXL-SitRep XML document. Never raises on missing
    optional CEIM content - only session_id is required."""
    now = datetime.now(timezone.utc)

    sitrep = ET.Element(_q(SITREP_NS, "sitRep"))
    # Declared inside SitRepType, in the SitRep schema file itself, so it
    # takes the SitRep namespace even though its TYPE (ct:EDXLStringType)
    # comes from ct: - same distinction as _build_location's EDXLGeoLocation.
    ET.SubElement(sitrep, _q(SITREP_NS, "messageID")).text = f"resqkit-{session_id}"

    prepared = _build_person_time_pair("ResQKit bystander app", now)
    prepared.tag = _q(SITREP_NS, "preparedBy")
    sitrep.append(prepared)

    authorized = _build_person_time_pair("ResQKit bystander app", now)
    authorized.tag = _q(SITREP_NS, "authorizedBy")
    sitrep.append(authorized)

    ET.SubElement(sitrep, _q(SITREP_NS, "reportPurpose")).text = (
        "Bystander-reported scene observation, prototype only - not an official incident report."
    )
    ET.SubElement(sitrep, _q(SITREP_NS, "reportNumber")).text = "1"
    ET.SubElement(sitrep, _q(SITREP_NS, "reportVersion")).text = "Initial"

    time_period = ET.SubElement(sitrep, _q(SITREP_NS, "forTimePeriod"))
    ET.SubElement(time_period, _q(CT_NS, "fromDateTime")).text = _edxl_datetime(now)
    ET.SubElement(time_period, _q(CT_NS, "toDateTime")).text = _edxl_datetime(now)

    ET.SubElement(sitrep, _q(SITREP_NS, "incidentID")).text = session_id
    ET.SubElement(sitrep, _q(SITREP_NS, "reportConfidence")).text = _overall_confidence(ceim)
    ET.SubElement(sitrep, _q(SITREP_NS, "severity")).text = "Severe" if ceim.get("hazards") else "Moderate"

    location = ceim.get("location") or {}
    lat = _fact_text(location.get("latitude"))
    lon = _fact_text(location.get("longitude"))
    location_description = _fact_text(location.get("description"))
    location_el = _build_location(
        float(lat) if lat else None, float(lon) if lon else None, description=location_description
    )
    if location_el is None:
        # No GPS fix AND no free-text note - _build_location can't produce a
        # valid choice from nothing, but observationLocation is mandatory
        # with no "unknown" option, so this still needs real, valid content.
        location_el = _build_location(None, None, description="Location not provided.")

    report = ET.SubElement(sitrep, _q(SITREP_NS, "report"))
    report.set(_q(XSI_NS, "type"), "sitrep:FieldObservationType")
    location_el.tag = _q(SITREP_NS, "observationLocation")
    report.append(location_el)

    needs_text = _fact_text(location.get("description")) or "See observation text."
    ET.SubElement(report, _q(SITREP_NS, "immediateNeeds")).text = needs_text[:1023] or "Unknown"
    for category in _immediate_needs_categories(ceim):
        ET.SubElement(report, _q(SITREP_NS, "immediateNeedsCategory")).text = category
    ET.SubElement(report, _q(SITREP_NS, "observationText")).text = _observation_text(ceim)

    return ET.tostring(sitrep, encoding="unicode")


# Cached across calls within one process: resolving the full remote schema
# tree (this file -> CT -> GSF -> GML 3.2 -> CIQ/xPIL/xNL) takes a real
# network round trip per file the first time. Re-fetched only on failure, in
# case the first attempt hit a transient error.
_schema_cache: Optional[Any] = None


def validate_edxl_sitrep(xml: str) -> Dict[str, Any]:
    """
    Real, synchronous validation against the actual published OASIS XSD -
    not a structural guess. Returns {"valid": bool, "checked_against": url,
    "error": str | None}. Never raises: a validator that can crash the
    caller on a network hiccup is worse than one that honestly reports it
    could not check.

    BLOCKING - does real network I/O the first time it runs in a process.
    Call sites inside an async request handler must go through
    `validate_edxl_sitrep_async` (below), never this directly, or the whole
    server stalls for other requests while the schema tree resolves.
    """
    global _schema_cache
    try:
        import xmlschema
    except ImportError:
        return {
            "valid": None,
            "checked_against": XSD_ROOT_URL,
            "error": "xmlschema package not installed - well-formedness only, not schema-validated.",
        }

    try:
        if _schema_cache is None:
            _schema_cache = xmlschema.XMLSchema(XSD_ROOT_URL, timeout=20)
        _schema_cache.validate(xml)
        return {"valid": True, "checked_against": XSD_ROOT_URL, "error": None}
    except xmlschema.XMLSchemaValidationError as exc:
        return {"valid": False, "checked_against": XSD_ROOT_URL, "error": str(exc)[:2000]}
    except Exception as exc:  # noqa: BLE001 - network/parse failure, not a validation verdict
        _schema_cache = None
        logger.warning("EDXL-SitRep schema resolution/validation failed: %s", exc)
        return {
            "valid": None,
            "checked_against": XSD_ROOT_URL,
            "error": f"Could not complete validation ({type(exc).__name__}): {exc}",
        }


async def validate_edxl_sitrep_async(xml: str) -> Dict[str, Any]:
    """
    Runs `validate_edxl_sitrep` in a genuinely separate OS process, not just
    a worker thread. This is the only entry point request handlers should
    call.

    Why a whole subprocess rather than `asyncio.to_thread`: during
    development, `validate_edxl_sitrep` returned "global component
    'FieldObservationType' not found" - a schema-build failure - EVERY time
    it ran inside this FastAPI process (including inside a to_thread worker
    thread of that same process), while the identical function, called on
    the identical XML, passed reliably in a bare `python` process every
    time, threaded or not. Something this app's process loads (candidates:
    asyncpg, anyio, httpx/openai's SSL/urllib setup) mutates global state
    xmlschema's remote schema loader depends on, silently truncating part of
    the resolved tree rather than raising. Root-caused further than that,
    this was not - a subprocess sidesteps it entirely by construction, and
    validation is an on-demand preview action, not a hot path, so the
    process-spawn cost is an acceptable trade for correctness.
    """
    import asyncio
    import json
    import os
    import sys

    backend_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    script = (
        "import sys, json; "
        f"sys.path.insert(0, {backend_root!r}); "
        "from services.edxl_sitrep import validate_edxl_sitrep; "
        "xml = sys.stdin.read(); "
        "print(json.dumps(validate_edxl_sitrep(xml)))"
    )
    try:
        proc = await asyncio.create_subprocess_exec(
            sys.executable,
            "-c",
            script,
            stdin=asyncio.subprocess.PIPE,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )
        stdout, stderr = await asyncio.wait_for(proc.communicate(xml.encode("utf-8")), timeout=60)
        if proc.returncode != 0:
            raise RuntimeError((stderr or b"").decode("utf-8", errors="replace")[:2000])
        return json.loads(stdout.decode("utf-8"))
    except Exception as exc:  # noqa: BLE001 - must degrade, never break the build endpoint
        logger.warning("EDXL-SitRep subprocess validation failed: %s", exc)
        return {
            "valid": None,
            "checked_against": XSD_ROOT_URL,
            "error": f"Could not run validation subprocess ({type(exc).__name__}): {exc}",
        }


class EdxlSitRepError(Exception):
    pass


class EdxlSitRepService:
    def __init__(self, db):
        self.sessions = IncidentSessionService(db)

    async def build(self, session_id: str) -> Dict[str, Any]:
        session = await self.sessions.get_session(session_id)
        if not session:
            raise EdxlSitRepError("not_found")

        ceim: Optional[Dict[str, Any]] = None
        for event in reversed(session.events):
            if event.event_type == "ceim_report_generated" and event.payload:
                candidate = event.payload.get("ceim")
                if isinstance(candidate, dict):
                    ceim = candidate
                    break

        if ceim is None:
            raise EdxlSitRepError("no_ceim_report")

        xml = build_edxl_sitrep(ceim, session_id)
        validation = await validate_edxl_sitrep_async(xml)

        await self.sessions.append_event(
            session_id,
            "edxl_sitrep_payload_built",
            {"xml_length": len(xml), "schema_valid": validation["valid"]},
        )

        return {
            "incident_id": session_id,
            "edxl_sitrep": xml,
            "transmitted": False,
            "validation": validation,
            "note": (
                "PROOF OF CONCEPT ONLY - not sent to any real emergency infrastructure. "
                "preparedBy/authorizedBy identify the app, not a real person - CEIM has no "
                "reporter-name concept to map there."
            ),
        }
