/**
 * AppState hardening (Section G6).
 *
 * Dialling 112 hands off to the OS dialler and SUSPENDS this app — unlike a
 * browser tab, which merely loses focus. JS timers and in-flight sockets are
 * unreliable across that boundary, so anything time-sensitive must react to it
 * explicitly rather than assume it kept running.
 *
 * The metronome uses this to stop cleanly on suspend (see ProcedureRunner) —
 * deliberately NOT auto-restarting on return, because resuming at a drifted
 * cadence while someone paces real chest compressions is worse than an
 * obviously-stopped beat the user restarts themselves.
 */
import { useEffect, useRef } from 'react';
import { AppState, AppStateStatus } from 'react-native';

interface Options {
  /** Fired when the app returns to the foreground after being backgrounded. */
  onResume?: () => void;
  /** Fired when the app leaves the foreground (background or inactive). */
  onSuspend?: () => void;
}

export function useAppStateResume({ onResume, onSuspend }: Options): void {
  const previous = useRef<AppStateStatus>(AppState.currentState);
  // Keep the latest callbacks in refs so a caller passing inline closures
  // doesn't tear down and re-add the subscription on every render. Assigned
  // in an effect, not during render — a ref write during render is not safe
  // under concurrent rendering.
  const onResumeRef = useRef(onResume);
  const onSuspendRef = useRef(onSuspend);

  useEffect(() => {
    onResumeRef.current = onResume;
    onSuspendRef.current = onSuspend;
  });

  useEffect(() => {
    const sub = AppState.addEventListener('change', (next) => {
      const wasActive = previous.current === 'active';
      const isActive = next === 'active';
      if (wasActive && !isActive) onSuspendRef.current?.();
      if (!wasActive && isActive) onResumeRef.current?.();
      previous.current = next;
    });
    return () => sub.remove();
  }, []);
}
