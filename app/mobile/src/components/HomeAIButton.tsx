/**
 * Floating AI entry point on Home — a literal port of Alexandra's reference
 * design's FloatingAIButton (src/components/home/aiButton.js +
 * aiButton.styles.js), not a NativeWind reimplementation: her actual button
 * is a plain Pressable + MaterialCommunityIcons, not a react-native-paper
 * component, so this mirrors that exactly (down to the icon name and the
 * "ResQ AI" label) rather than routing it through Paper unnecessarily.
 *
 * Absolutely positioned so it floats over scrolled content regardless of
 * scroll position, same as hers. Navigates to our real /chat screen — the
 * one piece of her Home screen with an actual functional equivalent here.
 */
import React from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';
import { useRouter } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';

import { useTokenColors } from '@/lib/tokenColors';

// Matches her SHADOWS.medium exactly (src/design/shadows.js) — the tier she
// reserves for this button specifically, distinct from Card's `elevated`
// (her SHADOWS.small).
const SHADOW_MEDIUM = {
  shadowColor: '#000',
  shadowOffset: { width: 0, height: 3 },
  shadowOpacity: 0.18,
  shadowRadius: 5,
  elevation: 4,
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    right: 24,
    bottom: 20,
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 18,
    borderRadius: 999,
    ...SHADOW_MEDIUM,
  },
  text: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 16,
    marginLeft: 10,
  },
});

export default function HomeAIButton() {
  const router = useRouter();
  const colors = useTokenColors();

  return (
    <Pressable
      onPress={() => router.push('/chat')}
      style={[styles.container, { backgroundColor: colors.primary }]}
      accessibilityRole="button"
      accessibilityLabel="Open ResQKit AI chat"
    >
      <MaterialCommunityIcons name="robot-outline" size={26} color="#FFFFFF" />
      <Text style={styles.text}>ResQ AI</Text>
    </Pressable>
  );
}
