# ResQKit — Deferred Features & Backlog

**Last updated:** 2026-09-12

**Purpose:** A running list of things discussed, designed, or scoped but not yet built — so an absence is never mistaken for an oversight, and nobody re-discovers the same tradeoff twice. Unlike `ResQKit_Progress_Update.md` (a dated snapshot written for the mentor), this file has no single audience or date it's "for" — it's meant to be added to as things come up, and updated (not deleted) once an item ships.

Standing rule, inherited from `ResQKit_Progress_Update.md` §6: a simulated/faked version of a feature that can't really work yet is worse than its plain absence, because it hides the gap from everyone, including the team.

## Hardware / infrastructure blocked

### Bluetooth pairing with the physical ResQKit device ("My ResQKit")
Not started — no hardware exists yet, in any form. Full detail and reasoning: `ResQKit_Progress_Update.md` §6.2.

### Device battery/connection status UI (Home screen)
Alexandra's reference design's Home screen has a `DeviceSection`/`DeviceCard` — connection status pill, battery percentage bar, "resync"/"connect" buttons — all driven by mock device state in her project (`mock/device.js`), not real hardware. Deliberately not ported here (2026-09 Phase 6 of the visual revamp): building the visual without a real device behind it would mean either faking a battery percentage on a safety product (violates the standing "no simulated hardware status" rule, see Purpose above) or shipping a UI that can never actually connect to anything, which is worse than not having it.

**Bring back when:** the physical ResQKit device (see the Bluetooth item above) exists and has a real backend integration to report actual battery/connection state from. At that point, port the visual (`DeviceCard`/`StatusChip`/`BatteryBar`, `src/components/home/*` and `src/design/*` in her repo) against real data, the same way the Phase 6 floating AI button and search bar were ported against real app state rather than mocked.

### Voice transcription of the emergency call (PVR / ASR)
The plumbing exists (`services/incident_stream.py`, the websocket channel), the feature doesn't — blocked on an unanswered legal question (recording bystanders/the victim, who can't meaningfully consent at a crash site) and a missing self-hosted Whisper-compatible server. Full detail: `ResQKit_Progress_Update.md` §6.1.

### A real NG112/STS channel (sending anything to actual emergency infrastructure)
Everything today — the NG protocol payload builder, EDXL-SitRep adapter, the ISU dashboard — is simulated by default and non-transmitting by design. Making it real requires STS accreditation for this specific app, which is an institutional/legal conversation, not an engineering task. Tracked as open question 6 in `ResQKit_Progress_Update.md` §4.

## Data/UX decisions deliberately parked — each has a specific trigger to revisit

### ~~Age-tailored first-aid procedures~~ — DONE, narrowly (2026-09-17)
The "Approximate age" triage question was removed from `emergency.tsx`'s critical path on 2026-09-12 because no procedure branched on age at the time. Brought back, but only for the two procedures where it turned out to be exactly the concrete example already on the table here: `choking` (abdominal thrusts are contraindicated on an infant — back blows + chest thrusts instead) and `cpr_aed` (infant = two-finger compressions ~4cm deep, child = one-hand heel ~5cm, both distinct from the adult two-handed technique). Confirmed as real, well-established first-aid facts (not invented) while comparing against Alexandra's now-much-more-developed reference implementation, which branches on the identical three age bands for the identical two reasons.

Implementation: `ProcedureStep.ageVariants` (`src/lib/knowledge.ts`) holds per-step title/detail overrides for `infant`/`child`; `resolveProcedureSteps()` applies them; `PROCEDURES_NEEDING_AGE_BAND` (`['choking', 'cpr_aed']`) gates a new `'age'` stage in `emergency.tsx` that only triggers for those two — routing to `severe_bleeding`/`burns`/`fracture`/`hypothermia` is completely unaffected, same number of questions as before. Content is marked `clinicalReview: 'pending'`, same as the rest of `choking`/`cpr_aed` already were — this is new content, not yet independently reviewed, despite being standard/well-established guidance.

**Not done:** every other procedure still doesn't branch on age, correctly — the original "bring back only when a procedure genuinely needs it" bar stays the rule, this didn't turn into a general age-tailoring pass.

### Structured hazard reporting to first responders
The hazard checklist ("What can hurt you?" — tap every hazard, per-hazard warnings, a "Do not approach" banner) and the separate "Can you reach them?" triage question were both replaced on 2026-09-12 with one plain-language safety reminder. No structured hazard/access data is collected from the bystander in the critical path anymore — `incident.hazards`/`incident.powertrain`/`incident.trapped` stay in the data model, just unused. The AI interview's existing free-text prompt ("What hazards or dangers do you see...") remains the only path hazard detail takes into the CEIM report today, and it's optional and reached after the guide, not before it.

**Bring back when:** ResQKit has an actual NG112/STS channel to send a detailed hazard report through (see above). At that point, richer structured hazard capture — not just a checkbox tap the bystander already knows the answer to — becomes worth the added friction, because it's feeding a real institutional consumer (a dispatcher/responder who wasn't on scene) rather than only a local brief.

### ~~Installing react-native-paper to run the Alexandra reference design's actual components~~ — DONE, no longer deferred
Done 2026-09 (Phase 6 of the visual revamp): `react-native-paper` + `@expo/vector-icons` installed, `PaperProvider` wired in, and design tokens (radius/shadow/roundness) corrected to match her `src/design/*.js` exactly rather than eyeballed. Ongoing work now is porting her actual screens one at a time (real file reads via Explore agents, not guessing) — Home (search bar + floating AI button) and the AI chat screen (bubble styling, quick-action prompts) are done; more screens follow. Left in this file only as a record that the decision was made and acted on.

### Richer guide taxonomy (severity levels, duration, category drill-down) for Learn & practise
Alexandra's reference design's guide screens are a 3-level structure — category picker → per-category tutorial list → detail — with a `SeverityBadge` (low/medium/high, each with its own pill color) and a `duration` field per procedure, plus a conditional red "emergency" callout card for high-severity items. Our `learn.tsx` is a flat single-level accordion over `PROCEDURES` (`src/lib/knowledge.ts`), which has no `severity`, `duration`, or `category` fields at all.

**Not built:** unlike the Home search bar and AI chat quick-actions (which were "visual exists, function doesn't" — safe to build because the underlying feature was already real, just unwired), inventing severity ratings or time estimates for first-aid procedures is a clinical content decision, not a UI gap — `PROCEDURES` already tracks `clinicalReview: 'pending' | 'verified'` precisely because this content gets real scrutiny before shipping. Fabricating a severity taxonomy without that review would be the exact kind of "simulated/fake" content the standing project rule (see Purpose above) warns against, just for medical content instead of hardware status.

**Bring back when:** whoever owns clinical content review is ready to actually assign severity/duration to each procedure in `knowledge.ts`. At that point the visual pattern (her `SeverityBadge`/`GuideCard`/category-drill-down, already fully read and documented — see the two Explore reports from the 2026-09 session that did the Home/AI/guides research) can be ported quickly against real data, the same way Phase 6's other pieces were.

### A real ResQKit app icon
Every raster image in `app/mobile/assets/images/` (`icon.png`, `splash-icon.png`, `logo-glow.png`, `expo-logo.png`, the Android adaptive-icon layers) is still the untouched stock Expo template — a blue gradient square with a white "A" chevron and grid pattern. Found while building the Phase 5 splash screen (2026-09-12): the splash itself sidesteps this by using the `LifeBuoy` lucide icon (already established as the brand mark in `AppShell`'s header) instead of a raster image, so it doesn't need this asset — but the actual home-screen/app-switcher/app-store icon still shows the default Expo mark.

**Bring back when:** a real icon image is exported (needs actual design work — a code change can't fix this, `app.json`'s `icon`/Android adaptive-icon config just points at whatever file exists). Once it exists, wiring it into `app.json` is a small mechanical change.

## Known gaps in the guidance content itself

(From a SMURD/first-aid reference-video comparison against `PROCEDURES` done earlier this session — reported at the time, never actioned. Restating here so it isn't lost.)

- `cpr_aed`'s head-tilt airway step has no exception for suspected trauma/cervical injury.
- `routeProcedure()`'s injury-priority resolution (`primaryInjury()`/`INJURY_PRIORITY` in `knowledge.ts`) has no case for `head_spine` or `chest` — both silently fall through to the `severe_bleeding` procedure instead of their own guidance.
- Missing procedures entirely: minor wound care, tooth avulsion, rib-fracture reassurance during CPR, motorcycle-helmet removal technique.

## Minor / not urgent

- **Romanian STT locale** — `VoiceInput`'s `locale` prop defaults to `'en-US'`; a `ro-RO` option is typed on `VoiceLocale` but never wired up or confirmed as actually needed.
- **Segmented control** (a pattern noticed in the Alexandra reference design during the visual revamp) — a clean two/three-way toggle look; no current use case in the app, so not built speculatively. Revisit if a real multi-way toggle need shows up.
- **A "practice mode"** — Alexandra's newer, functionally-real repo has one (`practiceHomeScreen`/`practiceProtocolScreen`, 2026-09): rehearse a protocol using the same content as the real emergency flow, but "call 112" is an `Alert` explaining it's simulated instead of actually dialling, and nothing writes to history. Interesting idea (matches this app's own "Learn & practise" intent but interactive rather than read-only), no user decision made on it yet — noting it so it isn't lost, not proposing it.

## Explicitly rejected, not deferred

Looked at and turned down — these shouldn't resurface as if still undecided:

- **Auth/login as primary navigation** (from the Alexandra reference design's side-menu + account screens) — contradicts ResQKit's local-first, no-account-required architecture for the core emergency flow.
- **Any simulated/fake version of the two hardware-blocked items above** — the standing rule (see Purpose) is to build nothing rather than something plausible-but-fake, especially for a battery/device-status claim on a safety product.
