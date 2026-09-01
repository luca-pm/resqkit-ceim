/**
 * S3–S8 — the emergency wizard (RN port of app/frontend/src/pages/Emergency.tsx).
 *
 * Stage order is deliberate and matches the MVP flow: context, then the 112
 * gate (which can never be silently skipped), then triage, hazards, kit, and
 * only then guided first aid. Location is captured from the device but is used
 * solely to help the user tell the dispatcher where they are — it is never
 * transmitted anywhere by the app.
 */
import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import * as Clipboard from 'expo-clipboard';
import * as Location from 'expo-location';
import {
  Anchor,
  Building2,
  Car,
  Check,
  ChevronRight,
  Copy,
  Crosshair,
  HelpCircle,
  Mountain,
  Phone,
  Radio,
  ShieldAlert,
  Users,
} from 'lucide-react-native';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from '@/components/ui/toast';
import { callEmergencyServices } from '@/components/AppShell';
import KitScanner from '@/components/KitScanner';
import ProcedureRunner from '@/components/ProcedureRunner';
import { useIncident } from '@/contexts/IncidentContext';
import { buildDispatcherScript, formatCoords } from '@/lib/brief';
import {
  connectNg112,
  ensureSession,
  logHazards,
  logKitSelection,
  logProcedureStep,
  logTriageAnswer,
  testInstitutionalVoiceChannel,
} from '@/lib/institutionalActions';
import {
  CONTEXTS,
  INJURY_OPTIONS,
  hazardsForContext,
  procedureById,
  routeProcedure,
} from '@/lib/knowledge';
import { CompletedStep } from '@/lib/storage';
import { useTokenColors } from '@/lib/tokenColors';

type Stage = 'context' | 'call' | 'triage' | 'hazards' | 'kit' | 'guide';

const CONTEXT_ICONS: Record<string, React.ComponentType<{ size?: number; color?: string }>> = {
  car: Car,
  building: Building2,
  anchor: Anchor,
  mountain: Mountain,
  help: HelpCircle,
};

const AGE_BANDS = ['', 'Infant (under 1)', 'Child', 'Adult', 'Elderly'];
const AGE_LABELS: Record<string, string> = { '': 'Not sure' };

const TRAPPED_OPTIONS = [
  { value: '', label: 'Not recorded' },
  { value: 'Accessible', label: 'Yes, I can reach them' },
  { value: 'Trapped in vehicle', label: 'Trapped in a vehicle' },
  { value: 'Trapped under load or debris', label: 'Trapped under load or debris' },
  { value: 'In water', label: 'In the water' },
  { value: 'Unreachable — hazard in the way', label: 'Unreachable, hazard in the way' },
];

const POWERTRAIN_OPTIONS = [
  { value: '', label: 'Not sure' },
  { value: 'Petrol or diesel', label: 'Petrol or diesel' },
  { value: 'Electric (high-voltage battery)', label: 'Electric (high-voltage battery)' },
  { value: 'Hybrid', label: 'Hybrid' },
  { value: 'LPG or CNG', label: 'LPG or CNG' },
  { value: 'Heavy goods vehicle', label: 'Heavy goods vehicle' },
];

/** RN has no <select>; a chip row keeps every option one tap away. */
const ChipSelect: React.FC<{
  options: { value: string; label: string }[];
  value: string;
  onChange: (value: string) => void;
}> = ({ options, value, onChange }) => (
  <View className="flex-row flex-wrap gap-2">
    {options.map((opt) => {
      const active = value === opt.value;
      return (
        <Pressable
          key={opt.value || '__none'}
          onPress={() => onChange(opt.value)}
          accessibilityRole="radio"
          accessibilityState={{ selected: active }}
          className={`rounded-md border px-3 py-2 ${
            active ? 'border-primary bg-primary/10' : 'border-border bg-card'
          }`}
        >
          <Text className={`text-sm ${active ? 'font-medium text-foreground' : 'text-muted-foreground'}`}>
            {opt.label}
          </Text>
        </Pressable>
      );
    })}
  </View>
);

export default function EmergencyScreen() {
  const router = useRouter();
  const {
    ready,
    consent,
    incident,
    startIncident,
    updateIncident,
    settings,
    updateSettings,
    logInstitutional,
  } = useIncident();
  const colors = useTokenColors();

  // Stage is DERIVED from the incident until the user navigates explicitly,
  // rather than synced via an effect. Two benefits over the web version's
  // approach: no setState-in-effect cascade, and resuming a saved incident
  // that already has a context lands directly on the 112 gate instead of
  // flashing the context picker first.
  const [stageOverride, setStageOverride] = useState<Stage | null>(null);
  const stage: Stage = stageOverride ?? (incident?.context ? 'call' : 'context');
  const setStage = setStageOverride;

  const [locating, setLocating] = useState(false);
  const [testingVoiceChannel, setTestingVoiceChannel] = useState(false);

  const onSession = (id: string, code: string | null) =>
    updateIncident({ backendSessionId: id, sessionCode: code });

  useEffect(() => {
    if (!ready) return;
    if (!consent.disclaimerAcknowledged) {
      router.replace({ pathname: '/consent', params: { next: '/emergency' } });
      return;
    }
    if (!incident) startIncident();
  }, [ready, consent.disclaimerAcknowledged, incident, startIncident, router]);

  const captureLocation = async () => {
    setLocating(true);
    try {
      const { status, canAskAgain } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        toast.error(
          canAskAgain
            ? 'Location permission declined. Describe a landmark instead.'
            : 'Location is blocked for this app. Enable it in Settings, or describe a landmark.',
        );
        return;
      }
      const pos = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });
      updateIncident({
        latitude: pos.coords.latitude,
        longitude: pos.coords.longitude,
        accuracy: pos.coords.accuracy,
        locationFixAt: new Date().toISOString(),
      });
      toast.success('Position captured for you to read out. Not sent anywhere.');
    } catch {
      toast.error('Could not get a fix. Describe a landmark instead.');
    } finally {
      setLocating(false);
    }
  };

  const procedure = useMemo(() => {
    if (!incident) return undefined;
    const id = incident.procedureId ?? routeProcedure(incident);
    return procedureById(id);
  }, [incident]);

  if (!ready || !incident) {
    return (
      <View className="flex-1 items-center justify-center bg-background py-16">
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  /* ------------------------- Stage: context ------------------------- */
  if (stage === 'context') {
    return (
      <ScrollView className="flex-1 bg-background" contentContainerClassName="gap-5 p-4 pb-10">
        <View>
          <Text className="text-2xl font-bold text-foreground">Where are you?</Text>
          <Text className="mt-2 text-sm text-muted-foreground">
            This decides which kit contents and which hazards ResQKit shows you. Pick the closest
            match — you can be approximate.
          </Text>
        </View>
        <View className="gap-3">
          {CONTEXTS.map((ctx) => {
            const Icon = CONTEXT_ICONS[ctx.icon] ?? HelpCircle;
            return (
              <Pressable
                key={ctx.id}
                onPress={() => {
                  updateIncident({ context: ctx.id });
                  updateSettings({ lastContext: ctx.id });
                  // updateIncident is async (React state), so reading
                  // incident.context from this closure would still see the
                  // pre-update value — pass the new context explicitly.
                  void ensureSession(
                    { ...incident, context: ctx.id },
                    settings.realDataMode,
                    logInstitutional,
                    onSession,
                  );
                  setStage('call');
                }}
                className="flex-row items-center gap-3 rounded-md border border-border bg-card p-4"
              >
                <View className="h-11 w-11 items-center justify-center rounded-md bg-primary">
                  <Icon size={20} color={colors.primaryForeground} />
                </View>
                <View className="flex-1">
                  <Text className="font-semibold text-foreground">{ctx.label}</Text>
                  <Text className="text-sm text-muted-foreground">{ctx.blurb}</Text>
                </View>
                <ChevronRight size={20} color={colors.mutedForeground} />
              </Pressable>
            );
          })}
        </View>
        {settings.lastContext && (
          <Text className="text-xs text-muted-foreground">
            Last time you used{' '}
            {CONTEXTS.find((c) => c.id === settings.lastContext)?.label ?? settings.lastContext}.
          </Text>
        )}
      </ScrollView>
    );
  }

  /* --------------------------- Stage: 112 --------------------------- */
  if (stage === 'call') {
    const script = buildDispatcherScript(incident);
    return (
      <ScrollView className="flex-1 bg-background" contentContainerClassName="gap-5 p-4 pb-10">
        <View>
          <Text className="text-2xl font-bold text-foreground">Has 112 been called?</Text>
          <Text className="mt-2 text-sm text-muted-foreground">
            Nothing else in this app matters more than this answer. ResQKit cannot make the call for
            you.
          </Text>
        </View>

        <Card>
          <CardContent className="gap-3">
            <View className="flex-row items-start justify-between gap-3">
              <View className="flex-1">
                <Text className="font-semibold text-foreground">Your position</Text>
                <Text className="text-sm text-muted-foreground">{formatCoords(incident)}</Text>
              </View>
              <Button size="sm" variant="secondary" onPress={captureLocation} disabled={locating}>
                {locating ? (
                  <ActivityIndicator size="small" color={colors.secondaryForeground} />
                ) : (
                  <Crosshair size={16} color={colors.secondaryForeground} />
                )}
                <Text className="text-xs font-medium text-secondary-foreground">Get fix</Text>
              </Button>
            </View>
            <View className="gap-1.5">
              <Label>Landmark or address (say this out loud)</Label>
              <TextInput
                multiline
                numberOfLines={2}
                value={incident.locationNote}
                onChangeText={(text) => updateIncident({ locationNote: text })}
                placeholder="E1 northbound, 3 km after the Sibiu exit, red van in the ditch"
                placeholderTextColor={colors.mutedForeground}
                className="min-h-16 rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground"
              />
            </View>
          </CardContent>
        </Card>

        <Card className="border-primary/40">
          <CardContent className="gap-3">
            <Text className="font-semibold text-foreground">What to say</Text>
            <View className="rounded-md bg-muted p-3">
              <Text className="font-mono text-xs leading-relaxed text-foreground">{script}</Text>
            </View>
            <Button
              size="sm"
              variant="secondary"
              onPress={async () => {
                try {
                  await Clipboard.setStringAsync(script);
                  toast.success('Script copied.');
                } catch {
                  toast.error('Could not copy. Read it from the screen.');
                }
              }}
            >
              <Copy size={16} color={colors.secondaryForeground} />
              <Text className="text-xs font-medium text-secondary-foreground">Copy script</Text>
            </Button>
          </CardContent>
        </Card>

        <View className="gap-2">
          <Button
            size="lg"
            variant="emergency"
            onPress={() => {
              updateIncident({ called112: 'called' });
              toast.success('Marked as called. Stay on the line with the operator.');
              void connectNg112(incident, settings.realDataMode, 'called', logInstitutional, onSession);
              callEmergencyServices();
            }}
          >
            <Phone size={20} color={colors.emergencyForeground} />
            <Text className="text-base font-semibold text-emergency-foreground">Call 112 now</Text>
          </Button>
          <Button
            size="lg"
            variant="secondary"
            onPress={() => {
              updateIncident({ called112: 'already_called' });
              void connectNg112(
                incident,
                settings.realDataMode,
                'already_called',
                logInstitutional,
                onSession,
              );
              setStage('triage');
            }}
          >
            <Check size={20} color={colors.secondaryForeground} />
            <Text className="text-base font-medium text-secondary-foreground">
              Someone already called 112
            </Text>
          </Button>
          <Button size="lg" onPress={() => setStage('triage')}>
            <Text className="text-base font-medium text-primary-foreground">Continue to first aid</Text>
            <ChevronRight size={20} color={colors.primaryForeground} />
          </Button>
          <Text className="text-xs text-muted-foreground">
            If nobody has called, the red banner stays on screen for the whole session until you do.
          </Text>
        </View>

        {incident.backendSessionId && (
          <Card className="border-dashed">
            <CardContent className="gap-1.5">
              <View className="flex-row items-center gap-1.5">
                <Radio size={16} color={colors.primary} />
                <Text className="text-sm font-semibold text-foreground">ISU dashboard pairing code</Text>
              </View>
              {incident.sessionCode ? (
                <>
                  <Text className="font-mono text-2xl tracking-widest text-foreground">
                    {incident.sessionCode}
                  </Text>
                  <Text className="text-xs text-muted-foreground">
                    Enter this code on the ISU dashboard to watch this incident live.
                  </Text>
                </>
              ) : (
                <Text className="text-xs text-muted-foreground">
                  Simulated on this device — no dashboard can connect. Turn on Local backend mode in
                  Settings to get a real pairing code (still never sent beyond your own machine).
                </Text>
              )}
            </CardContent>
          </Card>
        )}

        <Card className="border-dashed">
          <CardContent className="gap-2">
            <View className="flex-row items-center gap-1.5">
              <Radio size={16} color={colors.primary} />
              <Text className="text-sm font-semibold text-foreground">
                Institutional voice channel (prototype)
              </Text>
            </View>
            <Text className="text-xs text-muted-foreground">
              Fires a passive-voice-recognition request and a transcript websocket test, logged to
              Settings → Institutional actions trace.{' '}
              {settings.realDataMode
                ? 'Local backend mode is on (your machine only).'
                : 'Currently simulated on this device — nothing is sent, not even locally.'}
            </Text>
            <Button
              size="sm"
              variant="secondary"
              disabled={testingVoiceChannel}
              onPress={async () => {
                setTestingVoiceChannel(true);
                try {
                  await testInstitutionalVoiceChannel(
                    incident,
                    settings.realDataMode,
                    logInstitutional,
                    onSession,
                  );
                } finally {
                  setTestingVoiceChannel(false);
                }
              }}
            >
              {testingVoiceChannel ? (
                <ActivityIndicator size="small" color={colors.secondaryForeground} />
              ) : (
                <Radio size={16} color={colors.secondaryForeground} />
              )}
              <Text className="text-xs font-medium text-secondary-foreground">Test voice channel</Text>
            </Button>
          </CardContent>
        </Card>
      </ScrollView>
    );
  }

  /* -------------------------- Stage: triage ------------------------- */
  if (stage === 'triage') {
    const canContinue = incident.responsive !== '' && incident.breathing !== '';
    const choice = (
      field: 'responsive' | 'breathing',
      value: string,
      label: string,
      danger?: boolean,
    ) => {
      const active = incident[field] === value;
      return (
        <Pressable
          key={value}
          onPress={() => {
            updateIncident({ [field]: value });
            void logTriageAnswer(
              incident,
              settings.realDataMode,
              field,
              value,
              logInstitutional,
              onSession,
            );
          }}
          accessibilityRole="radio"
          accessibilityState={{ selected: active }}
          className={`flex-1 rounded-md border p-3 ${
            active
              ? danger
                ? 'border-emergency bg-emergency'
                : 'border-primary bg-primary'
              : 'border-border bg-card'
          }`}
        >
          <Text
            className={`text-center text-sm font-medium ${
              active
                ? danger
                  ? 'text-emergency-foreground'
                  : 'text-primary-foreground'
                : 'text-foreground'
            }`}
          >
            {label}
          </Text>
        </Pressable>
      );
    };

    return (
      <ScrollView className="flex-1 bg-background" contentContainerClassName="gap-5 p-4 pb-10">
        <View>
          <Text className="text-2xl font-bold text-foreground">The injured person</Text>
          <Text className="mt-2 text-sm text-muted-foreground">
            Two questions decide everything. Answer for the most seriously injured person first.
          </Text>
        </View>

        <Card>
          <CardContent className="gap-4">
            <View>
              <Text className="mb-2 font-semibold text-foreground">
                Do they respond when you shout and tap them?
              </Text>
              <View className="flex-row gap-2">
                {choice('responsive', 'yes', 'Yes')}
                {choice('responsive', 'no', 'No', true)}
                {choice('responsive', 'unsure', 'Unsure')}
              </View>
            </View>
            <View>
              <Text className="mb-2 font-semibold text-foreground">Are they breathing normally?</Text>
              <Text className="mb-2 text-xs text-muted-foreground">
                Occasional gasping is NOT normal breathing.
              </Text>
              <View className="flex-row gap-2">
                {choice('breathing', 'yes', 'Yes')}
                {choice('breathing', 'no', 'No', true)}
                {choice('breathing', 'unsure', 'Unsure')}
              </View>
            </View>
          </CardContent>
        </Card>

        {incident.breathing === 'no' && (
          <Card className="border-emergency">
            <CardContent>
              <View className="flex-row items-start gap-2">
                <ShieldAlert size={16} color={colors.emergency} style={{ marginTop: 2 }} />
                <Text className="flex-1 text-sm font-semibold text-emergency">
                  Not breathing means CPR now. Skip the rest of the questions.
                </Text>
              </View>
              <Button
                className="mt-3"
                size="lg"
                onPress={() => {
                  updateIncident({ procedureId: 'cpr_aed' });
                  setStage('kit');
                }}
              >
                Start CPR guidance
              </Button>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardContent className="gap-4">
            <View className="gap-1.5">
              <Label>Main visible problem</Label>
              <View className="gap-2">
                {INJURY_OPTIONS.map((opt) => {
                  const active = incident.injury === opt.value;
                  return (
                    <Pressable
                      key={opt.value}
                      onPress={() => updateIncident({ injury: opt.value })}
                      accessibilityRole="radio"
                      accessibilityState={{ selected: active }}
                      className={`rounded-md border p-2.5 ${
                        active ? 'border-primary bg-primary/10' : 'border-border bg-card'
                      }`}
                    >
                      <Text className={`text-sm ${active ? 'font-medium text-foreground' : 'text-muted-foreground'}`}>
                        {opt.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>

            <View className="gap-1.5">
              <View className="flex-row items-center gap-1.5">
                <Users size={16} color={colors.foreground} />
                <Label>How many injured people</Label>
              </View>
              <Input
                keyboardType="number-pad"
                value={String(incident.victimCount)}
                onChangeText={(text) =>
                  updateIncident({ victimCount: Math.max(1, parseInt(text, 10) || 1) })
                }
              />
            </View>

            <View className="gap-1.5">
              <Label>Approximate age</Label>
              <ChipSelect
                options={AGE_BANDS.map((v) => ({ value: v, label: AGE_LABELS[v] ?? v }))}
                value={incident.ageBand}
                onChange={(v) => updateIncident({ ageBand: v })}
              />
            </View>

            <View className="gap-1.5">
              <Label>Can you reach them?</Label>
              <ChipSelect
                options={TRAPPED_OPTIONS}
                value={incident.trapped}
                onChange={(v) => updateIncident({ trapped: v })}
              />
            </View>
          </CardContent>
        </Card>

        <Button size="lg" disabled={!canContinue} onPress={() => setStage('hazards')}>
          <Text className="text-base font-medium text-primary-foreground">Continue to hazards</Text>
          <ChevronRight size={20} color={colors.primaryForeground} />
        </Button>
      </ScrollView>
    );
  }

  /* ------------------------- Stage: hazards ------------------------- */
  if (stage === 'hazards') {
    const options = hazardsForContext(incident.context ?? 'other');
    const toggle = (code: string) => {
      const next = incident.hazards.includes(code)
        ? incident.hazards.filter((c) => c !== code)
        : [...incident.hazards, code];
      updateIncident({ hazards: next });
    };
    const blocking = options.filter((h) => incident.hazards.includes(h.code) && h.blocking);

    return (
      <ScrollView className="flex-1 bg-background" contentContainerClassName="gap-5 p-4 pb-10">
        <View>
          <Text className="text-2xl font-bold text-foreground">What can hurt you?</Text>
          <Text className="mt-2 text-sm text-muted-foreground">
            A dead rescuer helps nobody. Tick everything you can see — rescuers need this on arrival.
          </Text>
        </View>

        <View className="gap-2">
          {options.map((h) => {
            const active = incident.hazards.includes(h.code);
            return (
              <Pressable
                key={h.code}
                onPress={() => toggle(h.code)}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: active }}
                className={`rounded-md border p-3 ${
                  active ? 'border-emergency bg-emergency/10' : 'border-border bg-card'
                }`}
              >
                <View className="flex-row items-center justify-between gap-2">
                  <Text className="flex-1 font-medium text-foreground">{h.label}</Text>
                  <Badge variant={active ? 'emergency' : 'secondary'}>{h.family}</Badge>
                </View>
                {active && <Text className="mt-1 text-sm text-foreground">{h.warning}</Text>}
              </Pressable>
            );
          })}
        </View>

        {incident.context === 'road' && (
          <Card>
            <CardContent className="gap-1.5">
              <Label>Vehicle type (changes how rescuers cut it open)</Label>
              <ChipSelect
                options={POWERTRAIN_OPTIONS}
                value={incident.powertrain}
                onChange={(v) => updateIncident({ powertrain: v })}
              />
            </CardContent>
          </Card>
        )}

        {blocking.length > 0 && (
          <Card className="border-emergency">
            <CardContent>
              <View className="flex-row items-start gap-2">
                <ShieldAlert size={16} color={colors.emergency} style={{ marginTop: 2 }} />
                <Text className="flex-1 text-sm font-semibold text-emergency">
                  Do not approach. Stay back, keep others back, and report this to 112.
                </Text>
              </View>
              <View className="mt-2 gap-1">
                {blocking.map((h) => (
                  <Text key={h.code} className="text-sm text-muted-foreground">
                    {'• '}
                    {h.warning}
                  </Text>
                ))}
              </View>
            </CardContent>
          </Card>
        )}

        <Button
          size="lg"
          onPress={() => {
            void logHazards(
              incident,
              settings.realDataMode,
              incident.hazards,
              logInstitutional,
              onSession,
            );
            setStage('kit');
          }}
        >
          <Text className="text-base font-medium text-primary-foreground">Continue to your kit</Text>
          <ChevronRight size={20} color={colors.primaryForeground} />
        </Button>
      </ScrollView>
    );
  }

  /* --------------------------- Stage: kit --------------------------- */
  if (stage === 'kit') {
    return (
      <ScrollView className="flex-1 bg-background" contentContainerClassName="gap-5 p-4 pb-10">
        <View>
          <Text className="text-2xl font-bold text-foreground">What do you have to work with?</Text>
          <Text className="mt-2 text-sm text-muted-foreground">
            Guidance is filtered to your actual equipment, so you are never told to use something you
            do not have.
          </Text>
        </View>

        <KitScanner
          context={incident.context ?? 'other'}
          selected={incident.kitItems}
          onChange={(codes, source) => updateIncident({ kitItems: codes, kitSource: source })}
        />

        <Button
          size="lg"
          onPress={() => {
            const id = incident.procedureId ?? routeProcedure(incident);
            updateIncident({ procedureId: id });
            void logKitSelection(
              incident,
              settings.realDataMode,
              incident.kitItems,
              incident.kitSource,
              logInstitutional,
              onSession,
            );
            setStage('guide');
          }}
        >
          <Text className="text-base font-medium text-primary-foreground">
            Start step-by-step guidance
          </Text>
          <ChevronRight size={20} color={colors.primaryForeground} />
        </Button>
      </ScrollView>
    );
  }

  /* -------------------------- Stage: guide -------------------------- */
  if (!procedure) {
    return (
      <ScrollView className="flex-1 bg-background" contentContainerClassName="p-4">
        <Card>
          <CardContent className="p-5">
            <Text className="text-sm text-muted-foreground">
              No guidance matches those answers. Go back and review the triage questions.
            </Text>
            <Button className="mt-3" variant="secondary" onPress={() => setStage('triage')}>
              Back to triage
            </Button>
          </CardContent>
        </Card>
      </ScrollView>
    );
  }

  const addStep = (step: CompletedStep) => {
    const existing = incident.completedSteps.filter((s) => s.index !== step.index);
    updateIncident({ completedSteps: [...existing, step].sort((a, b) => a.index - b.index) });
    void logProcedureStep(
      incident,
      settings.realDataMode,
      step.index,
      step.title,
      logInstitutional,
      onSession,
    );
  };

  return (
    <ScrollView className="flex-1 bg-background" contentContainerClassName="gap-5 p-4 pb-10">
      <ProcedureRunner
        procedure={procedure}
        kitItems={incident.kitItems}
        completedSteps={incident.completedSteps}
        onStepDone={addStep}
        onFinish={() => router.push('/handoff')}
      />
      <View className="gap-2">
        <Button variant="secondary" onPress={() => setStage('kit')}>
          Change my kit
        </Button>
        <Button variant="secondary" onPress={() => router.push('/handoff')}>
          Rescuers are here — open handoff
        </Button>
      </View>
    </ScrollView>
  );
}
