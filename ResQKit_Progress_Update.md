# ResQKit — Progress Update

**Date:** 2026-08-19
**Purpose:** Status update for the mentor, covering what's been built, where it diverges from the original task list, and open questions that need a decision.

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

1. Confirm: is Node/Express intended for a separate future marketing site, not the app backend — or should the app backend actually move off FastAPI?
2. Confirm: should the mobile app be native React Native (work is proceeding on this basis), rather than the current web app?
3. Is "Terracotta & Clay" acceptable as one of the palette proposals, or should marketing start from a blank slate?
4. How far should the NG112 / PVR / NG-protocol prototype go before real institutional engagement (STS/ANCOM) is needed — is simulation-only sufficient for the foreseeable roadmap, or should work toward a real channel start soon?
5. Given that capturing 112 call audio is impossible on both mobile platforms (conflict 5), what should "passive voice recognition" become? The realistic option is transcribing the bystander's scene description before/after the call, into the handoff brief. Confirm that is the intended direction before further design assumes operator audio.
6. Since NG112 infrastructure already exists in Romania (conflict 6), should someone open an accreditation conversation with STS now? This is not blocked on engineering, and lead times for institutional processes are typically long — starting late is the main risk.

## 4b. For the legal team

These are not engineering decisions and should not be settled from an architecture diagram. Flagging them now because each is far cheaper to design around than to retrofit, and two of them gate features that are otherwise ready to build.

1. **Is recording the 112 operator lawful?** Note this is currently moot in practice — the platforms make it impossible (conflict 5) — but it determines whether the question is worth revisiting if that ever changes (e.g. a native NG112 integration rather than a phone call). Relevant framing: STS already records 112 calls as standard PSAP practice, so the question is not whether a recording exists, but whether ResQKit is entitled to a second copy, and on what lawful basis.

2. **Scene audio captures people who never consented.** The buildable form of voice recognition — transcribing the bystander describing the scene — will incidentally capture injured people, other bystanders and arriving responders. That is special-category data (health, and potentially biometric) belonging to third parties who cannot meaningfully consent mid-emergency. Is there a lawful basis (vital interests, Art. 6(1)(d) / Art. 9(2)(c)?), and what retention applies to a transcript that mentions a stranger's injuries?

3. **What may the ISU dashboard receive, and under what basis?** The pairing-code dashboard is technically working and is the near-term demo. Once it carries real incident data to a third party (a dispatcher, an instructor, a demo audience), the local-first posture no longer covers it. Who is controller vs. processor, and what does the bystander need to be told at pairing time?

4. **Does the "no PSAP/112 data channel in MVP" boundary need to hold legally, or only practically?** Conflict 4 records this as a scope disagreement. If there is also a legal reason for the boundary, it should be documented as such — a scope decision can be reversed by a product call, a legal constraint cannot.

5. **Health data in the Safety Profile and the handoff brief.** Already implemented as explicit, separate, withdrawable consent (GDPR Art. 9) stored on-device only. Worth a review that the current consent wording and the "archive to my account" path actually satisfy what the team believes they satisfy.

## 5. Not yet started

- **React Native migration** (full feature parity, Expo) — planned, not yet begun. This is a genuinely large, multi-session effort; a detailed phased construction plan exists internally and will be worked through incrementally.
- **One-pager → Markdown/Drawio conversion** — waiting on the team to provide the actual source files (PDF/Word/JPEG); most of the content is already present in `InfoExtra/EdwardInput.docx`.
- **Node/Express research** — parked pending the mentor's answer to open question 1.
