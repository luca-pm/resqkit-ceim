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
  wipeAllLocalData,
} from './localStore';

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
  discardIncident: () => void;
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
  const [online, setOnline] = useState<boolean>(
    typeof navigator === 'undefined' ? true : navigator.onLine,
  );

  useEffect(() => {
    setConsent(loadConsent());
    setProfile(loadProfile());
    setSettings(loadSettings());
    setIncident(loadIncident());
    setInstitutionalLog(loadInstitutionalLog());
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