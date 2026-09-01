/**
 * Global shell (RN port of app/frontend/src/components/AppShell.tsx).
 *
 * Enforces MVP guardrail 1: once an incident is running and the 112 call has
 * not been confirmed, a non-dismissible dialler banner stays visible for the
 * rest of the session.
 *
 * Mobile difference: the 112 action is `Linking.openURL('tel:112')`, which
 * hands off to the OS dialler and SUSPENDS this app (a browser tab merely
 * loses focus). Anything time-sensitive — the CPR metronome, an open
 * websocket — has to survive that, which is why AppState handling exists
 * (see lib/useAppStateResume.ts) rather than being an afterthought.
 */
import React from 'react';
import { Linking, Pressable, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { usePathname, useRouter } from 'expo-router';
import { LifeBuoy, Phone, Settings as SettingsIcon, ShieldAlert, WifiOff } from 'lucide-react-native';

import { useIncident } from '@/contexts/IncidentContext';
import { useTokenColors } from '@/lib/tokenColors';

/** Single choke point for dialling 112, so every call site behaves identically. */
export function callEmergencyServices(): void {
  void Linking.openURL('tel:112');
}

const AppShell: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { incident, online } = useIncident();
  const pathname = usePathname();
  const router = useRouter();
  const colors = useTokenColors();

  const showCallBanner =
    Boolean(incident) && incident?.called112 === 'not_confirmed' && pathname !== '/consent';

  return (
    <SafeAreaView edges={['top']} className="flex-1 bg-background">
      <View className="flex-row items-center justify-between gap-3 border-b border-border px-4 py-3">
        <Pressable className="flex-row items-center gap-2" onPress={() => router.push('/')}>
          <View className="h-9 w-9 items-center justify-center rounded-md bg-primary">
            <LifeBuoy size={20} color={colors.primaryForeground} />
          </View>
          <View>
            <Text className="text-lg font-bold text-foreground">ResQKit</Text>
            <Text className="text-xs text-muted-foreground">Assists. Does not replace 112.</Text>
          </View>
        </Pressable>

        <View className="flex-row items-center gap-2">
          {!online && (
            <View className="flex-row items-center gap-1 rounded-md bg-muted px-2 py-1">
              <WifiOff size={14} color={colors.mutedForeground} />
              <Text className="text-xs text-muted-foreground">Offline</Text>
            </View>
          )}
          <Pressable
            accessibilityLabel="Settings"
            hitSlop={8}
            onPress={() => router.push('/settings')}
            className="p-1.5"
          >
            <SettingsIcon size={18} color={colors.foreground} />
          </Pressable>
          <Pressable
            accessibilityLabel="Call 112"
            onPress={callEmergencyServices}
            className="flex-row items-center gap-1.5 rounded-md bg-emergency px-3 py-2"
          >
            <Phone size={16} color={colors.emergencyForeground} />
            <Text className="text-sm font-semibold text-emergency-foreground">112</Text>
          </Pressable>
        </View>
      </View>

      {showCallBanner && (
        <View className="gap-2 border-b border-emergency/40 bg-emergency/10 px-4 py-3">
          <View className="flex-row items-start gap-2">
            <ShieldAlert size={16} color={colors.emergency} style={{ marginTop: 2 }} />
            <Text className="flex-1 text-sm text-foreground">
              <Text className="font-semibold">112 not confirmed.</Text> ResQKit does not contact
              emergency services for you.
            </Text>
          </View>
          <Pressable
            onPress={callEmergencyServices}
            className="items-center rounded-md bg-emergency px-3 py-2"
          >
            <Text className="text-sm font-semibold text-emergency-foreground">Call 112 now</Text>
          </Pressable>
        </View>
      )}

      {children}
    </SafeAreaView>
  );
};

export default AppShell;
