/**
 * Local-first persistence for ResQKit.
 *
 * GDPR posture (MVP §3.3): the app is local-first. Consent state, the Safety
 * Profile, the in-flight incident and retention preferences live in
 * localStorage on this device only. Nothing here is uploaded. The only egress
 * path in the whole app is an explicit user action on the handoff screen or an
 * explicit archive action on the review screen.
 */

import { CONTENT_PACK_VERSION, ContextId } from './knowledge';

const KEY_CONSENT = 'resqkit.consent.v1';
const KEY_PROFILE = 'resqkit.profile.v1';
const KEY_INCIDENT = 'resqkit.incident.v1';
const KEY_SETTINGS = 'resqkit.settings.v1';
const KEY_INSTITUTIONAL_LOG = 'resqkit.institutional_log.v1';

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
  /** Backend incident_sessions id — only ever set while Real data mode is on. */
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

const read = <T,>(key: string, fallback: T): T => {
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return fallback;
    return { ...fallback, ...(JSON.parse(raw) as T) };
  } catch {
    return fallback;
  }
};

const write = (key: string, value: unknown) => {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* storage unavailable — the app must still function in-memory */
  }
};

export const loadConsent = (): ConsentState => read(KEY_CONSENT, EMPTY_CONSENT);
export const saveConsent = (value: ConsentState) => write(KEY_CONSENT, value);

export const loadProfile = (): SafetyProfile => read(KEY_PROFILE, EMPTY_PROFILE);
export const saveProfile = (value: SafetyProfile) => write(KEY_PROFILE, value);
export const clearProfile = () => window.localStorage.removeItem(KEY_PROFILE);

export const loadSettings = (): AppSettings => read(KEY_SETTINGS, DEFAULT_SETTINGS);
export const saveSettings = (value: AppSettings) => write(KEY_SETTINGS, value);

export const loadIncident = (): IncidentState | null => {
  try {
    const raw = window.localStorage.getItem(KEY_INCIDENT);
    if (!raw) return null;
    return { ...newIncident(), ...(JSON.parse(raw) as IncidentState) };
  } catch {
    return null;
  }
};
export const saveIncident = (value: IncidentState) => write(KEY_INCIDENT, value);

export const loadInstitutionalLog = (): InstitutionalLogEntry[] => {
  try {
    const raw = window.localStorage.getItem(KEY_INSTITUTIONAL_LOG);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as InstitutionalLogEntry[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};
export const appendInstitutionalLog = (
  entries: InstitutionalLogEntry[],
  entry: InstitutionalLogEntry,
): InstitutionalLogEntry[] => {
  const next = [...entries, entry].slice(-INSTITUTIONAL_LOG_LIMIT);
  write(KEY_INSTITUTIONAL_LOG, next);
  return next;
};
export const clearInstitutionalLog = () => window.localStorage.removeItem(KEY_INSTITUTIONAL_LOG);
export const clearIncident = () => window.localStorage.removeItem(KEY_INCIDENT);

/** Full local erasure — backs the "Delete everything" control. */
export const wipeAllLocalData = () => {
  [KEY_CONSENT, KEY_PROFILE, KEY_INCIDENT, KEY_SETTINGS, KEY_INSTITUTIONAL_LOG].forEach((k) => {
    try {
      window.localStorage.removeItem(k);
    } catch {
      /* ignore */
    }
  });
};

export const profileHasHealthData = (p: SafetyProfile): boolean =>
  Boolean(p.bloodType || p.allergies || p.conditions || p.medications || p.implants);