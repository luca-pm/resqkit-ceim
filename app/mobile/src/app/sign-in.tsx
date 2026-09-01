/**
 * Sign In — email/password only, ported from app/frontend's Login.tsx logic.
 * Google/Apple buttons are shown disabled ("coming soon") — real OAuth needs
 * external Google/Apple developer accounts the user hasn't set up yet.
 * See Section E of the plan.
 */
import React, { useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { AlertCircle } from 'lucide-react-native';
import { Card, CardContent } from '@/components/ui/card';
import { Input, PasswordInput } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { client, getAPIBaseURL } from '@/lib/apiClient';
import { useAuth } from '@/contexts/AuthContext';
import { useTokenColors } from '@/lib/tokenColors';

/** Shape rejected by apiClient's response interceptor. */
interface ApiError {
  status?: number;
  message?: string;
}

export default function SignInScreen() {
  const { t } = useTranslation('auth');
  const { refetch } = useAuth();
  const colors = useTokenColors();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    setError('');
    setLoading(true);
    try {
      await client.auth.login(email.trim(), password);
      await refetch();
      router.back();
    } catch (e) {
      // A wrong password and an unreachable server produced the same message
      // before, which made "the password stopped working" impossible to tell
      // apart from "the phone can't see the dev backend" — the single most
      // common failure while testing on a hotspot. Split them.
      const err = e as ApiError;
      if (err.status === 401) {
        setError(t('errorCredentials'));
      } else if (err.status === undefined) {
        setError(t('errorNetwork', { url: getAPIBaseURL() }));
      } else {
        setError(t('errorServer', { status: err.status }));
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-background" edges={['top']}>
      <ScrollView className="flex-1 px-4 py-6" contentContainerClassName="gap-4">
        <Text className="text-3xl font-bold text-foreground">{t('welcome')}</Text>
        <Text className="text-sm font-semibold uppercase text-muted-foreground">{t('signIn')}</Text>

        <View className="gap-1.5">
          <Text className="text-sm font-medium text-foreground">{t('email')}</Text>
          <Input
            value={email}
            onChangeText={setEmail}
            placeholder={t('emailPlaceholder')}
            autoCapitalize="none"
            keyboardType="email-address"
          />
        </View>
        <View className="gap-1.5">
          <Text className="text-sm font-medium text-foreground">{t('password')}</Text>
          <PasswordInput value={password} onChangeText={setPassword} />
        </View>

        {error !== '' && (
          <View className="flex-row items-center gap-2 rounded-md border border-destructive/40 bg-destructive/5 p-3">
            <AlertCircle color={colors.destructive} size={16} />
            <Text className="flex-1 text-sm text-destructive">{error}</Text>
          </View>
        )}

        <Button onPress={submit} loading={loading} disabled={!email || !password}>
          {t('signInButton')}
        </Button>

        <View className="flex-row items-center gap-3">
          <View className="h-px flex-1 bg-border" />
          <Text className="text-xs text-muted-foreground">{t('or')}</Text>
          <View className="h-px flex-1 bg-border" />
        </View>

        <View className="flex-row gap-3">
          <View className="flex-1">
            <Button variant="outline" disabled>
              {t('google')}
            </Button>
            <Text className="mt-1 text-center text-[10px] text-muted-foreground">
              {t('actions.comingSoon', { ns: 'common' })}
            </Text>
          </View>
          <View className="flex-1">
            <Button variant="outline" disabled>
              {t('apple')}
            </Button>
            <Text className="mt-1 text-center text-[10px] text-muted-foreground">
              {t('actions.comingSoon', { ns: 'common' })}
            </Text>
          </View>
        </View>

        <Card className="mt-2 border-dashed">
          <CardContent>
            <Text className="text-xs text-muted-foreground">{t('emergencyNotice')}</Text>
          </CardContent>
        </Card>
      </ScrollView>
    </SafeAreaView>
  );
}
