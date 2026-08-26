import React from 'react';
import { TextInput, TextInputProps } from 'react-native';

export const Input: React.FC<TextInputProps> = ({ className = '', ...props }) => (
  <TextInput
    className={`h-11 rounded-md border border-input bg-background px-3 text-foreground placeholder:text-muted-foreground ${className}`}
    {...props}
  />
);
