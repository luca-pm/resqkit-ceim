/**
 * Lightweight toast (Section G2) — RN stand-in for the web app's `sonner`.
 *
 * Deliberately mirrors sonner's module-level API (`toast.success(msg)`,
 * `toast.error(msg)`, `toast.info(msg)`) so screen code ported from
 * app/frontend needs no rewiring at the call sites — there are dozens of them
 * across the emergency wizard alone.
 *
 * Not Alert.alert: that's a blocking modal requiring a dismiss tap, which is
 * the wrong interaction for transient confirmations mid-emergency ("position
 * captured", "marked as called"). These auto-dismiss and never block.
 */
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { Text, View } from 'react-native';

type ToastKind = 'success' | 'error' | 'info';

interface ToastItem {
  id: number;
  kind: ToastKind;
  message: string;
}

const DISPLAY_MS = 3200;

/**
 * Module-level dispatch so `toast.x()` works outside React (matching sonner).
 * Registered by the provider on mount; a no-op before that, which keeps a
 * stray early call from throwing rather than crashing a screen.
 */
let dispatch: ((kind: ToastKind, message: string) => void) | null = null;

export const toast = {
  success: (message: string) => dispatch?.('success', message),
  error: (message: string) => dispatch?.('error', message),
  info: (message: string) => dispatch?.('info', message),
};

const ToastContext = createContext<null>(null);

const KIND_STYLES: Record<ToastKind, string> = {
  // `error` uses the neutral destructive slate, NOT the reserved emergency
  // red — a failed clipboard copy is not a 112-level event (Section E1).
  success: 'bg-secondary',
  error: 'bg-destructive',
  info: 'bg-muted',
};

const KIND_TEXT: Record<ToastKind, string> = {
  success: 'text-secondary-foreground',
  error: 'text-destructive-foreground',
  info: 'text-foreground',
};

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [items, setItems] = useState<ToastItem[]>([]);

  const push = useCallback((kind: ToastKind, message: string) => {
    const id = Date.now() + Math.random();
    setItems((prev) => [...prev, { id, kind, message }]);
    setTimeout(() => {
      setItems((prev) => prev.filter((t) => t.id !== id));
    }, DISPLAY_MS);
  }, []);

  useEffect(() => {
    dispatch = push;
    return () => {
      dispatch = null;
    };
  }, [push]);

  const value = useMemo(() => null, []);

  return (
    <ToastContext.Provider value={value}>
      {children}
      {items.length > 0 && (
        <View
          pointerEvents="none"
          className="absolute inset-x-0 bottom-24 z-50 items-center gap-2 px-4"
        >
          {items.map((item) => (
            <View key={item.id} className={`w-full rounded-lg px-4 py-3 ${KIND_STYLES[item.kind]}`}>
              <Text className={`text-sm font-medium ${KIND_TEXT[item.kind]}`}>{item.message}</Text>
            </View>
          ))}
        </View>
      )}
    </ToastContext.Provider>
  );
};

export const useToastContext = () => useContext(ToastContext);
