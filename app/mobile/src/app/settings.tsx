/**
 * Settings — consumer preferences (Section E7 step 4) PLUS the institutional
 * actions surface (Section G5).
 *
 * The institutional half is what makes "Test voice channel" and the other
 * institutional actions observable: without the trace below, those actions
 * fire and log but the user sees nothing at all, which reads as "the button
 * is broken". It also holds the only control that takes the app out of
 * simulated mode.
 *
 * Notification toggles are locally-persisted only and say so visibly here —
 * no real push backend exists yet (same honesty standard as realDataMode).
 */
import React from 'react';
import { ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { useColorScheme } from 'nativewind';
import { AlertTriangle, Bell, Globe, Info, ListTree, Moon, RadioTower, Trash2 } from 'lucide-react-native';
import Constants from 'expo-constants';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { toast } from '@/components/ui/toast';
import { useIncident } from '@/contexts/IncidentContext';
import { useSettings } from '@/contexts/SettingsContext';
import { useTokenColors } from '@/lib/tokenColors';

const ACTION_LABELS: Record<string, string> = {
  'session.create': 'Session created',
  'ng112.connect': 'NG112 connection',
  'pvr.request': 'PVR requested',
  'stream.connect': 'Websocket connected',
  'stream.terminate': 'Websocket terminated',
  'triage.answer': 'Triage answer logged',
  'hazards.confirm': 'Hazards confirmed',
  'kit.confirm': 'Kit selection confirmed',
  'procedure.step': 'Procedure step completed',
  'ng_protocol.build': 'NG protocol payload built',
  'session.terminate': 'Session terminated',
};

const SectionLabel: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <Text className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
    {children}
  </Text>
);

const Row: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <View className="flex-row items-center justify-between border-b border-border py-3 last:border-b-0">
    <Text className="flex-1 pr-3 text-base text-foreground">{label}</Text>
    {children}
  </View>
);

export default function SettingsScreen() {
  const { t } = useTranslation('settings');
  const { setColorScheme, colorScheme } = useColorScheme();
  const { settings, updateSettings, institutionalLog, clearInstitutionalLog } = useIncident();
  const colors = useTokenColors();

  const notifications = settings.notifications;
  const setNotification = (key: keyof typeof notifications, value: boolean) =>
    updateSettings({ notifications: { ...notifications, [key]: value } });

  return (
    <SafeAreaView className="flex-1 bg-background" edges={['top']}>
      <ScrollView className="flex-1 px-4 py-4" contentContainerClassName="gap-4 pb-8">
        <Text className="text-2xl font-bold text-foreground">{t('title')}</Text>

        <View>
          <SectionLabel>{t('notifications')}</SectionLabel>
          <Text className="mb-2 text-xs text-muted-foreground">{t('notificationsHint')}</Text>
          <Card>
            <CardContent>
              <Row label={t('push')}>
                <Bell color={colors.primary} size={16} />
                <Switch
                  value={notifications.push}
                  onValueChange={(v) => setNotification('push', v)}
                />
              </Row>
              <Row label={t('urgentAlerts')}>
                <Switch
                  value={notifications.urgentAlerts}
                  onValueChange={(v) => setNotification('urgentAlerts', v)}
                />
              </Row>
              <Row label={t('expiryReminders')}>
                <Switch
                  value={notifications.expiryReminders}
                  onValueChange={(v) => setNotification('expiryReminders', v)}
                />
              </Row>
            </CardContent>
          </Card>
        </View>

        <View>
          <SectionLabel>{t('preferences')}</SectionLabel>
          <Card>
            <CardContent>
              <Row label={t('darkMode')}>
                <Moon color={colors.primary} size={16} />
                <Switch
                  value={colorScheme === 'dark'}
                  onValueChange={(v) => setColorScheme(v ? 'dark' : 'light')}
                />
              </Row>
              <View className="flex-row items-center justify-between py-3">
                <View className="flex-row items-center gap-2">
                  <Globe color={colors.primary} size={16} />
                  <Text className="text-base text-foreground">{t('language')}</Text>
                </View>
                <LanguageButtons />
              </View>
            </CardContent>
          </Card>
        </View>

        {/* ---------------- Institutional actions (Section G5) ---------------- */}
        <View>
          <SectionLabel>Institutional systems</SectionLabel>
          <Card className={settings.realDataMode ? 'border-primary/50' : ''}>
            <CardContent className="gap-3">
              <View className="flex-row items-center gap-2">
                <RadioTower size={20} color={colors.primary} />
                <Text className="text-lg font-bold text-foreground">Local backend mode</Text>
              </View>
              <Text className="text-sm text-muted-foreground">
                Off by default. This is the explicit opt-in, not a default.
              </Text>

              <View className="flex-row items-center justify-between gap-4 rounded-md border border-border p-3">
                <View className="flex-1">
                  <Text className="text-sm font-medium text-foreground">
                    {settings.realDataMode
                      ? 'Local backend mode is ON'
                      : 'Simulated on this device (default)'}
                  </Text>
                  <Text className="mt-1 text-xs text-muted-foreground">
                    {settings.realDataMode
                      ? 'Institutional actions now call the ResQKit backend on your own machine — creating a session, and sending it your context, called-112 status, triage answers, and location if captured. It never reaches any real emergency service.'
                      : 'Institutional actions (NG112 connection, PVR, the transcript websocket, NG protocol build) are faked on this device, with no network call at all — not even to your own backend.'}
                  </Text>
                </View>
                <Switch
                  value={settings.realDataMode}
                  onValueChange={(v) => {
                    updateSettings({ realDataMode: v });
                    toast.success(
                      v ? 'Local backend mode enabled.' : 'Back to simulated-on-device mode.',
                    );
                  }}
                />
              </View>

              <View className="flex-row items-start gap-2">
                <AlertTriangle size={14} color={colors.emergency} style={{ marginTop: 2 }} />
                <Text className="flex-1 text-xs text-muted-foreground">
                  Neither mode ever contacts a real emergency service. &quot;Local backend
                  received&quot; only means the ResQKit server on your own machine logged the action
                  to its own database — never 112, NG112, ISU, or any outside institution. The NG
                  protocol payload builder is proof-of-concept only, always returns
                  &quot;transmitted: false&quot;, and is not an authorized channel to Romanian
                  emergency services (STS/ANCOM). The only real 112 channel in this app is the
                  dialler button.
                </Text>
              </View>
            </CardContent>
          </Card>
        </View>

        <View>
          <Card>
            <CardContent className="gap-3">
              <View className="flex-row items-center gap-2">
                <ListTree size={20} color={colors.primary} />
                <Text className="text-lg font-bold text-foreground">Institutional actions trace</Text>
              </View>
              <Text className="text-sm text-muted-foreground">
                Every institutional action fired, most recent first, tagged by whether it reached
                your own backend or was faked on this device.
              </Text>

              {institutionalLog.length === 0 ? (
                <Text className="text-sm text-muted-foreground">
                  Nothing fired yet. Actions appear here as you go through the 112 call step, the
                  voice channel test, or the NG protocol preview during handoff.
                </Text>
              ) : (
                <View className="gap-2">
                  {[...institutionalLog].reverse().map((entry) => (
                    <View key={entry.id} className="rounded-md border border-border p-2.5">
                      <View className="flex-row flex-wrap items-center gap-1.5">
                        <Badge variant={entry.mode === 'real' ? 'default' : 'secondary'}>
                          {entry.mode === 'real' ? 'LOCAL BACKEND RECEIVED' : 'SIMULATED ON DEVICE'}
                        </Badge>
                        {!entry.ok && <Badge variant="outline">failed</Badge>}
                        <Text className="text-sm font-medium text-foreground">
                          {ACTION_LABELS[entry.action] ?? entry.action}
                        </Text>
                      </View>
                      <Text className="mt-1 text-xs text-muted-foreground">
                        {new Date(entry.at).toLocaleTimeString()} · {entry.detail}
                      </Text>
                    </View>
                  ))}
                </View>
              )}

              {institutionalLog.length > 0 && (
                <Button
                  variant="secondary"
                  size="sm"
                  onPress={() => {
                    clearInstitutionalLog();
                    toast.success('Institutional actions trace cleared.');
                  }}
                >
                  <Trash2 size={16} color={colors.secondaryForeground} />
                  <Text className="text-xs font-medium text-secondary-foreground">Clear trace</Text>
                </Button>
              )}
            </CardContent>
          </Card>
        </View>

        <View>
          <SectionLabel>{t('features')}</SectionLabel>
          <Card>
            <CardContent>
              <Row label={t('version')}>
                <View className="flex-row items-center gap-1.5">
                  <Info color={colors.mutedForeground} size={14} />
                  <Text className="text-sm text-muted-foreground">
                    {Constants.expoConfig?.version ?? '1.0.0'}
                  </Text>
                </View>
              </Row>
            </CardContent>
          </Card>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const LanguageButtons: React.FC = () => {
  const { updateSettings } = useSettings();
  const { i18n } = useTranslation();
  return (
    <View className="flex-row gap-1.5">
      {(['en', 'ro'] as const).map((lang) => (
        <Button
          key={lang}
          size="sm"
          variant={i18n.language.startsWith(lang) ? 'default' : 'secondary'}
          onPress={() => updateSettings({ uiLanguage: lang })}
        >
          {lang.toUpperCase()}
        </Button>
      ))}
    </View>
  );
};
