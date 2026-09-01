/**
 * Primitive (Section G2) — procedure progress bar. Plain Views rather than an
 * animated bar: this paces a first-aid procedure, so an instant, unambiguous
 * position reading matters more than a transition.
 */
import React from 'react';
import { View } from 'react-native';

interface ProgressProps {
  /** 0–100. Clamped, so a bad computation can't render a bar wider than its track. */
  value: number;
  className?: string;
  accessibilityLabel?: string;
}

export const Progress: React.FC<ProgressProps> = ({ value, className = '', accessibilityLabel }) => {
  const pct = Math.max(0, Math.min(100, Number.isFinite(value) ? value : 0));
  return (
    <View
      accessibilityRole="progressbar"
      accessibilityLabel={accessibilityLabel}
      accessibilityValue={{ min: 0, max: 100, now: Math.round(pct) }}
      className={`h-2 w-full overflow-hidden rounded-full bg-muted ${className}`}
    >
      <View className="h-full rounded-full bg-primary" style={{ width: `${pct}%` }} />
    </View>
  );
};
