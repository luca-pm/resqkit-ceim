/**
 * S8 — Guided first aid (RN port of app/frontend/src/components/ProcedureRunner.tsx).
 *
 * Steps come exclusively from the curated content pack. Each step is filtered
 * against the kit the user actually has: if a required item is missing, the
 * step shows its improvised alternative instead of asking for equipment that
 * is not there. Completed steps are timestamped for the rescuer handoff.
 *
 * The metronome is the one genuinely re-engineered piece. The web version
 * schedules a Web Audio oscillator; RN has no oscillator API, so this replays
 * a pre-rendered click sample on a setInterval AND fires a haptic pulse on
 * every beat. The haptic is deliberate redundancy, not decoration: this paces
 * real chest compressions, RN timer jitter is worse than Web Audio's
 * scheduling, and a bystander in a loud roadside environment may not hear the
 * click at all. Timing fidelity can only be judged on a physical device —
 * see spike-metronome.tsx.
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Text, View } from 'react-native';
import { useAudioPlayer } from 'expo-audio';
import * as Haptics from 'expo-haptics';
import { AlertTriangle, Check, ChevronLeft, ChevronRight, Pause, Play, PhoneCall, Stethoscope } from 'lucide-react-native';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import SourceNote from '@/components/SourceNote';
import { Procedure, kitItemByCode } from '@/lib/knowledge';
import { CompletedStep } from '@/lib/storage';
import { useTokenColors } from '@/lib/tokenColors';
import { useAppStateResume } from '@/lib/useAppStateResume';

const CLICK_SOUND = require('../../assets/audio/metronome-click.wav');

interface ProcedureRunnerProps {
  procedure: Procedure;
  kitItems: string[];
  completedSteps: CompletedStep[];
  onStepDone: (step: CompletedStep) => void;
  onFinish: () => void;
}

/** Click + haptic metronome for compression rate guidance. */
const useMetronome = (bpm?: number) => {
  const player = useAudioPlayer(CLICK_SOUND);
  const [running, setRunning] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const stop = useCallback(() => {
    if (timerRef.current !== null) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    setRunning(false);
  }, []);

  const tick = useCallback(() => {
    // seekTo(0) before play so a beat that lands while the previous sample is
    // still playing restarts it rather than being swallowed.
    void player.seekTo(0);
    player.play();
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  }, [player]);

  const start = useCallback(() => {
    if (!bpm) return;
    tick();
    timerRef.current = setInterval(tick, Math.round(60000 / bpm));
    setRunning(true);
  }, [bpm, tick]);

  // A tel:112 hand-off suspends the app; JS timers are unreliable across that
  // boundary, so stop cleanly rather than resuming at a drifted cadence. The
  // user restarts it deliberately, which is safer than a silently-wrong beat.
  useAppStateResume({ onSuspend: stop });

  useEffect(() => stop, [stop]);

  return { running, start, stop };
};

const ProcedureRunner: React.FC<ProcedureRunnerProps> = ({
  procedure,
  kitItems,
  completedSteps,
  onStepDone,
  onFinish,
}) => {
  const [index, setIndex] = useState(() =>
    Math.min(completedSteps.length, procedure.steps.length - 1),
  );
  const [wasInterrupted, setWasInterrupted] = useState(false);
  const step = procedure.steps[index];
  const metronome = useMetronome(step.metronomeBpm);
  const colors = useTokenColors();

  // Flag the interruption so the user is told where they were, rather than
  // returning from a 112 call to a screen that looks untouched.
  useAppStateResume({ onResume: () => setWasInterrupted(true) });

  const doneIndexes = new Set(completedSteps.map((s) => s.index));
  const isLast = index === procedure.steps.length - 1;

  const stopMetronome = metronome.stop;
  useEffect(() => {
    stopMetronome();
  }, [index, stopMetronome]);

  const missing = (step.requiresItems ?? []).filter((code) => !kitItems.includes(code));
  const present = (step.requiresItems ?? []).filter((code) => kitItems.includes(code));
  const blockedByMissingItem = (step.requiresItems ?? []).length > 0 && present.length === 0;

  const markDone = () => {
    if (!doneIndexes.has(index)) {
      onStepDone({ index, title: step.title, at: new Date().toISOString() });
    }
    metronome.stop();
    if (isLast) {
      onFinish();
    } else {
      setIndex((i) => i + 1);
    }
  };

  return (
    <View className="gap-4">
      <View>
        <View className="flex-row items-center justify-between gap-2">
          <Text className="flex-1 text-xl font-bold text-foreground">{procedure.name}</Text>
          <Badge variant="secondary">{`${index + 1}/${procedure.steps.length}`}</Badge>
        </View>
        <Progress
          value={((index + 1) / procedure.steps.length) * 100}
          className="mt-2"
          accessibilityLabel="Procedure progress"
        />
      </View>

      {/* Above the steps and never dismissed: these criteria decide whether the
          bystander should be calling rather than treating, so they must be
          readable before the first action and still visible at the last one. */}
      {procedure.escalation && (
        <View className="rounded-lg border border-emergency/40 bg-emergency/5 p-4">
          <View className="flex-row items-center gap-1.5">
            <PhoneCall size={14} color={colors.emergency} />
            <Text className="text-xs font-semibold uppercase tracking-wide text-emergency">
              Call 112 first if any of this applies
            </Text>
          </View>
          <Text className="mt-2 text-base leading-relaxed text-foreground">
            {procedure.escalation}
          </Text>
        </View>
      )}

      {wasInterrupted && (
        <Card className="border-primary/40">
          <CardContent className="flex-row items-center justify-between gap-3">
            <Text className="flex-1 text-sm text-foreground">
              You were on step {index + 1} of {procedure.steps.length}
              {step.metronomeBpm ? '. The beat was stopped — restart it below.' : '.'}
            </Text>
            <Button size="sm" variant="secondary" onPress={() => setWasInterrupted(false)}>
              Dismiss
            </Button>
          </CardContent>
        </Card>
      )}

      <Card className={step.critical ? 'border-emergency/50' : ''}>
        <CardContent className="gap-3 p-5">
          {step.critical && (
            <View className="flex-row items-center gap-1.5">
              <AlertTriangle size={14} color={colors.emergency} />
              <Text className="text-xs font-semibold uppercase tracking-wide text-emergency">
                Critical step
              </Text>
            </View>
          )}
          <Text className="text-xl font-bold leading-snug text-foreground">{step.title}</Text>
          <Text className="text-base leading-relaxed text-foreground">{step.detail}</Text>

          {present.length > 0 && (
            <View className="rounded-md border border-primary/40 bg-primary/10 p-3">
              <Text className="text-sm font-semibold text-foreground">Use from your kit</Text>
              <View className="mt-1 gap-1">
                {present.map((code) => {
                  const item = kitItemByCode(code);
                  return (
                    <Text key={code} className="text-sm text-foreground">
                      <Text className="font-medium">{item?.name ?? code}</Text>
                      {item ? ` — ${item.howTo}` : ''}
                    </Text>
                  );
                })}
              </View>
            </View>
          )}

          {blockedByMissingItem && step.withoutItem && (
            <View className="rounded-md border border-border bg-muted p-3">
              <Text className="text-sm font-semibold text-foreground">
                You don&apos;t have {missing.map((c) => kitItemByCode(c)?.name ?? c).join(' or ')}
              </Text>
              <Text className="mt-1 text-sm text-muted-foreground">{step.withoutItem}</Text>
            </View>
          )}

          {step.metronomeBpm && (
            <View className="flex-row items-center justify-between gap-3 rounded-md border border-border bg-background p-3">
              <View className="flex-1">
                <Text className="text-sm font-semibold text-foreground">Compression rhythm</Text>
                <Text className="text-xs text-muted-foreground">
                  {step.metronomeBpm} beats per minute
                </Text>
              </View>
              <View className="flex-row items-center gap-2">
                {metronome.running && <View className="h-3 w-3 rounded-full bg-emergency" />}
                <Button
                  size="sm"
                  variant={metronome.running ? 'secondary' : 'default'}
                  onPress={() => (metronome.running ? metronome.stop() : metronome.start())}
                >
                  {metronome.running ? (
                    <>
                      <Pause size={16} color={colors.secondaryForeground} />
                      <Text className="text-xs font-medium text-secondary-foreground">Stop</Text>
                    </>
                  ) : (
                    <>
                      <Play size={16} color={colors.primaryForeground} />
                      <Text className="text-xs font-medium text-primary-foreground">Start beat</Text>
                    </>
                  )}
                </Button>
              </View>
            </View>
          )}
        </CardContent>
      </Card>

      <View className="flex-row gap-2">
        <Button
          variant="secondary"
          size="lg"
          disabled={index === 0}
          onPress={() => setIndex((i) => Math.max(0, i - 1))}
          accessibilityLabel="Previous step"
        >
          <ChevronLeft size={20} color={colors.secondaryForeground} />
        </Button>
        <Button size="lg" className="flex-1" onPress={markDone}>
          <Check size={20} color={colors.primaryForeground} />
          <Text className="text-base font-medium text-primary-foreground">
            {isLast ? 'Done — prepare handoff' : 'Done, next step'}
          </Text>
        </Button>
        {!isLast && (
          <Button
            variant="secondary"
            size="lg"
            onPress={() => setIndex((i) => Math.min(procedure.steps.length - 1, i + 1))}
            accessibilityLabel="Skip step"
          >
            <ChevronRight size={20} color={colors.secondaryForeground} />
          </Button>
        )}
      </View>

      <Card className="border-dashed">
        <CardContent className="gap-2">
          <View className="flex-row items-start gap-2">
            <Stethoscope size={16} color={colors.primary} style={{ marginTop: 2 }} />
            <Text className="flex-1 text-sm text-muted-foreground">
              {procedure.clinicalReview === 'pending'
                ? 'These steps are bystander orientation and are pending independent clinical sign-off. If the 112 operator tells you something different, follow the operator.'
                : 'Clinically reviewed content. Still follow the 112 operator over this screen.'}
            </Text>
          </View>
          <SourceNote sources={procedure.sources} />
        </CardContent>
      </Card>
    </View>
  );
};

export default ProcedureRunner;
