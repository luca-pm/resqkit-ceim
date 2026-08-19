/**
 * Spike: CPR compression-rate metronome on real hardware.
 *
 * The web app drives this with a Web Audio oscillator on a `setInterval`
 * (see app/frontend/src/components/ProcedureRunner.tsx). RN has no oscillator
 * API, so this replays a pre-rendered click sample instead, paired with a
 * haptic pulse as a redundant channel (see the RN migration plan's risk
 * notes). setInterval jitter and audio/haptic latency can only be judged on
 * a physical device — not in this dev sandbox.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import { useAudioPlayer } from 'expo-audio';

const CLICK_SOUND = require('../../assets/audio/metronome-click.wav');
const BPM = 110;

export default function MetronomeSpike() {
  const player = useAudioPlayer(CLICK_SOUND);
  const [running, setRunning] = useState(false);
  const [beatCount, setBeatCount] = useState(0);
  const timerRef = useRef<number | null>(null);

  const tick = useCallback(() => {
    player.seekTo(0);
    player.play();
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setBeatCount((n) => n + 1);
  }, [player]);

  const stop = useCallback(() => {
    if (timerRef.current !== null) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    setRunning(false);
  }, []);

  const start = useCallback(() => {
    setBeatCount(0);
    tick();
    timerRef.current = setInterval(tick, Math.round(60000 / BPM));
    setRunning(true);
  }, [tick]);

  useEffect(() => stop, [stop]);

  return (
    <View className="flex-1 items-center justify-center gap-6 bg-background px-6">
      <Text className="text-center text-2xl font-bold text-foreground">CPR metronome spike</Text>
      <Text className="text-center text-sm text-muted-foreground">
        {BPM} bpm — audio click plus a haptic pulse on every beat. Judge whether the rhythm feels
        steady and whether the click and the pulse land together.
      </Text>
      <Text className="text-4xl font-bold tabular-nums text-primary">{beatCount}</Text>
      <Pressable onPress={running ? stop : start} className="rounded-full bg-primary px-8 py-4">
        <Text className="text-lg font-semibold text-primary-foreground">
          {running ? 'Stop' : 'Start beat'}
        </Text>
      </Pressable>
    </View>
  );
}
