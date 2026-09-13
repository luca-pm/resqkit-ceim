# ResQKit — Deferred Features & Backlog

**Last updated:** 2026-09-12

**Purpose:** A running list of things discussed, designed, or scoped but not yet built — so an absence is never mistaken for an oversight, and nobody re-discovers the same tradeoff twice. Unlike `ResQKit_Progress_Update.md` (a dated snapshot written for the mentor), this file has no single audience or date it's "for" — it's meant to be added to as things come up, and updated (not deleted) once an item ships.

Standing rule, inherited from `ResQKit_Progress_Update.md` §6: a simulated/faked version of a feature that can't really work yet is worse than its plain absence, because it hides the gap from everyone, including the team.

## Hardware / infrastructure blocked

### Bluetooth pairing with the physical ResQKit device ("My ResQKit")
Not started — no hardware exists yet, in any form. Full detail and reasoning: `ResQKit_Progress_Update.md` §6.2.

### Voice transcription of the emergency call (PVR / ASR)
The plumbing exists (`services/incident_stream.py`, the websocket channel), the feature doesn't — blocked on an unanswered legal question (recording bystanders/the victim, who can't meaningfully consent at a crash site) and a missing self-hosted Whisper-compatible server. Full detail: `ResQKit_Progress_Update.md` §6.1.

### A real NG112/STS channel (sending anything to actual emergency infrastructure)
Everything today — the NG protocol payload builder, EDXL-SitRep adapter, the ISU dashboard — is simulated by default and non-transmitting by design. Making it real requires STS accreditation for this specific app, which is an institutional/legal conversation, not an engineering task. Tracked as open question 6 in `ResQKit_Progress_Update.md` §4.

## Data/UX decisions deliberately parked — each has a specific trigger to revisit

### Age-tailored first-aid procedures
The "Approximate age" triage question was removed from `emergency.tsx`'s critical path on 2026-09-12, because no procedure in `knowledge.ts` currently branches on age — asking it bought nothing and just delayed reaching the guide. `ageBand` stays in `IncidentState`/`VictimRecord`, just unused; `AGE_BANDS`/`AGE_LABELS` stay exported for `incident-detail.tsx`.

**Bring back when:** any procedure genuinely needs to differ by age. Concrete example already on the table: infant CPR is two-finger chest compressions, not two-handed; infant recovery position differs from an adult's. At that point `ageBand` stops being pure reporting metadata and becomes safety-relevant.

### Structured hazard reporting to first responders
The hazard checklist ("What can hurt you?" — tap every hazard, per-hazard warnings, a "Do not approach" banner) and the separate "Can you reach them?" triage question were both replaced on 2026-09-12 with one plain-language safety reminder. No structured hazard/access data is collected from the bystander in the critical path anymore — `incident.hazards`/`incident.powertrain`/`incident.trapped` stay in the data model, just unused. The AI interview's existing free-text prompt ("What hazards or dangers do you see...") remains the only path hazard detail takes into the CEIM report today, and it's optional and reached after the guide, not before it.

**Bring back when:** ResQKit has an actual NG112/STS channel to send a detailed hazard report through (see above). At that point, richer structured hazard capture — not just a checkbox tap the bystander already knows the answer to — becomes worth the added friction, because it's feeding a real institutional consumer (a dispatcher/responder who wasn't on scene) rather than only a local brief.

### Installing react-native-paper to run the Alexandra reference design's actual components (not a reimplementation)
The whole mobile visual revamp this session reimplemented Alexandra's design decisions (colors, spacing, card/badge shapes, button sizing) natively in our own stack (NativeWind, custom `components/ui/*` primitives, `lucide-react-native`, TypeScript) — not a literal port, because her project is built on `react-native-paper` (Material Design 3 components + its own theming system), `react-navigation` used directly, plain `StyleSheet.create`, `@expo/vector-icons`/MaterialCommunityIcons, and untyped JS — none of which our app uses today. Running her actual component files would require installing `react-native-paper` (and separately `@expo/vector-icons`, which isn't bundled with Paper despite being commonly paired with it) as a second, parallel design system alongside NativeWind — two theming mechanisms, two dark-mode implementations, kept in sync by hand indefinitely.

**Bring back when:** once the current native reimplementation is finished, if a side-by-side comparison shows it isn't a close enough match (the user's own bar: ~95-100% visual fidelity to the original), evaluate actually installing `react-native-paper` and running her screens in parallel rather than continuing to hand-reimplement. Explicit user decision, not to be done casually — this is a real architecture change (two component systems coexisting), not a styling tweak.

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

## Explicitly rejected, not deferred

Looked at and turned down — these shouldn't resurface as if still undecided:

- **Auth/login as primary navigation** (from the Alexandra reference design's side-menu + account screens) — contradicts ResQKit's local-first, no-account-required architecture for the core emergency flow.
- **Any simulated/fake version of the two hardware-blocked items above** — the standing rule (see Purpose) is to build nothing rather than something plausible-but-fake, especially for a battery/device-status claim on a safety product.
