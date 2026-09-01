/**
 * Shared incident session state (RN port of app/frontend/src/lib/incidentContext.tsx).
 *
 * Holds the in-flight incident, consent state, Safety Profile and the
 * institutional-actions trace, mirroring every mutation into AsyncStorage so
 * the emergency flow survives an app restart and works fully offline.
 *
 * Two deliberate differences from the web version:
 *
 * 1. AsyncStorage is async, so the initial hydrate happens in an effect and
 *    `ready` stays false until it lands. Screens must not render incident data
 *    before `ready` — on web the equivalent read was synchronous and this
 *    window did not exist.
 * 2. Settings are NOT duplicated here. SettingsContext (built in Section E6)
 *    already owns them, so this provider composes it and re-exposes
 *    `settings`/`updateSettings` — that keeps screen code ported from web
 *    (`const { incident, settings } = useIncident()`) working unchanged while
 *    keeping a single source of truth.
 */
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useNetworkState } from 'expo-network';

import {
  AppSettings,
  ConsentState,
  EMPTY_CONSENT,
  EMPTY_PROFILE,
  IncidentState,
  InstitutionalLogEntry,
  RetainedIncident,
  SafetyProfile,
  appendInstitutionalLog,
  clearIncident,
  clearInstitutionalLog,
  clearProfile,
  closeIncidentWithRetention,
  deleteRetainedIncident,
  loadConsent,
  loadIncident,
  loadInstitutionalLog,
  loadProfile,
  newIncident,
  saveConsent,
  saveIncident,
  saveProfile,
  sweepRetainedIncidents,
  wipeAllLocalData,
} from '@/lib/storage';
import { useSettings } from './SettingsContext';

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
  const { settings, ready: settingsReady, updateSettings } = useSettings();

  const [hydrated, setHydrated] = useState(false);
  const [consent, setConsent] = useState<ConsentState>(EMPTY_CONSENT);
  const [profile, setProfile] = useState<SafetyProfile>(EMPTY_PROFILE);
  const [incident, setIncident] = useState<IncidentState | null>(null);
  const [institutionalLog, setInstitutionalLog] = useState<InstitutionalLogEntry[]>([]);
  const [retained, setRetained] = useState<RetainedIncident[]>([]);

  const networkState = useNetworkState();
  // Treat "unknown" as online: a false offline banner during an emergency is
  // worse than a missing one, and the app works offline regardless.
  const online = networkState.isInternetReachable ?? networkState.isConnected ?? true;

  useEffect(() => {
    void (async () => {
      // The sweep runs before anything renders, so an expired incident is
      // never readable even for a frame.
      const [loadedConsent, loadedProfile, loadedIncident, loadedLog, liveRetained] =
        await Promise.all([
          loadConsent(),
          loadProfile(),
          loadIncident(),
          loadInstitutionalLog(),
          sweepRetainedIncidents(),
        ]);
      setConsent(loadedConsent);
      setProfile(loadedProfile);
      setIncident(loadedIncident);
      setInstitutionalLog(loadedLog);
      setRetained(liveRetained);
      setHydrated(true);
    })();
  }, []);

  const updateConsent = useCallback((patch: Partial<ConsentState>) => {
    setConsent((prev) => {
      const next = { ...prev, ...patch };
      void saveConsent(next);
      return next;
    });
  }, []);

  const updateProfile = useCallback((patch: Partial<SafetyProfile>) => {
    setProfile((prev) => {
      const next = { ...prev, ...patch };
      void saveProfile(next);
      return next;
    });
  }, []);

  const deleteProfile = useCallback(() => {
    void clearProfile();
    setProfile(EMPTY_PROFILE);
  }, []);

  const startIncident = useCallback(() => {
    const fresh = newIncident();
    void saveIncident(fresh);
    setIncident(fresh);
    return fresh;
  }, []);

  const updateIncident = useCallback((patch: Partial<IncidentState>) => {
    setIncident((prev) => {
      const base = prev ?? newIncident();
      const next = { ...base, ...patch };
      void saveIncident(next);
      return next;
    });
  }, []);

  const discardIncident = useCallback(() => {
    void clearIncident();
    setIncident(null);
  }, []);

  const closeIncident = useCallback(() => {
    setIncident((prev) => {
      if (prev) {
        void closeIncidentWithRetention(prev, settings.retention).then(setRetained);
      }
      return null;
    });
  }, [settings.retention]);

  const deleteRetained = useCallback((id: string) => {
    void deleteRetainedIncident(id).then(setRetained);
  }, []);

  const wipeEverything = useCallback(() => {
    void wipeAllLocalData();
    setConsent(EMPTY_CONSENT);
    setProfile(EMPTY_PROFILE);
    setIncident(null);
    setInstitutionalLog([]);
    setRetained([]);
  }, []);

  const logInstitutional = useCallback((entry: Omit<InstitutionalLogEntry, 'id' | 'at'>) => {
    const full: InstitutionalLogEntry = {
      ...entry,
      id: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
      at: new Date().toISOString(),
    };
    setInstitutionalLog((prev) => {
      const next = [...prev, full].slice(-100);
      // Persist against the same list we just derived, so a burst of calls in
      // one tick can't race each other into a stale write.
      void appendInstitutionalLog(prev, full);
      return next;
    });
  }, []);

  const clearInstitutionalLogCallback = useCallback(() => {
    void clearInstitutionalLog();
    setInstitutionalLog([]);
  }, []);

  const value = useMemo<IncidentContextValue>(
    () => ({
      ready: hydrated && settingsReady,
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
      hydrated,
      settingsReady,
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
