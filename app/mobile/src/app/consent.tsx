/**
 * S1 — Disclaimer and consent gate (RN port of app/frontend/src/pages/Consent.tsx).
 *
 * Two separate decisions, never bundled (GDPR Art. 7): the mandatory
 * acknowledgement that ResQKit is not an emergency service, and the optional,
 * granular consent to store health data locally.
 */
import React, { useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { AlertTriangle, Check, Lock } from 'lucide-react-native';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { callEmergencyServices } from '@/components/AppShell';
import { useIncident } from '@/contexts/IncidentContext';
import { useTokenColors } from '@/lib/tokenColors';

export default function ConsentScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ next?: string }>();
  const next = params.next ?? '/';
  const { consent, updateConsent, startIncident } = useIncident();
  const colors = useTokenColors();

  const [ack, setAck] = useState(consent.disclaimerAcknowledged);
  const [health, setHealth] = useState(consent.healthDataConsent);

  const confirm = () => {
    const now = new Date().toISOString();
    updateConsent({
      disclaimerAcknowledged: true,
      disclaimerAt: consent.disclaimerAt ?? now,
      healthDataConsent: health,
      healthDataConsentAt: health ? (consent.healthDataConsentAt ?? now) : null,
    });
    if (next === '/emergency') startIncident();
    router.replace(next as never);
  };

  return (
    <ScrollView className="flex-1 bg-background" contentContainerClassName="gap-5 p-4 pb-10">
      <View>
        <Text className="text-2xl font-bold text-foreground">Before you use ResQKit</Text>
        <Text className="mt-2 text-sm text-muted-foreground">
          Read this once. It takes fifteen seconds and it decides what this app is allowed to do.
        </Text>
      </View>

      <Card className="border-emergency/40">
        <CardHeader className="pb-3">
          <View className="flex-row items-center gap-2">
            <AlertTriangle size={20} color={colors.emergency} />
            <CardTitle>ResQKit is not an emergency service</CardTitle>
          </View>
        </CardHeader>
        <CardContent className="gap-3">
          <View className="gap-1.5">
            {[
              'It does not call 112 for you and does not notify anyone automatically.',
              'It does not transmit your location to emergency services.',
              'It gives general first-aid orientation for bystanders. It is not a medical device and not a diagnosis.',
              'The legal information it shows is sourced reference material, not legal advice for your specific case.',
              'Always follow the instructions of the 112 operator over anything shown here.',
            ].map((line) => (
              <View key={line} className="flex-row gap-2">
                <Text className="text-sm text-muted-foreground">{'•'}</Text>
                <Text className="flex-1 text-sm text-muted-foreground">{line}</Text>
              </View>
            ))}
          </View>

          <Pressable
            onPress={() => setAck(!ack)}
            className="flex-row items-start gap-3 rounded-md border border-border bg-background p-3"
          >
            <Checkbox
              checked={ack}
              onCheckedChange={setAck}
              accessibilityLabel="Acknowledge that ResQKit does not replace emergency services"
              className="mt-0.5"
            />
            <Text className="flex-1 text-sm text-foreground">
              I understand ResQKit assists me and never replaces calling 112.
              <Text className="text-emergency"> (required)</Text>
            </Text>
          </Pressable>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <View className="flex-row items-center gap-2">
            <Lock size={20} color={colors.primary} />
            <CardTitle>Health data in your Safety Profile</CardTitle>
          </View>
        </CardHeader>
        <CardContent className="gap-3">
          <Text className="text-sm text-muted-foreground">
            Blood type, allergies, conditions, medication and implants are special-category health
            data under GDPR Article 9. This is optional and separate from the acknowledgement above —
            the app works fully without it.
          </Text>
          <Text className="text-sm text-muted-foreground">
            If you allow it, this data is stored on this device only. It is never uploaded. It is
            shown to rescuers only when you tap Share on the handoff screen, and you can delete it at
            any time.
          </Text>
          <Pressable
            onPress={() => setHealth(!health)}
            className="flex-row items-start gap-3 rounded-md border border-border bg-background p-3"
          >
            <Checkbox
              checked={health}
              onCheckedChange={setHealth}
              accessibilityLabel="Consent to store health data locally"
              className="mt-0.5"
            />
            <Text className="flex-1 text-sm text-foreground">
              I consent to storing my health data on this device.
              <Text className="text-muted-foreground"> (optional, withdrawable)</Text>
            </Text>
          </Pressable>
        </CardContent>
      </Card>

      <View className="gap-2">
        <Button size="lg" disabled={!ack} onPress={confirm}>
          <Check size={20} color={colors.primaryForeground} />
          <Text className="text-base font-medium text-primary-foreground">Continue</Text>
        </Button>
        <Button size="lg" variant="emergency" onPress={callEmergencyServices}>
          Skip and call 112
        </Button>
      </View>
    </ScrollView>
  );
}
