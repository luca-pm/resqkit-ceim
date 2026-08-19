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

## 4. Open questions for the mentor

1. Confirm: is Node/Express intended for a separate future marketing site, not the app backend — or should the app backend actually move off FastAPI?
2. Confirm: should the mobile app be native React Native (work is proceeding on this basis), rather than the current web app?
3. Is "Terracotta & Clay" acceptable as one of the palette proposals, or should marketing start from a blank slate?
4. How far should the NG112 / PVR / NG-protocol prototype go before real institutional engagement (STS/ANCOM) is needed — is simulation-only sufficient for the foreseeable roadmap, or should work toward a real channel start soon?

## 5. Not yet started

- **React Native migration** (full feature parity, Expo) — planned, not yet begun. This is a genuinely large, multi-session effort; a detailed phased construction plan exists internally and will be worked through incrementally.
- **One-pager → Markdown/Drawio conversion** — waiting on the team to provide the actual source files (PDF/Word/JPEG); most of the content is already present in `InfoExtra/EdwardInput.docx`.
- **Node/Express research** — parked pending the mentor's answer to open question 1.
