# ResQKit — Progress Update

**Date:** 2026-09-04
**Purpose:** Status update for the mentor, covering what's been built, where it diverges from the original task list, what has been deliberately left unbuilt and why, and open questions that need a decision.

---

## 1. Feature list / status

Base list is the team's own MVP scope document, `ResQKit_MVP_Screens_and_User_Flow.md` (12 screens). Status reflects actual code in `app/frontend/src/pages` and `app/backend`, not intent.

| Screen | Purpose | Status |
|---|---|---|
| S0 — Welcome, Disclaimer & Consent | 112-first disclaimer + layered privacy notice | **Done** (`Index.tsx` + `Consent.tsx`) |
| S1 — Safety Profile | Optional medical facts, local-only | **Done** (`Profile.tsx`) |
| S2 — Home / Standby | Entry point, no login required | **Done** (`Index.tsx`) |
| S3 — Environment & Context | Road/Office/Maritime/Mountain/Other | **Done** (`Emergency.tsx`, context stage) |
| S4 — Call 112 Gate | Non-dismissible 112-first gate + dispatcher script | **Done** (`Emergency.tsx`, call stage) |
| S5 — Scene Triage | Responsive/breathing/injury/victim count/age/trapped | **Done** (`Emergency.tsx`, triage stage) |
| S6 — Hazard Check | Context-filtered hazard checklist | **Done** (`Emergency.tsx`, hazards stage) |
| S7 — Kit Recognition | Camera-based AI kit recognition + manual fallback | **Done** (`KitScanner.tsx`) |
| S8 — Guided First Aid | Step-by-step procedures, filtered by available kit | **Done** (`ProcedureRunner.tsx`) |
| S9 — Rescuer Handoff Card | Deterministic brief + optional AI-polished spoken version | **Done** (`Handoff.tsx`) |
| S10 — Risks & Legal Obligations | Curated, sourced regulation cards | **Done** (`Regulations.tsx`) |
| S11 — Incident Review & Data Rights | Retention choice, archive, full local erasure | **Done** (`Review.tsx`) |
| S12a — My Kits | Register/track owned kits | **Done** (`Kits.tsx`) |
| S12b — Learn & Practise | Calm-state walkthroughs | **Done** (`Learn.tsx`) |

The MVP scope document is, at this point, close to fully implemented. Two screens exist beyond that original scope:

| Screen | Purpose | Status |
|---|---|---|
| Settings | Real data mode toggle + institutional actions trace | **Done** (new, this phase of work) |
| ISU Dashboard (demo) | Enter a pairing code, watch a session live | **Done** (new, this phase of work) |

## 2. What's been built since the last mentor update

**Backend — session/log infrastructure** (`app/backend/routers/incident_sessions.py`, `pre_call_triage.py`, `incident_stream.py`, `ng_protocol.py`):
- A live incident session + append-only event log, addressed by an anonymous ID (matches the un-gated emergency flow — no login required).
- A pre-call triage state machine (timed Q&A: ask → 7s window → in-time response or unresponsive/skip fallback).
- Passive-voice-recognition request + a websocket transcript-streaming channel, with a REST fallback for when the socket can't be kept alive.
- A PIDF-LO / RFC 7852-style NG protocol payload builder — **non-transmitting**: it only builds and logs the payload shape, never sends anything to real emergency infrastructure.

**Backend — ISU dashboard demo** (this session):
- A short, human-typeable pairing code (`join_code`) generated per session, distinct from its internal UUID.
- A live "watch" websocket: a spectator (the dashboard) connects and receives every event the instant it's logged — no polling.

**Frontend — institutional actions + simulation mode** (`app/frontend/src/lib/institutionalActions.ts`, `pages/Settings.tsx`):
- Every one of the above backend calls is wrapped so it can run **simulated** (default — zero network calls, nothing leaves the device) or **real** (explicit opt-in via Settings → Real data mode). Every call, either way, is logged to a visible trace.
- This preserves the app's existing local-first, no-egress-until-explicit-action guarantee (documented in `lib/localStore.ts`) by default.

**Frontend — ISU dashboard demo page** (`app/frontend/src/pages/Dashboard.tsx`, this session):
- The existing web app now has a `/dashboard` route: enter a pairing code, connect, watch the session's log update live.
- The sender side (currently the web app's own call stage; the React Native app inherits this role once it exists) shows its pairing code prominently once a real session exists — clearly labeled "Simulated" instead of a code when Real data mode is off, so nothing implies a connection that can't actually happen.
- Verified end-to-end: two browser tabs, one as sender (real data mode on, progressing through the wizard), one as dashboard (entering the code) — events appear on the dashboard within the same second they happen on the sender, no polling.

**Also this session:** local git version control initialized for the project (no remote yet — that's still the team's own step).

## 2b. Canonical Emergency Incident Model (CEIM) — new, this session

Built in response to the mentor's 2026-09-02 direction (see `ResQKit_Canonical_Incident_Model.md` for the full design, plain-language EDXL-SitRep/NG112 background, and verification). Summary:

- **The AI interview flow is live**: after confirming a 112 call, a bystander answers up to 5 fixed, optional, open-ended prompts (skippable at any point), then one call structures everything into a versioned, provenance-tracked internal model (`CeimIncident` — every fact carries where it came from and how confident the app is). This is additive to the existing fixed-button triage, not a replacement — the two life-critical CPR-routing fields (`responsive`/`breathing`) are never AI-sourced, enforced in code and covered by an adversarial test (contradictory free text could not change them in either of two test runs).
- **The existing NG112/PIDF-LO payload builder now adapts from CEIM** when a report exists, with zero breaking change to its existing request/response contract — verified by a before/after regression check.
- **EDXL-SitRep adapter and a Romania/STS-specific format are explicitly not built** — see the doc's §6–7 for why, matching the mentor's own "don't guess STS's format" instruction.
- **The "we send this report to any institution" framing was deliberately not implemented as literal transmission.** Nothing in this app sends data anywhere today (see conflict 4/5 below, unchanged by this work). The report is built in a shareable, universal format the user explicitly shares via the OS share sheet — the exact same non-transmission posture as the pre-existing NG protocol prototype.

### Overlap with Matei's backend (`github.com/RosogaMatei/resqkit`)

Relayed by the team: Matei's backend was built on a different premise (streaming live 112-call audio to a server), and the mentor has separately asked Matei to reconcile with Luca's backend under Mircea's guidance — a process this work does not own. Matei's own assessment is that the audio-transmission premise is superseded by this AI-dialogue-driven flow, and that his port/adapter architecture "fits well over the canonical model idea" — worth noting as independent architectural agreement with the CEIM/adapter approach here, not a competing design.

| Matei already has | This backend (`app/backend`) | Verdict |
|---|---|---|
| JWT auth, register/login | Already exists independently, tested this session | Duplicate capability, not code — no merge needed |
| Sessions persisted in PostgreSQL | Already exists independently (`incident_sessions`/`incident_events`), tested this session including the live ISU dashboard websocket | Duplicate capability, not code — no merge needed |
| Docker Compose containerization | Not present here | Real gap — legitimate follow-up, not done this session |
| 79 automated tests | None committed here (verification this session was scripted API calls, not a committed suite) | Real gap — legitimate follow-up, not done this session |
| Real-time 112-call-audio → server premise | No microphone capture code anywhere in this app (verified; see conflict 5 below) | Correctly abandoned by both sides |

The CEIM JSON schema is deliberately the portable part of this work — a plain data contract, not tied to FastAPI/Ollama/Postgres — so it can be adopted regardless of which backend the team eventually converges on.

## 3. Conflicts / divergences from the original direction

Flagging these explicitly rather than letting them stay implicit:

1. **Backend is Python/FastAPI, not Node/Express** as originally directed ("same language front and back"). Current working assumption: Node/Express was meant for a future, *separate* marketing/presentation site, not the app backend — but this was inferred, not confirmed with the mentor.
2. **Frontend is being corrected from web to native.** It was built as a React web app, not React Native/Expo as originally directed. A full React Native migration (Expo, targeting full feature parity) is now planned and about to start — see open questions below for what's already decided vs. what's still being sequenced.
3. **Color palette ("Terracotta & Clay") was already implemented** in code before the "propose 2-3 palettes" task was assigned. Now explicitly parked — marketing owns this going forward, engineering isn't touching it further.
4. **The team's own MVP scope document is stricter than the mentor's original architecture sketch.** `ResQKit_MVP_Screens_and_User_Flow.md` defines "no PSAP/112 data channel in MVP" as an explicit, hard boundary. The mentor's own diagram (NG112 connection, websocket streaming, NG protocol transmission) sketches further than that. This has been reconciled in code by making all of it simulated-by-default (see §2) — but the underlying scope question (how far the prototype should go before real institutional engagement) hasn't been put to the mentor directly.

5. **"Passive voice recognition" of the 112 call cannot be built on iOS or Android.** This is the most consequential conflict found so far, because it is a hard platform limit rather than a scope decision — no authorization, budget or engineering effort changes it.

   The architecture sketch implies the app can capture the audio of the user's call with the 112 operator and transcribe it. Both mobile platforms forbid this to third-party apps:

   - **iOS** has blocked third-party microphone access during a cellular call for over a decade. Apple's own call recording is available only within the Phone app; third-party apps receive no call audio at all.
   - **Android** restricted call-recording APIs in Android 10, and Google banned the Accessibility-API workaround in Play Store policy in **May 2022**. A third-party app can at best capture the user's own microphone — never the remote party.

   The only apps that genuinely record both sides do so by **conferencing the call through their own bridge number**, which is not an acceptable pattern for an emergency application.

   **What remains buildable:** transcribing *the bystander describing the scene* — before or after the 112 call, not during it — and feeding that into the rescuer handoff brief. That is still valuable (hands-free scene capture while giving first aid), but it is a materially different feature from what the diagram implies, and downstream design should not assume operator audio exists.

   **Current implementation status:** the backend pipeline (`services/incident_stream.py`, `transcribe_chunk`) is built and works — it accepts short audio clips over a websocket and transcribes each via the self-hosted model. Nothing captures audio and feeds it, and the in-app "Test voice channel" button is a **connectivity test only** (it opens the socket, round-trips a ping, and logs both ends). No microphone is accessed anywhere in the app today.

   **Two questions that should be settled before any audio capture is built** (they are cheaper to design for now than to retrofit):
   - Capturing audio at an incident scene records **bystanders and responders who never consented**, not just the user — special-category data under GDPR with third-party voices in it.
   - Whether recording the operator is lawful at all is a question for qualified Romanian/GDPR counsel, not an engineering decision. Note that **STS already records 112 calls** as standard PSAP practice, so the relevant question is not whether a recording exists but who is entitled to a second copy.

   Sources: [iOS/Android call-recording restrictions](https://www.notta.ai/en/blog/best-call-recorder-app), [platform limitations overview](https://hinoter.com/blog/how-to-record-a-phone-call-on-iphone-android-2026)

6. **NG112 is not a future/pending standard — Romania is among its most advanced deployments.** An assumption worth correcting, because it changes what "waiting for NG112" means. NG112 is an existing ETSI/EENA standard; the EECC deadline for member-state roadmaps was **December 2023**. STS already operates Romania's ESInet and Next Generation Core Services, with roughly 41 stage-1 PSAPs and ~130 stage-2 dispatch centres.

   The blocker for ResQKit is therefore **not** that the standard needs approving — it is obtaining STS authorization for this specific application to act as a data source into infrastructure that already exists. That is an accreditation/partnership conversation which can begin now, and it is institutional rather than technical.

   Sources: [EENA — NG112 implementation in Europe](https://eena.org/blog/ng112-implementation-in-europe-demystifying-the-esinet-and-next-generation-core-services-2/), [STS/ITU — Romania 112 modernisation, April 2026](https://www.itu.int/en/ITU-T/Workshops-and-Seminars/2026/0414/Documents/Florin%20Feticu.pdf)

## 4. Open questions for the mentor

**Recommended order, and why:**

| Order | Question | Urgency | Why this position |
|---|---|---|---|
| 1st | **2 — React Native confirmation** | **Blocking** | The largest active workstream is proceeding on this assumption. Every week it goes unconfirmed is a week of work that would be discarded if the answer is no. Cheapest possible question to ask, highest cost of being wrong. |
| 2nd | **1 — Node/Express vs FastAPI** | High | Same risk shape as above: the backend is built and working on FastAPI. If it must move, that should be known before more is layered on top. Currently parked on an inference, not a confirmation. |
| 3rd | **5 — what should PVR become?** | High | The current design assumes operator audio that cannot exist (conflict 5). Until redirected, any further design in this area is built on a false premise. |
| 4th | **6 — start the STS conversation?** | Medium-high | Not blocking any code, but institutional lead times are long. The risk here is purely one of starting late, which makes it worth raising early even though nothing waits on it. |
| 5th | **4 — how far should the prototype go?** | Medium | Roadmap-shaping rather than work-blocking; simulation-by-default already makes the current state safe either way. |
| 6th | **3 — colour palette** | Low | Marketing owns it, engineering is not touching it, and a new palette is already implemented from their Figma handoff. Answer whenever convenient. |

1. Confirm: is Node/Express intended for a separate future marketing site, not the app backend — or should the app backend actually move off FastAPI?
2. Confirm: should the mobile app be native React Native (work is proceeding on this basis), rather than the current web app?
3. Is "Terracotta & Clay" acceptable as one of the palette proposals, or should marketing start from a blank slate?
4. How far should the NG112 / PVR / NG-protocol prototype go before real institutional engagement (STS/ANCOM) is needed — is simulation-only sufficient for the foreseeable roadmap, or should work toward a real channel start soon?
5. Given that capturing 112 call audio is impossible on both mobile platforms (conflict 5), what should "passive voice recognition" become? The realistic option is transcribing the bystander's scene description before/after the call, into the handoff brief. Confirm that is the intended direction before further design assumes operator audio.
6. Since NG112 infrastructure already exists in Romania (conflict 6), should someone open an accreditation conversation with STS now? This is not blocked on engineering, and lead times for institutional processes are typically long — starting late is the main risk.

## 4b. For the legal team

These are not engineering decisions and should not be settled from an architecture diagram. Flagging them now because each is far cheaper to design around than to retrofit, and two of them gate features that are otherwise ready to build.

**Recommended order, and why:**

| Order | Item | Urgency | Why this position |
|---|---|---|---|
| 1st | **3 — ISU dashboard** | **Blocking** | The only one where the answer changes UI we would otherwise build. The dashboard works today and is the near-term demo. If pairing needs its own consent step, designing that now is far cheaper than retrofitting it after the flow is finished. Demoing with fake data is unaffected — this gates real bystander data only. |
| 2nd | **2 — scene audio / third-party voices** | High | Gates the only buildable form of voice recognition. No code should be written against it until there is a lawful basis, or the work is wasted. Answering early also lets the consent model be designed alongside item 3 rather than twice. |
| 3rd | **5 — existing health-data consent** | Medium | Already shipped and in users' hands, so this is a review rather than a design input — but that also means any defect is live now. Low effort to check, and it validates the Art. 9 pattern the other items would reuse. |
| 4th | **4 — is the no-PSAP boundary legal or practical?** | Medium | Cheap to answer and clarifies whether conflict 4 is a product decision the mentor can reverse or a hard constraint. Mostly affects roadmap planning rather than current work. |
| 5th | **1 — recording the operator** | Low / moot | Currently impossible on both mobile platforms, so nothing depends on it. Worth answering only if a native NG112 integration is ever pursued (which itself depends on mentor question 6). Answering it first would be effort spent on the one item that cannot be built either way. |

Rough principle behind the ordering: **first what blocks design, then what blocks building, then what is already live, then what only affects planning, and last what is not currently possible.**

1. **Is recording the 112 operator lawful?** Note this is currently moot in practice — the platforms make it impossible (conflict 5) — but it determines whether the question is worth revisiting if that ever changes (e.g. a native NG112 integration rather than a phone call). Relevant framing: STS already records 112 calls as standard PSAP practice, so the question is not whether a recording exists, but whether ResQKit is entitled to a second copy, and on what lawful basis.

2. **Scene audio captures people who never consented.** The buildable form of voice recognition — transcribing the bystander describing the scene — will incidentally capture injured people, other bystanders and arriving responders. That is special-category data (health, and potentially biometric) belonging to third parties who cannot meaningfully consent mid-emergency. Is there a lawful basis (vital interests, Art. 6(1)(d) / Art. 9(2)(c)?), and what retention applies to a transcript that mentions a stranger's injuries?

3. **What may the ISU dashboard receive, and under what basis?** The pairing-code dashboard is technically working and is the near-term demo. Once it carries real incident data to a third party (a dispatcher, an instructor, a demo audience), the local-first posture no longer covers it. Who is controller vs. processor, and what does the bystander need to be told at pairing time?

4. **Does the "no PSAP/112 data channel in MVP" boundary need to hold legally, or only practically?** Conflict 4 records this as a scope disagreement. If there is also a legal reason for the boundary, it should be documented as such — a scope decision can be reversed by a product call, a legal constraint cannot.

5. **Health data in the Safety Profile and the handoff brief.** Already implemented as explicit, separate, withdrawable consent (GDPR Art. 9) stored on-device only. Worth a review that the current consent wording and the "archive to my account" path actually satisfy what the team believes they satisfy.

6. **Is a 30-day on-device retention option defensible under Art. 5(1)(e)?** See §4c. The data never leaves the device, the period is the user's explicit choice rather than a default, and it is deletable at any time from two places — but storage limitation sets no fixed number, and the incident may carry Art. 9 health data from the Safety Profile. The option is **already built and live**; if the answer is no, removing it is a one-line change. Slot this at **3rd** in the order above if 30 days is likely to be contentious, otherwise last — nothing is blocked on it either way, since 24h and 7d are uncontroversial.

## 4c. Retention — now enforced, with one question outstanding

The retention control on the review screen previously recorded the user's choice and never acted on it: closing an incident deleted it immediately whatever had been selected. That is now implemented for real on both platforms. A closed incident moves into a separate on-device store with an expiry date, a sweep on every app start removes anything past it, and the kept incidents are listed under Istoric → *On this device* with a countdown and a delete button.

Four options are now offered, and the **default has changed from immediate deletion to 7 days**. An incident is frequently needed after the fact — an insurance claim, a workplace report, a witness statement — and a bystander cannot know that at the moment they close it. Erasing by default made the common case unrecoverable in order to guard against a risk the user can already remove themselves at any time.

| Option | Behaviour |
|---|---|
| Delete on close | Erased the moment the incident is closed |
| 24 hours | Kept on the device, then deleted automatically |
| **7 days (default)** | Covers most insurance and workplace reporting deadlines |
| 30 days | The longest offered — **pending the legal question below** |

**Boundary that matters:** retention governs only the copy on the device. An incident explicitly archived to an account is a separate, deliberate act, is never touched by the sweep, and stays until the user deletes it. Istoric now shows the two stores as separate sections so they cannot be confused.

**Question for the legal team (added as item 7 in §4b):** is a 30-day on-device retention option defensible under GDPR Article 5(1)(e)? Engineering's reading is that it should be, because the data never leaves the device, the period is the user's own explicit choice rather than a default, and it can be deleted at any moment from two places in the app — but storage limitation has no fixed number in the regulation, the Safety Profile can carry Article 9 special-category health data, and this is a judgement the engineering team is not qualified to make. **The option is built and live.** If the answer is no, removing it is a one-line change.

## 5. Not yet started

- **React Native migration** (full feature parity, Expo) — **now well under way**, not "not started" as this section previously said. The mobile app exists and runs on physical devices: consent, the six-stage emergency wizard, handoff, review, profile, kits, learn, regulations, settings, sign-in, account, history, AI chat, FAQ, contact and tutorials are all ported. Remaining: on-device verification of camera latency, metronome timing and `tel:112` suspend/resume; EAS registration; a shared workspace package to stop `knowledge.ts` and the i18n locales being duplicated per platform.
- **One-pager → Markdown/Drawio conversion** — waiting on the team to provide the actual source files (PDF/Word/JPEG); most of the content is already present in `InfoExtra/EdwardInput.docx`.
- **Node/Express research** — parked pending the mentor's answer to open question 1.

## 6. Deliberately deferred — nothing built, nothing faked

These are features that appear in designs, discussions or existing scaffolding but have **no working implementation and no placeholder**. They are listed here so nobody mistakes an absence for an oversight. The team's standing rule is that a simulated version of a feature that cannot really work is worse than its absence, because it hides the gap from everyone including ourselves.

### 6.1 Voice transcription of the emergency call (PVR / ASR)

**State:** the plumbing exists, the feature does not. `Emergency → Institutional voice channel (prototype) → Test voice channel` issues a `pvr/request` call and performs a websocket connect/ping/close, logging each step to `Settings → Institutional actions`. That is all it does. **The app never opens the microphone** — verified by search: there is no `useAudioRecorder`, no `AudioModule`, no recording-permission request and no `RECORD_AUDIO` anywhere in the mobile codebase. The backend's `transcribe_chunk()` waits for audio chunks that no client ever sends.

**Why it is deferred, in order of weight:**

1. **The legal question is unanswered.** Whether the app may record a 112 call — and under what basis it could record bystanders and the victim, who cannot meaningfully consent at a crash site — is open with the legal team (see §4b). Building audio capture before that answer risks writing code that must be deleted, and moves the product into a higher risk category before we know we are allowed to be there.
2. **It would break the strongest privacy claim we currently have.** Today ResQKit records no audio at all. That is a simple, verifiable, defensible statement. Transcription makes it conditional, and the recording would contain third-party voices captured in the worst possible circumstances.
3. **No self-hosted engine currently serves it.** `APP_AI_BASE_URL` points at Ollama, which has no `/audio/transcriptions` endpoint and cannot do speech-to-text at any model size — neither `llama3.2:3b` (text) nor `moondream` (vision) has an audio encoder. A separate Whisper server is required.
4. **The backend can only address one AI endpoint.** `AIHubService` builds a single `AsyncOpenAI` client from one base URL and uses it for both text generation and transcription. Since no single self-hosted server does text, vision and audio, enabling ASR needs a second endpoint setting and a second client, or a gateway in front of both. Small work, but real, and currently unbudgeted.

**What it would take, when unblocked:** an OpenAI-compatible Whisper server (`faster-whisper-server` or `hwdsl2/docker-whisper`) — chosen because the backend already calls `client.audio.transcriptions.create(...)`, so the server is a drop-in and only the base URL changes. Commercial dictation apps (Willow Voice, Wispr Flow) were evaluated and rejected: both are consumer keyboard/dictation products with no embeddable API and no self-hosted option, and both are cloud services, which contradicts the no-egress posture.

### 6.2 Bluetooth Low Energy pairing with the physical ResQKit device

**State:** not started. No BLE code, no device model in the backend, no pairing UI. The "My ResQKit" screen from the marketing designs — showing Kit ID, battery percentage and firmware updates — and the associated "Vehicul" tab are not built.

**Why it is deferred:**

1. **The hardware does not exist yet, in any form this project can address.** There is no device, no prototype, no firmware, no BLE service or characteristic definitions, and no protocol specification anywhere in the repository or the source documents. There is nothing to connect *to*.
2. **The designs specify appearance, not behaviour.** The Figma screens show a battery percentage and a firmware-update affordance, but nothing defines how battery level is reported, how firmware is delivered and verified, what happens on a failed update, or what a Kit ID even identifies. These are the parts that determine the work; none of them are answered.
3. **A simulated version would be actively harmful here.** A fake battery indicator on a first-aid kit is not a harmless placeholder — it is a safety claim. A user who sees "87%" for a device that does not exist, or that exists and is not actually being read, may rely on equipment that is flat. This is the clearest case in the product for building nothing rather than something plausible.
4. **It carries regulatory weight the app does not currently have.** A connected physical device with firmware updates is a materially different product from a guidance app: it raises questions about device classification, update integrity and post-market surveillance that intersect with pre-launch item 20 (medical-device classification).

**What is needed before any work starts:** confirmation that the device is actually being produced, and a hardware specification covering the BLE profile, the battery-reporting mechanism and the firmware-update path. Until then this stays a design, not a backlog item.
