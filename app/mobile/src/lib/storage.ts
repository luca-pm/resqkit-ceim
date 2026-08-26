/**
 * Minimal AsyncStorage-backed settings, scoped to what the Section E screens
 * need (uiLanguage, dark mode, local-only chat history). This is
 * deliberately NOT a full port of app/frontend/src/lib/localStore.ts — the
 * Emergency wizard's IncidentState/InstitutionalLogEntry etc. belong to
 * Section C's own migration, not this slice. See Section E6 of the plan.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY_SETTINGS = 'resqkit.settings.v1';
const KEY_CHAT_HISTORY = 'resqkit.chat_history.v1';

export interface AppSettings {
  /** UI chrome language. `null` follows the device locale. */
  uiLanguage: 'en' | 'ro' | null;
  /** 'system' follows the OS preference; 'light'/'dark' overrides it. */
  themePreference: 'system' | 'light' | 'dark';
}

export const DEFAULT_SETTINGS: AppSettings = {
  uiLanguage: null,
  themePreference: 'system',
};

export async function loadSettings(): Promise<AppSettings> {
  try {
    const raw = await AsyncStorage.getItem(KEY_SETTINGS);
    if (!raw) return DEFAULT_SETTINGS;
    return { ...DEFAULT_SETTINGS, ...(JSON.parse(raw) as Partial<AppSettings>) };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export async function saveSettings(value: AppSettings): Promise<void> {
  try {
    await AsyncStorage.setItem(KEY_SETTINGS, JSON.stringify(value));
  } catch {
    /* storage unavailable — the app must still function in-memory */
  }
}

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

export async function saveChatHistory(turns: ChatTurn[]): Promise<void> {
  try {
    await AsyncStorage.setItem(KEY_CHAT_HISTORY, JSON.stringify(turns));
  } catch {
    /* ignore */
  }
}

export async function clearChatHistory(): Promise<void> {
  try {
    await AsyncStorage.removeItem(KEY_CHAT_HISTORY);
  } catch {
    /* ignore */
  }
}
