import React, { useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { GraduationCap, Play } from 'lucide-react-native';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

interface TutorialItem {
  id: string;
  title: string;
  description: string;
}

export default function TutorialsScreen() {
  const { t } = useTranslation('tutorials');
  const [tab, setTab] = useState<'video' | 'text'>('video');
  const items = t('items', { returnObjects: true }) as TutorialItem[];

  return (
    <SafeAreaView className="flex-1 bg-background" edges={['top']}>
      <ScrollView className="flex-1 px-4 py-4" contentContainerClassName="gap-4 pb-8">
        <View className="flex-row items-center gap-2">
          <GraduationCap color="hsl(202 74% 42%)" size={22} />
          <Text className="text-2xl font-bold text-foreground">{t('title')}</Text>
        </View>

        <View className="flex-row gap-2">
          <Button variant={tab === 'video' ? 'default' : 'secondary'} className="flex-1" onPress={() => setTab('video')}>
            {t('videoTab')}
          </Button>
          <Button variant={tab === 'text' ? 'default' : 'secondary'} className="flex-1" onPress={() => setTab('text')}>
            {t('textTab')}
          </Button>
        </View>

        {items.map((item) => (
          <Card key={item.id}>
            <CardContent className="flex-row gap-3">
              {tab === 'video' && (
                <View className="h-16 w-16 items-center justify-center rounded-md bg-muted">
                  <Play color="hsl(207 15% 40%)" size={20} />
                </View>
              )}
              <View className="flex-1">
                <Text className="font-semibold text-foreground">{item.title}</Text>
                <Text className="mt-1 text-sm text-muted-foreground">{item.description}</Text>
                {tab === 'video' && (
                  <Text className="mt-2 self-start rounded-full bg-secondary px-2.5 py-0.5 text-xs font-semibold text-secondary-foreground">
                    {t('videoComingSoon')}
                  </Text>
                )}
              </View>
            </CardContent>
          </Card>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}
