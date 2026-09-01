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
const KEY_RETAINED = 'resqkit.retained.v1';
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

export type RetentionChoice = 'session' | '24h' | '7d' | '30d';

/**
 * How long a closed incident stays in this browser, in milliseconds.
 * Mirrors app/mobile/src/lib/storage.ts — the retention promise must mean the
 * same thing on both platforms. `session` is 0: erased the moment it closes.
 * Retention governs only the local copy; an incident archived to an account is
 * a separate deliberate act and is never swept.
 */
export const RETENTION_MS: Record<RetentionChoice, number> = {
  session: 0,
  '24h': 24 * 60 * 60 * 1000,
  '7d': 7 * 24 * 60 * 60 * 1000,
  '30d': 30 * 24 * 60 * 60 * 1000,
};

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
  /**
   * UI chrome language — distinct from `SafetyProfile.language` (the
   * bystander's own spoken language, shown to paramedics). `null` follows
   * the device/browser locale.
   */
  uiLanguage: 'en' | 'ro' | null;
  /** 'system' follows the OS/browser preference; 'light'/'dark' overrides it. */
  themePreference: 'system' | 'light' | 'dark';
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
  // Seven days by default: an incident is frequently needed after the fact
  // (insurance claim, workplace report) and the user cannot know that at the
  // moment they close it. Mirrors app/mobile/src/lib/storage.ts.
  retention: '7d',
  localCounters: false,
  lastContext: null,
  realDataMode: false,
  uiLanguage: null,
  themePreference: 'system',
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

export const loadRetainedIncidents = (): RetainedIncident[] => {
  try {
    const raw = window.localStorage.getItem(KEY_RETAINED);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as RetainedIncident[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

/** Drop everything past its expiry. Runs on load, before anything renders. */
export const sweepRetainedIncidents = (): RetainedIncident[] => {
  const all = loadRetainedIncidents();
  const live = all.filter((r) => new Date(r.expiresAt).getTime() > Date.now());
  if (live.length !== all.length) write(KEY_RETAINED, live);
  return live;
};

/**
 * Close the active incident, honouring the chosen retention: 'session' erases
 * it, anything else moves it to the retained store with an expiry and frees
 * the active slot so a new incident can start.
 */
export const closeIncidentWithRetention = (
  incident: IncidentState,
  retention: RetentionChoice,
): RetainedIncident[] => {
  clearIncident();
  if (retention === 'session') return loadRetainedIncidents();

  const now = new Date();
  const entry: RetainedIncident = {
    id: `${now.getTime()}-${Math.random().toString(36).slice(2, 8)}`,
    incident,
    closedAt: now.toISOString(),
    expiresAt: new Date(now.getTime() + RETENTION_MS[retention]).toISOString(),
    retention,
  };
  const next = [entry, ...loadRetainedIncidents()];
  write(KEY_RETAINED, next);
  return next;
};

export const deleteRetainedIncident = (id: string): RetainedIncident[] => {
  const next = loadRetainedIncidents().filter((r) => r.id !== id);
  write(KEY_RETAINED, next);
  return next;
};

/** Full local erasure — backs the "Delete everything" control. */
export const wipeAllLocalData = () => {
  [KEY_CONSENT, KEY_PROFILE, KEY_INCIDENT, KEY_SETTINGS, KEY_INSTITUTIONAL_LOG, KEY_RETAINED].forEach((k) => {
    try {
      window.localStorage.removeItem(k);
    } catch {
      /* ignore */
    }
  });
};

export const profileHasHealthData = (p: SafetyProfile): boolean =>
  Boolean(p.bloodType || p.allergies || p.conditions || p.medications || p.implants);