/**
 * Primitive (Section G2) — mirrors app/frontend's shadcn Badge variant names
 * so screen code reads the same on both platforms. Includes the `emergency`
 * variant: the only place the reserved red appears (112 / hazards / critical
 * steps). See Section E1 of the plan.
 */
import React from 'react';
import { Text, View } from 'react-native';

export type BadgeVariant = 'default' | 'secondary' | 'destructive' | 'emergency' | 'outline';

const CONTAINER: Record<BadgeVariant, string> = {
  default: 'bg-primary border-transparent',
  secondary: 'bg-secondary border-transparent',
  destructive: 'bg-destructive border-transparent',
  emergency: 'bg-emergency border-transparent',
  outline: 'bg-transparent border-border',
};

const LABEL: Record<BadgeVariant, string> = {
  default: 'text-primary-foreground',
  secondary: 'text-secondary-foreground',
  destructive: 'text-destructive-foreground',
  emergency: 'text-emergency-foreground',
  outline: 'text-foreground',
};

interface BadgeProps {
  variant?: BadgeVariant;
  className?: string;
  children: React.ReactNode;
}

export const Badge: React.FC<BadgeProps> = ({ variant = 'default', className = '', children }) => (
  <View className={`self-start rounded-full border px-2.5 py-0.5 ${CONTAINER[variant]} ${className}`}>
    {typeof children === 'string' ? (
      <Text className={`text-xs font-semibold ${LABEL[variant]}`}>{children}</Text>
    ) : (
      children
    )}
  </View>
);
