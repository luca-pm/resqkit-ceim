import React, { useState } from 'react';
import { Pressable, TextInput, TextInputProps, View } from 'react-native';
import { Eye, EyeOff } from 'lucide-react-native';

import { useTokenColors } from '@/lib/tokenColors';

// h-14 (56px) matches the reference design's uniform input/button height —
// bigger tap target, easier to hit under stress than the previous h-11.
export const Input: React.FC<TextInputProps> = ({ className = '', ...props }) => (
  <TextInput
    className={`h-14 rounded-md border border-input bg-background px-4 text-base text-foreground placeholder:text-muted-foreground ${className}`}
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
        className={`h-14 rounded-md border border-input bg-background pl-4 pr-12 text-base text-foreground placeholder:text-muted-foreground ${className}`}
        {...props}
      />
      <Pressable
        onPress={() => setVisible((v) => !v)}
        accessibilityRole="button"
        accessibilityLabel={visible ? 'Hide password' : 'Show password'}
        hitSlop={8}
        className="absolute right-0 h-14 w-14 items-center justify-center"
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
