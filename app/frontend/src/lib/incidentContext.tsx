/**
 * Shared incident session state.
 *
 * Holds the in-flight incident, consent state, Safety Profile and settings,
 * mirroring every mutation into localStorage so the emergency flow survives a
 * reload and works fully offline.
 */

import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import {
  AppSettings,
  ConsentState,
  DEFAULT_SETTINGS,
  EMPTY_CONSENT,
  EMPTY_PROFILE,
  IncidentState,
  InstitutionalLogEntry,
  SafetyProfile,
  appendInstitutionalLog,
  clearIncident,
  clearInstitutionalLog,
  clearProfile,
  loadConsent,
  loadIncident,
  loadInstitutionalLog,
  loadProfile,
  loadSettings,
  newIncident,
  saveConsent,
  saveIncident,
  saveProfile,
  saveSettings,
  RetainedIncident,
  closeIncidentWithRetention,
  deleteRetainedIncident,
  sweepRetainedIncidents,
  wipeAllLocalData,
} from './localStore';
import { applyUiLanguage } from './i18n';

interface IncidentContextValue {
  ready: boolean;
  consent: ConsentState;
  profile: SafetyProfile;
  settings: AppSettings;
  incident: IncidentState | null;
  online: boolean;
  institutionalLog: InstitutionalLogEntry[];
  updateConsent: (patch: Partial<ConsentState>) => void;
  updateProfile: (patch: Partial<SafetyProfile>) => void;
  deleteProfile: () => void;
  updateSettings: (patch: Partial<AppSettings>) => void;
  startIncident: () => IncidentState;
  updateIncident: (patch: Partial<IncidentState>) => void;
  /** Erase the active incident outright, ignoring retention. */
  discardIncident: () => void;
  /** Close the active incident, keeping a copy for as long as settings.retention says. */
  closeIncident: () => void;
  /** Closed incidents still inside their retention window, newest first. */
  retained: RetainedIncident[];
  deleteRetained: (id: string) => void;
  wipeEverything: () => void;
  logInstitutional: (entry: Omit<InstitutionalLogEntry, 'id' | 'at'>) => void;
  clearInstitutionalLog: () => void;
}

const IncidentContext = createContext<IncidentContextValue | null>(null);

export const IncidentProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [ready, setReady] = useState(false);
  const [consent, setConsent] = useState<ConsentState>(EMPTY_CONSENT);
  const [profile, setProfile] = useState<SafetyProfile>(EMPTY_PROFILE);
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [incident, setIncident] = useState<IncidentState | null>(null);
  const [institutionalLog, setInstitutionalLog] = useState<InstitutionalLogEntry[]>([]);
  const [retained, setRetained] = useState<RetainedIncident[]>([]);
  const [online, setOnline] = useState<boolean>(
    typeof navigator === 'undefined' ? true : navigator.onLine,
  );

  useEffect(() => {
    setConsent(loadConsent());
    setProfile(loadProfile());
    const loadedSettings = loadSettings();
    setSettings(loadedSettings);
    applyUiLanguage(loadedSettings.uiLanguage);
    setIncident(loadIncident());
    setInstitutionalLog(loadInstitutionalLog());
    // Sweep before anything renders, so an expired incident is never readable.
    setRetained(sweepRetainedIncidents());
    setReady(true);
  }, []);

  useEffect(() => {
    const up = () => setOnline(true);
    const down = () => setOnline(false);
    window.addEventListener('online', up);
    window.addEventListener('offline', down);
    return () => {
      window.removeEventListener('online', up);
      window.removeEventListener('offline', down);
    };
  }, []);

  const updateConsent = useCallback((patch: Partial<ConsentState>) => {
    setConsent((prev) => {
      const next = { ...prev, ...patch };
      saveConsent(next);
      return next;
    });
  }, []);

  const updateProfile = useCallback((patch: Partial<SafetyProfile>) => {
    setProfile((prev) => {
      const next = { ...prev, ...patch };
      saveProfile(next);
      return next;
    });
  }, []);

  const deleteProfile = useCallback(() => {
    clearProfile();
    setProfile(EMPTY_PROFILE);
  }, []);

  const updateSettings = useCallback((patch: Partial<AppSettings>) => {
    setSettings((prev) => {
      const next = { ...prev, ...patch };
      saveSettings(next);
      if (patch.uiLanguage !== undefined) applyUiLanguage(patch.uiLanguage);
      return next;
    });
  }, []);

  const startIncident = useCallback(() => {
    const fresh = newIncident();
    saveIncident(fresh);
    setIncident(fresh);
    return fresh;
  }, []);

  const updateIncident = useCallback((patch: Partial<IncidentState>) => {
    setIncident((prev) => {
      const base = prev ?? newIncident();
      const next = { ...base, ...patch };
      saveIncident(next);
      return next;
    });
  }, []);

  const discardIncident = useCallback(() => {
    clearIncident();
    setIncident(null);
  }, []);

  const closeIncident = useCallback(() => {
    setIncident((prev) => {
      if (prev) setRetained(closeIncidentWithRetention(prev, settings.retention));
      return null;
    });
  }, [settings.retention]);

  const deleteRetained = useCallback((id: string) => {
    setRetained(deleteRetainedIncident(id));
  }, []);

  const wipeEverything = useCallback(() => {
    wipeAllLocalData();
    setConsent(EMPTY_CONSENT);
    setProfile(EMPTY_PROFILE);
    setSettings(DEFAULT_SETTINGS);
    setIncident(null);
    setInstitutionalLog([]);
  }, []);

  const logInstitutional = useCallback((entry: Omit<InstitutionalLogEntry, 'id' | 'at'>) => {
    setInstitutionalLog((prev) =>
      appendInstitutionalLog(prev, {
        ...entry,
        id: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
        at: new Date().toISOString(),
      }),
    );
  }, []);

  const clearInstitutionalLogCallback = useCallback(() => {
    clearInstitutionalLog();
    setInstitutionalLog([]);
  }, []);

  const value = useMemo<IncidentContextValue>(
    () => ({
      ready,
      consent,
      profile,
      settings,
      incident,
      online,
      institutionalLog,
      updateConsent,
      updateProfile,
      deleteProfile,
      updateSettings,
      startIncident,
      updateIncident,
      discardIncident,
      closeIncident,
      retained,
      deleteRetained,
      wipeEverything,
      logInstitutional,
      clearInstitutionalLog: clearInstitutionalLogCallback,
    }),
    [
      ready,
      consent,
      profile,
      settings,
      incident,
      online,
      institutionalLog,
      updateConsent,
      updateProfile,
      deleteProfile,
      updateSettings,
      startIncident,
      updateIncident,
      discardIncident,
      closeIncident,
      retained,
      deleteRetained,
      wipeEverything,
      logInstitutional,
      clearInstitutionalLogCallback,
    ],
  );

  return <IncidentContext.Provider value={value}>{children}</IncidentContext.Provider>;
};

export const useIncident = (): IncidentContextValue => {
  const ctx = useContext(IncidentContext);
  if (!ctx) throw new Error('useIncident must be used inside IncidentProvider');
  return ctx;
};