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
import Animated, { LinearTransition } from 'react-native-reanimated';
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
  Volume2,
} from 'lucide-react-native';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from '@/components/ui/toast';
import { callEmergencyServices } from '@/components/AppShell';
import InterviewStage from '@/components/InterviewStage';
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
  rankVictims,
  routeProcedure,
  victimUrgencyRank,
} from '@/lib/knowledge';
import { speak, stopSpeaking } from '@/lib/speech';
import { CompletedStep, VictimRecord, newVictim } from '@/lib/storage';
import { useTokenColors } from '@/lib/tokenColors';

type Stage = 'context' | 'call' | 'victims' | 'triage' | 'interview' | 'hazards' | 'kit' | 'guide';

const CONTEXT_ICONS: Record<string, React.ComponentType<{ size?: number; color?: string }>> = {
  car: Car,
  building: Building2,
  anchor: Anchor,
  mountain: Mountain,
  help: HelpCircle,
};

// Exported so incident-detail.tsx can render these same labels for a past
// incident's stored values, instead of re-deriving a second copy that could
// drift from what the wizard actually offers.
export const AGE_BANDS = ['', 'Infant (under 1)', 'Child', 'Adult', 'Elderly'];
export const AGE_LABELS: Record<string, string> = { '': 'Not sure' };

export const TRAPPED_OPTIONS = [
  { value: '', label: 'Not recorded' },
  { value: 'Accessible', label: 'Yes, I can reach them' },
  { value: 'Trapped in vehicle', label: 'Trapped in a vehicle' },
  { value: 'Trapped under load or debris', label: 'Trapped under load or debris' },
  { value: 'In water', label: 'In the water' },
  { value: 'Unreachable — hazard in the way', label: 'Unreachable, hazard in the way' },
];

export const POWERTRAIN_OPTIONS = [
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

const TRIAGE_STEP_COUNT = 6;

/** One question per screen for the triage wizard — module-scoped so its
 * identity is stable across renders (React Compiler flags a component type
 * created inline in render, since that resets its own state every time). */
const TriageStepShell: React.FC<{
  step: number;
  title: string;
  subtitle?: string;
  onBack?: () => void;
  onSkip?: () => void;
  children: React.ReactNode;
}> = ({ step, title, subtitle, onBack, onSkip, children }) => {
  const colors = useTokenColors();

  // Read each question aloud as it appears, same reasoning as
  // InterviewStage's prompts — a bystander's hands and eyes are often busy
  // with the injured person, not the phone. Stopped on unmount so it never
  // talks over the next screen (e.g. the CPR fast path taking over).
  useEffect(() => {
    speak(subtitle ? `${title}. ${subtitle}` : title);
    return () => stopSpeaking();
  }, [title, subtitle]);

  return (
    <ScrollView className="flex-1 bg-background" contentContainerClassName="gap-5 p-4 pb-10">
      <View>
        <Text className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Question {step + 1} of {TRIAGE_STEP_COUNT}
        </Text>
        <View className="mt-1 flex-row items-start justify-between gap-2">
          <Text className="flex-1 text-2xl font-bold text-foreground">{title}</Text>
          <Pressable
            onPress={() => speak(subtitle ? `${title}. ${subtitle}` : title)}
            accessibilityRole="button"
            accessibilityLabel="Read question aloud again"
            hitSlop={8}
            className="mt-1"
          >
            <Volume2 size={20} color={colors.mutedForeground} />
          </Pressable>
        </View>
        {subtitle && <Text className="mt-2 text-sm text-muted-foreground">{subtitle}</Text>}
      </View>
      {children}
      <View className="flex-row items-center justify-between">
        <Pressable onPress={onBack} disabled={!onBack} hitSlop={8}>
          <Text className={`text-sm font-medium ${onBack ? 'text-foreground' : 'text-transparent'}`}>← Back</Text>
        </Pressable>
        {onSkip && (
          <Pressable onPress={onSkip} hitSlop={8}>
            <Text className="text-sm font-medium text-muted-foreground">Don&apos;t know / Skip →</Text>
          </Pressable>
        )}
      </View>
    </ScrollView>
  );
};

const CPR_BANNER_TEXT = 'Not breathing means CPR now. Skip the rest of the questions.';

/** Module-scoped for the same reason as TriageStepShell — and because its
 * own useEffect (reading the banner aloud once) can only be called
 * unconditionally from within its own render, not from inside the parent's
 * `if (incident.breathing === 'no')` branch. */
const CprFastPathBanner: React.FC<{ onStart: () => void; onRecheck: () => void }> = ({ onStart, onRecheck }) => {
  const colors = useTokenColors();

  useEffect(() => {
    speak(CPR_BANNER_TEXT);
    return () => stopSpeaking();
  }, []);

  return (
    <ScrollView className="flex-1 bg-background" contentContainerClassName="gap-5 p-4 pb-10">
      <Card className="border-emergency">
        <CardContent className="gap-3">
          <View className="flex-row items-start gap-2">
            <ShieldAlert size={16} color={colors.emergency} style={{ marginTop: 2 }} />
            <Text className="flex-1 text-sm font-semibold text-emergency">{CPR_BANNER_TEXT}</Text>
          </View>
          <Button size="lg" onPress={onStart}>
            Start CPR guidance
          </Button>
          <Button variant="secondary" onPress={onRecheck}>
            <Text className="text-sm font-medium text-secondary-foreground">
              Actually, let me re-check that answer
            </Text>
          </Button>
        </CardContent>
      </Card>
    </ScrollView>
  );
};

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

  /**
   * Draft text for the victim-count field, so it can be *emptied* while typing.
   *
   * Binding the input straight to the stored number made it impossible to
   * retype: clearing "1" produced an empty string, parseInt('') is NaN, and the
   * `|| 1` fallback wrote 1 straight back before the next keystroke landed — so
   * typing 2 appended onto the restored 1 and gave 12.
   *
   * null means "not editing, show the stored value". A non-null draft (empty
   * string included) is what the user is currently typing, and is only written
   * back to the incident once it parses to a sane count.
   */
  const [victimDraft, setVictimDraft] = useState<string | null>(null);

  // Triage is a sequential, one-question-per-screen wizard: 0 responsive,
  // 1 breathing, 2 injury, 3 victim count, 4 age band, 5 trapped. Tapping an
  // answer both records it and advances; a Back link and a "Don't know"
  // shortcut are offered on every screen. This is separate from `stage`
  // because triage is one stage but many small screens within it.
  const [triageStep, setTriageStep] = useState(0);

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

  // Every incident needs at least one victim record to hang the triage/guide
  // flow off of — seed it once, right after the incident itself is created,
  // rather than special-casing "no victims yet" throughout the render below.
  useEffect(() => {
    if (incident && incident.victims.length === 0) {
      const v = newVictim();
      updateIncident({ victims: [v], activeVictimId: v.id });
    }
  }, [incident, updateIncident]);

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

  const addVictim = () => updateIncident({ victims: [...incident.victims, newVictim()] });

  const updateVictimBrief = (id: string, patch: Partial<VictimRecord>) =>
    updateIncident({ victims: incident.victims.map((v) => (v.id === id ? { ...v, ...patch } : v)) });

  /** Makes `id` the active victim: loads its (possibly blank) triage answers
   * into the shared scratch fields the rest of the wizard already reads. */
  const selectVictim = (id: string) => {
    const v = incident.victims.find((vv) => vv.id === id);
    if (!v) return;
    updateIncident({
      activeVictimId: id,
      responsive: v.responsive,
      breathing: v.breathing,
      injury: v.injury,
      ageBand: v.ageBand,
      trapped: v.trapped,
      procedureId: v.procedureId,
      completedSteps: v.completedSteps,
      victims: incident.victims.map((vv) =>
        vv.id === id && vv.status === 'pending' ? { ...vv, status: 'in_progress' } : vv,
      ),
    });
    setTriageStep(0);
    setStage('triage');
  };

  /** Saves the shared scratch fields back onto the active victim's own
   * record — called whenever the wizard moves on from that victim (to the
   * next one, or to handoff), so nothing is lost and the list/ranking stay
   * accurate. */
  const snapshotActiveVictim = (status: VictimRecord['status']) => {
    if (!incident.activeVictimId) return;
    updateIncident({
      victims: incident.victims.map((v) =>
        v.id === incident.activeVictimId
          ? {
              ...v,
              responsive: incident.responsive,
              breathing: incident.breathing,
              injury: incident.injury,
              ageBand: incident.ageBand,
              trapped: incident.trapped,
              procedureId: incident.procedureId,
              completedSteps: incident.completedSteps,
              status,
            }
          : v,
      ),
    });
  };

  /** After the last triage question: the scene-wide interview/hazards/kit
   * stages only ever run once per incident (for the first victim) — every
   * later victim already has that context, so their triage goes straight to
   * guidance instead of re-asking scene-level questions. */
  const afterTriage = () => {
    if (incident.sceneContextDone) {
      updateIncident({ procedureId: routeProcedure(incident) });
      setStage('guide');
    } else {
      setStage('interview');
    }
  };

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
              setStage('victims');
            }}
          >
            <Check size={20} color={colors.secondaryForeground} />
            <Text className="text-base font-medium text-secondary-foreground">
              Someone already called 112
            </Text>
          </Button>
          <Button size="lg" onPress={() => setStage('victims')}>
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
                  // Without this the action is completely silent — it only
                  // writes to the trace on another screen, which reads as a
                  // dead button.
                  toast.success('Voice channel test logged. See Settings → Institutional actions.');
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

  /* ------------------------- Stage: victims -------------------------- */
  if (stage === 'victims') {
    const yesNoUnsure = [
      { value: '', label: 'Not sure' },
      { value: 'yes', label: 'Yes' },
      { value: 'no', label: 'No' },
    ];
    const ranked = rankVictims(incident.victims);

    return (
      <ScrollView className="flex-1 bg-background" contentContainerClassName="gap-5 p-4 pb-10">
        <View>
          <Text className="text-2xl font-bold text-foreground">Who needs help?</Text>
          <Text className="mt-2 text-sm text-muted-foreground">
            More than one injured person? Add each one with a brief description. ResQKit ranks them
            by urgency below — no AI involved, only the answers you give here — then you pick who to
            help first.
          </Text>
        </View>

        <View className="gap-3">
          {ranked.map((v, idx) => {
            const rank = victimUrgencyRank(v);
            const done = v.status === 'done';
            // Three visual tiers, not a single "urgent" cutoff: only a
            // breathing-critical victim (rank 0) gets the reserved red —
            // an unresponsive-but-breathing or heavily-bleeding victim
            // (rank 1-2) reads as amber, distinct but a notch down.
            const severity: 'critical' | 'warning' | 'normal' =
              done ? 'normal' : rank === 0 ? 'critical' : rank <= 2 ? 'warning' : 'normal';
            const cardBorderClass =
              severity === 'critical' ? 'border-emergency' : severity === 'warning' ? 'border-warning' : undefined;
            const priorityBadgeVariant =
              severity === 'critical' ? 'emergency' : severity === 'warning' ? 'warning' : 'secondary';
            return (
              // `layout` animates this card gliding to its new slot whenever
              // the sort order changes (Kahoot-leaderboard style) — keyed on
              // the stable victim id so Reanimated tracks it across reorders
              // instead of treating it as a fresh mount.
              <Animated.View key={v.id} layout={LinearTransition.springify().damping(18).stiffness(160)}>
                <Card className={cardBorderClass}>
                  <CardContent className="gap-3">
                    <View className="flex-row items-center justify-between">
                      <Badge variant={priorityBadgeVariant} tone="pastel">{`#${idx + 1} priority`}</Badge>
                      <Badge
                        variant={done ? 'secondary' : v.status === 'in_progress' ? 'default' : 'outline'}
                        tone="pastel"
                      >
                        {done ? 'Done' : v.status === 'in_progress' ? 'In progress' : 'Not started'}
                      </Badge>
                    </View>
                    <TextInput
                      value={v.briefDescription}
                      onChangeText={(text) => updateVictimBrief(v.id, { briefDescription: text })}
                      editable={!done}
                      multiline
                      placeholder="Brief description — age, what happened, what you see"
                      placeholderTextColor={colors.mutedForeground}
                      className="min-h-[60px] rounded-md border border-input bg-background p-3 text-sm text-foreground"
                      textAlignVertical="top"
                    />
                    {!done && (
                      <>
                        <View className="gap-1">
                          <Label>Breathing normally?</Label>
                          <ChipSelect
                            options={yesNoUnsure}
                            value={v.breathing}
                            onChange={(val) => updateVictimBrief(v.id, { breathing: val })}
                          />
                        </View>
                        <View className="gap-1">
                          <Label>Responds to you?</Label>
                          <ChipSelect
                            options={yesNoUnsure}
                            value={v.responsive}
                            onChange={(val) => updateVictimBrief(v.id, { responsive: val })}
                          />
                        </View>
                      </>
                    )}
                    <Button variant={done ? 'secondary' : 'default'} disabled={done} onPress={() => selectVictim(v.id)}>
                      <Text
                        className={`text-sm font-medium ${done ? 'text-secondary-foreground' : 'text-primary-foreground'}`}
                      >
                        {done ? 'Completed' : v.status === 'in_progress' ? 'Continue with this victim' : 'Start with this victim'}
                      </Text>
                      {!done && <ChevronRight size={18} color={colors.primaryForeground} />}
                    </Button>
                  </CardContent>
                </Card>
              </Animated.View>
            );
          })}
        </View>

        <Button variant="secondary" onPress={addVictim}>
          <Users size={16} color={colors.secondaryForeground} />
          <Text className="text-sm font-medium text-secondary-foreground">Add another victim</Text>
        </Button>
      </ScrollView>
    );
  }

  /* -------------------------- Stage: triage ------------------------- */
  if (stage === 'triage') {
    // The CPR fast path pre-empts the rest of the wizard the moment
    // breathing is answered "no", exactly like before — it just now owns
    // the whole screen instead of being an extra card underneath more
    // questions, since nothing after it matters until CPR is started.
    if (incident.breathing === 'no') {
      return (
        <CprFastPathBanner
          onStart={() => {
            // Every kit-gated CPR step already has a withoutItem fallback
            // (compression-only CPR, "keep compressing" without an AED), so
            // nothing here depends on having visited the kit screen — time
            // to first compression outranks completeness of data capture.
            updateIncident({ procedureId: 'cpr_aed' });
            setStage('guide');
          }}
          onRecheck={() => {
            updateIncident({ breathing: '' });
            setTriageStep(1);
          }}
        />
      );
    }

    const rowChoice = (
      field: 'responsive' | 'breathing',
      value: string,
      label: string,
      danger: boolean,
      onPress: () => void,
    ) => {
      const active = incident[field] === value;
      return (
        <Pressable
          key={value}
          onPress={onPress}
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

    const answerYesNo = (field: 'responsive' | 'breathing', value: string) => {
      updateIncident({ [field]: value });
      void logTriageAnswer(incident, settings.realDataMode, field, value, logInstitutional, onSession);
      setTriageStep((s) => s + 1);
    };

    /* ---- Step 0: responsive ---- */
    if (triageStep === 0) {
      return (
        <TriageStepShell step={triageStep}
          title="Do they respond when you shout and tap them?"
          onSkip={() => answerYesNo('responsive', 'unsure')}
        >
          <Card>
            <CardContent className="flex-row gap-2">
              {rowChoice('responsive', 'yes', 'Yes', false, () => answerYesNo('responsive', 'yes'))}
              {rowChoice('responsive', 'no', 'No', true, () => answerYesNo('responsive', 'no'))}
              {rowChoice('responsive', 'unsure', 'Unsure', false, () => answerYesNo('responsive', 'unsure'))}
            </CardContent>
          </Card>
        </TriageStepShell>
      );
    }

    /* ---- Step 1: breathing ---- */
    if (triageStep === 1) {
      return (
        <TriageStepShell step={triageStep}
          title="Are they breathing normally?"
          subtitle="Occasional gasping is NOT normal breathing."
          onBack={() => setTriageStep(0)}
          onSkip={() => answerYesNo('breathing', 'unsure')}
        >
          <Card>
            <CardContent className="flex-row gap-2">
              {rowChoice('breathing', 'yes', 'Yes', false, () => answerYesNo('breathing', 'yes'))}
              {rowChoice('breathing', 'no', 'No', true, () => answerYesNo('breathing', 'no'))}
              {rowChoice('breathing', 'unsure', 'Unsure', false, () => answerYesNo('breathing', 'unsure'))}
            </CardContent>
          </Card>
        </TriageStepShell>
      );
    }

    /* ---- Step 2: main injury ---- */
    if (triageStep === 2) {
      return (
        <TriageStepShell step={triageStep}
          title="Main visible problem"
          onBack={() => setTriageStep(1)}
          onSkip={() => {
            updateIncident({ injury: 'unknown' });
            setTriageStep(3);
          }}
        >
          <Card>
            <CardContent className="gap-2">
              {INJURY_OPTIONS.map((opt) => (
                <Pressable
                  key={opt.value}
                  onPress={() => {
                    updateIncident({ injury: opt.value });
                    setTriageStep(3);
                  }}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: incident.injury === opt.value }}
                  className={`rounded-md border p-2.5 ${
                    incident.injury === opt.value ? 'border-primary bg-primary/10' : 'border-border bg-card'
                  }`}
                >
                  <Text
                    className={`text-sm ${
                      incident.injury === opt.value ? 'font-medium text-foreground' : 'text-muted-foreground'
                    }`}
                  >
                    {opt.label}
                  </Text>
                </Pressable>
              ))}
            </CardContent>
          </Card>
        </TriageStepShell>
      );
    }

    /* ---- Step 3: victim count ---- */
    if (triageStep === 3) {
      return (
        <TriageStepShell step={triageStep} title="How many injured people" onBack={() => setTriageStep(2)} onSkip={() => setTriageStep(4)}>
          <Card>
            <CardContent className="gap-1.5">
              <View className="flex-row items-center gap-1.5">
                <Users size={16} color={colors.foreground} />
                <Label>Count</Label>
              </View>
              <Input
                keyboardType="number-pad"
                value={victimDraft ?? String(incident.victimCount)}
                onChangeText={(text) => {
                  // The number-pad still offers "." "-" and "," on Android, and
                  // a count of "1.2" helps nobody — keep digits only. Capped at
                  // 2 digits to match the web field's max={99}.
                  const digits = text.replace(/[^0-9]/g, '').slice(0, 2);
                  setVictimDraft(digits);
                  const parsed = parseInt(digits, 10);
                  if (parsed >= 1) updateIncident({ victimCount: parsed });
                }}
                // Leaving the field empty must not persist an empty count:
                // dropping the draft falls back to the last committed value.
                onBlur={() => setVictimDraft(null)}
              />
              <Button
                className="mt-2"
                size="lg"
                onPress={() => {
                  setVictimDraft(null);
                  setTriageStep(4);
                }}
              >
                <Text className="text-base font-medium text-primary-foreground">Next</Text>
                <ChevronRight size={20} color={colors.primaryForeground} />
              </Button>
            </CardContent>
          </Card>
        </TriageStepShell>
      );
    }

    /* ---- Step 4: age band ---- */
    if (triageStep === 4) {
      return (
        <TriageStepShell step={triageStep}
          title="Approximate age"
          onBack={() => setTriageStep(3)}
          onSkip={() => {
            updateIncident({ ageBand: '' });
            setTriageStep(5);
          }}
        >
          <Card>
            <CardContent>
              <ChipSelect
                options={AGE_BANDS.map((v) => ({ value: v, label: AGE_LABELS[v] ?? v }))}
                value={incident.ageBand}
                onChange={(v) => {
                  updateIncident({ ageBand: v });
                  setTriageStep(5);
                }}
              />
            </CardContent>
          </Card>
        </TriageStepShell>
      );
    }

    /* ---- Step 5: trapped / reachable — last question ---- */
    return (
      <TriageStepShell step={triageStep}
        title="Can you reach them?"
        onBack={() => setTriageStep(4)}
        onSkip={() => {
          updateIncident({ trapped: '' });
          afterTriage();
        }}
      >
        <Card>
          <CardContent>
            <ChipSelect
              options={TRAPPED_OPTIONS}
              value={incident.trapped}
              onChange={(v) => {
                updateIncident({ trapped: v });
                afterTriage();
              }}
            />
          </CardContent>
        </Card>
      </TriageStepShell>
    );
  }

  /* ------------------------ Stage: interview ------------------------ */
  if (stage === 'interview') {
    return (
      <InterviewStage
        incident={incident}
        settings={settings}
        logInstitutional={logInstitutional}
        onSession={onSession}
        updateIncident={updateIncident}
        onDone={() => setStage('hazards')}
      />
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
            updateIncident({ procedureId: id, sceneContextDone: true });
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
            <Button
              className="mt-3"
              variant="secondary"
              onPress={() => {
                setTriageStep(0);
                setStage('triage');
              }}
            >
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

  // Other victims still waiting for this one to finish — offered as a loop
  // back to the victim list rather than forcing the user through handoff
  // first, since a bystander alone on scene may need to move straight from
  // one victim to the next.
  const pendingVictims = incident.victims.filter(
    (v) => v.status !== 'done' && v.id !== incident.activeVictimId,
  );

  const goToHandoff = () => {
    snapshotActiveVictim('done');
    router.push('/handoff');
  };

  const nextVictim = () => {
    snapshotActiveVictim('done');
    updateIncident({
      activeVictimId: null,
      responsive: '',
      breathing: '',
      injury: '',
      ageBand: '',
      trapped: '',
      procedureId: null,
      completedSteps: [],
    });
    setStage('victims');
  };

  return (
    <ScrollView className="flex-1 bg-background" contentContainerClassName="gap-5 p-4 pb-10">
      <ProcedureRunner
        procedure={procedure}
        kitItems={incident.kitItems}
        completedSteps={incident.completedSteps}
        onStepDone={addStep}
        onFinish={goToHandoff}
      />
      <View className="gap-2">
        <Button variant="secondary" onPress={() => setStage('kit')}>
          Change my kit
        </Button>
        {incident.ceimReport && (
          <Button variant="secondary" onPress={() => router.push('/report')}>
            View scene report
          </Button>
        )}
        {pendingVictims.length > 0 && (
          <Button variant="secondary" onPress={nextVictim}>
            <Users size={16} color={colors.secondaryForeground} />
            <Text className="text-sm font-medium text-secondary-foreground">
              {`Next victim (${pendingVictims.length} waiting)`}
            </Text>
          </Button>
        )}
        <Button variant="secondary" onPress={goToHandoff}>
          Rescuers are here — open handoff
        </Button>
      </View>
    </ScrollView>
  );
}
