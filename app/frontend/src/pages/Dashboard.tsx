/**
 * ISU Dashboard — demo spectator view.
 *
 * Enter a session's pairing code (shown on the sender's device — today the
 * web app's own call stage, later the React Native app) to watch its event
 * log live over a websocket, no polling. See app/backend/routers/
 * incident_sessions.py `/watch` and services/session_broadcast.py.
 */

import React, { useEffect, useRef, useState } from 'react';
import { LayoutDashboard, Loader2, Radio, Wifi, WifiOff } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { client } from '@/lib/api';
import { getAPIBaseURL } from '@/lib/config';

interface SessionSnapshot {
  id: string;
  join_code: string | null;
  status: string;
  context_type: string | null;
  called_112: string | null;
}

interface TraceEvent {
  id: number;
  session_id: string;
  event_type: string;
  payload: Record<string, unknown> | null;
  created_at: string | null;
}

const wsBaseURL = () => getAPIBaseURL().replace(/^http/, 'ws');

type ConnState = 'idle' | 'connecting' | 'connected' | 'closed' | 'error';

const Dashboard: React.FC = () => {
  const [code, setCode] = useState('');
  const [connState, setConnState] = useState<ConnState>('idle');
  const [error, setError] = useState<string | null>(null);
  const [session, setSession] = useState<SessionSnapshot | null>(null);
  const [events, setEvents] = useState<TraceEvent[]>([]);
  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => () => wsRef.current?.close(), []);

  const connect = async () => {
    const trimmed = code.trim().toUpperCase();
    if (!trimmed) return;

    setError(null);
    setConnState('connecting');
    setEvents([]);
    wsRef.current?.close();

    try {
      const res = await client.apiCall.invoke<{ id: string }>({
        url: `/api/v1/incident_sessions/by_code/${trimmed}`,
      });
      const sessionId = res.data.id;

      const ws = new WebSocket(`${wsBaseURL()}/api/v1/incident_sessions/${sessionId}/watch`);
      wsRef.current = ws;

      ws.onopen = () => setConnState('connected');
      ws.onmessage = (evt) => {
        const msg = JSON.parse(evt.data as string) as
          | { type: 'snapshot'; session: SessionSnapshot; events: TraceEvent[] }
          | { type: 'event'; event: TraceEvent }
          | { type: 'error'; message: string };
        if (msg.type === 'snapshot') {
          setSession(msg.session);
          setEvents(msg.events);
        } else if (msg.type === 'event') {
          setEvents((prev) => [...prev, msg.event]);
        } else if (msg.type === 'error') {
          setError(msg.message);
          setConnState('error');
        }
      };
      ws.onclose = () => setConnState((s) => (s === 'error' ? s : 'closed'));
      ws.onerror = () => setConnState('error');
    } catch (e: unknown) {
      const err = e as { data?: { detail?: string }; message?: string };
      setError(err?.data?.detail || err?.message || 'No session found for that code.');
      setConnState('error');
    }
  };

  return (
    <div className="space-y-5">
      <div>
        <h1>ISU Dashboard (demo)</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Enter the pairing code shown on the sender's device to watch that incident's log live.
          Read-only — nothing here is sent back to the sender.
        </p>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg">
            <LayoutDashboard className="h-5 w-5 text-primary" aria-hidden="true" />
            Connect to a session
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <div className="flex-1 space-y-1.5">
              <Label htmlFor="joinCode">Pairing code</Label>
              <Input
                id="joinCode"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && connect()}
                placeholder="e.g. CYRFYR"
                className="font-mono tracking-widest"
                maxLength={6}
                autoCapitalize="characters"
              />
            </div>
            <Button onClick={connect} disabled={!code.trim() || connState === 'connecting'}>
              {connState === 'connecting' ? (
                <Loader2 className="mr-1.5 h-4 w-4 animate-spin" aria-hidden="true" />
              ) : (
                <Radio className="mr-1.5 h-4 w-4" aria-hidden="true" />
              )}
              Connect
            </Button>
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
        </CardContent>
      </Card>

      {session && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center justify-between gap-2 text-lg">
              <span>Session {session.join_code}</span>
              {connState === 'connected' ? (
                <Badge className="flex items-center gap-1">
                  <Wifi className="h-3.5 w-3.5" aria-hidden="true" />
                  Live
                </Badge>
              ) : (
                <Badge variant="secondary" className="flex items-center gap-1">
                  <WifiOff className="h-3.5 w-3.5" aria-hidden="true" />
                  {connState === 'closed' ? 'Disconnected' : 'Connecting'}
                </Badge>
              )}
            </CardTitle>
            <CardDescription>
              {session.context_type ?? 'unknown context'} · status: {session.status} · 112:{' '}
              {session.called_112 ?? 'not confirmed'}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {events.length === 0 ? (
              <p className="text-sm text-muted-foreground">No events logged yet.</p>
            ) : (
              <div className="max-h-[32rem] space-y-2 overflow-auto">
                {[...events].reverse().map((e) => (
                  <div key={e.id} className="rounded-md border border-border p-2.5 text-sm">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="font-medium">{e.event_type}</span>
                      <span className="ml-auto text-xs text-muted-foreground">
                        {e.created_at ? new Date(e.created_at).toLocaleTimeString() : ''}
                      </span>
                    </div>
                    {e.payload && (
                      <pre className="mt-1 overflow-x-auto text-xs text-muted-foreground">
                        {JSON.stringify(e.payload, null, 0)}
                      </pre>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default Dashboard;
