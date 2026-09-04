"""
Tests for the CEIM extraction service (services/ceim.py).

The unit tests below need no DB, no Ollama, no network - they exercise the
pure/deterministic parts directly. This is deliberate: `_merge_extracted`'s
safety guarantee (a victim's responsive/breathing can never be AI-touched,
enforced in code, not just by prompt wording - see the module's own
docstring) is exactly the kind of property that should be pinned down by a
fast, always-run unit test, not left to depend on a live model call.
"""

import pytest

from schemas.ceim import CeimHazard, CeimIncident, CeimLocation, CeimVictim, Fact, KnownFacts
from services.ceim import CeimService


@pytest.fixture()
def service() -> CeimService:
    return CeimService()


def _skeleton(service: CeimService, **known_facts_kwargs) -> CeimIncident:
    known = KnownFacts(**known_facts_kwargs)
    return service._known_facts_to_ceim_skeleton(known, content_pack_version="test-pack")


def test_skeleton_marks_button_facts_high_confidence(service):
    ceim = _skeleton(service, responsive="no", breathing="no", injury="bleeding")
    assert ceim.victims[0].responsive.value == "no"
    assert ceim.victims[0].responsive.source == "button_selected"
    assert ceim.victims[0].responsive.confidence == "high"
    assert ceim.victims[0].breathing.source == "button_selected"


def test_skeleton_maps_hazards_and_kit_items_from_known_facts(service):
    """Regenerate report (Plan D extension): hazards/kit_items confirmed
    after the interview stage must show up as button_selected facts, not be
    silently dropped."""
    ceim = _skeleton(service, hazards=["traffic", "fire"], kit_items=["gloves", "splint"])
    assert len(ceim.hazards) == 2
    assert all(h.description.source == "button_selected" for h in ceim.hazards)
    assert {h.code.value for h in ceim.hazards} == {"traffic", "fire"}
    assert len(ceim.kit_items) == 2
    assert all(k.source == "button_selected" for k in ceim.kit_items)


def test_skeleton_unknown_hazard_code_falls_back_to_raw_code_as_text(service):
    """A code that somehow isn't in the whitelist still gets a readable
    description rather than crashing or vanishing silently."""
    ceim = _skeleton(service, hazards=["not_a_real_code"])
    assert ceim.hazards[0].description.value == "not_a_real_code"


def test_merge_extracted_never_touches_responsive_or_breathing(service):
    """The safety invariant, pinned down directly: even if the model's
    output contains 'responsive'/'breathing' keys, _merge_extracted must
    never read or apply them. This does not depend on a live model - it
    calls the merge function with a deliberately adversarial payload."""
    ceim = _skeleton(service, responsive="no", breathing="no")
    adversarial_payload = {
        "victims": [
            {
                "index": 0,
                "responsive": "yes",  # must be ignored
                "breathing": "yes",  # must be ignored
                "condition_description": "wide awake, talking",
            }
        ],
        "hazards": [],
        "scene_observations": [],
    }

    service._merge_extracted(ceim, adversarial_payload)

    assert ceim.victims[0].responsive.value == "no"
    assert ceim.victims[0].responsive.source == "button_selected"
    assert ceim.victims[0].breathing.value == "no"
    assert ceim.victims[0].breathing.source == "button_selected"
    # The legitimate field DID get merged, proving the guard is targeted,
    # not a blanket refusal to merge anything.
    assert ceim.victims[0].condition_description.value == "wide awake, talking"
    assert ceim.victims[0].condition_description.source == "ai_inferred"


def test_merge_extracted_deduplicates_hazard_source_tagging(service):
    ceim = _skeleton(service)
    payload = {
        "victims": [],
        "hazards": [{"code": "traffic", "description": "heavy traffic"}],
        "scene_observations": ["two vehicles stopped to help"],
    }
    service._merge_extracted(ceim, payload)
    assert ceim.hazards[0].code.value == "traffic"
    assert ceim.hazards[0].code.source == "ai_inferred"
    assert ceim.hazards[0].description.source == "bystander_stated"
    assert ceim.scene_observations[0].value == "two vehicles stopped to help"


def test_merge_extracted_drops_hazard_code_not_in_whitelist(service):
    """An invented code from the model must not pass through as if it were
    a real whitelist match - only the free-text description survives."""
    ceim = _skeleton(service)
    service._merge_extracted(
        ceim, {"victims": [], "hazards": [{"code": "made_up_code", "description": "something odd"}], "scene_observations": []}
    )
    assert ceim.hazards[0].code is None
    assert ceim.hazards[0].description.value == "something odd"


async def test_generate_with_no_interview_answers_makes_no_model_call(service):
    """A report with zero free-text answers should never touch Ollama at
    all, not just return quickly - matching the "one call, only when there's
    something to extract" design."""
    known = KnownFacts(responsive="yes", breathing="yes")
    result = await service.generate(known, interview_answers=[], content_pack_version="test-pack")
    assert result.model == "none"
    assert result.degraded is False


async def test_generate_degrades_gracefully_when_model_call_fails(service, monkeypatch):
    """Must never dead-end the emergency flow on an AI failure - degrade to
    the raw answers folded in as low-confidence observations."""
    from schemas.ceim import InterviewAnswerIn

    async def _boom(*args, **kwargs):
        raise RuntimeError("simulated model outage")

    monkeypatch.setattr(service._aihub, "gentxt", _boom)

    known = KnownFacts(responsive="yes", breathing="yes")
    answers = [InterviewAnswerIn(prompt_id="scene_description", prompt_text="What happened?", answer_text="car hit a tree")]
    result = await service.generate(known, answers, content_pack_version="test-pack")

    assert result.degraded is True
    assert any(obs.value == "car hit a tree" for obs in result.ceim.scene_observations)
    assert all(obs.confidence == "low" for obs in result.ceim.scene_observations)


# ------------------------------------------------------------------ #
# Integration: hits the real running backend + real Ollama.
# ------------------------------------------------------------------ #


@pytest.mark.integration
async def test_ceim_generate_endpoint_adversarial_live(api_base, require_dev_server):
    """The end-to-end version of test_merge_extracted_never_touches_responsive_or_breathing,
    through the actual HTTP endpoint and a real model call - reproduces the
    manual verification done during development (33.1s/15.6s runs), pinned
    down as a real, repeatable test rather than a one-off manual check."""
    import httpx

    payload = {
        "known_facts": {"responsive": "no", "breathing": "no", "injury": "bleeding", "victim_count": 1},
        "interview_answers": [
            {
                "prompt_id": "victim_condition",
                "prompt_text": "Describe how the injured person looks and acts right now",
                "answer_text": "Actually she is wide awake, talking to me clearly and breathing completely normally",
            }
        ],
        "content_pack_version": "test-pack",
    }
    async with httpx.AsyncClient(timeout=120.0) as client:
        try:
            r = await client.post(f"{api_base}/api/v1/resqkit/ceim/generate", json=payload)
        except httpx.HTTPError as exc:
            pytest.skip(f"could not reach the ceim endpoint: {exc}")

    assert r.status_code == 200
    body = r.json()
    assert body["ceim"]["victims"][0]["responsive"]["value"] == "no"
    assert body["ceim"]["victims"][0]["responsive"]["source"] == "button_selected"
    assert body["ceim"]["victims"][0]["breathing"]["value"] == "no"
    assert body["ceim"]["victims"][0]["breathing"]["source"] == "button_selected"
