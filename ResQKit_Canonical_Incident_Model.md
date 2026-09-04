# ResQKit — Canonical Emergency Incident Model (CEIM)

**Status:** Implemented — interview → CEIM → NG112 adapter → EDXL-SitRep adapter, all verified against the real running backend and, for EDXL-SitRep, the real published OASIS schema. Only the STS format stays explicitly deferred — see §7.
**Date:** 2026-09-04
**Purpose:** Answers the mentor's 2026-09-02 direction in writing: the app's AI populates one internal model instead of generating a protocol-specific format directly, and protocol adapters translate FROM that model on demand. This document is also the artifact meant to satisfy the mentor's "have an AI research and explain EDXL-SitRep/NG112 to the team" instruction, and the hand-off Mircea and Matei can review to check for overlap with their own work (see `ResQKit_Progress_Update.md` for the explicit overlap table).

---

## 1. Why CEIM

Before this work, ResQKit's incident data lived in two places, neither of them protocol-ready:

- **`IncidentState`** (`app/mobile/src/lib/storage.ts`) — flat fields (`responsive`, `breathing`, `hazards: string[]`, …) with no record of *where a value came from* or *how sure the app is about it*. A button tap and an AI guess were indistinguishable once stored.
- **The deterministic brief** (`app/mobile/src/lib/brief.ts`) — plain text, composed for a human reading a handoff card. Useful for its purpose, structurally useless for anything else: no machine can parse "she's talking to me now" back into a field.

Neither was ever meant to be a data-interchange format, and turning either one directly into EDXL-SitRep XML or an NG112 payload would mean re-deriving the mapping every time a new protocol shows up — exactly the trap the mentor's direction avoids. CEIM is the model in between: one well-defined internal shape, versioned, with **per-fact provenance and confidence**, that protocol adapters translate *from*.

The provenance/confidence layer is the genuinely new part. Every meaningful fact in a `CeimIncident` is wrapped:

```
{ "value": ..., "source": "bystander_stated" | "button_selected" | "device_sensor" | "ai_inferred" | "not_recorded",
  "confidence": "high" | "medium" | "low", "note": "..." }
```

A rescuer or a receiving system can tell the difference between "the bystander tapped a button" and "the AI inferred this from free text" — something neither `IncidentState` nor the plain-text brief could ever express.

**Non-negotiable safety rule, carried over unchanged from the app's existing design:** CEIM is never itself a source of medical guidance. `app/mobile/src/lib/knowledge.ts`'s header rule — "AI models are never allowed to author or extend this content" — applies exactly as before. The interview only gathers and structures bystander-reported information; `routeProcedure()` and the curated `PROCEDURES` array remain the only guidance shown to the user, completely untouched by this feature. And a victim's `responsive`/`breathing` facts always carry `source: "button_selected"` — the AI can never originate or overwrite the two fields that route to CPR. This is enforced in code (`app/backend/services/ceim.py`'s `_merge_extracted`), not just by prompt wording, and is covered by an adversarial test (§8).

---

## 2. EDXL-SitRep, in plain language

**EDXL-SitRep** (Emergency Data Exchange Language – Situation Reporting) is an OASIS open standard for exchanging structured situation reports between emergency organizations — the kind of report an incident commander or a field team files to describe what's happening at a scene, updated over time. It's part of the broader **EDXL family**, which also includes a shared envelope format (**EDXL-DE**, the "Distribution Element" that wraps any EDXL message with routing/addressing metadata regardless of payload type) and other message types (alerts, resource messages, hospital-availability messages) not relevant here.

A SitRep report is organized around: who's reporting and when, the incident it's about, one or more **situation report segments** (each segment can describe a specific area, hazard, or aspect of the incident), and structured fields for things like affected population estimates, resource status, and free-text narrative. It's XML-based, with a published XML Schema (XSD) that a message must validate against to be considered well-formed.

**Sources the mentor provided (authoritative, not re-derived here):**
- Spec: https://docs.oasis-open.org/emergency/edxl-sitrep/v1.0/edxl-sitrep-v1.0.html
- Versions/examples index: https://docs.oasis-open.org/emergency/edxl-sitrep/v1.0/
- XSD: https://docs.oasis-open.org/emergency/edxl-sitrep/v1.0/cs02/schemas/EDXLSitRep.xsd
- Worked examples: https://docs.oasis-open.org/emergency/edxl-sitrep/v1.0/cs02/examples/
- EDXL-DE container: https://docs.oasis-open.org/emergency/edxl-de/v2.0/edxl-de-v2.0.html

**Why it's a good second target for CEIM (beyond NG112):** SitRep's segment structure maps naturally onto CEIM's victims/hazards/observations arrays, and its emphasis on narrative-plus-structure is close to what a bystander's free-text interview actually produces. It is *not* built for real-time PSAP call handling the way NG112 is — it's closer to situational-awareness reporting between responding organizations, which fits the mentor's "useful even if no institution ever receives it" framing especially well.

**State in this codebase: not yet built.** See §6.

---

## 3. NG112 / ETSI TS 103 479, in plain language

**NG112** is the EU's next-generation architecture for the single European emergency number, the European counterpart to the US NG9-1-1 (i3) architecture. Instead of a plain voice circuit, an NG112 call carries **structured additional data** alongside it — most importantly precise caller location, but also a defined mechanism for attaching other structured context.

Two pieces matter for this project:

- **PIDF-LO** (Presence Information Data Format – Location Object, RFC 4119/5491) — the standard XML shape for describing a location: either a point or a shape (like a circle with a radius, for GPS-accuracy-bounded fixes), plus provenance metadata (how the location was determined, e.g. `gps`).
- **RFC 7852 "Additional Data related to an Emergency Call"** — defines standard *blocks* of extra structured data a caller's device or app can attach to an emergency call: provider info (who's sending this data and what kind of client), comments, and other typed blocks. This is the actual mechanism NG112 uses for "the app hands the PSAP more than just a voice call."

**ETSI TS 103 479** is the European standard specifying how this works end-to-end for NG112 specifically (the equivalent of the US NENA i3 standard, adapted for the EU regulatory context) — it's the document that ties PIDF-LO/RFC 7852 into an actual NG112 deployment architecture.

**Sources the mentor provided:**
- ETSI standards portal: https://www.etsi.org/standards/get-standards
- TS 103 479 deliverable page: https://www.etsi.org/deliver/etsi_ts/103400_103499/103479/

**Romania's own 112 modernization**, per the mentor's link (https://www.mai.gov.ro/extinderea-si-eficientizarea-serviciului-de-urgenta-112-oferit-cetatenilor/), is a 2025–2028 STS/MAI project that explicitly includes AI/ML in dispatch analysis and "acquisition/processing/dissemination of contextual and additional data" — i.e., Romania is heading toward exactly this kind of structured-additional-data model, which is the mentor's justification for building toward NG112/RFC 7852 now rather than waiting for a Romania-specific spec (§7).

**State in this codebase:** implemented, and now CEIM-driven — see §5.

---

## 4. CEIM schema, field by field

Defined in `app/backend/schemas/ceim.py` (Pydantic, source of truth) and mirrored in `app/mobile/src/lib/ceim.ts` (TypeScript). Kept in sync by hand — no shared workspace package exists yet for cross-platform types (the same accepted gap already documented for `knowledge.ts`/`brief.ts` and the i18n locale files); treat drift between the two files as a defect.

| Field | Shape | Notes |
|---|---|---|
| `ceim_schema_version` | string | Currently `"0.1.0"`. Bump on any breaking shape change. |
| `generated_at` | ISO datetime | When the report was generated. |
| `content_pack_version` | string | The curated safety-content version active at generation time, for provenance. |
| `incident_type` | `Fact<string>` | Road/office/maritime/mountain/other — the app's existing context taxonomy. |
| `called_112` | `Fact<string>` | called / already_called / not_confirmed. |
| `location` | `{latitude, longitude, accuracy_m, description}` | Each a `Fact`. Coordinates are `source: "device_sensor"`; `description` (a landmark note) may be `bystander_stated`. |
| `victim_count` | `Fact<int>` | |
| `victims[]` | array of victim objects | See below — this is where the safety invariant lives. |
| `hazards[]` | array of `{code, description}` | `code` is a `Fact<string>` matched against the app's existing hazard whitelist (`HAZARD_WHITELIST` in `services/resqkit_ai.py` / `hazardByCode` in `knowledge.ts`) when the AI extraction clearly matches one; `description` is always present as raw text. |
| `scene_observations[]` | array of `Fact<string>` | Free-text narrative snippets that aren't hazards or victim-specific detail. |
| `additional_notes` | `Fact<string>` | Catch-all. |
| `degraded` | bool | True if AI extraction failed or was skipped; the report is skeleton-only or raw-answer-only in that case. |

**Victim object** (`CeimVictim`): `index`, `responsive`, `breathing`, `age_band`, `injury_type`, `trapped`, `condition_description` — each a `Fact` except `index`. **`responsive` and `breathing` are always `source: "button_selected"`, enforced in code, never AI-touched, under any circumstance.** This is the field-level expression of the safety rule in §1.

**Request/response contract** — `POST /api/v1/resqkit/ceim/generate`:

```
→ { known_facts: {incident_type, called_112, latitude, longitude, accuracy_m,
                   location_note, victim_count, responsive, breathing, injury,
                   age_band, trapped},
    interview_answers: [{prompt_id, prompt_text, answer_text}, ...],
    content_pack_version }
← { ceim: CeimIncident, degraded: bool, model: string }
```

Unauthenticated and unconditional, like the app's other AI endpoints (`recognize_kit`, `polish_brief`, `chat`) — this is a core app feature, not institutional traffic. Always returns 200; `degraded` signals whether AI extraction succeeded, never a hard failure the app has to handle specially.

**Where it's populated:** `known_facts` come from the existing fixed-button triage/location capture, mapped deterministically (no model call) into `Fact`s with `source: "button_selected"`/`"device_sensor"`, `confidence: "high"`. `interview_answers` come from a fixed set of 5 pre-written open-ended prompts (`INTERVIEW_PROMPTS` in `lib/ceim.ts`) — the app deliberately does *not* run an adaptive, model-generated multi-turn interview, because the local Ollama model (`llama3.2:3b`, no GPU) measures 30–57 seconds per call on the dev machine, and paying that cost per question would mean minutes of dead air at a real scene. Instead, exactly one model call at the end structures everything into the extracted fields (`victims[].condition_description`/`injury_type`/`trapped`, `hazards[]`, `scene_observations[]`, `additional_notes`) — reusing the same prompt-for-JSON → manual parse → one repair call → graceful-degrade pattern already proven in `recognize_kit`.

---

## 5. CEIM → NG112 mapping (implemented)

`app/backend/services/ng_protocol.py`'s existing PIDF-LO/RFC 7852 builder — previously built directly from ad hoc session-log scanning — now reads the session's latest `ceim_report_generated` event and adapts from that when present, falling back to its original log-scanning behavior otherwise (so old sessions and the existing test coverage are unaffected).

| CEIM field | NG112 output |
|---|---|
| `location.latitude` / `longitude` / `accuracy_m` | PIDF-LO `<gs:Circle>` (radius = accuracy) or `<gml:Point>`, exactly as before — now sourced from the CEIM's location facts when explicit request args aren't supplied. |
| `victims[].condition_description`, `injury_type`, `trapped` | Folded into the RFC 7852 `Comment` block, each suffixed with its confidence tag, e.g. `bruised arm, alert [conf:medium]`. |
| `hazards[].description` | Same Comment block, prefixed `hazard:`. |
| `scene_observations[]`, `additional_notes` | Same Comment block. |

The response gains one additive field, `ceim_driven: bool`, so a caller can tell which path produced the comment. **The request/response contract for `POST /{session_id}/ng_protocol/build` is otherwise unchanged** — the mobile app's already-working `buildNgProtocolPayload()` call needed zero changes. Verified: a regression check (no-CEIM session, byte-identical output) and a new-behavior check (synthetic CEIM event → `ceim_driven: true`, comment reflects CEIM content, returned XML parses back cleanly with `ElementTree.fromstring()`).

**Non-transmission is unchanged.** The output still carries `"transmitted": false` and the same "PROOF OF CONCEPT ONLY … requires an authorized channel via STS/ANCOM" note as before, now with one appended sentence noting when the comment is CEIM-derived. This feature does not add, and was never meant to add, a real transmission path.

---

## 6. CEIM → EDXL-SitRep mapping (implemented)

**The mentor's link 404s.** `.../schemas/EDXLSitRep.xsd` doesn't exist; the real published file is `EDXLSitRep-v1.0.xsd`, found by walking the version index the mentor also linked. Worth knowing if anyone else tries the original URL.

`app/backend/services/edxl_sitrep.py` builds a `sitRep` document (root type `SitRepType`) whose `report` element uses the abstract `IReport` type via `xsi:type`, concretely **`FieldObservationType`** — the field-observation report type flagged in §2, and the best structural fit for a bystander's free-text scene description:

| CEIM field | EDXL-SitRep target |
|---|---|
| session id | `messageID`, `incidentID` |
| `location.latitude`/`longitude` | `observationLocation` → `ct:EDXLGeoLocation` → `gml:point` (GML 3.2, EDXL's "Simple Features Profile") |
| `location.description` (no GPS fix) | `observationLocation` → `ct:EDXLGeoPoliticalLocation` → `geoCode` — a generic value-list pair, chosen over a full xAL postal address since CEIM has no structured address data. `observationLocation` is mandatory with no "unknown" option, so even a fully degraded report gets a placeholder value rather than invalid/missing content. |
| overall confidence across all facts actually included | `reportConfidence` (`HighlyConfident`/`SomewhatConfident`/`Unsure`/`NoConfidence`) — the *lowest* confidence among included facts is used, since SitRep confidence is per-report, not per-fact like CEIM, and understating certainty is the safe direction to round. |
| `hazards[]` presence | `severity` (`Severe` if any hazard is present, else `Moderate`) |
| `victims[].condition_description`/`injury_type`/`trapped`, `hazards[].description`, `scene_observations[]`, `additional_notes` | Folded into `observationText`, the report's free-text narrative |
| `hazards[].code` (fire/electrical/fuel_spill/gas) | `immediateNeedsCategory` = `FireAndHazardousMaterials`, else `EmergencyMedicalServices` |
| `kit_items[]` | **Not mapped.** No SitRep field fits on-scene bystander equipment; shown in the app's own report view only. |
| `degraded` | Not represented — a receiving institution has no use for "our AI couldn't summarize this," matching the original plan. |

`preparedBy`/`authorizedBy` are mandatory on `SitRepType` and require a `ct:PersonTimePairType` → CIQ `xpil:PersonDetailsType` → at least one `xnl:personName`. CEIM has no reporter-name concept, so both identify "ResQKit bystander app" rather than a real person — the minimal valid `personName` is empty content, so this is honest, schema-correct filler, not a fabricated identity.

**Real validation, not a guess.** `services/edxl_sitrep.py`'s `validate_edxl_sitrep()` runs the built XML through the `xmlschema` package pointed at the real OASIS URL, which resolves the *entire* transitive schema tree over HTTPS at validation time (this schema → CT → GSF → GML 3.2 from opengis.net → CIQ/xPIL/xNL for the person types) — nothing is guessed or hand-waved. Getting there found three real bugs, each only catchable by validating against the actual schema rather than reasoning from XML conventions:

1. `EDXLGeoLocation` must carry the **`ct:`** namespace prefix (the schema file that *declares* the element), not the `edxl-gsf:` namespace of its own *content type* — an easy, non-obvious mix-up.
2. The location choice element is **`gml:point`**, lowercase — not GML 3.2's own conventionally-capitalized `gml:Point`. This EDXL "GML Simple Features Profile" genuinely uses the lowercase form.
3. That same element requires a `gml:Id` identity attribute and an unprefixed, capitalized **`SrsName`** — not vanilla GML's `srsName`.

A fourth, more consequential bug surfaced only when this module ran *inside the actual FastAPI app* rather than standalone: `ng_protocol.py` and `edxl_sitrep.py` both called `ET.register_namespace("", ...)` for **different** namespace URIs. `register_namespace` writes to a process-global registry, so whichever module's import ran last silently won the default-namespace slot, and the other module's elements lost their default-namespace declaration on serialization — breaking `xsi:type="FieldObservationType"` resolution (an unprefixed value resolves against whatever default namespace is in scope) with `"global component 'FieldObservationType' not found"`. Fixed by giving EDXL-SitRep's root an explicit `sitrep:` prefix instead of `""`, and writing `xsi:type` fully qualified (`sitrep:FieldObservationType`) rather than relying on ambient default-namespace resolution. Confirmed this was the actual cause (not environment/threading, both tried and ruled out first) by reproducing it in isolation: importing both modules together broke it every time; either alone never did.

**Result:** three sample documents — with a GPS fix, with neither GPS nor a location note, and a fully empty/degraded CEIM — all validate as schema-valid against the live OASIS schema, verified through the actual running endpoint end to end, not just in a standalone script.

---

## 7. STS (Romania) — explicitly deferred

Per the mentor's own instruction: *"nu încercăm acum să 'ghicim' exact formatul intern al STS"* (we don't try to guess STS's exact internal format now). No adapter, no speculative schema exists or is planned here. Romania's 112 modernization project (§3) signals the *direction* STS is heading — structured contextual/additional data, AI/ML-assisted dispatch — which is why NG112/RFC 7852 was built as the near-term real target instead of waiting: it's the standard STS's own stated direction is converging toward, without requiring ResQKit to guess at an institution-specific format that hasn't been published. If and when STS/ANCOM publish or communicate an actual integration format, a CEIM → STS adapter is a bounded, well-scoped addition — the same shape as the NG112 and EDXL-SitRep adapters — not a redesign.

---

## 8. Non-transmission and legal posture (recap, unchanged)

No PSAP/112 real data channel exists in this app today — this remains an open, tracked item (`ResQKit_Progress_Update.md`, conflict 4 and the legal-team questions section). CEIM generation, the NG112 adapter, and the EDXL-SitRep adapter are all **non-transmitting**: they build a payload shape and stop there. The app's only real 112 channel is, and remains, the OS dialer (`tel:112`).

The mentor's phrase *"trimitem acel raport la orice instituție"* (we send that report to any institution) is deliberately **not** implemented as literal autonomous transmission. Nothing in this app sends data anywhere today, and building that would be a false claim carrying real legal weight on an already-open question — see the recording/transmission questions already raised with the legal team, and GDPR Article 9 (special-category data) as discussed in `eu_regulations_emergency_response_data_handling_report.md` §1.1. The honest, implemented behavior: the report is built in a **universal, exportable format** that the user explicitly **shares** (reusing the same OS share-sheet action already used for the deterministic brief in `handoff.tsx`) with whichever institution or person they choose. This exact framing is the copy shown on the report screen itself (`app/mobile/src/app/report.tsx`), in English and Romanian.

---

## 9. Verification performed

- **CEIM extraction**, scripted against the running backend: a normal request (known facts + interview answers) and an **adversarial** request where the free text explicitly contradicted `responsive: "no"`/`breathing: "no"` — the response's `victims[0].responsive`/`breathing` stayed `value: "no"`, `source: "button_selected"` in both runs, at two different phrasings/latencies (33.1s and 15.6s). This is the concrete, repeatable proof of the safety rule in §1, not just a design intent.
- **Degrade path**: pointed the model endpoint at an unreachable host — still HTTP 200, `degraded: true`, raw interview answers folded in as low-confidence observations rather than a dead end.
- **NG112 adapter**: regression-checked (no-CEIM session behaves byte-identically to before the refactor) and new-behavior-checked (synthetic CEIM event produces `ceim_driven: true`, CEIM content reflected in the comment, returned XML fragments parse cleanly with `ElementTree.fromstring()`, confirming bystander free text doesn't break XML escaping) — re-checked again after the EDXL-SitRep module was added to the same process, since that's exactly where the namespace collision bug (§6) surfaced.
- **EDXL-SitRep adapter**: real schema validation via `xmlschema` against the live OASIS URL, resolving the full transitive schema tree, across three cases (GPS fix present; no GPS fix but a location note; fully empty/degraded CEIM) — all schema-valid. Verified through the actual running `POST /{session_id}/edxl_sitrep/build` endpoint end to end (session → CEIM with hazards/kit → event logged → payload built and validated), not just a standalone script, which is precisely what caught the namespace collision bug that a standalone script could not have found.
- **Regenerate report**: `known_facts` extended with `hazards`/`kit_items`, populated as `button_selected`/high-confidence facts in the skeleton before any AI merge — verified via the same live endpoint with both fields populated, producing a CEIM whose `hazards`/`kit_items` arrays were non-empty.
- **Mobile**: `tsc --noEmit` and `expo lint` clean; the Metro dev server bundle was fetched and grepped to confirm the new interview/report screens are actually served, not just present in source.
- **Honest limits, not hidden**: the on-device *feel* of a 15–60 second final "generating report" wait, and whether the 5 fixed prompts actually elicit useful text from a real, stressed bystander rather than one-word non-answers, cannot be verified from this dev sandbox. Recommend the team dry-run the interview themselves before the mentor demo.
