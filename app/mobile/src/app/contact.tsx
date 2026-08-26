/**
 * Contact — submits via a plain mailto: link (Linking.openURL), no backend
 * endpoint. Mirrors app/frontend/src/pages/Contact.tsx.
 */
import React, { useState } from 'react';
import { Linking, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { Mail, Send } from 'lucide-react-native';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

const SUPPORT_EMAIL = 'support@resqkit.com';

export default function ContactScreen() {
  const { t } = useTranslation('contact');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');

  const send = () => {
    const body = [message, '', name && `${t('name')}: ${name}`, email && `${t('emailLabel')}: ${email}`]
      .filter(Boolean)
      .join('\n');
    const params = new URLSearchParams({ subject: subject || t('title'), body });
    void Linking.openURL(`mailto:${SUPPORT_EMAIL}?${params.toString()}`);
  };

  return (
    <SafeAreaView className="flex-1 bg-background" edges={['top']}>
      <ScrollView className="flex-1 px-4 py-4" contentContainerClassName="gap-4 pb-8">
        <View className="flex-row items-center gap-2">
          <Mail color="hsl(202 74% 42%)" size={22} />
          <Text className="text-2xl font-bold text-foreground">{t('title')}</Text>
        </View>
        <Text className="text-sm text-muted-foreground">{t('subtitle')}</Text>

        <Card>
          <CardContent>
            <Text className="text-primary" onPress={() => Linking.openURL(`mailto:${SUPPORT_EMAIL}`)}>
              {SUPPORT_EMAIL}
            </Text>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="gap-3">
            <Text className="font-semibold text-foreground">{t('formTitle')}</Text>
            <Input value={name} onChangeText={setName} placeholder={t('namePlaceholder')} />
            <Input
              value={email}
              onChangeText={setEmail}
              placeholder={t('emailPlaceholder')}
              autoCapitalize="none"
              keyboardType="email-address"
            />
            <Input value={subject} onChangeText={setSubject} placeholder={t('subjectPlaceholder')} />
            <Input
              value={message}
              onChangeText={setMessage}
              placeholder={t('messagePlaceholder')}
              multiline
              numberOfLines={4}
              className="h-24 pt-3"
            />
            <Button onPress={send}>
              <Send color="white" size={16} />
              <Text className="font-medium text-primary-foreground">{t('send')}</Text>
            </Button>
            <Text className="text-xs text-muted-foreground">{t('sendHint')}</Text>
          </CardContent>
        </Card>
      </ScrollView>
    </SafeAreaView>
  );
}
