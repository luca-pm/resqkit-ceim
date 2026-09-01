import React, { useState } from 'react';
import { Pressable, TextInput, TextInputProps, View } from 'react-native';
import { Eye, EyeOff } from 'lucide-react-native';

import { useTokenColors } from '@/lib/tokenColors';

export const Input: React.FC<TextInputProps> = ({ className = '', ...props }) => (
  <TextInput
    className={`h-11 rounded-md border border-input bg-background px-3 text-foreground placeholder:text-muted-foreground ${className}`}
    {...props}
  />
);

/**
 * Password field with a show/hide toggle.
 *
 * Worth having rather than a bare secureTextEntry: a mistyped password on a
 * phone keyboard is invisible otherwise, and the only feedback is a failed
 * sign-in that looks identical to wrong credentials.
 */
export const PasswordInput: React.FC<TextInputProps> = ({ className = '', ...props }) => {
  const [visible, setVisible] = useState(false);
  const colors = useTokenColors();

  return (
    <View className="relative justify-center">
      <TextInput
        secureTextEntry={!visible}
        autoCapitalize="none"
        autoCorrect={false}
        className={`h-11 rounded-md border border-input bg-background pl-3 pr-11 text-foreground placeholder:text-muted-foreground ${className}`}
        {...props}
      />
      <Pressable
        onPress={() => setVisible((v) => !v)}
        accessibilityRole="button"
        accessibilityLabel={visible ? 'Hide password' : 'Show password'}
        hitSlop={8}
        className="absolute right-0 h-11 w-11 items-center justify-center"
      >
        {visible ? (
          <EyeOff size={18} color={colors.mutedForeground} />
        ) : (
          <Eye size={18} color={colors.mutedForeground} />
        )}
      </Pressable>
    </View>
  );
};
