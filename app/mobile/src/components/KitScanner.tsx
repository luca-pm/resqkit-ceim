/**
 * S6 — Kit recognition (RN port of app/frontend/src/components/KitScanner.tsx).
 *
 * Camera frames are captured, downscaled in memory, sent once for recognition,
 * and discarded. No frame is stored or uploaded to object storage. Recognition
 * is always optional: manual selection and "no kit at all" are first-class
 * paths, because a failed camera must never block first aid.
 *
 * Built on the capture pipeline proven on-device in spike-kit-scanner.tsx
 * (same 1024px downscale + JPEG q=0.75 + base64 data URI the web version
 * sends, so one backend contract serves both platforms).
 *
 * Mobile-specific: a permission funnel is a first-class UX path here, not an
 * edge case — a denied permission can only be recovered via OS settings, so
 * that route is offered explicitly (Section C's risk list).
 */
import React, { useRef, useState } from 'react';
import { ActivityIndicator, Linking, Pressable, Text, View } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import { Camera, CameraOff, Check, ScanLine, X } from 'lucide-react-native';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { toast } from '@/components/ui/toast';
import { client } from '@/lib/apiClient';
import { ContextId, KitItem, kitItemsForContext } from '@/lib/knowledge';
import { useTokenColors } from '@/lib/tokenColors';

interface RecognizedItem {
  code: string;
  name: string;
  confidence: number;
}

interface KitScannerProps {
  context: ContextId;
  selected: string[];
  onChange: (codes: string[], source: 'camera' | 'manual' | 'none') => void;
}

const KitScanner: React.FC<KitScannerProps> = ({ context, selected, onChange }) => {
  const [permission, requestPermission] = useCameraPermissions();
  const cameraRef = useRef<CameraView>(null);
  const colors = useTokenColors();

  const [cameraOn, setCameraOn] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [cameraError, setCameraError] = useState('');
  const [results, setResults] = useState<RecognizedItem[] | null>(null);
  const [sceneNote, setSceneNote] = useState('');

  const available: KitItem[] = kitItemsForContext(context);

  const openCamera = async () => {
    setCameraError('');
    if (!permission?.granted) {
      const res = await requestPermission();
      if (!res.granted) {
        setCameraError(
          res.canAskAgain
            ? 'Camera permission was declined. Select your kit items manually below.'
            : 'Camera access is blocked for this app. Enable it in Settings, or select your kit items manually below.',
        );
        return;
      }
    }
    setCameraOn(true);
  };

  const toggle = (code: string) => {
    const next = selected.includes(code)
      ? selected.filter((c) => c !== code)
      : [...selected, code];
    onChange(next, 'manual');
  };

  const captureAndRecognize = async () => {
    if (!cameraRef.current) {
      toast.error('The camera is not ready yet.');
      return;
    }
    setScanning(true);
    try {
      const photo = await cameraRef.current.takePictureAsync({ quality: 0.8 });
      if (!photo) throw new Error('No photo captured.');

      const ctx = ImageManipulator.manipulate(photo.uri);
      ctx.resize({ width: 1024 });
      const rendered = await ctx.renderAsync();
      const saved = await rendered.saveAsync({
        compress: 0.75,
        format: SaveFormat.JPEG,
        base64: true,
      });
      if (!saved.base64) throw new Error('Could not encode the photo.');

      const response = await client.apiCall.invoke<{
        items?: RecognizedItem[];
        scene_note?: string;
        degraded?: boolean;
        message?: string;
      }>({
        url: '/api/v1/resqkit/recognize_kit',
        method: 'POST',
        data: {
          image: `data:image/jpeg;base64,${saved.base64}`,
          context,
          expected_items: available.map((i) => i.code),
        },
      });

      const payload = response.data;
      setResults(payload.items ?? []);
      setSceneNote(payload.scene_note ?? '');

      const confident = (payload.items ?? []).filter((i) => i.confidence >= 0.5).map((i) => i.code);
      if (confident.length > 0) {
        const merged = Array.from(new Set([...selected, ...confident]));
        onChange(merged, 'camera');
        toast.success(`${confident.length} item(s) added from the photo.`);
      } else {
        toast.info(payload.message || 'Nothing recognised. Select items manually.');
      }
    } catch (e: unknown) {
      const err = e as { data?: { detail?: string }; message?: string };
      toast.error(err?.data?.detail || err?.message || 'Recognition failed. Select items manually.');
    } finally {
      setScanning(false);
    }
  };

  return (
    <View className="gap-4">
      <Card>
        <CardContent className="gap-3">
          <View className="flex-row items-start justify-between gap-3">
            <View className="flex-1">
              <Text className="text-base font-semibold text-foreground">
                Point your camera at the open kit
              </Text>
              <Text className="mt-1 text-sm text-muted-foreground">
                One photo, analysed for objects only. The image is never saved or uploaded.
              </Text>
              <View className="mt-1.5 flex-row items-center gap-1.5">
                <Badge variant="secondary">Open-source AI</Badge>
                <Text className="flex-1 text-xs text-muted-foreground">
                  Recognition runs on a model self-hosted on the server.
                </Text>
              </View>
            </View>
            {cameraOn ? (
              <Button size="sm" variant="secondary" onPress={() => setCameraOn(false)}>
                <CameraOff size={16} color={colors.secondaryForeground} />
                <Text className="text-xs font-medium text-secondary-foreground">Stop</Text>
              </Button>
            ) : (
              <Button size="sm" onPress={openCamera}>
                <Camera size={16} color={colors.primaryForeground} />
                <Text className="text-xs font-medium text-primary-foreground">Open camera</Text>
              </Button>
            )}
          </View>

          {cameraOn && (
            <View className="gap-3">
              <View className="overflow-hidden rounded-md border border-border bg-muted">
                <CameraView ref={cameraRef} style={{ height: 240 }} facing="back" />
              </View>
              <Button onPress={captureAndRecognize} disabled={scanning}>
                {scanning ? (
                  <>
                    <ActivityIndicator size="small" color={colors.primaryForeground} />
                    <Text className="text-sm font-medium text-primary-foreground">
                      Identifying items…
                    </Text>
                  </>
                ) : (
                  <>
                    <ScanLine size={16} color={colors.primaryForeground} />
                    <Text className="text-sm font-medium text-primary-foreground">
                      Identify kit contents
                    </Text>
                  </>
                )}
              </Button>
              {scanning && (
                <Text className="text-center text-xs text-muted-foreground">
                  Recognition can take a while on a slow connection. You can stop and pick items
                  manually at any time.
                </Text>
              )}
            </View>
          )}

          {cameraError !== '' && (
            <View className="gap-2 rounded-md bg-muted p-3">
              <Text className="text-sm text-muted-foreground">{cameraError}</Text>
              {permission && !permission.canAskAgain && (
                <Pressable onPress={() => void Linking.openSettings()}>
                  <Text className="text-sm font-medium text-primary">Open app settings</Text>
                </Pressable>
              )}
            </View>
          )}

          {results && (
            <View className="rounded-md border border-border bg-background p-3">
              <Text className="text-sm font-semibold text-foreground">Recognition result</Text>
              {results.length === 0 ? (
                <Text className="mt-1 text-sm text-muted-foreground">
                  Nothing identified with confidence. Use the list below — it is faster than trying
                  again.
                </Text>
              ) : (
                <View className="mt-2 gap-1.5">
                  {results.map((r) => (
                    <View key={r.code} className="flex-row items-center justify-between gap-2">
                      <Text className="flex-1 text-sm text-foreground">{r.name}</Text>
                      <Badge variant={r.confidence >= 0.5 ? 'default' : 'secondary'}>
                        {`${Math.round(r.confidence * 100)}%`}
                      </Badge>
                    </View>
                  ))}
                </View>
              )}
              {sceneNote !== '' && (
                <Text className="mt-2 text-xs text-muted-foreground">Scene: {sceneNote}</Text>
              )}
              <Text className="mt-2 text-xs text-muted-foreground">
                Recognition can be wrong. Always trust what you can see with your own eyes.
              </Text>
            </View>
          )}
        </CardContent>
      </Card>

      <View>
        <View className="mb-2 flex-row items-center justify-between gap-2">
          <Text className="text-base font-semibold text-foreground">What you actually have</Text>
          <Text className="text-sm text-muted-foreground">{selected.length} selected</Text>
        </View>
        <View className="gap-2">
          {available.map((item) => {
            const active = selected.includes(item.code);
            return (
              <Pressable
                key={item.code}
                onPress={() => toggle(item.code)}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: active }}
                className={`flex-row items-start gap-2 rounded-md border p-3 ${
                  active ? 'border-primary bg-primary/10' : 'border-border bg-card'
                }`}
              >
                <View
                  className={`mt-0.5 h-5 w-5 items-center justify-center rounded-sm border ${
                    active ? 'border-primary bg-primary' : 'border-border'
                  }`}
                >
                  {active && <Check size={14} color={colors.primaryForeground} />}
                </View>
                <View className="flex-1">
                  <Text className="text-sm font-medium text-foreground">{item.name}</Text>
                  <Text className="text-xs text-muted-foreground">{item.purpose}</Text>
                </View>
              </Pressable>
            );
          })}
        </View>
      </View>

      <Button
        variant="secondary"
        onPress={() => {
          onChange([], 'none');
          toast.info('Continuing with no kit. Guidance will use improvised alternatives.');
        }}
      >
        <X size={16} color={colors.secondaryForeground} />
        <Text className="text-sm font-medium text-secondary-foreground">I have no kit at all</Text>
      </Button>
    </View>
  );
};

export default KitScanner;
