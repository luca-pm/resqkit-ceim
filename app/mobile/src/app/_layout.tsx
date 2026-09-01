import { DarkTheme, DefaultTheme, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useColorScheme } from 'nativewind';

import { AnimatedSplashOverlay } from '@/components/animated-icon';
import AppShell from '@/components/AppShell';
import AppTabs from '@/components/app-tabs';
import { ToastProvider } from '@/components/ui/toast';
import { AuthProvider } from '@/contexts/AuthContext';
import { IncidentProvider } from '@/contexts/IncidentContext';
import { SettingsProvider } from '@/contexts/SettingsContext';

import '../global.css';
import '../lib/i18n';

SplashScreen.preventAutoHideAsync();

export default function TabLayout() {
  // nativewind's useColorScheme (not react-native's) so React Navigation's
  // chrome theme follows the same manual dark-mode toggle as everything
  // else, not just the OS preference. See Section E3 of the plan.
  const { colorScheme } = useColorScheme();
  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <SettingsProvider>
        <AuthProvider>
          {/* IncidentProvider composes SettingsContext, so it must sit inside it. */}
          <IncidentProvider>
            <AnimatedSplashOverlay />
            {/* AppShell holds the persistent 112 header/banner above the tab
                navigator, so guardrail 1 can't be navigated away from. */}
            <ToastProvider>
              <AppShell>
                <AppTabs />
              </AppShell>
            </ToastProvider>
          </IncidentProvider>
        </AuthProvider>
      </SettingsProvider>
    </ThemeProvider>
  );
}
