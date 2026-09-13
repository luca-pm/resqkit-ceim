/**
 * Minimal primitive (Section E6) — mirrors app/frontend's shadcn Button
 * variant names/props so screen code reads the same on both platforms.
 * Not a full port of the Radix/cva machinery, just enough for the new
 * Section E screens.
 */
import React from 'react';
import { ActivityIndicator, Pressable, PressableProps, Text } from 'react-native';

export type ButtonVariant = 'default' | 'secondary' | 'outline' | 'ghost' | 'destructive' | 'emergency';
export type ButtonSize = 'default' | 'sm' | 'lg';

interface ButtonProps extends Omit<PressableProps, 'children'> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  children: React.ReactNode;
}

const CONTAINER_VARIANTS: Record<ButtonVariant, string> = {
  default: 'bg-primary',
  secondary: 'bg-secondary',
  outline: 'border border-input bg-transparent',
  ghost: 'bg-transparent',
  destructive: 'bg-destructive',
  emergency: 'bg-emergency',
};

const TEXT_VARIANTS: Record<ButtonVariant, string> = {
  default: 'text-primary-foreground',
  secondary: 'text-secondary-foreground',
  outline: 'text-foreground',
  ghost: 'text-foreground',
  destructive: 'text-destructive-foreground',
  emergency: 'text-emergency-foreground',
};

// Bumped toward the reference design's chunkier, more tappable scale
// (its buttons/inputs are uniformly 56px tall) — every existing call site
// gets the new size automatically, no per-screen changes needed.
const SIZE_CONTAINER: Record<ButtonSize, string> = {
  default: 'h-14 px-5',
  sm: 'h-10 px-4',
  lg: 'h-16 px-6',
};

const SIZE_TEXT: Record<ButtonSize, string> = {
  default: 'text-base',
  sm: 'text-sm',
  lg: 'text-lg',
};

export const Button: React.FC<ButtonProps> = ({
  variant = 'default',
  size = 'default',
  loading = false,
  disabled,
  className = '',
  children,
  ...props
}) => {
  const isDisabled = disabled || loading;
  return (
    <Pressable
      disabled={isDisabled}
      className={`flex-row items-center justify-center gap-2 rounded-md ${CONTAINER_VARIANTS[variant]} ${SIZE_CONTAINER[size]} ${isDisabled ? 'opacity-50' : ''} ${className}`}
      {...props}
    >
      {loading ? (
        <ActivityIndicator size="small" />
      ) : typeof children === 'string' ? (
        <Text className={`font-medium ${TEXT_VARIANTS[variant]} ${SIZE_TEXT[size]}`}>{children}</Text>
      ) : (
        children
      )}
    </Pressable>
  );
};
