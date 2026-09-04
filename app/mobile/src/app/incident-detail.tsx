/**
 * Full detail view for one incident, reached by tapping a card in Istoric.
 *
 * Two very different sources render through the same screen:
 *
 * - "local": a RetainedIncident held in IncidentContext's `retained` array.
 *   The full structured IncidentState is already in memory (it came from
 *   AsyncStorage at hydrate time) — no fetch needed, and no risk of showing
 *   stale data after a delete since the list is reactive.
 * - "server": an incident_records row, fetched by id. Only the fields the
 *   backend actually stores are shown — notably no reporter contact details,
 *   since that column doesn't exist server-side (see archive() in review.tsx).
 *
 * Deliberately does NOT try to regenerate a brief for a local incident using
 * the CURRENT Safety Profile: the profile may have changed since the
 * incident closed, and showing today's allergies against a week-old incident
 * would misrepresent what was actually true at the time. Only the server
 * copy's stored `brief_text` (frozen at archive time) is shown verbatim.
 */
import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  Archive,
  Backpack,
  Clock,
  MapPin,
  Phone,
  ShieldAlert,
  Stethoscope,
  Trash2,
  User,
} from 'lucide-react-native';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from '@/components/ui/toast';
import { AGE_BANDS, AGE_LABELS, POWERTRAIN_OPTIONS, TRAPPED_OPTIONS } from './emergency';
import { client } from '@/lib/apiClient';
import { useIncident } from '@/contexts/IncidentContext';
import {
  CONTEXTS,
  INJURY_OPTIONS,
  hazardByCode,
  kitItemByCode,
  procedureById,
} from '@/lib/knowledge';
import { useTokenColors } from '@/lib/tokenColors';

interface ServerRecord {
  id: number;
  context_type: string;
  occurred_at: string;
  location_summary: string | null;
  latitude: number | null;
  longitude: number | null;
  location_accuracy: number | null;
  victim_count: number;
  triage_summary: string | null;
  hazards: string | null;
  kit_items: string | null;
  procedure_id: string | null;
  interventions: string | null;
  includes_health_data: boolean | null;
  called_112: string;
  brief_text: string | null;
  content_pack_version: string | null;
  retention_choice: string | null;
}

const yesNoUnsure = (v: string): string => {
  if (v === 'yes') return 'Yes';
  if (v === 'no') return 'No';
  if (v === 'unsure') return 'Unsure';
  return 'Not recorded';
};

const CALLED_112_LABELS: Record<string, string> = {
  called: 'Called 112',
  already_called: 'Someone else already called 112',
  not_confirmed: '112 not confirmed',
};

/** A label: value row, skipped entirely when there's nothing to show. */
const Field: React.FC<{ label: string; value: React.ReactNode }> = ({ label, value }) =>
  value === null || value === undefined || value === '' ? null : (
    <View className="gap-0.5">
      <Text className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </Text>
      <Text className="text-sm text-foreground">{value}</Text>
    </View>
  );

const SectionCard: React.FC<{
  icon: React.ReactNode;
  title: string;
  children: React.ReactNode;
}> = ({ icon, title, children }) => (
  <Card>
    <CardHeader className="flex-row items-center gap-2 pb-2">
      {icon}
      <CardTitle className="text-base">{title}</CardTitle>
    </CardHeader>
    <CardContent className="gap-3">{children}</CardContent>
  </Card>
);

export default function IncidentDetailScreen() {
  const router = useRouter();
  const { source, id } = useLocalSearchParams<{ source: string; id: string }>();
  const { retained, deleteRetained } = useIncident();
  const colors = useTokenColors();

  const [serverRecord, setServerRecord] = useState<ServerRecord | null>(null);
  const [serverError, setServerError] = useState('');
  const [deleting, setDeleting] = useState(false);

  const local = source === 'local' ? retained.find((r) => r.id === id) : undefined;

  const loadServer = useCallback(async () => {
    if (source !== 'server' || !id) return;
    try {
      const res = await client.entities.incident_records.get<ServerRecord>({ id });
      setServerRecord(res.data);
    } catch {
      setServerError('Could not load this incident. It may have been deleted.');
    }
  }, [source, id]);

  useEffect(() => {
    // Fetch-on-mount for the one param combination this screen is opened
    // with; not the setState-in-render-effect pattern the lint rule targets.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadServer();
  }, [loadServer]);

  const confirmDelete = () => {
    Alert.alert(
      'Delete this incident?',
      source === 'local'
        ? 'It will be removed from this device immediately.'
        : 'It will be permanently removed from your account. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            if (source === 'local') {
              deleteRetained(id);
              toast.success('Incident deleted.');
              router.back();
              return;
            }
            setDeleting(true);
            try {
              await client.entities.incident_records.delete({ id });
              toast.success('Incident deleted from your account.');
              router.back();
            } catch {
              toast.error('Could not delete this incident. Try again.');
            } finally {
              setDeleting(false);
            }
          },
        },
      ],
    );
  };

  if (source === 'local' && !local) {
    return (
      <SafeAreaView className="flex-1 bg-background" edges={['top']}>
        <View className="flex-1 items-center justify-center gap-3 p-4">
          <Text className="text-sm text-muted-foreground">
            This incident is no longer on this device — its retention period may have ended.
          </Text>
          <Button variant="secondary" onPress={() => router.back()}>
            Back to Istoric
          </Button>
        </View>
      </SafeAreaView>
    );
  }

  if (source === 'server' && !serverRecord) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-background">
        {serverError ? (
          <View className="gap-3 p-4">
            <Text className="text-sm text-destructive">{serverError}</Text>
            <Button variant="secondary" onPress={() => router.back()}>
              Back to Istoric
            </Button>
          </View>
        ) : (
          <ActivityIndicator />
        )}
      </SafeAreaView>
    );
  }

  const incident = local?.incident;
  const ctxLabel = CONTEXTS.find(
    (c) => c.id === (incident?.context ?? serverRecord?.context_type),
  )?.label;
  const procedure = procedureById(incident?.procedureId ?? serverRecord?.procedure_id ?? '');

  return (
    <SafeAreaView className="flex-1 bg-background" edges={['top']}>
      <ScrollView contentContainerClassName="gap-4 p-4 pb-10">
        <View>
          <View className="flex-row items-center gap-2">
            {source === 'local' ? (
              <Clock size={16} color={colors.primary} />
            ) : (
              <Archive size={16} color={colors.secondary} />
            )}
            <Badge variant="secondary">
              {source === 'local' ? 'On this device' : 'Archived to your account'}
            </Badge>
          </View>
          <Text className="mt-2 text-2xl font-bold text-foreground">
            {new Date(incident?.startedAt ?? serverRecord?.occurred_at ?? '').toLocaleString()}
          </Text>
          {ctxLabel && <Text className="mt-0.5 text-sm text-muted-foreground">{ctxLabel}</Text>}
          <View className="mt-2 flex-row flex-wrap gap-1.5">
            <Badge variant="secondary">
              {(incident?.victimCount ?? serverRecord?.victim_count ?? 1) + ' injured'}
            </Badge>
            <Badge
              variant={
                (incident?.called112 ?? serverRecord?.called_112) === 'not_confirmed'
                  ? 'emergency'
                  : 'secondary'
              }
            >
              {CALLED_112_LABELS[incident?.called112 ?? serverRecord?.called_112 ?? ''] ??
                'Not recorded'}
            </Badge>
            {(incident?.includeHealthData ?? serverRecord?.includes_health_data) && (
              <Badge>Health data shared</Badge>
            )}
          </View>
        </View>

        {source === 'local' && local && (
          <SectionCard icon={<Clock size={16} color={colors.primary} />} title="Retention">
            <Field
              label="Closed"
              value={new Date(local.closedAt).toLocaleString()}
            />
            <Field
              label="Kept until"
              value={new Date(local.expiresAt).toLocaleString()}
            />
          </SectionCard>
        )}

        {incident && (
          <SectionCard icon={<Stethoscope size={16} color={colors.primary} />} title="Triage">
            <Field label="Responsive" value={yesNoUnsure(incident.responsive)} />
            <Field label="Breathing" value={yesNoUnsure(incident.breathing)} />
            <Field
              label="Main problem"
              value={INJURY_OPTIONS.find((o) => o.value === incident.injury)?.label}
            />
            <Field
              label="Approximate age"
              value={AGE_LABELS[incident.ageBand] ?? (incident.ageBand || AGE_BANDS[0])}
            />
            <Field
              label="Access"
              value={TRAPPED_OPTIONS.find((o) => o.value === incident.trapped)?.label}
            />
          </SectionCard>
        )}

        {serverRecord?.triage_summary && (
          <SectionCard icon={<Stethoscope size={16} color={colors.primary} />} title="Triage">
            <Text className="text-sm text-foreground">{serverRecord.triage_summary}</Text>
          </SectionCard>
        )}

        {(incident?.locationNote ||
          incident?.latitude !== undefined ||
          serverRecord?.location_summary ||
          serverRecord?.latitude) && (
          <SectionCard icon={<MapPin size={16} color={colors.primary} />} title="Location">
            <Field label="Note" value={incident?.locationNote || serverRecord?.location_summary} />
            <Field
              label="Coordinates"
              value={
                incident
                  ? incident.latitude !== null && incident.longitude !== null
                    ? `${incident.latitude.toFixed(5)}, ${incident.longitude.toFixed(5)}${incident.accuracy ? ` (±${Math.round(incident.accuracy)} m)` : ''}`
                    : 'No satellite fix captured'
                  : serverRecord?.latitude !== null && serverRecord?.longitude !== null
                    ? `${serverRecord?.latitude?.toFixed(5)}, ${serverRecord?.longitude?.toFixed(5)}${serverRecord?.location_accuracy ? ` (±${Math.round(serverRecord.location_accuracy)} m)` : ''}`
                    : undefined
              }
            />
            {incident && (
              <Field
                label="Powertrain"
                value={POWERTRAIN_OPTIONS.find((o) => o.value === incident.powertrain)?.label}
              />
            )}
          </SectionCard>
        )}

        {((incident?.hazards.length ?? 0) > 0 ||
          (serverRecord?.hazards ?? '').split(',').filter(Boolean).length > 0) && (
          <SectionCard icon={<ShieldAlert size={16} color={colors.emergency} />} title="Hazards">
            <View className="flex-row flex-wrap gap-1.5">
              {(incident?.hazards ?? serverRecord?.hazards?.split(',').filter(Boolean) ?? []).map(
                (code) => (
                  <Badge key={code} variant="emergency">
                    {hazardByCode(code)?.label ?? code}
                  </Badge>
                ),
              )}
            </View>
          </SectionCard>
        )}

        {((incident?.kitItems.length ?? 0) > 0 ||
          (serverRecord?.kit_items ?? '').split(',').filter(Boolean).length > 0) && (
          <SectionCard icon={<Backpack size={16} color={colors.primary} />} title="Kit used">
            <View className="flex-row flex-wrap gap-1.5">
              {(
                incident?.kitItems ??
                serverRecord?.kit_items?.split(',').filter(Boolean) ??
                []
              ).map((code) => (
                <Badge key={code} variant="secondary">
                  {kitItemByCode(code)?.name ?? code}
                </Badge>
              ))}
            </View>
            {incident?.kitSource && (
              <Field
                label="How it was recorded"
                value={
                  incident.kitSource === 'camera'
                    ? 'Camera recognition'
                    : incident.kitSource === 'manual'
                      ? 'Selected manually'
                      : 'None selected'
                }
              />
            )}
          </SectionCard>
        )}

        {(procedure || incident?.completedSteps.length || serverRecord?.interventions) && (
          <SectionCard
            icon={<Stethoscope size={16} color={colors.primary} />}
            title="Procedure followed"
          >
            <Field label="Guidance used" value={procedure?.name} />
            {incident && incident.completedSteps.length > 0 && (
              <View className="gap-1.5">
                <Text className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Steps completed
                </Text>
                {incident.completedSteps
                  .sort((a, b) => a.index - b.index)
                  .map((step) => (
                    <Text key={step.index} className="text-sm text-foreground">
                      {`${step.index + 1}. ${step.title}`}
                      <Text className="text-xs text-muted-foreground">
                        {`  —  ${new Date(step.at).toLocaleTimeString()}`}
                      </Text>
                    </Text>
                  ))}
              </View>
            )}
            <Field label="Interventions" value={serverRecord?.interventions?.replaceAll('|', '\n')} />
          </SectionCard>
        )}

        {incident && (incident.reporterName || incident.reporterPhone) && (
          <SectionCard icon={<User size={16} color={colors.primary} />} title="Reporter">
            <Field label="Name" value={incident.reporterName} />
            <Field
              label="Phone"
              value={
                incident.reporterPhone ? (
                  <View className="flex-row items-center gap-1.5">
                    <Phone size={12} color={colors.foreground} />
                    <Text className="text-sm text-foreground">{incident.reporterPhone}</Text>
                  </View>
                ) : undefined
              }
            />
          </SectionCard>
        )}

        {serverRecord?.brief_text && (
          <SectionCard icon={<Archive size={16} color={colors.secondary} />} title="Archived brief">
            <View className="rounded-md bg-muted p-3">
              <Text className="font-mono text-xs leading-relaxed text-foreground">
                {serverRecord.brief_text}
              </Text>
            </View>
          </SectionCard>
        )}

        <Text className="text-center text-xs text-muted-foreground">
          {`Content pack ${incident?.contentPackVersion ?? serverRecord?.content_pack_version ?? 'unknown'}`}
        </Text>

        <Button variant="destructive" onPress={confirmDelete} disabled={deleting}>
          {deleting ? (
            <ActivityIndicator size="small" color={colors.destructiveForeground} />
          ) : (
            <Trash2 size={16} color={colors.destructiveForeground} />
          )}
          <Text className="text-sm font-medium text-destructive-foreground">
            {source === 'local' ? 'Delete from this device' : 'Delete from your account'}
          </Text>
        </Button>
      </ScrollView>
    </SafeAreaView>
  );
}
