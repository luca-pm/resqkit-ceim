/**
 * S11 — Learn & practise (RN port of app/frontend/src/pages/Learn.tsx).
 *
 * Calm-time walkthrough of every procedure in the content pack. Same curated
 * steps the emergency wizard uses, read-only here, so practising can never
 * diverge from what the app will actually tell you during an incident.
 */
import React, { useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { ChevronDown, ChevronUp, GraduationCap } from 'lucide-react-native';

import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import SourceNote from '@/components/SourceNote';
import { PROCEDURES } from '@/lib/knowledge';
import { useTokenColors } from '@/lib/tokenColors';

export default function LearnScreen() {
  // Optional deep-link from Home's search — e.g. /learn?openId=cpr_aed
  // pre-expands that procedure. Absent in every other entry point, so this
  // is additive: normal tab navigation still lands with nothing open.
  const { openId: openIdParam } = useLocalSearchParams<{ openId?: string }>();
  const [openId, setOpenId] = useState<string | null>(openIdParam ?? null);
  const colors = useTokenColors();

  // Tab screens stay mounted in the background (expo-router's Tabs), so a
  // second search hit while this tab is already alive needs to re-sync — the
  // useState initializer above only fires on first mount. Adjusting state
  // during render (rather than in an effect) is the documented pattern for
  // "reset state when a prop changes": https://react.dev/learn/you-might-not-need-an-effect
  const [lastOpenIdParam, setLastOpenIdParam] = useState(openIdParam);
  if (openIdParam !== lastOpenIdParam) {
    setLastOpenIdParam(openIdParam);
    if (openIdParam) setOpenId(openIdParam);
  }

  return (
    <ScrollView
      className="flex-1 bg-background"
      contentContainerClassName="gap-5 p-4 pb-10"
    >
      <View>
        <View className="flex-row items-center gap-2">
          <GraduationCap size={22} color={colors.primary} />
          <Text className="text-2xl font-bold text-foreground">
            Learn &amp; practise
          </Text>
        </View>
        <Text className="mt-2 text-sm text-muted-foreground">
          Read these now, while nothing is happening. These are the exact steps
          ResQKit will show you during an incident.
        </Text>
      </View>

      <View className="gap-3">
        {PROCEDURES.map((proc) => {
          const open = openId === proc.id;
          return (
            <Card key={proc.id}>
              <Pressable onPress={() => setOpenId(open ? null : proc.id)}>
                <CardContent className="flex-row items-center justify-between gap-2">
                  <View className="flex-1">
                    <Text className="font-semibold text-foreground">
                      {proc.name}
                    </Text>
                    <Text className="mt-0.5 text-xs text-muted-foreground">
                      {`${proc.steps.length} steps · ${proc.shortLabel}`}
                    </Text>
                  </View>
                  {open ? (
                    <ChevronUp size={18} color={colors.mutedForeground} />
                  ) : (
                    <ChevronDown size={18} color={colors.mutedForeground} />
                  )}
                </CardContent>
              </Pressable>

              {open && (
                <CardContent className="gap-3 pt-0">
                  {proc.steps.map((step, i) => (
                    <View key={`${proc.id}-${i}`} className="gap-1">
                      <View className="flex-row items-center gap-2">
                        <Text className="text-sm font-semibold text-foreground">
                          {`${i + 1}. ${step.title}`}
                        </Text>
                        {step.critical && (
                          <Badge variant="emergency" tone="pastel">
                            critical
                          </Badge>
                        )}
                      </View>
                      <Text className="text-sm text-muted-foreground">
                        {step.detail}
                      </Text>
                      {step.withoutItem && (
                        <Text className="text-xs text-muted-foreground">
                          Without equipment: {step.withoutItem}
                        </Text>
                      )}
                    </View>
                  ))}
                  <Text className="text-xs text-muted-foreground">
                    {proc.clinicalReview === 'pending'
                      ? 'Bystander orientation, pending independent clinical sign-off. Follow the 112 operator over this screen.'
                      : 'Clinically reviewed content. Still follow the 112 operator over this screen.'}
                  </Text>
                  <SourceNote sources={proc.sources} />
                </CardContent>
              )}
            </Card>
          );
        })}
      </View>
    </ScrollView>
  );
}
