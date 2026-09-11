import React from 'react';
import { Text, View, ViewProps } from 'react-native';

// RN shadows are platform style props, not expressible via className, so
// this stays a small shared style constant rather than an ad hoc value per
// call site. Theme-agnostic on purpose (a literal black at low opacity
// reads as "soft elevation" in both light and dark, same as the reference
// design's own shadow tokens) rather than trying to resolve a CSS var here.
const ELEVATED_SHADOW = {
  shadowColor: '#000',
  shadowOffset: { width: 0, height: 2 },
  shadowOpacity: 0.12,
  shadowRadius: 6,
  elevation: 3,
};

interface CardProps extends ViewProps {
  /** Soft drop shadow instead of the flat border look — opt-in for
   * "playful"/status surfaces (e.g. chat), left off (default) for
   * data/list surfaces (history, FAQ) which stay flat-bordered by design.
   * Every existing <Card> usage is unaffected until it passes this. */
  elevated?: boolean;
}

export const Card: React.FC<CardProps> = ({ className = '', elevated = false, style, ...props }) => (
  <View
    className={`rounded-2xl border border-border bg-card ${className}`}
    style={elevated ? [ELEVATED_SHADOW, style] : style}
    {...props}
  />
);

export const CardHeader: React.FC<ViewProps> = ({ className = '', ...props }) => (
  <View className={`p-4 pb-2 ${className}`} {...props} />
);

export const CardTitle: React.FC<{ children: React.ReactNode; className?: string }> = ({
  children,
  className = '',
}) => <Text className={`text-lg font-bold text-card-foreground ${className}`}>{children}</Text>;

export const CardDescription: React.FC<{ children: React.ReactNode; className?: string }> = ({
  children,
  className = '',
}) => <Text className={`mt-1 text-sm text-muted-foreground ${className}`}>{children}</Text>;

export const CardContent: React.FC<ViewProps> = ({ className = '', ...props }) => (
  <View className={`p-4 ${className}`} {...props} />
);
