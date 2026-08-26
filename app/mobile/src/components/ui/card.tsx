import React from 'react';
import { Text, View, ViewProps } from 'react-native';

export const Card: React.FC<ViewProps> = ({ className = '', ...props }) => (
  <View className={`rounded-2xl border border-border bg-card ${className}`} {...props} />
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
