/**
 * Spike: camera capture -> downscale -> backend kit recognition round-trip.
 *
 * Mirrors app/frontend/src/components/KitScanner.tsx exactly on the backend
 * contract (POST /api/v1/resqkit/recognize_kit, maxWidth 1024, JPEG q=0.75,
 * base64 data URI) so the same endpoint serves both apps unchanged. What
 * this spike is actually testing: permission flow, capture latency, and
 * round-trip time to the self-hosted recognition model over a real Wi-Fi
 * connection instead of localhost — none of which the dev sandbox can judge.
 */
import { useRef, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';

const API_BASE = process.env.EXPO_PUBLIC_API_BASE_URL ?? 'http://localhost:8001';

interface RecognizedItem {
  code: string;
  name: string;
  confidence: number;
}

export default function KitScannerSpike() {
  const [permission, requestPermission] = useCameraPermissions();
  const cameraRef = useRef<CameraView>(null);
  const [scanning, setScanning] = useState(false);
  const [error, setError] = useState('');
  const [results, setResults] = useState<RecognizedItem[] | null>(null);
  const [sceneNote, setSceneNote] = useState('');

  const captureAndRecognize = async () => {
    if (!cameraRef.current) return;
    setScanning(true);
    setError('');
    setResults(null);
    try {
      const photo = await cameraRef.current.takePictureAsync({ quality: 0.8 });
      if (!photo) throw new Error('No photo captured.');

      const context = ImageManipulator.manipulate(photo.uri);
      context.resize({ width: 1024 });
      const rendered = await context.renderAsync();
      const saved = await rendered.saveAsync({
        compress: 0.75,
        format: SaveFormat.JPEG,
        base64: true,
      });
      if (!saved.base64) throw new Error('Could not encode the photo.');
      const dataUri = `data:image/jpeg;base64,${saved.base64}`;

      const response = await fetch(`${API_BASE}/api/v1/resqkit/recognize_kit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: dataUri, context: 'other' }),
      });
      if (!response.ok) throw new Error(`Backend returned ${response.status}`);
      const payload = (await response.json()) as {
        items?: RecognizedItem[];
        scene_note?: string;
        message?: string;
      };
      setResults(payload.items ?? []);
      setSceneNote(payload.scene_note ?? '');
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : 'Recognition failed.';
      setError(`${message} (API base: ${API_BASE})`);
    } finally {
      setScanning(false);
    }
  };

  if (!permission) {
    return (
      <View className="flex-1 items-center justify-center bg-background">
        <ActivityIndicator />
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <View className="flex-1 items-center justify-center gap-4 bg-background px-6">
        <Text className="text-center text-base text-foreground">
          Camera access is needed to identify what is in your kit.
        </Text>
        <Pressable onPress={requestPermission} className="rounded-full bg-primary px-6 py-3">
          <Text className="font-semibold text-primary-foreground">Grant camera access</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-background">
      <CameraView ref={cameraRef} style={{ flex: 1 }} facing="back" />
      <ScrollView className="max-h-72 bg-background px-4 py-3">
        <Pressable
          onPress={captureAndRecognize}
          disabled={scanning}
          className="items-center rounded-full bg-primary px-6 py-3"
        >
          {scanning ? (
            <ActivityIndicator color="white" />
          ) : (
            <Text className="font-semibold text-primary-foreground">Identify kit contents</Text>
          )}
        </Pressable>

        {error !== '' && <Text className="mt-3 text-sm text-destructive">{error}</Text>}

        {results !== null && (
          <View className="mt-3 rounded-md border border-border p-3">
            <Text className="font-semibold text-foreground">Recognition result</Text>
            {results.length === 0 ? (
              <Text className="mt-1 text-sm text-muted-foreground">
                Nothing identified with confidence.
              </Text>
            ) : (
              results.map((item) => (
                <Text key={item.code} className="mt-1 text-sm text-foreground">
                  {item.name} — {Math.round(item.confidence * 100)}%
                </Text>
              ))
            )}
            {sceneNote !== '' && (
              <Text className="mt-2 text-xs text-muted-foreground">Scene: {sceneNote}</Text>
            )}
          </View>
        )}
      </ScrollView>
    </View>
  );
}
