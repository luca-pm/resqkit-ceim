/**
 * Istoric intervenții — two distinct stores, deliberately shown side by side
 * because they behave differently and users conflate them:
 *
 * 1. "On this device" — incidents closed under a retention window. They delete
 *    themselves when the window expires. No account needed; nothing was ever
 *    uploaded. Shown first because this is the one with a deadline.
 * 2. "Archived to your account" — incidents the user explicitly sent to the
 *    server from the review screen. These are never touched by retention and
 *    stay until the user deletes them.
 *
 * The screen used to require sign-in for the whole view. That was wrong once
 * retention became real: local retained incidents belong to the user whether
 * or not they ever create an account.
 */
import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Archive, Clock, Trash2 } from 'lucide-react-native';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { toast } from '@/components/ui/toast';
import { client } from '@/lib/apiClient';
import { useAuth } from '@/contexts/AuthContext';
import { useIncident } from '@/contexts/IncidentContext';
import { CONTEXTS } from '@/lib/knowledge';
import { useTokenColors } from '@/lib/tokenColors';

interface IncidentRecord {
  id: number;
  context_type: string;
  occurred_at: string;
  victim_count: number;
  hazards: string | null;
  called_112: string;
}

/** "3 days left" / "5 hours left" — deadlines are useless without a countdown. */
function timeLeft(expiresAt: string): string {
  const ms = new Date(expiresAt).getTime() - Date.now();
  if (ms <= 0) return 'expired';
  const hours = Math.floor(ms / (60 * 60 * 1000));
  if (hours < 1) return 'under an hour left';
  if (hours < 48) return `${hours} hour${hours === 1 ? '' : 's'} left`;
  return `${Math.floor(hours / 24)} days left`;
}

export default function HistoryScreen() {
  const { t } = useTranslation('history');
  const { user, loading: authLoading } = useAuth();
  const { retained, deleteRetained, ready } = useIncident();
  const colors = useTokenColors();
  const [records, setRecords] = useState<IncidentRecord[] | null>(null);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    if (!user) return;
    try {
      const res = await client.entities.incident_records.query<{ items: IncidentRecord[] }>({
        sort: '-occurred_at',
        limit: 50,
      });
      setRecords(res.data.items);
    } catch {
      setError(t('error'));
    }
  }, [user, t]);

  useEffect(() => {
    // See the identical justified suppression in contexts/AuthContext.tsx —
    // standard fetch-on-mount, not the pattern this rule targets.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  const confirmDelete = (id: string) => {
    Alert.alert('Delete this incident?', 'It will be removed from this device immediately.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          deleteRetained(id);
          toast.success('Incident deleted.');
        },
      },
    ]);
  };

  if (authLoading || !ready) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-background">
        <ActivityIndicator />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-background" edges={['top']}>
      <ScrollView contentContainerClassName="gap-6 px-4 py-4 pb-10">
        <Text className="text-2xl font-bold text-foreground">{t('title')}</Text>

        {/* ---- Kept on this device, on a deadline ---- */}
        <View className="gap-3">
          <View className="flex-row items-center gap-2">
            <Clock size={16} color={colors.primary} />
            <Text className="font-semibold text-foreground">On this device</Text>
          </View>
          <Text className="text-sm text-muted-foreground">
            Closed incidents still inside the retention period you chose. They delete themselves
            when it runs out — nothing here was ever uploaded.
          </Text>

          {retained.length === 0 ? (
            <Card className="border-dashed">
              <CardContent>
                <Text className="text-sm text-muted-foreground">
                  No incidents are being kept on this device.
                </Text>
              </CardContent>
            </Card>
          ) : (
            retained.map((entry) => {
              const ctx = CONTEXTS.find((c) => c.id === entry.incident.context)?.label;
              return (
                <Card key={entry.id}>
                  <CardContent className="gap-2">
                    <View className="flex-row items-start justify-between gap-3">
                      <View className="flex-1">
                        <Text className="font-semibold text-foreground">
                          {new Date(entry.incident.startedAt).toLocaleString()}
                          {ctx ? ` — ${ctx}` : ''}
                        </Text>
                        <Text className="mt-0.5 text-sm text-muted-foreground">
                          {t('victims', { count: entry.incident.victimCount })}
                          {entry.incident.hazards.length > 0
                            ? ` · ${t('hazards', { count: entry.incident.hazards.length })}`
                            : ''}
                          {` · ${entry.incident.completedSteps.length} step(s) done`}
                        </Text>
                      </View>
                      <Badge variant="secondary">{timeLeft(entry.expiresAt)}</Badge>
                    </View>
                    <Button size="sm" variant="outline" onPress={() => confirmDelete(entry.id)}>
                      <Trash2 size={14} color={colors.foreground} />
                      <Text className="text-xs font-medium text-foreground">Delete now</Text>
                    </Button>
                  </CardContent>
                </Card>
              );
            })
          )}
        </View>

        {/* ---- Archived to the account, no deadline ---- */}
        <View className="gap-3">
          <View className="flex-row items-center gap-2">
            <Archive size={16} color={colors.secondary} />
            <Text className="font-semibold text-foreground">Archived to your account</Text>
          </View>
          <Text className="text-sm text-muted-foreground">
            Incidents you explicitly archived. Retention never touches these — they stay until you
            delete them.
          </Text>

          {!user ? (
            <Card className="border-dashed">
              <CardContent className="gap-3">
                <Text className="text-sm text-muted-foreground">{t('empty')}</Text>
                <Button size="sm" onPress={() => router.push('/sign-in')}>
                  Sign in
                </Button>
              </CardContent>
            </Card>
          ) : records === null ? (
            <View className="items-center py-6">
              {error ? (
                <Text className="text-sm text-destructive">{error}</Text>
              ) : (
                <ActivityIndicator />
              )}
            </View>
          ) : records.length === 0 ? (
            <Card className="border-dashed">
              <CardContent>
                <Text className="text-sm text-muted-foreground">{t('empty')}</Text>
              </CardContent>
            </Card>
          ) : (
            records.map((item) => (
              <Card key={item.id}>
                <CardContent className="gap-1">
                  <Text className="font-semibold text-foreground">
                    {new Date(item.occurred_at).toLocaleDateString()} — {item.context_type}
                  </Text>
                  <Text className="text-sm text-muted-foreground">
                    {t('victims', { count: item.victim_count })}
                    {item.hazards
                      ? ` · ${t('hazards', { count: item.hazards.split(',').filter(Boolean).length })}`
                      : ''}
                  </Text>
                </CardContent>
              </Card>
            ))
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
