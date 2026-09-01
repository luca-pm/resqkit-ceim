/**
 * S10 / S12 — Incident review, retention choice and data rights
 * (RN port of app/frontend/src/pages/Review.tsx).
 *
 * Default is deletion. Keeping a copy is an opt-in action, and archiving to the
 * account is a second, separate opt-in that requires being signed in. This is
 * where GDPR Articles 15–18 are made operational for the user without them
 * having to contact anybody.
 *
 * Mobile difference: the web version's "download as a text file" becomes a
 * share-sheet export. There is no user-visible filesystem to download into on
 * iOS, so the honest equivalent is handing the text to whatever app the user
 * chooses (Files, Mail, Notes).
 */
import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Share, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Archive, ClipboardList, LogIn, Share2, ShieldCheck, Trash2 } from 'lucide-react-native';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from '@/components/ui/toast';
import { useIncident } from '@/contexts/IncidentContext';
import { client } from '@/lib/apiClient';
import { buildBrief } from '@/lib/brief';
import { terminateInstitutionalSession } from '@/lib/institutionalActions';
import { CONTEXTS, procedureById } from '@/lib/knowledge';
import { RetentionChoice } from '@/lib/storage';
import { useTokenColors } from '@/lib/tokenColors';

const RETENTION_LABELS: Record<RetentionChoice, string> = {
  session: 'Delete as soon as I close the incident (default)',
  '24h': 'Keep on this device for 24 hours',
  '7d': 'Keep on this device for 7 days',
};

export default function ReviewScreen() {
  const router = useRouter();
  const {
    incident,
    profile,
    settings,
    updateSettings,
    discardIncident,
    wipeEverything,
    logInstitutional,
  } = useIncident();
  const colors = useTokenColors();

  const [authState, setAuthState] = useState<'loading' | 'authenticated' | 'anonymous'>('loading');
  const [archiving, setArchiving] = useState(false);
  const [archivedId, setArchivedId] = useState<number | null>(null);

  useEffect(() => {
    client.auth
      .me()
      .then((res) => setAuthState(res?.data ? 'authenticated' : 'anonymous'))
      .catch(() => setAuthState('anonymous'));
  }, []);

  const brief = useMemo(
    () =>
      incident
        ? buildBrief(incident, profile, {
            includeHealth: incident.includeHealthData,
            includeReporter: true,
          })
        : '',
    [incident, profile],
  );

  const exportBrief = async () => {
    try {
      await Share.share({ message: brief });
    } catch {
      toast.error('Could not export. Copy the text from the handoff screen instead.');
    }
  };

  const archive = async () => {
    if (!incident) return;
    setArchiving(true);
    try {
      const response = await client.entities.incident_records.create<{ id?: number }>({
        data: {
          context_type: incident.context ?? 'other',
          occurred_at: incident.startedAt,
          location_summary: incident.locationNote,
          latitude: incident.latitude,
          longitude: incident.longitude,
          location_accuracy: incident.accuracy,
          victim_count: incident.victimCount,
          triage_summary: `responsive=${incident.responsive || 'n/a'}; breathing=${
            incident.breathing || 'n/a'
          }; injury=${incident.injury || 'n/a'}; age=${incident.ageBand || 'n/a'}; access=${
            incident.trapped || 'n/a'
          }`,
          hazards: incident.hazards.join(','),
          kit_items: incident.kitItems.join(','),
          procedure_id: incident.procedureId ?? '',
          interventions: incident.completedSteps.map((s) => `${s.at} ${s.title}`).join(' | '),
          includes_health_data: incident.includeHealthData,
          called_112: incident.called112,
          brief_text: brief,
          content_pack_version: incident.contentPackVersion,
          retention_choice: settings.retention,
        },
      });
      setArchivedId(response.data?.id ?? null);
      toast.success('Archived to your account. You can delete it there at any time.');
    } catch (e: unknown) {
      const err = e as { data?: { detail?: string }; message?: string };
      toast.error(err?.data?.detail || err?.message || 'Could not archive this incident.');
    } finally {
      setArchiving(false);
    }
  };

  const closeIncident = () => {
    if (incident) {
      void terminateInstitutionalSession(incident, settings.realDataMode, logInstitutional);
    }
    discardIncident();
    toast.success('Incident deleted from this device.');
    router.replace('/');
  };

  const procedure = incident?.procedureId ? procedureById(incident.procedureId) : undefined;
  const ctxLabel = CONTEXTS.find((c) => c.id === incident?.context)?.label;

  return (
    <ScrollView className="flex-1 bg-background" contentContainerClassName="gap-5 p-4 pb-10">
      <View>
        <Text className="text-2xl font-bold text-foreground">Your data and your rights</Text>
        <Text className="mt-2 text-sm text-muted-foreground">
          Nothing here was uploaded. You decide what happens to it next.
        </Text>
        <Text className="mt-1 text-xs text-muted-foreground">
          Kit recognition and the spoken brief use an open-source AI model self-hosted on the
          server — your data never reaches an outside company by default.
        </Text>
      </View>

      {incident ? (
        <>
          <Card>
            <CardHeader className="pb-3">
              <View className="flex-row items-center gap-2">
                <ClipboardList size={20} color={colors.primary} />
                <CardTitle>What was recorded</CardTitle>
              </View>
              <CardDescription>
                {`Started ${new Date(incident.startedAt).toLocaleString()}${ctxLabel ? ` · ${ctxLabel}` : ''}`}
              </CardDescription>
            </CardHeader>
            <CardContent className="gap-2">
              <View className="flex-row flex-wrap gap-1.5">
                <Badge variant="secondary">{`${incident.victimCount} injured`}</Badge>
                {incident.hazards.length > 0 && (
                  <Badge variant="emergency">{`${incident.hazards.length} hazard(s)`}</Badge>
                )}
                {incident.kitItems.length > 0 && (
                  <Badge variant="secondary">{`${incident.kitItems.length} kit item(s)`}</Badge>
                )}
                {procedure && <Badge>{procedure.shortLabel}</Badge>}
                <Badge variant={incident.includeHealthData ? 'default' : 'secondary'}>
                  {incident.includeHealthData ? 'Health data shared' : 'No health data shared'}
                </Badge>
              </View>
              <Text className="text-sm text-muted-foreground">
                {`${incident.completedSteps.length} step(s) recorded as completed. No camera image was kept.`}
              </Text>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle>How long to keep it on this device</CardTitle>
              <CardDescription>Storage limitation, GDPR Article 5(1)(e).</CardDescription>
            </CardHeader>
            <CardContent className="gap-2">
              {(Object.keys(RETENTION_LABELS) as RetentionChoice[]).map((key) => {
                const active = settings.retention === key;
                return (
                  <Pressable
                    key={key}
                    onPress={() => updateSettings({ retention: key })}
                    accessibilityRole="radio"
                    accessibilityState={{ selected: active }}
                    className={`rounded-md border p-3 ${
                      active ? 'border-primary bg-primary/10' : 'border-border bg-card'
                    }`}
                  >
                    <Text
                      className={`text-sm ${active ? 'font-medium text-foreground' : 'text-muted-foreground'}`}
                    >
                      {RETENTION_LABELS[key]}
                    </Text>
                  </Pressable>
                );
              })}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle>Keep a copy</CardTitle>
              <CardDescription>
                Useful for an insurance claim or a workplace incident report.
              </CardDescription>
            </CardHeader>
            <CardContent className="gap-3">
              <Button variant="secondary" onPress={exportBrief}>
                <Share2 size={16} color={colors.secondaryForeground} />
                <Text className="text-sm font-medium text-secondary-foreground">
                  Export a copy
                </Text>
              </Button>

              {authState === 'loading' && (
                <Button variant="secondary" disabled>
                  <ActivityIndicator size="small" color={colors.secondaryForeground} />
                  <Text className="text-sm text-secondary-foreground">Checking your account…</Text>
                </Button>
              )}
              {authState === 'anonymous' && (
                <View className="rounded-md border border-border bg-muted p-3">
                  <Text className="text-sm text-muted-foreground">
                    You can also archive this incident to your account so it survives clearing this
                    app. That requires signing in and is entirely optional.
                  </Text>
                  <Button
                    size="sm"
                    variant="secondary"
                    className="mt-2"
                    onPress={() => router.push('/sign-in')}
                  >
                    <LogIn size={16} color={colors.secondaryForeground} />
                    <Text className="text-xs font-medium text-secondary-foreground">
                      Sign in to archive
                    </Text>
                  </Button>
                </View>
              )}
              {authState === 'authenticated' && (
                <Button
                  variant="secondary"
                  onPress={archive}
                  disabled={archiving || archivedId !== null}
                >
                  {archiving ? (
                    <ActivityIndicator size="small" color={colors.secondaryForeground} />
                  ) : (
                    <Archive size={16} color={colors.secondaryForeground} />
                  )}
                  <Text className="text-sm font-medium text-secondary-foreground">
                    {archivedId !== null ? 'Archived to your account' : 'Archive to my account'}
                  </Text>
                </Button>
              )}
            </CardContent>
          </Card>

          <Button size="lg" variant="destructive" onPress={closeIncident}>
            <Trash2 size={20} color={colors.destructiveForeground} />
            <Text className="text-base font-medium text-destructive-foreground">
              Close incident and delete it from this device
            </Text>
          </Button>
        </>
      ) : (
        <Card>
          <CardContent className="p-5">
            <Text className="text-sm text-muted-foreground">
              No incident is stored on this device right now.
            </Text>
          </CardContent>
        </Card>
      )}

      <Card className="border-destructive/40">
        <CardHeader className="pb-3">
          <View className="flex-row items-center gap-2">
            <ShieldCheck size={20} color={colors.primary} />
            <CardTitle>Erasure and withdrawal</CardTitle>
          </View>
          <CardDescription>
            GDPR Articles 15–18: access, rectification, erasure and restriction — exercised here,
            with no request form.
          </CardDescription>
        </CardHeader>
        <CardContent className="gap-3">
          <Text className="text-sm text-muted-foreground">
            This removes your Safety Profile, your consent record, your settings and any stored
            incident from this device. Anything you explicitly archived to your account stays there
            until you delete it from your account.
          </Text>
          <Button
            variant="destructive"
            onPress={() => {
              wipeEverything();
              toast.success('All local ResQKit data deleted.');
              router.replace('/');
            }}
          >
            <Trash2 size={16} color={colors.destructiveForeground} />
            <Text className="text-sm font-medium text-destructive-foreground">
              Delete everything on this device
            </Text>
          </Button>
        </CardContent>
      </Card>
    </ScrollView>
  );
}
