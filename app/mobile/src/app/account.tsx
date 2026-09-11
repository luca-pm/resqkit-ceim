/**
 * Cont (Account) — shows client.auth.me() fields + relevant profile info,
 * and is the hub screen for Settings/FAQ/Contact/Tutoriale (per Section E6's
 * nav design — no Figma nav/IA was actually provided, this is a reasonable
 * default). Kit ID / kit expiration date are deliberately excluded — those
 * belong to the deferred physical-device feature (Section E8).
 */
import React from 'react';
import { ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import {
  ChevronRight,
  HelpCircle,
  LogOut,
  Mail,
  Settings as SettingsIcon,
  UserRound,
  GraduationCap,
} from 'lucide-react-native';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { useTokenColors } from '@/lib/tokenColors';

const NavRow: React.FC<{ icon: React.ReactNode; label: string; onPress: () => void }> = ({
  icon,
  label,
  onPress,
}) => {
  const colors = useTokenColors();
  return (
    <Button variant="ghost" onPress={onPress} className="w-full justify-between px-0">
      <View className="flex-row items-center gap-3">
        <View className="h-9 w-9 items-center justify-center rounded-md bg-primary-tint">{icon}</View>
        <Text className="text-base text-foreground">{label}</Text>
      </View>
      <ChevronRight color={colors.mutedForeground} size={18} />
    </Button>
  );
};

export default function AccountScreen() {
  const { t } = useTranslation('account');
  const { t: tc } = useTranslation('common');
  const { user, loading, logout } = useAuth();
  const colors = useTokenColors();

  return (
    <SafeAreaView className="flex-1 bg-background" edges={['top']}>
      <ScrollView className="flex-1 px-4 py-4" contentContainerClassName="gap-4 pb-8">
        <Text className="text-2xl font-bold text-foreground">{t('title')}</Text>

        {!loading && !user && (
          <Card>
            <CardContent className="gap-3">
              <Text className="text-sm text-muted-foreground">{t('signInPrompt')}</Text>
              <Button onPress={() => router.push('/sign-in')}>{t('signInAction')}</Button>
            </CardContent>
          </Card>
        )}

        {user && (
          <>
            <Card>
              <CardContent className="gap-1">
                <View className="mb-2 flex-row items-center gap-3">
                  <View className="h-12 w-12 items-center justify-center rounded-full bg-muted">
                    <UserRound color={colors.mutedForeground} size={22} />
                  </View>
                  <View>
                    <Text className="font-bold text-foreground">{user.name || user.email}</Text>
                    <Text className="text-xs text-muted-foreground">{user.email}</Text>
                  </View>
                </View>
              </CardContent>
            </Card>
            <Button variant="outline" onPress={() => void logout()}>
              <LogOut color={colors.foreground} size={16} />
              <Text className="font-medium text-foreground">{t('logOut')}</Text>
            </Button>
          </>
        )}

        <Card>
          <CardContent className="gap-1">
            <NavRow
              icon={<SettingsIcon color={colors.primary} size={18} />}
              label={tc('nav.settings')}
              onPress={() => router.push('/settings')}
            />
            <NavRow
              icon={<GraduationCap color={colors.primary} size={18} />}
              label={tc('nav.tutorials')}
              onPress={() => router.push('/tutorials')}
            />
            <NavRow
              icon={<HelpCircle color={colors.primary} size={18} />}
              label={tc('nav.faq')}
              onPress={() => router.push('/faq')}
            />
            <NavRow
              icon={<Mail color={colors.primary} size={18} />}
              label={tc('nav.contact')}
              onPress={() => router.push('/contact')}
            />
          </CardContent>
        </Card>
      </ScrollView>
    </SafeAreaView>
  );
}
