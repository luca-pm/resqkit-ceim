/**
 * Local-first persistence for ResQKit mobile (AsyncStorage).
 *
 * Port of app/frontend/src/lib/localStore.ts. The types are kept identical to
 * the web version on purpose — they describe the same incident, the same
 * Safety Profile and the same consent record, and any drift between platforms
 * is a defect. The storage *functions* differ: AsyncStorage is async, so every
 * read returns a Promise where the web version reads localStorage synchronously
 * (see incidentContext.tsx's loading state, which exists only for this reason).
 *
 * GDPR posture (MVP §3.3): consent state, the Safety Profile, the in-flight
 * incident and retention preferences live on this device only. Nothing here is
 * uploaded. The only egress paths in the whole app are an explicit user action
 * on the handoff screen and an explicit archive action on the review screen.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

import { CONTENT_PACK_VERSION, ContextId } from './knowledge';
// Type-only: erased at compile time, so this does not create a runtime
// circular dependency even though ceim.ts imports IncidentState from here.
import type { CeimIncident } from './ceim';

const KEY_CONSENT = 'resqkit.consent.v1';
const KEY_PROFILE = 'resqkit.profile.v1';
const KEY_INCIDENT = 'resqkit.incident.v1';
const KEY_SETTINGS = 'resqkit.settings.v1';
const KEY_INSTITUTIONAL_LOG = 'resqkit.institutional_log.v1';
const KEY_CHAT_HISTORY = 'resqkit.chat_history.v1';
const KEY_RETAINED = 'resqkit.retained.v1';

/** How many institutional actions are kept for the trace view before the oldest are dropped. */
const INSTITUTIONAL_LOG_LIMIT = 100;

export interface ConsentState {
  /** Required acknowledgement that ResQKit does not replace 112. */
  disclaimerAcknowledged: boolean;
  disclaimerAt: string | null;
  /** Optional, separate explicit consent for storing health data locally. */
  healthDataConsent: boolean;
  healthDataConsentAt: string | null;
  noticeVersion: string;
}

export interface SafetyProfile {
  displayName: string;
  bloodType: string;
  allergies: string;
  conditions: string;
  medications: string;
  implants: string;
  emergencyContactName: string;
  emergencyContactPhone: string;
  /** The bystander's own spoken language, shown to paramedics — NOT the UI
   * chrome language, which is AppSettings.uiLanguage. */
  language: string;
}

export type RetentionChoice = 'session' | '24h' | '7d' | '30d';

/**
 * How long a closed incident stays on this device, in milliseconds.
 *
 * `session` is 0 — the incident is erased the moment it is closed. The others
 * keep it in KEY_RETAINED until it expires, and a sweep on every app start
 * removes anything past its date. This is what makes the retention control on
 * the review screen real: it was previously recorded and never acted on, so a
 * user who chose "keep for 7 days" still lost the incident immediately.
 *
 * Retention only ever governs the copy on this device. An incident explicitly
 * archived to an account is a separate, deliberate act and is never touched by
 * the sweep — it stays until the user deletes it.
 */
export const RETENTION_MS: Record<RetentionChoice, number> = {
  session: 0,
  '24h': 24 * 60 * 60 * 1000,
  '7d': 7 * 24 * 60 * 60 * 1000,
  '30d': 30 * 24 * 60 * 60 * 1000,
};

/** A closed incident being held on-device until its retention expires. */
export interface RetainedIncident {
  id: string;
  incident: IncidentState;
  closedAt: string;
  expiresAt: string;
  retention: RetentionChoice;
}

export interface AppSettings {
  retention: RetentionChoice;
  localCounters: boolean;
  lastContext: ContextId | null;
  /**
   * Off by default. While off, every institutional action (NG112 connection,
   * passive voice recognition, the transcript websocket, NG protocol payload
   * build) is simulated on-device only — nothing is sent to the backend.
   * Turning this on is the explicit, separate opt-in required before any of
   * that data leaves this device (see lib/institutionalActions.ts).
   */
  realDataMode: boolean;
  /** UI chrome language. `null` follows the device locale. */
  uiLanguage: 'en' | 'ro' | null;
  /** 'system' follows the OS preference; 'light'/'dark' overrides it. */
  themePreference: 'system' | 'light' | 'dark';
  /** Locally persisted only — no push backend is wired up (surfaced in the UI). */
  notifications: {
    push: boolean;
    urgentAlerts: boolean;
    expiryReminders: boolean;
  };
}

/** One entry in the institutional-actions trace (see lib/institutionalActions.ts). */
export type InstitutionalAction =
  | 'session.create'
  | 'ng112.connect'
  | 'pvr.request'
  | 'stream.connect'
  | 'stream.terminate'
  | 'triage.answer'
  | 'hazards.confirm'
  | 'kit.confirm'
  | 'procedure.step'
  | 'ng_protocol.build'
  | 'session.terminate'
  | 'interview.answer'
  | 'ceim.generate';

export interface InstitutionalLogEntry {
  id: string;
  at: string;
  action: InstitutionalAction;
  mode: 'simulated' | 'real';
  detail: string;
  ok: boolean;
}

export interface CompletedStep {
  index: number;
  title: string;
  at: string;
}

/** One answered (or left blank) AI-interview prompt — see lib/ceim.ts. */
export interface InterviewAnswer {
  promptId: string;
  promptText: string;
  answerText: string;
  answeredAt: string;
}

export interface IncidentState {
  startedAt: string;
  context: ContextId | null;
  /** Backend incident_sessions id — only ever set while real data mode is on. */
  backendSessionId: string | null;
  /** Short pairing code for the ISU dashboard demo. Only real (dashboard-connectable) when backendSessionId is a real (non "sim-") id. */
  sessionCode: string | null;
  called112: 'called' | 'already_called' | 'not_confirmed';
  latitude: number | null;
  longitude: number | null;
  accuracy: number | null;
  locationFixAt: string | null;
  locationNote: string;
  victimCount: number;
  responsive: string;
  breathing: string;
  injury: string;
  ageBand: string;
  trapped: string;
  hazards: string[];
  powertrain: string;
  kitItems: string[];
  kitSource: 'camera' | 'manual' | 'none' | null;
  procedureId: string | null;
  completedSteps: CompletedStep[];
  reporterName: string;
  reporterPhone: string;
  includeHealthData: boolean;
  contentPackVersion: string;
  /** Free-text answers from the AI scene interview — see lib/ceim.ts. Empty
   * until the interview stage runs; the two CPR-routing fields above
   * (responsive/breathing) are never derived from these. */
  interviewAnswers: InterviewAnswer[];
  interviewSkipped: boolean;
  ceimReport: CeimIncident | null;
  ceimGeneratedAt: string | null;
  ceimDegraded: boolean;
}

export const EMPTY_CONSENT: ConsentState = {
  disclaimerAcknowledged: false,
  disclaimerAt: null,
  healthDataConsent: false,
  healthDataConsentAt: null,
  noticeVersion: CONTENT_PACK_VERSION,
};

export const EMPTY_PROFILE: SafetyProfile = {
  displayName: '',
  bloodType: '',
  allergies: '',
  conditions: '',
  medications: '',
  implants: '',
  emergencyContactName: '',
  emergencyContactPhone: '',
  language: '',
};

export const DEFAULT_SETTINGS: AppSettings = {
  /**
   * Seven days by default. An incident is frequently needed after the fact —
   * an insurance claim, a workplace report, a statement — and a bystander has
   * no way to know that at the moment they close it. Erasing by default made
   * the common case unrecoverable to protect against a risk the user can
   * already remove themselves at any time from the review screen.
   */
  retention: '7d',
  localCounters: false,
  lastContext: null,
  /**
   * Development builds default this ON: simulated mode shows nothing useful
   * while building or demoing, so having to toggle it on every fresh install
   * is pure friction.
   *
   * Production builds MUST default it off. There, "local backend" is a real
   * server rather than the developer's laptop, and defaulting it on would mean
   * every incident silently creates a server-side session carrying context,
   * triage answers and location — contradicting the no-egress-by-default
   * guarantee in ResQKit_MVP_Screens_and_User_Flow.md that the app's whole
   * GDPR posture rests on. The user's explicit opt-in is the point.
   */
  realDataMode: __DEV__,
  uiLanguage: null,
  themePreference: 'system',
  notifications: {
    push: false,
    urgentAlerts: false,
    expiryReminders: false,
  },
};

export const newIncident = (): IncidentState => ({
  startedAt: new Date().toISOString(),
  context: null,
  backendSessionId: null,
  sessionCode: null,
  called112: 'not_confirmed',
  latitude: null,
  longitude: null,
  accuracy: null,
  locationFixAt: null,
  locationNote: '',
  victimCount: 1,
  responsive: '',
  breathing: '',
  injury: '',
  ageBand: '',
  trapped: '',
  hazards: [],
  powertrain: '',
  kitItems: [],
  kitSource: null,
  procedureId: null,
  completedSteps: [],
  reporterName: '',
  reporterPhone: '',
  includeHealthData: false,
  contentPackVersion: CONTENT_PACK_VERSION,
  interviewAnswers: [],
  interviewSkipped: false,
  ceimReport: null,
  ceimGeneratedAt: null,
  ceimDegraded: false,
});

/** Merge-read helper: unknown/missing keys fall back to the given defaults. */
async function read<T>(key: string, fallback: T): Promise<T> {
  try {
    const raw = await AsyncStorage.getItem(key);
    if (!raw) return fallback;
    return { ...fallback, ...(JSON.parse(raw) as T) };
  } catch {
    return fallback;
  }
}

async function write(key: string, value: unknown): Promise<void> {
  try {
    await AsyncStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* storage unavailable — the app must still function in-memory */
  }
}

async function remove(key: string): Promise<void> {
  try {
    await AsyncStorage.removeItem(key);
  } catch {
    /* ignore */
  }
}

export const loadConsent = () => read(KEY_CONSENT, EMPTY_CONSENT);
export const saveConsent = (value: ConsentState) => write(KEY_CONSENT, value);

export const loadProfile = () => read(KEY_PROFILE, EMPTY_PROFILE);
export const saveProfile = (value: SafetyProfile) => write(KEY_PROFILE, value);
export const clearProfile = () => remove(KEY_PROFILE);

export const loadSettings = () => read(KEY_SETTINGS, DEFAULT_SETTINGS);
export const saveSettings = (value: AppSettings) => write(KEY_SETTINGS, value);

export async function loadIncident(): Promise<IncidentState | null> {
  try {
    const raw = await AsyncStorage.getItem(KEY_INCIDENT);
    if (!raw) return null;
    return { ...newIncident(), ...(JSON.parse(raw) as IncidentState) };
  } catch {
    return null;
  }
}
export const saveIncident = (value: IncidentState) => write(KEY_INCIDENT, value);
export const clearIncident = () => remove(KEY_INCIDENT);

export async function loadRetainedIncidents(): Promise<RetainedIncident[]> {
  try {
    const raw = await AsyncStorage.getItem(KEY_RETAINED);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as RetainedIncident[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/**
 * Drop everything past its expiry date and persist the result.
 *
 * Called once on app start rather than from a timer: the app is not running
 * most of the time, so a background schedule would be both unreliable and
 * pointless. What matters is that expired data is never readable, and a sweep
 * before anything renders guarantees that.
 */
export async function sweepRetainedIncidents(): Promise<RetainedIncident[]> {
  const all = await loadRetainedIncidents();
  const now = Date.now();
  const live = all.filter((r) => new Date(r.expiresAt).getTime() > now);
  if (live.length !== all.length) await write(KEY_RETAINED, live);
  return live;
}

/**
 * Close the active incident, honouring the chosen retention.
 *
 * 'session' erases it outright. Anything else moves it into the retained store
 * with an expiry and clears the active slot, so the app returns to standby and
 * a new incident can be started — the retained copy is history, not something
 * still in progress.
 */
export async function closeIncidentWithRetention(
  incident: IncidentState,
  retention: RetentionChoice,
): Promise<RetainedIncident[]> {
  await clearIncident();
  if (retention === 'session') return loadRetainedIncidents();

  const now = new Date();
  const entry: RetainedIncident = {
    id: `${now.getTime()}-${Math.random().toString(36).slice(2, 8)}`,
    incident,
    closedAt: now.toISOString(),
    expiresAt: new Date(now.getTime() + RETENTION_MS[retention]).toISOString(),
    retention,
  };
  const next = [entry, ...(await loadRetainedIncidents())];
  await write(KEY_RETAINED, next);
  return next;
}

export async function deleteRetainedIncident(id: string): Promise<RetainedIncident[]> {
  const next = (await loadRetainedIncidents()).filter((r) => r.id !== id);
  await write(KEY_RETAINED, next);
  return next;
}

export const clearRetainedIncidents = () => remove(KEY_RETAINED);

export async function loadInstitutionalLog(): Promise<InstitutionalLogEntry[]> {
  try {
    const raw = await AsyncStorage.getItem(KEY_INSTITUTIONAL_LOG);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as InstitutionalLogEntry[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export async function appendInstitutionalLog(
  entries: InstitutionalLogEntry[],
  entry: InstitutionalLogEntry,
): Promise<InstitutionalLogEntry[]> {
  const next = [...entries, entry].slice(-INSTITUTIONAL_LOG_LIMIT);
  await write(KEY_INSTITUTIONAL_LOG, next);
  return next;
}

export const clearInstitutionalLog = () => remove(KEY_INSTITUTIONAL_LOG);

/** Full local erasure — backs the "Delete everything" control. */
export async function wipeAllLocalData(): Promise<void> {
  await Promise.all(
    [
      KEY_CONSENT,
      KEY_PROFILE,
      KEY_INCIDENT,
      KEY_SETTINGS,
      KEY_INSTITUTIONAL_LOG,
      KEY_CHAT_HISTORY,
      KEY_RETAINED,
    ].map((k) => remove(k)),
  );
}

export const profileHasHealthData = (p: SafetyProfile): boolean =>
  Boolean(p.bloodType || p.allergies || p.conditions || p.medications || p.implants);

export interface ChatTurn {
  role: 'user' | 'assistant';
  content: string;
}

/** Chat history lives on-device only, never sent to any server except as
 * the in-flight request body — matches the app's local-first ethos. */
export async function loadChatHistory(): Promise<ChatTurn[]> {
  try {
    const raw = await AsyncStorage.getItem(KEY_CHAT_HISTORY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as ChatTurn[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export const saveChatHistory = (turns: ChatTurn[]) => write(KEY_CHAT_HISTORY, turns);
export const clearChatHistory = () => remove(KEY_CHAT_HISTORY);
