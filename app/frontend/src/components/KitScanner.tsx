/**
 * S6 — Kit recognition.
 *
 * Camera frames are captured to an in-memory canvas, sent once for
 * recognition, and discarded. No frame is stored locally or uploaded to object
 * storage. Recognition is always optional: manual selection and "no kit at all"
 * are first-class paths, because a failed camera must never block first aid.
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Camera, CameraOff, Check, Loader2, ScanLine, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { client } from '@/lib/api';
import { ContextId, KitItem, kitItemsForContext } from '@/lib/knowledge';

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
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [cameraOn, setCameraOn] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [cameraError, setCameraError] = useState('');
  const [results, setResults] = useState<RecognizedItem[] | null>(null);
  const [sceneNote, setSceneNote] = useState('');

  const available: KitItem[] = kitItemsForContext(context);

  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    setCameraOn(false);
  }, []);

  useEffect(() => stopCamera, [stopCamera]);

  const startCamera = async () => {
    setCameraError('');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' },
        audio: false,
      });
      streamRef.current = stream;
      setCameraOn(true);
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play().catch(() => undefined);
      }
    } catch {
      setCameraError(
        'Camera unavailable or permission denied. Select your kit items manually below.',
      );
      setCameraOn(false);
    }
  };

  const toggle = (code: string) => {
    const next = selected.includes(code)
      ? selected.filter((c) => c !== code)
      : [...selected, code];
    onChange(next, 'manual');
  };

  const captureAndRecognize = async () => {
    const video = videoRef.current;
    if (!video || !video.videoWidth) {
      toast.error('The camera is not ready yet.');
      return;
    }
    setScanning(true);
    try {
      const maxWidth = 1024;
      const scale = Math.min(1, maxWidth / video.videoWidth);
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(video.videoWidth * scale);
      canvas.height = Math.round(video.videoHeight * scale);
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Canvas unavailable');
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const dataUri = canvas.toDataURL('image/jpeg', 0.75);

      const response = await client.apiCall.invoke({
        url: '/api/v1/resqkit/recognize_kit',
        method: 'POST',
        data: {
          image: dataUri,
          context,
          expected_items: available.map((i) => i.code),
        },
      });

      const payload = response.data as {
        items: RecognizedItem[];
        scene_note?: string;
        degraded?: boolean;
        message?: string;
      };

      setResults(payload.items || []);
      setSceneNote(payload.scene_note || '');

      const confident = (payload.items || [])
        .filter((i) => i.confidence >= 0.5)
        .map((i) => i.code);
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
    <div className="space-y-4">
      <Card>
        <CardContent className="space-y-3 p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h3 className="text-base font-semibold">Point your camera at the open kit</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                One photo, analysed for objects only. The image is never saved or uploaded.
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                <Badge variant="secondary" className="mr-1.5 align-middle">
                  Open-source AI
                </Badge>
                Recognition runs on a model self-hosted on this server. The photo never leaves
                this machine.
              </p>
            </div>
            {cameraOn ? (
              <Button variant="secondary" size="sm" onClick={stopCamera}>
                <CameraOff className="mr-1.5 h-4 w-4" aria-hidden="true" />
                Stop
              </Button>
            ) : (
              <Button size="sm" onClick={startCamera}>
                <Camera className="mr-1.5 h-4 w-4" aria-hidden="true" />
                Open camera
              </Button>
            )}
          </div>

          {cameraOn && (
            <div className="space-y-3">
              <div className="relative overflow-hidden rounded-md border border-border bg-muted">
                <video
                  ref={videoRef}
                  playsInline
                  muted
                  className="aspect-video w-full object-cover"
                />
                <div className="pointer-events-none absolute inset-6 rounded-md border-2 border-dashed border-primary/70" />
              </div>
              <Button className="w-full" onClick={captureAndRecognize} disabled={scanning}>
                {scanning ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
                    Identifying items…
                  </>
                ) : (
                  <>
                    <ScanLine className="mr-2 h-4 w-4" aria-hidden="true" />
                    Identify kit contents
                  </>
                )}
              </Button>
            </div>
          )}

          {cameraError && (
            <p className="rounded-md bg-muted p-3 text-sm text-muted-foreground">{cameraError}</p>
          )}

          {results && (
            <div className="rounded-md border border-border bg-background p-3">
              <p className="text-sm font-semibold">Recognition result</p>
              {results.length === 0 ? (
                <p className="mt-1 text-sm text-muted-foreground">
                  Nothing identified with confidence. Use the list below — it is faster than trying
                  again.
                </p>
              ) : (
                <ul className="mt-2 space-y-1.5">
                  {results.map((r) => (
                    <li key={r.code} className="flex items-center justify-between gap-2 text-sm">
                      <span>{r.name}</span>
                      <Badge variant={r.confidence >= 0.5 ? 'default' : 'secondary'}>
                        {Math.round(r.confidence * 100)}%
                      </Badge>
                    </li>
                  ))}
                </ul>
              )}
              {sceneNote && (
                <p className="mt-2 text-xs text-muted-foreground">Scene: {sceneNote}</p>
              )}
              <p className="mt-2 text-xs text-muted-foreground">
                Recognition can be wrong. Always trust what you can see with your own eyes.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      <div>
        <div className="mb-2 flex items-center justify-between gap-2">
          <h3 className="text-base font-semibold">What you actually have</h3>
          <span className="text-sm text-muted-foreground">{selected.length} selected</span>
        </div>
        <div className="grid gap-2 sm:grid-cols-2">
          {available.map((item) => {
            const active = selected.includes(item.code);
            return (
              <button
                key={item.code}
                type="button"
                onClick={() => toggle(item.code)}
                aria-pressed={active}
                className={`flex items-start gap-2 rounded-md border p-3 text-left transition-colors ${
                  active
                    ? 'border-primary bg-primary/10'
                    : 'border-border bg-card hover:bg-accent'
                }`}
              >
                <span
                  className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-sm border ${
                    active ? 'border-primary bg-primary text-primary-foreground' : 'border-border'
                  }`}
                >
                  {active && <Check className="h-3.5 w-3.5" aria-hidden="true" />}
                </span>
                <span>
                  <span className="block text-sm font-medium">{item.name}</span>
                  <span className="block text-xs text-muted-foreground">{item.purpose}</span>
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <Button
        variant="secondary"
        className="w-full"
        onClick={() => {
          onChange([], 'none');
          toast.info('Continuing with no kit. Guidance will use improvised alternatives.');
        }}
      >
        <X className="mr-2 h-4 w-4" aria-hidden="true" />
        I have no kit at all
      </Button>
    </div>
  );
};

export default KitScanner;