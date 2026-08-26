/**
 * Istoric intervenții — lists the caller's own archived incidents via the
 * existing entity client, which is automatically scoped server-side (see
 * Section E4). Requires sign-in.
 */
import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Clock } from 'lucide-react-native';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { client } from '@/lib/apiClient';
import { useAuth } from '@/contexts/AuthContext';

interface IncidentRecord {
  id: number;
  context_type: string;
  occurred_at: string;
  victim_count: number;
  hazards: string | null;
  called_112: string;
}

export default function HistoryScreen() {
  const { t } = useTranslation('history');
  const { user, loading: authLoading } = useAuth();
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

  if (authLoading) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-background">
        <ActivityIndicator />
      </SafeAreaView>
    );
  }

  if (!user) {
    return (
      <SafeAreaView className="flex-1 bg-background px-4" edges={['top']}>
        <View className="flex-1 items-center justify-center gap-4">
          <Clock color="hsl(207 15% 40%)" size={32} />
          <Text className="text-center text-sm text-muted-foreground">{t('empty')}</Text>
          <Button onPress={() => router.push('/sign-in')}>Sign in</Button>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-background" edges={['top']}>
      <View className="px-4 py-4">
        <Text className="text-2xl font-bold text-foreground">{t('title')}</Text>
      </View>
      {records === null ? (
        <View className="flex-1 items-center justify-center">
          {error ? <Text className="text-sm text-destructive">{error}</Text> : <ActivityIndicator />}
        </View>
      ) : records.length === 0 ? (
        <View className="flex-1 items-center justify-center px-4">
          <Text className="text-center text-sm text-muted-foreground">{t('empty')}</Text>
        </View>
      ) : (
        <FlatList
          data={records}
          keyExtractor={(item) => String(item.id)}
          contentContainerClassName="gap-3 px-4 pb-8"
          renderItem={({ item }) => (
            <Card>
              <CardContent className="gap-1">
                <Text className="font-semibold text-foreground">
                  {new Date(item.occurred_at).toLocaleDateString()} — {item.context_type}
                </Text>
                <Text className="text-sm text-muted-foreground">
                  {t('victims', { count: item.victim_count })}
                  {item.hazards ? ` · ${t('hazards', { count: item.hazards.split(',').filter(Boolean).length })}` : ''}
                </Text>
              </CardContent>
            </Card>
          )}
        />
      )}
    </SafeAreaView>
  );
}
