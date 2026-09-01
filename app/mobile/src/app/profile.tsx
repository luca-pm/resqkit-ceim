/**
 * S2 — Safety Profile (RN port of app/frontend/src/pages/Profile.tsx).
 *
 * Medical fields are gated behind the separate, explicit health-data consent
 * (GDPR Art. 9) and stay locked until it is given. Everything here lives on
 * this device only and is shared solely through an explicit Share action on
 * the handoff screen.
 */
import React from 'react';
import { ScrollView, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Lock, Trash2, UserRound } from 'lucide-react-native';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from '@/components/ui/toast';
import { useIncident } from '@/contexts/IncidentContext';
import { useTokenColors } from '@/lib/tokenColors';

export default function ProfileScreen() {
  const router = useRouter();
  const { profile, updateProfile, deleteProfile, consent } = useIncident();
  const colors = useTokenColors();

  const healthAllowed = consent.healthDataConsent;

  const field = (
    label: string,
    value: string,
    onChange: (text: string) => void,
    placeholder: string,
    opts: { disabled?: boolean; keyboardType?: 'phone-pad' | 'default' } = {},
  ) => (
    <View className="gap-1.5">
      <Label>{label}</Label>
      <Input
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor={colors.mutedForeground}
        editable={!opts.disabled}
        keyboardType={opts.keyboardType ?? 'default'}
        className={opts.disabled ? 'opacity-50' : ''}
      />
    </View>
  );

  return (
    <ScrollView className="flex-1 bg-background" contentContainerClassName="gap-5 p-4 pb-10">
      <View>
        <Text className="text-2xl font-bold text-foreground">Safety Profile</Text>
        <Text className="mt-2 text-sm text-muted-foreground">
          What a paramedic would want to know about you in the first thirty seconds. Stored on this
          device only, and shared only when you tap Share on a handoff card.
        </Text>
      </View>

      <Card>
        <CardHeader className="pb-3">
          <View className="flex-row items-center gap-2">
            <UserRound size={20} color={colors.primary} />
            <CardTitle>Identity and contact</CardTitle>
          </View>
          <CardDescription>Not special-category data, but still only kept locally.</CardDescription>
        </CardHeader>
        <CardContent className="gap-4">
          {field(
            'Name',
            profile.displayName,
            (t) => updateProfile({ displayName: t }),
            'How rescuers should address you',
          )}
          {field(
            'Preferred language',
            profile.language,
            (t) => updateProfile({ language: t }),
            'e.g. Romanian, English',
          )}
          {field(
            'Emergency contact name',
            profile.emergencyContactName,
            (t) => updateProfile({ emergencyContactName: t }),
            'Next of kin',
          )}
          {field(
            'Emergency contact phone',
            profile.emergencyContactPhone,
            (t) => updateProfile({ emergencyContactPhone: t }),
            '+40 ...',
            { keyboardType: 'phone-pad' },
          )}
        </CardContent>
      </Card>

      <Card className={healthAllowed ? '' : 'border-dashed'}>
        <CardHeader className="pb-3">
          <View className="flex-row items-center gap-2">
            <Lock size={20} color={colors.primary} />
            <CardTitle>Medical facts</CardTitle>
          </View>
          <CardDescription>
            Special-category health data under GDPR Article 9. Requires your explicit consent.
          </CardDescription>
        </CardHeader>
        <CardContent className="gap-4">
          {!healthAllowed && (
            <View className="rounded-md border border-border bg-muted p-3">
              <Text className="text-sm text-muted-foreground">
                These fields are locked because you have not consented to storing health data on this
                device.
              </Text>
              <Button
                size="sm"
                variant="secondary"
                className="mt-2"
                onPress={() => router.push({ pathname: '/consent', params: { next: '/profile' } })}
              >
                Review consent
              </Button>
            </View>
          )}

          {field('Blood type', profile.bloodType, (t) => updateProfile({ bloodType: t }), 'e.g. 0 Rh+', {
            disabled: !healthAllowed,
          })}
          {field(
            'Allergies',
            profile.allergies,
            (t) => updateProfile({ allergies: t }),
            'e.g. penicillin',
            { disabled: !healthAllowed },
          )}
          {field(
            'Conditions',
            profile.conditions,
            (t) => updateProfile({ conditions: t }),
            'e.g. diabetes, epilepsy',
            { disabled: !healthAllowed },
          )}
          {field(
            'Medication',
            profile.medications,
            (t) => updateProfile({ medications: t }),
            'e.g. anticoagulants',
            { disabled: !healthAllowed },
          )}
          {field(
            'Implants or devices',
            profile.implants,
            (t) => updateProfile({ implants: t }),
            'e.g. pacemaker',
            { disabled: !healthAllowed },
          )}
        </CardContent>
      </Card>

      <Card className="border-destructive/40">
        <CardContent className="gap-3">
          <Text className="text-sm text-muted-foreground">
            Deleting your profile removes every field above from this device immediately. Your
            consent record is kept separately and is not affected.
          </Text>
          <Button
            variant="destructive"
            size="sm"
            onPress={() => {
              deleteProfile();
              toast.success('Safety Profile deleted from this device.');
            }}
          >
            <Trash2 size={16} color={colors.destructiveForeground} />
            <Text className="text-xs font-medium text-destructive-foreground">Delete profile</Text>
          </Button>
        </CardContent>
      </Card>
    </ScrollView>
  );
}
