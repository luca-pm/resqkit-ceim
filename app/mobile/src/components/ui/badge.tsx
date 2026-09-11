/**
 * Primitive (Section G2) — mirrors app/frontend's shadcn Badge variant names
 * so screen code reads the same on both platforms. Includes the `emergency`
 * variant: the only place the reserved red appears (112 / hazards / critical
 * steps). See Section E1 of the plan.
 */
import React from 'react';
import { Text, View } from 'react-native';

export type BadgeVariant = 'default' | 'secondary' | 'destructive' | 'emergency' | 'warning' | 'outline';
/** 'pastel' is a soft tinted-background alternative to the default solid
 * fill (see global.css's `*-tint`/`*-tint-foreground` pairs) — opt-in only,
 * every existing call site keeps its solid look unless it passes tone. */
export type BadgeTone = 'solid' | 'pastel';

const CONTAINER: Record<BadgeVariant, string> = {
  default: 'bg-primary border-transparent',
  secondary: 'bg-secondary border-transparent',
  destructive: 'bg-destructive border-transparent',
  emergency: 'bg-emergency border-transparent',
  warning: 'bg-warning border-transparent',
  outline: 'bg-transparent border-border',
};

// 'outline' has no pastel form — it's already a minimal/transparent style,
// so a pastel Badge just falls back to CONTAINER/LABEL for it.
const CONTAINER_PASTEL: Partial<Record<BadgeVariant, string>> = {
  default: 'bg-primary-tint border-transparent',
  secondary: 'bg-secondary-tint border-transparent',
  destructive: 'bg-destructive-tint border-transparent',
  emergency: 'bg-emergency-tint border-transparent',
  warning: 'bg-warning-tint border-transparent',
};

const LABEL: Record<BadgeVariant, string> = {
  default: 'text-primary-foreground',
  secondary: 'text-secondary-foreground',
  destructive: 'text-destructive-foreground',
  emergency: 'text-emergency-foreground',
  warning: 'text-warning-foreground',
  outline: 'text-foreground',
};

const LABEL_PASTEL: Partial<Record<BadgeVariant, string>> = {
  default: 'text-primary-tint-foreground',
  secondary: 'text-secondary-tint-foreground',
  destructive: 'text-destructive-tint-foreground',
  emergency: 'text-emergency-tint-foreground',
  warning: 'text-warning-tint-foreground',
};

interface BadgeProps {
  variant?: BadgeVariant;
  tone?: BadgeTone;
  className?: string;
  children: React.ReactNode;
}

export const Badge: React.FC<BadgeProps> = ({ variant = 'default', tone = 'solid', className = '', children }) => {
  const containerClass = tone === 'pastel' ? (CONTAINER_PASTEL[variant] ?? CONTAINER[variant]) : CONTAINER[variant];
  const labelClass = tone === 'pastel' ? (LABEL_PASTEL[variant] ?? LABEL[variant]) : LABEL[variant];
  return (
    <View className={`self-start rounded-full border px-2.5 py-0.5 ${containerClass} ${className}`}>
      {typeof children === 'string' ? (
        <Text className={`text-xs font-semibold ${labelClass}`}>{children}</Text>
      ) : (
        children
      )}
    </View>
  );
};
