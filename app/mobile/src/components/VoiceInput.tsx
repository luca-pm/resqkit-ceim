/**
 * On-device speech-to-text button. Deliberately never falls back to
 * network/cloud recognition — this app's whole posture is that nothing
 * leaves the device (see services/ceim.py's local-Ollama-only design,
 * ResQKit_Progress_Update.md). expo-speech-recognition defaults to Google's
 * server-based recognition; every call here forces
 * `requiresOnDeviceRecognition: true` instead.
 *
 * On-device recognition needs Android 13+ and a downloaded language model.
 * When it isn't available, this component renders nothing rather than
 * silently falling back to a cloud service the user didn't agree to.
 */
import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Platform, Pressable, Text } from 'react-native';
import { Mic, MicOff } from 'lucide-react-native';
import {
  ExpoSpeechRecognitionModule,
  useSpeechRecognitionEvent,
} from 'expo-speech-recognition';

import { toast } from '@/components/ui/toast';
import { useTokenColors } from '@/lib/tokenColors';

export type VoiceLocale = 'en-US' | 'ro-RO';

type Availability = 'checking' | 'unavailable' | 'model_missing' | 'ready';

interface VoiceInputProps {
  /** Current text in the field this button feeds, so starting voice input
   * appends to what's already there instead of wiping it. */
  value: string;
  onTranscript: (text: string) => void;
  locale?: VoiceLocale;
}

const VoiceInput: React.FC<VoiceInputProps> = ({ value, onTranscript, locale = 'en-US' }) => {
  const colors = useTokenColors();
  const [availability, setAvailability] = useState<Availability>('checking');
  const [listening, setListening] = useState(false);

  // Stop any in-progress recognition when this button goes away — the
  // parent remounts it (via `key`) for every new question, so without this
  // a session left running from the previous question keeps listening,
  // picks up that question's own TTS audio being read aloud, and appends
  // it onto whatever the next question's answer becomes.
  useEffect(() => () => ExpoSpeechRecognitionModule.abort(), []);

  // Base text that each new voice segment gets appended onto. In continuous
  // mode each `result` covers a new segment, not the whole transcript since
  // listening started, so this has to be updated as segments are committed
  // — see the `result` handler below.
  const committedRef = useRef('');
  const valueRef = useRef(value);
  // The last value this component itself pushed via onTranscript. Used to
  // tell "the field changed because I typed a voice result into it" apart
  // from "the field changed because the user edited it on the keyboard" —
  // only the latter should re-sync committedRef. Without this, editing the
  // text (e.g. deleting a misheard word) while a listening session is still
  // open gets silently overwritten: the next voice segment appends onto the
  // stale pre-edit base and resurrects whatever was deleted.
  const lastEmittedRef = useRef('');
  useEffect(() => {
    valueRef.current = value;
    if (value !== lastEmittedRef.current) {
      committedRef.current = value;
    }
  }, [value]);

  useEffect(() => {
    (async () => {
      // Android-only for now — iOS on-device recognition needs a separate,
      // unverified permissions path (see the package README's iOS section).
      if (Platform.OS !== 'android') {
        setAvailability('unavailable');
        return;
      }
      try {
        const supported = ExpoSpeechRecognitionModule.supportsOnDeviceRecognition();
        if (!supported) {
          setAvailability('unavailable');
          return;
        }
        const { installedLocales } = await ExpoSpeechRecognitionModule.getSupportedLocales({
          androidRecognitionServicePackage: 'com.google.android.as',
        });
        setAvailability(installedLocales.includes(locale) ? 'ready' : 'model_missing');
      } catch {
        // Not present at all — most likely still running in Expo Go, where
        // this native module doesn't exist. Fail silent, not crash.
        setAvailability('unavailable');
      }
    })();
  }, [locale]);

  useSpeechRecognitionEvent('start', () => {
    committedRef.current = valueRef.current;
    setListening(true);
  });
  useSpeechRecognitionEvent('end', () => setListening(false));
  useSpeechRecognitionEvent('result', (event) => {
    const transcript = event.results[0]?.transcript;
    if (!transcript) return;
    let next: string;
    if (event.isFinal) {
      // Settle this segment into the committed base so a later interim
      // update (continuous mode can produce several final segments) is
      // appended after it instead of overwriting it.
      committedRef.current = committedRef.current ? `${committedRef.current} ${transcript}` : transcript;
      next = committedRef.current;
    } else {
      // Interim result: the transcript IS the full utterance-so-far, not a
      // delta, so this replaces (not appends to) whatever the previous
      // interim update showed — only committedRef.current is prepended.
      next = committedRef.current ? `${committedRef.current} ${transcript}` : transcript;
    }
    lastEmittedRef.current = next;
    onTranscript(next);
  });
  useSpeechRecognitionEvent('error', (event) => {
    if (event.error !== 'no-speech' && event.error !== 'aborted') {
      toast.error('Voice input failed. You can still type your answer.');
    }
  });

  const downloadModel = async () => {
    try {
      const result = await ExpoSpeechRecognitionModule.androidTriggerOfflineModelDownload({ locale });
      if (result.status === 'download_success') {
        setAvailability('ready');
        toast.success('Voice model ready.');
      } else {
        toast.info('Downloading the offline voice model — try again in a moment.');
      }
    } catch {
      toast.error('Could not download the offline voice model.');
    }
  };

  const toggle = async () => {
    if (listening) {
      ExpoSpeechRecognitionModule.stop();
      return;
    }
    if (availability === 'model_missing') {
      void downloadModel();
      return;
    }
    const permission = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
    if (!permission.granted) {
      toast.error('Microphone permission denied. You can still type your answer.');
      return;
    }
    ExpoSpeechRecognitionModule.start({
      lang: locale,
      interimResults: true,
      continuous: true,
      requiresOnDeviceRecognition: true,
      androidIntentOptions: {
        // Default Android silence timeout (~1-2s) was cutting people off
        // mid-sentence on a normal thinking pause. 5s gives real breathing
        // room; the mic button still lets you stop early by hand.
        EXTRA_SPEECH_INPUT_COMPLETE_SILENCE_LENGTH_MILLIS: 5000,
      },
    });
  };

  if (availability === 'unavailable' || availability === 'checking') return null;

  return (
    <Pressable
      onPress={toggle}
      accessibilityRole="button"
      accessibilityLabel={listening ? 'Stop voice input' : 'Answer by voice'}
      className={`flex-row items-center gap-1.5 self-start rounded-md border px-3 py-2 ${
        listening ? 'border-emergency bg-emergency/10' : 'border-border bg-card'
      }`}
    >
      {listening ? (
        <ActivityIndicator size="small" color={colors.emergency} />
      ) : availability === 'model_missing' ? (
        <MicOff size={16} color={colors.mutedForeground} />
      ) : (
        <Mic size={16} color={colors.foreground} />
      )}
      <Text className={`text-xs font-medium ${listening ? 'text-emergency' : 'text-foreground'}`}>
        {listening ? 'Listening… tap to stop' : availability === 'model_missing' ? 'Download voice model' : 'Answer by voice'}
      </Text>
    </Pressable>
  );
};

export default VoiceInput;
