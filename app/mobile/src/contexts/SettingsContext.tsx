import React, { createContext, useContext, useEffect, useState, useCallback, ReactNode } from 'react';
import { AppSettings, DEFAULT_SETTINGS, loadSettings, saveSettings } from '@/lib/storage';
import { applyUiLanguage } from '@/lib/i18n';

interface SettingsContextType {
  settings: AppSettings;
  ready: boolean;
  updateSettings: (patch: Partial<AppSettings>) => void;
}

const SettingsContext = createContext<SettingsContextType | null>(null);

export const useSettings = () => {
  const context = useContext(SettingsContext);
  if (!context) throw new Error('useSettings must be used within a SettingsProvider');
  return context;
};

export const SettingsProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    void (async () => {
      const loaded = await loadSettings();
      setSettings(loaded);
      applyUiLanguage(loaded.uiLanguage);
      setReady(true);
    })();
  }, []);

  const updateSettings = useCallback((patch: Partial<AppSettings>) => {
    setSettings((prev) => {
      const next = { ...prev, ...patch };
      void saveSettings(next);
      if (patch.uiLanguage !== undefined) applyUiLanguage(patch.uiLanguage);
      return next;
    });
  }, []);

  return (
    <SettingsContext.Provider value={{ settings, ready, updateSettings }}>{children}</SettingsContext.Provider>
  );
};
