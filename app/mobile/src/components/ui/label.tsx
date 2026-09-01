/**
 * Primitive (Section G2) — form field label. Mirrors app/frontend's shadcn Label.
 */
import React from 'react';
import { Text } from 'react-native';

interface LabelProps {
  className?: string;
  children: React.ReactNode;
}

export const Label: React.FC<LabelProps> = ({ className = '', children }) => (
  <Text className={`text-sm font-medium text-foreground ${className}`}>{children}</Text>
);
