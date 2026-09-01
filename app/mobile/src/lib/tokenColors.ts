/**
 * Resolved brand token colors for contexts that can't take a Tailwind class.
 *
 * NativeWind `className` covers Views and Text, but `lucide-react-native`
 * icons and a few navigation props need a literal color string. Those call
 * sites must NOT fall back to src/constants/theme.ts — that's the stock Expo
 * template palette, never updated to the brand, and the reason the tab bar
 * drifted out of sync (see Section E3 of the plan). This is the single source
 * of truth for that case, mirroring src/global.css exactly.
 *
 * Keep in sync with global.css. If a token changes there, change it here.
 */
import { useColorScheme } from 'nativewind';

export interface TokenColors {
  background: string;
  foreground: string;
  card: string;
  primary: string;
  primaryForeground: string;
  secondary: string;
  secondaryForeground: string;
  muted: string;
  mutedForeground: string;
  accent: string;
  accentForeground: string;
  destructive: string;
  destructiveForeground: string;
  /** The only reserved red — 112 / hazards / critical steps. */
  emergency: string;
  emergencyForeground: string;
  border: string;
}

export const LIGHT_COLORS: TokenColors = {
  background: 'hsl(210 30% 97%)',
  foreground: 'hsl(207 55% 14%)',
  card: 'hsl(0 0% 100%)',
  primary: 'hsl(202 74% 42%)',
  primaryForeground: 'hsl(0 0% 100%)',
  secondary: 'hsl(176 55% 32%)',
  secondaryForeground: 'hsl(0 0% 100%)',
  muted: 'hsl(210 20% 93%)',
  mutedForeground: 'hsl(207 15% 40%)',
  accent: 'hsl(140 40% 93%)',
  accentForeground: 'hsl(140 45% 20%)',
  destructive: 'hsl(207 20% 32%)',
  destructiveForeground: 'hsl(0 0% 100%)',
  emergency: 'hsl(356 72% 48%)',
  emergencyForeground: 'hsl(0 0% 100%)',
  border: 'hsl(210 20% 85%)',
};

export const DARK_COLORS: TokenColors = {
  background: 'hsl(207 45% 9%)',
  foreground: 'hsl(210 25% 92%)',
  card: 'hsl(207 40% 12%)',
  primary: 'hsl(202 80% 60%)',
  primaryForeground: 'hsl(207 55% 10%)',
  secondary: 'hsl(176 50% 45%)',
  secondaryForeground: 'hsl(207 55% 10%)',
  muted: 'hsl(207 25% 18%)',
  mutedForeground: 'hsl(210 15% 65%)',
  accent: 'hsl(140 30% 20%)',
  accentForeground: 'hsl(140 45% 80%)',
  destructive: 'hsl(207 15% 45%)',
  destructiveForeground: 'hsl(0 0% 100%)',
  emergency: 'hsl(356 80% 60%)',
  emergencyForeground: 'hsl(0 0% 100%)',
  border: 'hsl(207 25% 22%)',
};

/** Follows the same manual dark-mode toggle as every `dark:` class. */
export function useTokenColors(): TokenColors {
  const { colorScheme } = useColorScheme();
  return colorScheme === 'dark' ? DARK_COLORS : LIGHT_COLORS;
}
