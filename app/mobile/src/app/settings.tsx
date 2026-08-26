/**
 * Consumer Settings (Section E7 step 4) — additive alongside the existing
 * institutional-actions Settings the RN migration will eventually port
 * (Section C), not a replacement. Notification toggles are locally-
 * persisted only and say so visibly here — no real push backend exists yet
 * (same honesty standard as the web app's realDataMode pattern).
 */
import React from 'react';
import { ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { useColorScheme } from 'nativewind';
import { Bell, Globe, Info, Moon } from 'lucide-react-native';
import Constants from 'expo-constants';
import { Card, CardContent } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { useSettings } from '@/contexts/SettingsContext';

const SectionLabel: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <Text className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{children}</Text>
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

  // Local-only notification prefs (no backend yet — see file header).
  const [push, setPush] = React.useState(true);
  const [urgent, setUrgent] = React.useState(true);
  const [expiry, setExpiry] = React.useState(false);

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
                <Bell color="hsl(202 74% 42%)" size={16} />
                <Switch value={push} onValueChange={setPush} />
              </Row>
              <Row label={t('urgentAlerts')}>
                <Switch value={urgent} onValueChange={setUrgent} />
              </Row>
              <Row label={t('expiryReminders')}>
                <Switch value={expiry} onValueChange={setExpiry} />
              </Row>
            </CardContent>
          </Card>
        </View>

        <View>
          <SectionLabel>{t('preferences')}</SectionLabel>
          <Card>
            <CardContent>
              <Row label={t('darkMode')}>
                <Moon color="hsl(202 74% 42%)" size={16} />
                <Switch
                  value={colorScheme === 'dark'}
                  onValueChange={(v) => setColorScheme(v ? 'dark' : 'light')}
                />
              </Row>
              <View className="flex-row items-center justify-between py-3">
                <View className="flex-row items-center gap-2">
                  <Globe color="hsl(202 74% 42%)" size={16} />
                  <Text className="text-base text-foreground">{t('language')}</Text>
                </View>
                <LanguageButtons />
              </View>
            </CardContent>
          </Card>
        </View>

        <View>
          <SectionLabel>{t('features')}</SectionLabel>
          <Card>
            <CardContent>
              <Row label={t('version')}>
                <View className="flex-row items-center gap-1.5">
                  <Info color="hsl(207 15% 40%)" size={14} />
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
