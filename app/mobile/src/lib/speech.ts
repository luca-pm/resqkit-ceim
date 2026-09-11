/**
 * Thin wrapper around expo-speech (text-to-speech). Kept as one place so
 * every caller shares the same voice/rate and so speech is always stopped
 * before a new utterance starts, instead of queueing and talking over
 * itself as the wizard advances one question per screen.
 */
import * as Speech from 'expo-speech';

export const speak = (text: string): void => {
  Speech.stop();
  Speech.speak(text, { rate: 0.95 });
};

export const stopSpeaking = (): void => {
  Speech.stop();
};
