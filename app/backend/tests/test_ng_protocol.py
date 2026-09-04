"""
Tests for the CEIM-aware NG112 adapter (services/ng_protocol.py).

Unit tests exercise the static/pure helpers directly against a minimal fake
session object (anything with an `.events` list of `.event_type`/`.payload`
pairs, matching what SQLAlchemy's IncidentSession.events relationship
actually looks like to calling code) - no DB needed for these.
"""

from types import SimpleNamespace

import pytest

from services.ng_protocol import NgProtocolService


def _event(event_type: str, payload: dict) -> SimpleNamespace:
    return SimpleNamespace(event_type=event_type, payload=payload)


def _session(events: list) -> SimpleNamespace:
    return SimpleNamespace(events=events)


def test_extract_latest_ceim_returns_none_when_no_ceim_event():
    session = _session([_event("session_updated", {"foo": "bar"})])
    assert NgProtocolService._extract_latest_ceim(session) is None


def test_extract_latest_ceim_picks_the_last_one():
    """Two CEIM reports on the same session (e.g. a "regenerate" call) -
    the most recent one must win, not the first."""
    session = _session(
        [
            _event("ceim_report_generated", {"ceim": {"additional_notes": {"value": "first"}}}),
            _event("session_updated", {}),
            _event("ceim_report_generated", {"ceim": {"additional_notes": {"value": "second"}}}),
        ]
    )
    result = NgProtocolService._extract_latest_ceim(session)
    assert result["additional_notes"]["value"] == "second"


def test_extract_latest_ceim_ignores_malformed_payload():
    """A ceim_report_generated event with no 'ceim' key, or a non-dict
    payload, must not crash the adapter - fall back to no-CEIM behavior."""
    session = _session([_event("ceim_report_generated", {"degraded": True})])
    assert NgProtocolService._extract_latest_ceim(session) is None


def test_ceim_fact_value_walks_nested_path_safely():
    ceim = {"location": {"latitude": {"value": 44.4268, "confidence": "high"}}}
    assert NgProtocolService._ceim_fact_value(ceim, "location", "latitude") == 44.4268


@pytest.mark.parametrize(
    "ceim",
    [
        None,
        {},
        {"location": None},
        {"location": {"latitude": "not-a-fact-dict"}},
        {"location": {"latitude": {}}},
    ],
)
def test_ceim_fact_value_never_raises_on_malformed_input(ceim):
    assert NgProtocolService._ceim_fact_value(ceim, "location", "latitude") is None


def test_comment_from_ceim_includes_confidence_tags():
    ceim = {
        "victims": [{"condition_description": {"value": "bruised arm", "confidence": "medium"}}],
        "hazards": [{"description": {"value": "wet road", "confidence": "high"}}],
        "scene_observations": [{"value": "two vehicles stopped", "confidence": "low"}],
    }
    comment = NgProtocolService._comment_from_ceim(ceim)
    assert "bruised arm [conf:medium]" in comment
    assert "hazard: wet road [conf:high]" in comment
    assert "two vehicles stopped [conf:low]" in comment


def test_comment_from_ceim_handles_a_report_with_no_scene_detail():
    """A CEIM skeleton with no interview answers at all must still produce
    readable output, not an empty string or a crash."""
    comment = NgProtocolService._comment_from_ceim({"victims": [], "hazards": [], "scene_observations": []})
    assert comment == "CEIM report generated with no scene detail captured."


def test_summarize_log_falls_back_when_no_ceim_and_no_triage_events():
    comment = NgProtocolService._summarize_log(_session([]))
    assert comment == "No triage data captured yet."
