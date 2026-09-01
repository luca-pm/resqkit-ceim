/**
 * S0 — Home / standby (RN port of app/frontend/src/pages/Index.tsx).
 *
 * The single most important action on this screen is calling 112. Everything
 * else is secondary. The emergency entry point does not gate on login: a
 * bystander must never be blocked by an auth screen at a crash site.
 */
import React from 'react';
import { Alert, Pressable, ScrollView, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import {
  Backpack,
  ChevronRight,
  Clock,
  GraduationCap,
  Phone,
  Scale,
  ShieldCheck,
  Siren,
  UserRound,
} from 'lucide-react-native';

import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { toast } from '@/components/ui/toast';
import { callEmergencyServices } from '@/components/AppShell';
import { useIncident } from '@/contexts/IncidentContext';
import { terminateInstitutionalSession } from '@/lib/institutionalActions';
import { profileHasHealthData } from '@/lib/storage';
import { useTokenColors } from '@/lib/tokenColors';

export default function HomeScreen() {
  const router = useRouter();
  const { consent, profile, incident, startIncident, settings, logInstitutional, closeIncident } =
    useIncident();
  const colors = useTokenColors();

  const beginIncident = () => {
    if (!consent.disclaimerAcknowledged) {
      router.push({ pathname: '/consent', params: { next: '/emergency' } });
      return;
    }
    if (!incident) startIncident();
    router.push('/emergency');
  };

  /**
   * Second exit from a stuck incident, mirroring handoff's "End incident".
   * This card is where being unable to start a fresh call-out is actually
   * felt — the main button reads "Resume incident" and nothing here offered
   * a way out — so the escape belongs here too, not only after handoff.
   */
  const endIncident = () => {
    if (!incident) return;
    const keeps = settings.retention !== 'session';
    Alert.alert(
      'End this incident?',
      keeps
        ? 'It will be closed and kept on this device for the retention period you chose, then deleted automatically. Open it and use Review to change that or archive it to your account.'
        : 'It will be closed and deleted from this device straight away. To keep a copy or archive it to your account, open it and use Review instead.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: keeps ? 'End incident' : 'End and delete',
          style: 'destructive',
          onPress: () => {
            void terminateInstitutionalSession(incident, settings.realDataMode, logInstitutional);
            closeIncident();
            toast.success('Incident closed. You can start a new one.');
          },
        },
      ],
    );
  };

  const shortcuts = [
    {
      to: '/profile' as const,
      icon: UserRound,
      title: 'Safety Profile',
      description: profileHasHealthData(profile)
        ? 'Stored on this device only'
        : 'Add blood type, allergies, medication',
    },
    {
      to: '/kits' as const,
      icon: Backpack,
      title: 'My Kits',
      description: 'Know what you actually carry',
    },
    {
      to: '/regulations' as const,
      icon: Scale,
      title: 'Risks & regulations',
      description: 'Sourced EU obligations, no guesswork',
    },
    {
      to: '/learn' as const,
      icon: GraduationCap,
      title: 'Learn & practise',
      description: 'Calm-time walkthrough of every procedure',
    },
  ];

  return (
    <ScrollView className="flex-1 bg-background" contentContainerClassName="gap-6 p-4 pb-10">
      <View className="rounded-lg border border-emergency/30 bg-emergency/5 p-5">
        <Text className="text-sm font-semibold uppercase tracking-wide text-emergency">
          If someone is hurt, call first
        </Text>
        <Text className="mt-2 text-2xl font-bold text-foreground">
          Call 112 before anything else
        </Text>
        <Text className="mt-2 text-sm text-muted-foreground">
          ResQKit does not contact emergency services and does not send your location to anyone. Your
          phone and network deliver caller location to the emergency service under EU rules.
        </Text>
        <View className="mt-4 gap-2">
          <Button size="lg" variant="emergency" onPress={callEmergencyServices}>
            <Phone size={20} color={colors.emergencyForeground} />
            <Text className="text-base font-semibold text-emergency-foreground">Call 112</Text>
          </Button>
          <Button size="lg" variant="secondary" onPress={beginIncident}>
            <Siren size={20} color={colors.secondaryForeground} />
            <Text className="text-base font-medium text-secondary-foreground">
              {incident ? 'Resume incident' : 'Start guided help'}
            </Text>
          </Button>
        </View>
      </View>

      {incident && (
        <Card className="border-primary/40">
          <CardContent className="flex-row items-center justify-between gap-3">
            <View className="flex-1 flex-row items-start gap-2">
              <Clock size={16} color={colors.primary} style={{ marginTop: 2 }} />
              <View className="flex-1">
                <Text className="text-sm font-semibold text-foreground">Incident in progress</Text>
                <Text className="text-xs text-muted-foreground">
                  {`Started ${new Date(incident.startedAt).toLocaleTimeString()} · kept on this device`}
                </Text>
              </View>
            </View>
            <View className="gap-2">
              <Button size="sm" onPress={() => router.push('/emergency')}>
                Continue
              </Button>
              <Button size="sm" variant="outline" onPress={endIncident}>
                End incident
              </Button>
            </View>
          </CardContent>
        </Card>
      )}

      <View>
        <Text className="mb-3 text-xl font-bold text-foreground">
          Prepare now, so you don&apos;t improvise later
        </Text>
        <View className="gap-3">
          {shortcuts.map((item) => (
            <Pressable key={item.to} onPress={() => router.push(item.to)}>
              <Card>
                <CardContent className="flex-row items-start gap-3">
                  <View className="h-10 w-10 items-center justify-center rounded-md bg-accent">
                    <item.icon size={20} color={colors.accentForeground} />
                  </View>
                  <View className="flex-1">
                    <View className="flex-row items-center justify-between gap-2">
                      <Text className="font-semibold text-foreground">{item.title}</Text>
                      <ChevronRight size={16} color={colors.mutedForeground} />
                    </View>
                    <Text className="mt-0.5 text-sm text-muted-foreground">{item.description}</Text>
                  </View>
                </CardContent>
              </Card>
            </Pressable>
          ))}
        </View>
      </View>

      <View className="rounded-lg border border-border bg-card p-4">
        <View className="flex-row items-start gap-2">
          <ShieldCheck size={16} color={colors.primary} style={{ marginTop: 2 }} />
          <Text className="flex-1 text-sm text-card-foreground">
            <Text className="font-semibold">Local-first by design.</Text> Your Safety Profile and the
            incident record stay on this device. Camera frames are analysed for object recognition
            only and are never stored or uploaded as images.
          </Text>
        </View>
      </View>
    </ScrollView>
  );
}
