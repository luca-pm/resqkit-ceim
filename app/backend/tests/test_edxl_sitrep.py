"""
Tests for the CEIM -> EDXL-SitRep adapter (services/edxl_sitrep.py).

Unit tests build XML and inspect it directly (fast, no network). The
namespace-collision regression test is the most important one here: the
real bug it pins down ("global component 'FieldObservationType' not found")
was only reproducible when this module and services/ng_protocol.py were
BOTH loaded in the same process - a standalone test of this file alone,
which is what every earlier manual check during development used, could
never have caught it. See the module's own docstring and
ResQKit_Canonical_Incident_Model.md section 6 for the full story.
"""

from xml.etree import ElementTree as ET

import pytest

from services.edxl_sitrep import SITREP_NS, build_edxl_sitrep, validate_edxl_sitrep


def _sample_ceim(with_location: bool = True) -> dict:
    ceim: dict = {
        "victims": [{"index": 0, "condition_description": {"value": "bruised arm, alert", "confidence": "medium"}}],
        "hazards": [{"code": {"value": "traffic"}, "description": {"value": "heavy traffic", "confidence": "high"}}],
        "scene_observations": [{"value": "two vehicles stopped to help", "confidence": "medium"}],
    }
    if with_location:
        ceim["location"] = {
            "latitude": {"value": 44.4268},
            "longitude": {"value": 26.1025},
            "description": {"value": "near the bridge"},
        }
    return ceim


def test_build_is_well_formed_xml():
    xml = build_edxl_sitrep(_sample_ceim(), "test-session")
    # Raises on malformed XML - the same guarantee ng_protocol.py relies on
    # for its own output, applied here.
    root = ET.fromstring(xml)
    assert root.tag == f"{{{SITREP_NS}}}sitRep"


def test_build_never_raises_on_a_fully_empty_ceim():
    """The degrade path (services/ceim.py returning a skeleton-only report)
    must still produce a valid document, not crash the preview endpoint."""
    xml = build_edxl_sitrep({}, "empty-session")
    ET.fromstring(xml)  # must not raise


def test_build_uses_geo_point_when_lat_lon_present():
    xml = build_edxl_sitrep(_sample_ceim(with_location=True), "s1")
    assert "gml:point" in xml or ":point" in xml
    assert "44.4268 26.1025" in xml


def test_build_falls_back_to_geocode_when_no_gps_fix():
    ceim = _sample_ceim(with_location=False)
    ceim["location"] = {"description": {"value": "third floor, north stairwell"}}
    xml = build_edxl_sitrep(ceim, "s2")
    assert "geoCode" in xml
    assert "third floor, north stairwell" in xml
    assert "point" not in xml.split("EDXLGeoLocation")[0] if "EDXLGeoLocation" in xml else True


def test_build_falls_back_to_placeholder_when_no_location_at_all():
    """observationLocation is mandatory with no "unknown" choice in the real
    schema - this must never be omitted or left empty."""
    xml = build_edxl_sitrep({}, "s3")
    assert "observationLocation" in xml
    assert "Location not provided." in xml


def test_xsi_type_is_explicitly_namespace_qualified():
    """Regression guard for the actual bug found during development: an
    unprefixed xsi:type value depends on ambient default-namespace
    resolution, which broke when another module in the same process also
    claimed the default ("") prefix. Qualifying it explicitly sidesteps
    that fragility regardless of what else is loaded."""
    xml = build_edxl_sitrep(_sample_ceim(), "s4")
    assert 'type="sitrep:FieldObservationType"' in xml


def test_root_element_does_not_claim_the_default_namespace_prefix():
    """The module deliberately does not register "" for its own namespace
    (see services/edxl_sitrep.py's top-of-file comment) - confirms the root
    element is written with an explicit prefix rather than xmlns="..."."""
    xml = build_edxl_sitrep(_sample_ceim(), "s5")
    assert "<sitrep:sitRep" in xml
    assert 'xmlns="urn:oasis:names:tc:emergency:EDXL:SitRep:1.0"' not in xml


def test_namespace_collision_with_ng_protocol_is_resolved():
    """The actual regression: importing both modules together in one
    process, exactly as main.py's router auto-discovery does, must not
    reintroduce the 'global component not found' failure. Doesn't require
    network - only checks that the document keeps its explicit prefix and
    parses, which is what the live failure actually broke."""
    import services.ng_protocol  # noqa: F401 - the point is that this import happened first

    xml = build_edxl_sitrep(_sample_ceim(), "collision-check")
    ET.fromstring(xml)
    assert "<sitrep:sitRep" in xml
    assert 'type="sitrep:FieldObservationType"' in xml


# ------------------------------------------------------------------ #
# Integration: real network validation against the live OASIS schema.
# ------------------------------------------------------------------ #


@pytest.mark.integration
@pytest.mark.parametrize(
    "ceim",
    [_sample_ceim(with_location=True), _sample_ceim(with_location=False), {}],
    ids=["with-gps", "no-gps-with-note", "fully-empty"],
)
def test_schema_valid_against_real_oasis_xsd(ceim):
    """Real validation, not a structural guess - resolves the full
    transitive schema tree (this file -> CT -> GSF -> GML 3.2 -> CIQ/xPIL/xNL)
    over HTTPS from docs.oasis-open.org / opengis.net. Skips if that network
    isn't reachable rather than failing the whole suite."""
    xml = build_edxl_sitrep(ceim, "schema-check")
    result = validate_edxl_sitrep(xml)
    if result["valid"] is None:
        pytest.skip(f"could not reach the OASIS schema servers: {result['error']}")
    assert result["valid"] is True, result["error"]
