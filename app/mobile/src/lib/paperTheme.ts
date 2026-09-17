/**
 * react-native-paper MD3 theme, mapped onto our existing brand tokens
 * (tokenColors.ts / global.css) rather than a second, independent palette.
 * Only the fields our ported screens actually use are overridden — the rest
 * fall through to Paper's MD3 defaults.
 */
import { MD3DarkTheme, MD3LightTheme } from 'react-native-paper';

import { DARK_COLORS, LIGHT_COLORS } from './tokenColors';

export const paperLightTheme = {
  ...MD3LightTheme,
  // Matches her theme.js's roundness: 12 exactly (her RADIUS.md) — governs
  // the corner radius Paper's own components (Button, Card, TextInput, etc.)
  // derive their border-radius from.
  roundness: 12,
  colors: {
    ...MD3LightTheme.colors,
    primary: LIGHT_COLORS.primary,
    onPrimary: LIGHT_COLORS.primaryForeground,
    secondary: LIGHT_COLORS.secondary,
    onSecondary: LIGHT_COLORS.secondaryForeground,
    background: LIGHT_COLORS.background,
    onBackground: LIGHT_COLORS.foreground,
    surface: LIGHT_COLORS.card,
    onSurface: LIGHT_COLORS.foreground,
    surfaceVariant: LIGHT_COLORS.muted,
    onSurfaceVariant: LIGHT_COLORS.mutedForeground,
    error: LIGHT_COLORS.emergency,
    onError: LIGHT_COLORS.emergencyForeground,
    outline: LIGHT_COLORS.border,
  },
};

export const paperDarkTheme = {
  ...MD3DarkTheme,
  roundness: 12,
  colors: {
    ...MD3DarkTheme.colors,
    primary: DARK_COLORS.primary,
    onPrimary: DARK_COLORS.primaryForeground,
    secondary: DARK_COLORS.secondary,
    onSecondary: DARK_COLORS.secondaryForeground,
    background: DARK_COLORS.background,
    onBackground: DARK_COLORS.foreground,
    surface: DARK_COLORS.card,
    onSurface: DARK_COLORS.foreground,
    surfaceVariant: DARK_COLORS.muted,
    onSurfaceVariant: DARK_COLORS.mutedForeground,
    error: DARK_COLORS.emergency,
    onError: DARK_COLORS.emergencyForeground,
    outline: DARK_COLORS.border,
  },
};
