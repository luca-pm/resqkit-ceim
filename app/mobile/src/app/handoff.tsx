/**
 * S9 — Rescuer handoff (RN port of app/frontend/src/pages/Handoff.tsx).
 *
 * The written brief is composed deterministically on-device and is complete on
 * its own. The optional spoken version is generated server-side from that exact
 * text and is clearly labelled; if it fails, the written brief remains fully
 * usable.
 *
 * Mobile difference: "Share" is the OS share sheet (React Native's Share API)
 * rather than the web's navigator.share-with-clipboard-fallback. That's a real
 * UX change, not a hidden equivalent — the crew can receive the brief through
 * any installed app, and there is no silent download path.
 */
import React, { useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, Share, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import * as Clipboard from 'expo-clipboard';
import { CheckCircle2, Copy, Radio, Share2, Sparkles, Volume2 } from 'lucide-react-native';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from '@/components/ui/toast';
import { useIncident } from '@/contexts/IncidentContext';
import { client } from '@/lib/apiClient';
import { buildBrief } from '@/lib/brief';
import { buildNgProtocolPayload, terminateInstitutionalSession } from '@/lib/institutionalActions';
import { RESPONDER_PRIORITIES } from '@/lib/knowledge';
import { profileHasHealthData } from '@/lib/storage';
import { useTokenColors } from '@/lib/tokenColors';

export default function HandoffScreen() {
  const router = useRouter();
  const {
    incident,
    profile,
    consent,
    updateIncident,
    settings,
    logInstitutional,
    discardIncident,
    startIncident,
  } = useIncident();
  const colors = useTokenColors();

  const [includeHealth, setIncludeHealth] = useState(false);
  const [includeReporter, setIncludeReporter] = useState(false);
  const [spoken, setSpoken] = useState('');
  const [narrating, setNarrating] = useState(false);
  const [buildingNgPayload, setBuildingNgPayload] = useState(false);

  const brief = useMemo(() => {
    if (!incident) return '';
    return buildBrief(incident, profile, { includeHealth, includeReporter });
  }, [incident, profile, includeHealth, includeReporter]);

  if (!incident) {
    return (
      <ScrollView className="flex-1 bg-background" contentContainerClassName="p-4">
        <Card>
          <CardContent className="p-5">
            <Text className="text-sm text-muted-foreground">
              There is no active incident to hand over.
            </Text>
            <Button className="mt-3" onPress={() => router.replace('/')}>
              Back to start
            </Button>
          </CardContent>
        </Card>
      </ScrollView>
    );
  }

  const healthAvailable = consent.healthDataConsent && profileHasHealthData(profile);

  const copyBrief = async () => {
    try {
      await Clipboard.setStringAsync(brief);
      toast.success('Brief copied.');
    } catch {
      toast.error('Could not copy. Show the screen instead.');
    }
  };

  const shareBrief = async () => {
    updateIncident({ includeHealthData: includeHealth });
    try {
      await Share.share({ message: brief });
    } catch {
      // User dismissing the sheet lands here too — fall back to the clipboard
      // rather than reporting a failure they didn't experience.
      await copyBrief();
    }
  };

  const startNewIncident = () => {
    void terminateInstitutionalSession(incident, settings.realDataMode, logInstitutional);
    discardIncident();
    startIncident();
    toast.success('New incident started. The previous one was discarded without review.');
    router.replace('/emergency');
  };

  /**
   * Closes the incident for good and returns to standby.
   *
   * This is the exit the handoff screen was missing. Without it the only way
   * out ran through "Review and delete data", which reads as a data-rights
   * screen rather than "I'm finished here" — so an incident stayed open,
   * Home offered only "Resume incident", and a second call-out could not be
   * started at all.
   *
   * Known gap, consistent with the rest of the app: RetentionChoice is
   * recorded but never enforced anywhere, so closing always deletes now
   * rather than honouring a 24h/7d choice. The confirmation text therefore
   * says plainly that it deletes, instead of implying a scheduled sweep that
   * does not exist.
   */
  const endIncident = () => {
    Alert.alert(
      'End this incident?',
      'It will be closed and deleted from this device. If you want to keep a copy or archive it to your account, review it first.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Review first', onPress: () => router.push('/review') },
        {
          text: 'End and delete',
          style: 'destructive',
          onPress: () => {
            void terminateInstitutionalSession(incident, settings.realDataMode, logInstitutional);
            discardIncident();
            toast.success('Incident closed and deleted from this device.');
            router.replace('/');
          },
        },
      ],
    );
  };

  const narrate = async () => {
    setNarrating(true);
    try {
      const response = await client.apiCall.invoke<{ spoken: string }>({
        url: '/api/v1/resqkit/polish_brief',
        method: 'POST',
        data: { brief_text: brief },
      });
      setSpoken(response.data.spoken);
    } catch (e: unknown) {
      const err = e as { data?: { detail?: string }; message?: string };
      toast.error(
        err?.data?.detail || err?.message || 'Spoken version unavailable. Read the written brief.',
      );
    } finally {
      setNarrating(false);
    }
  };

  return (
    <ScrollView className="flex-1 bg-background" contentContainerClassName="gap-5 p-4 pb-10">
      <View>
        <Text className="text-2xl font-bold text-foreground">Hand over to the crew</Text>
        <Text className="mt-2 text-sm text-muted-foreground">
          Ordered the way rescuers ask for it:{' '}
          {RESPONDER_PRIORITIES.slice(0, 4).join(', ').toLowerCase()}, then medical history and what
          you already did.
        </Text>
      </View>

      <Card>
        <CardContent className="gap-3">
          <Text className="font-semibold text-foreground">What to include</Text>

          <Pressable
            onPress={() => healthAvailable && setIncludeHealth(!includeHealth)}
            className="flex-row items-start gap-3"
          >
            <Checkbox
              checked={includeHealth}
              disabled={!healthAvailable}
              onCheckedChange={setIncludeHealth}
              accessibilityLabel="Include medical information"
              className="mt-0.5"
            />
            <View className="flex-1">
              <Text className="text-sm text-foreground">My medical information</Text>
              <Text className="text-xs text-muted-foreground">
                {healthAvailable
                  ? 'Health data, shared only on this explicit action.'
                  : 'Unavailable — no consented health data in your Safety Profile.'}
              </Text>
            </View>
          </Pressable>

          <Pressable
            onPress={() => setIncludeReporter(!includeReporter)}
            className="flex-row items-start gap-3"
          >
            <Checkbox
              checked={includeReporter}
              onCheckedChange={setIncludeReporter}
              accessibilityLabel="Include my contact details"
              className="mt-0.5"
            />
            <View className="flex-1">
              <Text className="text-sm text-foreground">My name and phone</Text>
              <Text className="text-xs text-muted-foreground">
                So the crew can reach you as a witness.
              </Text>
            </View>
          </Pressable>

          {includeReporter && (
            <View className="gap-3">
              <View className="gap-1.5">
                <Label>Your name</Label>
                <Input
                  value={incident.reporterName}
                  onChangeText={(text) => updateIncident({ reporterName: text })}
                />
              </View>
              <View className="gap-1.5">
                <Label>Your phone</Label>
                <Input
                  keyboardType="phone-pad"
                  value={incident.reporterPhone}
                  onChangeText={(text) => updateIncident({ reporterPhone: text })}
                />
              </View>
            </View>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="gap-3">
          <View className="flex-row items-center justify-between gap-2">
            <Text className="font-semibold text-foreground">Scene brief</Text>
            <Badge variant="secondary">Composed on this device</Badge>
          </View>
          <View className="rounded-md bg-muted p-3">
            <Text className="font-mono text-xs leading-relaxed text-foreground">{brief}</Text>
          </View>
          <View className="gap-2">
            <Button onPress={shareBrief}>
              <Share2 size={16} color={colors.primaryForeground} />
              <Text className="text-sm font-medium text-primary-foreground">Share with the crew</Text>
            </Button>
            <Button variant="secondary" onPress={copyBrief}>
              <Copy size={16} color={colors.secondaryForeground} />
              <Text className="text-sm font-medium text-secondary-foreground">Copy text</Text>
            </Button>
          </View>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="gap-3">
          <View className="flex-row items-start justify-between gap-3">
            <View className="flex-1">
              <View className="flex-row items-center gap-1.5">
                <Volume2 size={16} color={colors.primary} />
                <Text className="font-semibold text-foreground">Spoken handover</Text>
              </View>
              <Text className="mt-1 text-sm text-muted-foreground">
                A short paragraph you can read aloud, rewritten from the brief above. It adds no new
                facts.
              </Text>
              <View className="mt-1.5 flex-row items-center gap-1.5">
                <Badge variant="secondary">Open-source AI</Badge>
                <Text className="flex-1 text-xs text-muted-foreground">
                  Rewritten by a model self-hosted on the server.
                </Text>
              </View>
            </View>
            <Button size="sm" variant="secondary" onPress={narrate} disabled={narrating}>
              {narrating ? (
                <ActivityIndicator size="small" color={colors.secondaryForeground} />
              ) : (
                <Sparkles size={16} color={colors.secondaryForeground} />
              )}
              <Text className="text-xs font-medium text-secondary-foreground">Generate</Text>
            </Button>
          </View>
          {spoken !== '' && (
            <View className="rounded-md border border-border bg-background p-3">
              <Text className="text-sm leading-relaxed text-foreground">{spoken}</Text>
              <Text className="mt-2 text-xs text-muted-foreground">
                AI-rewritten wording. The written brief above is the authoritative record.
              </Text>
            </View>
          )}
        </CardContent>
      </Card>

      <Card className="border-dashed">
        <CardContent className="gap-2">
          <View className="flex-row items-center gap-1.5">
            <Radio size={16} color={colors.primary} />
            <Text className="font-semibold text-foreground">NG protocol payload (prototype)</Text>
          </View>
          <Text className="text-sm text-muted-foreground">
            Previews the PIDF-LO + RFC 7852-style payload ResQKit would eventually hand to an
            authorized NG112 channel. Proof-of-concept only — never transmitted anywhere; logged to
            Settings → Institutional actions trace.{' '}
            {settings.realDataMode
              ? 'Local backend mode is on (your machine only).'
              : 'Currently simulated on this device.'}
          </Text>
          <Button
            size="sm"
            variant="secondary"
            disabled={buildingNgPayload}
            onPress={async () => {
              setBuildingNgPayload(true);
              try {
                await buildNgProtocolPayload(
                  incident,
                  settings.realDataMode,
                  logInstitutional,
                  (id, code) => updateIncident({ backendSessionId: id, sessionCode: code }),
                );
                toast.success('Logged to the institutional actions trace.');
              } finally {
                setBuildingNgPayload(false);
              }
            }}
          >
            {buildingNgPayload ? (
              <ActivityIndicator size="small" color={colors.secondaryForeground} />
            ) : (
              <Radio size={16} color={colors.secondaryForeground} />
            )}
            <Text className="text-xs font-medium text-secondary-foreground">
              Build NG protocol payload
            </Text>
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="gap-3">
          <Text className="font-semibold text-foreground">The crew has taken over?</Text>
          <Text className="text-sm text-muted-foreground">
            Close the incident once you have handed over. Until you do, ResQKit keeps it open and
            offers only &ldquo;Resume&rdquo; on the home screen.
          </Text>

          <Button size="lg" variant="destructive" onPress={endIncident}>
            <CheckCircle2 size={20} color={colors.destructiveForeground} />
            <Text className="text-base font-medium text-destructive-foreground">End incident</Text>
          </Button>

          <View className="gap-2">
            <Button size="lg" variant="secondary" onPress={() => router.push('/review')}>
              Keep a copy or archive it first
            </Button>
            <Button size="lg" variant="outline" onPress={startNewIncident}>
              Start a new incident instead
            </Button>
          </View>
          <Text className="text-xs text-muted-foreground">
            Starting a new incident discards this one immediately, with no review step.
          </Text>
        </CardContent>
      </Card>
    </ScrollView>
  );
}
