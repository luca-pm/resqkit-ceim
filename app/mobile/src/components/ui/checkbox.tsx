/**
 * Primitive (Section G2) — consent/opt-in checkbox. Mirrors app/frontend's
 * shadcn Checkbox props (`checked` / `onCheckedChange`) so screen code ports
 * without rewiring.
 */
import React from 'react';
import { Pressable } from 'react-native';
import { Check } from 'lucide-react-native';

import { useTokenColors } from '@/lib/tokenColors';

interface CheckboxProps {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  disabled?: boolean;
  accessibilityLabel?: string;
  className?: string;
}

export const Checkbox: React.FC<CheckboxProps> = ({
  checked,
  onCheckedChange,
  disabled = false,
  accessibilityLabel,
  className = '',
}) => {
  const colors = useTokenColors();
  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityState={{ checked, disabled }}
      accessibilityLabel={accessibilityLabel}
      disabled={disabled}
      onPress={() => onCheckedChange(!checked)}
      // Enlarge the touch target beyond the 20px box without changing layout —
      // this gates consent, and a missed tap is a real failure here.
      hitSlop={10}
      className={`h-5 w-5 items-center justify-center rounded-sm border ${
        checked ? 'border-primary bg-primary' : 'border-border bg-transparent'
      } ${disabled ? 'opacity-50' : ''} ${className}`}
    >
      {checked ? <Check size={14} color={colors.primaryForeground} /> : null}
    </Pressable>
  );
};
