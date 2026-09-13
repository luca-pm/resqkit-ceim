/**
 * The splash shown while the native Expo splash screen hands off to the app
 * (see `app.json`'s `expo-splash-screen` plugin config for the native frame
 * this must match exactly on first paint, so `hideAsync()` never produces a
 * visible jump). Bold brand treatment, decided in the visual-revamp plan:
 * full-bleed primary teal, a white circular badge holding the brand mark
 * (the same `LifeBuoy` icon used in `AppShell`'s header, inverted here —
 * teal-on-white instead of white-on-teal), a large wordmark, and a
 * translucent tagline pulled from the same `common.app.tagline` string used
 * elsewhere so it never drifts out of sync.
 */
import * as SplashScreen from 'expo-splash-screen';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { LifeBuoy } from 'lucide-react-native';
import Animated, { Easing, Keyframe } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

/** Matches `--primary` (light) in global.css / tokenColors.ts and
 * `app.json`'s splash `backgroundColor` exactly — kept a literal, not the
 * theme-aware `useTokenColors()` hook, so this earliest-mounted screen never
 * depends on the color-scheme provider being ready yet, and so it reads as
 * one deliberate brand statement rather than following the OS theme. */
const TEAL = '#127E91';
const DURATION = 1100;

const splashKeyframe = new Keyframe({
  0: {
    transform: [{ scale: 1 }],
    opacity: 1,
  },
  20: {
    opacity: 1,
  },
  70: {
    opacity: 0,
    easing: Easing.elastic(0.7),
  },
  100: {
    opacity: 0,
    transform: [{ scale: 1 }],
    easing: Easing.elastic(0.7),
  },
});

export function AnimatedSplashOverlay() {
  const { t } = useTranslation('common');
  const [animate, setAnimate] = useState(false);
  const [visible, setVisible] = useState(true);

  if (!visible) return null;

  const content = (
    <View style={styles.content}>
      <View style={styles.badge}>
        <LifeBuoy size={44} color={TEAL} />
      </View>
      <Text style={styles.wordmark}>{t('app.name')}</Text>
      <Text style={styles.tagline}>{t('app.tagline')}</Text>
    </View>
  );

  return animate ? (
    <Animated.View
      entering={splashKeyframe.duration(DURATION).withCallback((finished) => {
        'worklet';
        if (finished) {
          scheduleOnRN(setVisible, false);
        }
      })}
      style={styles.splashOverlay}>
      {content}
    </Animated.View>
  ) : (
    <View
      onLayout={() => {
        SplashScreen.hideAsync().finally(() => {
          setAnimate(true);
        });
      }}
      style={styles.splashOverlay}
    />
  );
}

const styles = StyleSheet.create({
  splashOverlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: TEAL,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
  },
  content: {
    alignItems: 'center',
    gap: 14,
    paddingHorizontal: 32,
  },
  badge: {
    width: 112,
    height: 112,
    borderRadius: 56,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  wordmark: {
    fontSize: 34,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 0.3,
  },
  tagline: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.78)',
    textAlign: 'center',
  },
});
