import React, { useMemo, useState } from 'react';
import { ScrollView, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { HelpCircle } from 'lucide-react-native';
import { Card, CardContent } from '@/components/ui/card';
import { Accordion } from '@/components/ui/accordion';
import { useTokenColors } from '@/lib/tokenColors';

interface FaqItem {
  q: string;
  a: string;
}

export default function FAQScreen() {
  const { t } = useTranslation('faq');
  const colors = useTokenColors();
  const items = t('items', { returnObjects: true }) as FaqItem[];
  const [search, setSearch] = useState('');

  // Ported from Alexandra's faqScreen.js search box — hers filters
  // question/answer substrings client-side too, this mirrors that.
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return items;
    return items.filter(
      (item) =>
        item.q.toLowerCase().includes(q) || item.a.toLowerCase().includes(q),
    );
  }, [items, search]);

  return (
    <SafeAreaView className="flex-1 bg-background" edges={['top']}>
      <ScrollView
        className="flex-1 px-4 py-4"
        contentContainerClassName="gap-4 pb-8"
      >
        <View className="flex-row items-center gap-2">
          <HelpCircle color={colors.primary} size={22} />
          <Text className="text-2xl font-bold text-foreground">
            {t('title')}
          </Text>
        </View>

        <View className="h-14 flex-row items-center gap-2 rounded-md border border-border bg-card px-4">
          <MaterialCommunityIcons
            name="magnify"
            size={22}
            color={colors.mutedForeground}
          />
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder="Search questions…"
            placeholderTextColor={colors.mutedForeground}
            className="flex-1 text-base text-foreground"
          />
        </View>

        {filtered.length === 0 ? (
          <Text className="text-sm text-muted-foreground">
            No questions match &quot;{search}&quot;.
          </Text>
        ) : (
          <Card>
            <CardContent>
              <Accordion
                items={filtered.map((item, index) => ({
                  key: String(index),
                  trigger: item.q,
                  content: item.a,
                }))}
              />
            </CardContent>
          </Card>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
