import React from 'react';
import { ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { HelpCircle } from 'lucide-react-native';
import { Card, CardContent } from '@/components/ui/card';
import { Accordion } from '@/components/ui/accordion';

interface FaqItem {
  q: string;
  a: string;
}

export default function FAQScreen() {
  const { t } = useTranslation('faq');
  const items = t('items', { returnObjects: true }) as FaqItem[];

  return (
    <SafeAreaView className="flex-1 bg-background" edges={['top']}>
      <ScrollView className="flex-1 px-4 py-4" contentContainerClassName="gap-4 pb-8">
        <View className="flex-row items-center gap-2">
          <HelpCircle color="hsl(202 74% 42%)" size={22} />
          <Text className="text-2xl font-bold text-foreground">{t('title')}</Text>
        </View>
        <Card>
          <CardContent>
            <Accordion
              items={items.map((item, index) => ({ key: String(index), trigger: item.q, content: item.a }))}
            />
          </CardContent>
        </Card>
      </ScrollView>
    </SafeAreaView>
  );
}
