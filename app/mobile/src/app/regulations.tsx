/**
 * S11b — Risks & regulations (RN port of app/frontend/src/pages/Regulations.tsx).
 *
 * Sourced EU/Romanian obligations from the curated content pack. Every card
 * carries its instrument, articles and verification date — this is reference
 * material, never legal advice, and the app never renders an unsourced claim.
 */
import React, { useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { AlertCircle, ChevronDown, ChevronUp, Scale } from 'lucide-react-native';

import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import SourceNote from '@/components/SourceNote';
import { OBLIGATIONS, PENDING_VERIFICATION } from '@/lib/knowledge';
import { useTokenColors } from '@/lib/tokenColors';

export default function RegulationsScreen() {
  const [openId, setOpenId] = useState<string | null>(null);
  const colors = useTokenColors();

  return (
    <ScrollView className="flex-1 bg-background" contentContainerClassName="gap-5 p-4 pb-10">
      <View>
        <View className="flex-row items-center gap-2">
          <Scale size={22} color={colors.primary} />
          <Text className="text-2xl font-bold text-foreground">Risks &amp; regulations</Text>
        </View>
        <Text className="mt-2 text-sm text-muted-foreground">
          Sourced reference material on what the law actually requires. This is not legal advice for
          your specific situation.
        </Text>
      </View>

      <View className="gap-3">
        {OBLIGATIONS.map((ob) => {
          const open = openId === ob.id;
          return (
            <Card key={ob.id}>
              <Pressable onPress={() => setOpenId(open ? null : ob.id)}>
                <CardContent className="gap-2">
                  <View className="flex-row items-start justify-between gap-2">
                    <Text className="flex-1 font-semibold text-foreground">{ob.title}</Text>
                    {open ? (
                      <ChevronUp size={18} color={colors.mutedForeground} />
                    ) : (
                      <ChevronDown size={18} color={colors.mutedForeground} />
                    )}
                  </View>
                  <Text className="text-sm text-muted-foreground">{ob.summary}</Text>
                  <View className="flex-row flex-wrap gap-1.5">
                    <Badge variant="secondary">{ob.jurisdiction}</Badge>
                    {ob.tags.map((tag) => (
                      <Badge key={tag} variant="outline">
                        {tag}
                      </Badge>
                    ))}
                  </View>
                </CardContent>
              </Pressable>

              {open && (
                <CardContent className="gap-2 pt-0">
                  <Text className="text-sm text-foreground">{ob.detail}</Text>
                  <Text className="text-xs text-muted-foreground">
                    <Text className="font-semibold">Instrument: </Text>
                    {ob.instrument}
                  </Text>
                  <Text className="text-xs text-muted-foreground">
                    <Text className="font-semibold">Articles: </Text>
                    {ob.articles}
                  </Text>
                  <Text className="text-xs text-muted-foreground">
                    <Text className="font-semibold">Last verified: </Text>
                    {ob.lastVerified}
                  </Text>
                  <SourceNote sources={[ob.sourceDoc]} />
                </CardContent>
              )}
            </Card>
          );
        })}
      </View>

      {PENDING_VERIFICATION.length > 0 && (
        <Card className="border-dashed">
          <CardContent className="gap-2">
            <View className="flex-row items-center gap-2">
              <AlertCircle size={16} color={colors.emergency} />
              <Text className="font-semibold text-foreground">Known gaps in this content pack</Text>
            </View>
            {PENDING_VERIFICATION.map((item) => (
              <View key={item.topic} className="gap-0.5">
                <Text className="text-sm font-medium text-foreground">{item.topic}</Text>
                <Text className="text-xs text-muted-foreground">{item.note}</Text>
              </View>
            ))}
          </CardContent>
        </Card>
      )}
    </ScrollView>
  );
}
