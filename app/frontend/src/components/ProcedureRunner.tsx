/**
 * S8 — Guided first aid.
 *
 * Steps come exclusively from the curated content pack. Each step is filtered
 * against the kit the user actually has: if a required item is missing, the
 * step shows its improvised alternative instead of asking for equipment that
 * is not there. Completed steps are timestamped for the rescuer handoff.
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AlertTriangle, Check, ChevronLeft, ChevronRight, Pause, Play, Stethoscope } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import SourceNote from '@/components/SourceNote';
import { Procedure, kitItemByCode } from '@/lib/knowledge';
import { CompletedStep } from '@/lib/localStore';

interface ProcedureRunnerProps {
  procedure: Procedure;
  kitItems: string[];
  completedSteps: CompletedStep[];
  onStepDone: (step: CompletedStep) => void;
  onFinish: () => void;
}

/** Simple Web Audio metronome for compression rate guidance. */
const useMetronome = (bpm?: number) => {
  const [running, setRunning] = useState(false);
  const ctxRef = useRef<AudioContext | null>(null);
  const timerRef = useRef<number | null>(null);

  const stop = useCallback(() => {
    if (timerRef.current !== null) {
      window.clearInterval(timerRef.current);
      timerRef.current = null;
    }
    setRunning(false);
  }, []);

  const start = useCallback(() => {
    if (!bpm) return;
    type AudioCtor = typeof AudioContext;
    const Ctor: AudioCtor | undefined =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: AudioCtor }).webkitAudioContext;
    if (!Ctor) return;
    if (!ctxRef.current) ctxRef.current = new Ctor();
    const ctx = ctxRef.current;
    void ctx.resume().catch(() => undefined);

    const click = () => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.frequency.value = 1000;
      gain.gain.setValueAtTime(0.0001, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.25, ctx.currentTime + 0.005);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.06);
      osc.connect(gain).connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.07);
    };

    click();
    timerRef.current = window.setInterval(click, Math.round(60000 / bpm));
    setRunning(true);
  }, [bpm]);

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
  const [index, setIndex] = useState(() => Math.min(completedSteps.length, procedure.steps.length - 1));
  const step = procedure.steps[index];
  const metronome = useMetronome(step.metronomeBpm);
  const doneIndexes = new Set(completedSteps.map((s) => s.index));
  const isLast = index === procedure.steps.length - 1;

  useEffect(() => {
    metronome.stop();
  }, [index, metronome]);

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
    <div className="space-y-4">
      <div>
        <div className="flex items-center justify-between gap-2">
          <h2>{procedure.name}</h2>
          <Badge variant="secondary">
            {index + 1}/{procedure.steps.length}
          </Badge>
        </div>
        <Progress
          value={((index + 1) / procedure.steps.length) * 100}
          className="mt-2"
          aria-label="Procedure progress"
        />
      </div>

      <Card className={step.critical ? 'border-emergency/50' : undefined}>
        <CardContent className="space-y-3 p-5">
          {step.critical && (
            <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-emergency">
              <AlertTriangle className="h-3.5 w-3.5" aria-hidden="true" />
              Critical step
            </p>
          )}
          <h3 className="text-xl font-bold leading-snug">{step.title}</h3>
          <p className="text-base leading-relaxed">{step.detail}</p>

          {present.length > 0 && (
            <div className="rounded-md border border-primary/40 bg-primary/10 p-3">
              <p className="text-sm font-semibold">Use from your kit</p>
              <ul className="mt-1 space-y-1 text-sm">
                {present.map((code) => {
                  const item = kitItemByCode(code);
                  return (
                    <li key={code}>
                      <span className="font-medium">{item?.name ?? code}</span>
                      {item ? ` — ${item.howTo}` : ''}
                    </li>
                  );
                })}
              </ul>
            </div>
          )}

          {blockedByMissingItem && step.withoutItem && (
            <div className="rounded-md border border-border bg-muted p-3">
              <p className="text-sm font-semibold">
                You don't have {missing.map((c) => kitItemByCode(c)?.name ?? c).join(' or ')}
              </p>
              <p className="mt-1 text-sm text-muted-foreground">{step.withoutItem}</p>
            </div>
          )}

          {step.metronomeBpm && (
            <div className="flex items-center justify-between gap-3 rounded-md border border-border bg-background p-3">
              <div>
                <p className="text-sm font-semibold">Compression rhythm</p>
                <p className="text-xs text-muted-foreground tabular">
                  {step.metronomeBpm} beats per minute
                </p>
              </div>
              <div className="flex items-center gap-2">
                {metronome.running && (
                  <span className="h-3 w-3 rounded-full bg-emergency animate-pulse-ring" />
                )}
                <Button
                  size="sm"
                  variant={metronome.running ? 'secondary' : 'default'}
                  onClick={() => (metronome.running ? metronome.stop() : metronome.start())}
                >
                  {metronome.running ? (
                    <>
                      <Pause className="mr-1.5 h-4 w-4" aria-hidden="true" />
                      Stop
                    </>
                  ) : (
                    <>
                      <Play className="mr-1.5 h-4 w-4" aria-hidden="true" />
                      Start beat
                    </>
                  )}
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="flex gap-2">
        <Button
          variant="secondary"
          size="lg"
          disabled={index === 0}
          onClick={() => setIndex((i) => Math.max(0, i - 1))}
        >
          <ChevronLeft className="h-5 w-5" aria-hidden="true" />
          <span className="sr-only">Previous step</span>
        </Button>
        <Button size="lg" className="flex-1" onClick={markDone}>
          <Check className="mr-2 h-5 w-5" aria-hidden="true" />
          {isLast ? 'Done — prepare handoff' : 'Done, next step'}
        </Button>
        {!isLast && (
          <Button
            variant="secondary"
            size="lg"
            onClick={() => setIndex((i) => Math.min(procedure.steps.length - 1, i + 1))}
          >
            <ChevronRight className="h-5 w-5" aria-hidden="true" />
            <span className="sr-only">Skip step</span>
          </Button>
        )}
      </div>

      <Card className="border-dashed">
        <CardContent className="space-y-2 p-4">
          <p className="flex items-start gap-2 text-sm">
            <Stethoscope className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
            <span className="text-muted-foreground">
              {procedure.clinicalReview === 'pending'
                ? 'These steps are bystander orientation and are pending independent clinical sign-off. If the 112 operator tells you something different, follow the operator.'
                : 'Clinically reviewed content. Still follow the 112 operator over this screen.'}
            </span>
          </p>
          <SourceNote sources={procedure.sources} />
        </CardContent>
      </Card>
    </div>
  );
};

export default ProcedureRunner;