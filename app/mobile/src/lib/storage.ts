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

const KEY_CONSENT = 'resqkit.consent.v1';
const KEY_PROFILE = 'resqkit.profile.v1';
const KEY_INCIDENT = 'resqkit.incident.v1';
const KEY_SETTINGS = 'resqkit.settings.v1';
const KEY_INSTITUTIONAL_LOG = 'resqkit.institutional_log.v1';
const KEY_CHAT_HISTORY = 'resqkit.chat_history.v1';

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

export type RetentionChoice = 'session' | '24h' | '7d';

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
  | 'session.terminate';

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
  retention: 'session',
  localCounters: false,
  lastContext: null,
  realDataMode: false,
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
    [KEY_CONSENT, KEY_PROFILE, KEY_INCIDENT, KEY_SETTINGS, KEY_INSTITUTIONAL_LOG, KEY_CHAT_HISTORY].map(
      (k) => remove(k),
    ),
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
