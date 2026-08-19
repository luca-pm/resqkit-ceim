/**
 * Institutional actions: NG112 connection, passive voice recognition, the
 * transcript websocket, and the NG protocol payload build.
 *
 * These map to the backend's incident_sessions / pre_call / incident_stream
 * / ng_protocol API (app/backend/routers/*.py) - anonymous, non-transmitting
 * plumbing built as a separate pass, never previously called by the app.
 *
 * Every action is gated by settings.realDataMode:
 *  - OFF (default): fully simulated. No network call is made to any of the
 *    endpoints above; a synthetic result is produced locally. This keeps the
 *    app's local-first, no-egress-until-explicit-action guarantee
 *    (lib/localStore.ts) intact by default.
 *  - ON: the real endpoint is called with the incident's actual data.
 *
 * Every call — simulated or real — appends one entry to the institutional
 * log (see lib/incidentContext.tsx) so the effect is always visible,
 * regardless of mode.
 */

import { getAPIBaseURL } from './config';
import { client } from './apiClient';
import { IncidentState, InstitutionalLogEntry } from './localStore';

type LogFn = (entry: Omit<InstitutionalLogEntry, 'id' | 'at'>) => void;

const fakeId = (prefix: string) => `${prefix}-${Math.random().toString(36).slice(2, 10)}`;

const wsBaseURL = () => getAPIBaseURL().replace(/^http/, 'ws');

async function safely<T>(action: InstitutionalLogEntry['action'], mode: 'simulated' | 'real', log: LogFn, fn: () => Promise<{ detail: string; result: T }>): Promise<T | null> {
  try {
    const { detail, result } = await fn();
    log({ action, mode, detail, ok: true });
    return result;
  } catch (e: unknown) {
    const err = e as { data?: { detail?: string }; message?: string };
    log({ action, mode, detail: err?.data?.detail || err?.message || 'Failed', ok: false });
    return null;
  }
}

/** Ensures a backend session exists (real mode) or a fake local id (simulated mode). Idempotent per incident. */
export async function ensureSession(
  incident: IncidentState,
  realDataMode: boolean,
  log: LogFn,
  onSessionId: (id: string) => void,
): Promise<string | null> {
  const cached = incident.backendSessionId;
  // A cached id from a prior simulated run (sim-...) is not a real backend
  // session — if real mode is now on, it must not be reused against real
  // endpoints, so fall through and create an actual one.
  if (cached && !(realDataMode && cached.startsWith('sim-'))) return cached;

  if (!realDataMode) {
    const id = fakeId('sim-session');
    log({ action: 'session.create', mode: 'simulated', detail: `Simulated session ${id} (no data sent)`, ok: true });
    onSessionId(id);
    return id;
  }

  const id = await safely('session.create', 'real', log, async () => {
    const res = await client.apiCall.invoke<{ id: string }>({
      url: '/api/v1/incident_sessions',
      method: 'POST',
      data: { context_type: incident.context ?? undefined },
    });
    return { detail: `Created backend session ${res.data.id}`, result: res.data.id };
  });
  if (id) onSessionId(id);
  return id;
}

export async function connectNg112(
  incident: IncidentState,
  realDataMode: boolean,
  status: 'called' | 'already_called',
  log: LogFn,
  onSessionId: (id: string) => void,
): Promise<void> {
  const sessionId = await ensureSession(incident, realDataMode, log, onSessionId);
  if (!sessionId) return;

  if (!realDataMode) {
    log({
      action: 'ng112.connect',
      mode: 'simulated',
      detail: `Simulated NG112 connection (${status}) — no real emergency channel contacted`,
      ok: true,
    });
    return;
  }

  await safely('ng112.connect', 'real', log, async () => {
    await client.apiCall.invoke({
      url: `/api/v1/incident_sessions/${sessionId}`,
      method: 'PATCH',
      data: { called_112: status },
    });
    return { detail: `Backend session ${sessionId} marked called_112=${status}`, result: true };
  });
}

/** Records a triage answer as a plain log entry (not the timed pre-call question flow, which this UI doesn't drive). */
export async function logTriageAnswer(
  incident: IncidentState,
  realDataMode: boolean,
  field: string,
  value: string,
  log: LogFn,
  onSessionId: (id: string) => void,
): Promise<void> {
  const sessionId = await ensureSession(incident, realDataMode, log, onSessionId);
  if (!sessionId) return;

  if (!realDataMode) {
    log({ action: 'triage.answer', mode: 'simulated', detail: `Simulated log of ${field}=${value}`, ok: true });
    return;
  }

  await safely('triage.answer', 'real', log, async () => {
    await client.apiCall.invoke({
      url: `/api/v1/incident_sessions/${sessionId}/events`,
      method: 'POST',
      data: { event_type: 'triage_answer', payload: { field, value } },
    });
    return { detail: `Logged ${field}=${value} to backend session ${sessionId}`, result: true };
  });
}

/** PVR request + a short websocket connect/ping/close cycle, to demonstrate the streaming pipeline. */
export async function testInstitutionalVoiceChannel(
  incident: IncidentState,
  realDataMode: boolean,
  log: LogFn,
  onSessionId: (id: string) => void,
): Promise<void> {
  const sessionId = await ensureSession(incident, realDataMode, log, onSessionId);
  if (!sessionId) return;

  if (!realDataMode) {
    log({ action: 'pvr.request', mode: 'simulated', detail: 'Simulated PVR request — no audio captured', ok: true });
    log({ action: 'stream.connect', mode: 'simulated', detail: 'Simulated websocket connect (no socket opened)', ok: true });
    await new Promise((r) => setTimeout(r, 250));
    log({ action: 'stream.terminate', mode: 'simulated', detail: 'Simulated websocket terminated (reason: client_close)', ok: true });
    return;
  }

  await safely('pvr.request', 'real', log, async () => {
    await client.apiCall.invoke({ url: `/api/v1/incident_sessions/${sessionId}/pvr/request`, method: 'POST' });
    return { detail: `Requested PVR on backend session ${sessionId}`, result: true };
  });

  await new Promise<void>((resolve) => {
    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      resolve();
    };
    try {
      const ws = new WebSocket(`${wsBaseURL()}/api/v1/incident_sessions/${sessionId}/stream`);
      const timeout = setTimeout(() => {
        log({ action: 'stream.terminate', mode: 'real', detail: 'Websocket test timed out', ok: false });
        ws.close();
        finish();
      }, 5000);
      ws.onopen = () => {
        log({ action: 'stream.connect', mode: 'real', detail: `Websocket connected to session ${sessionId}`, ok: true });
        ws.send(JSON.stringify({ type: 'ping' }));
      };
      ws.onmessage = (evt) => {
        const msg = JSON.parse(evt.data as string) as { type: string };
        if (msg.type === 'pong') ws.send(JSON.stringify({ type: 'close' }));
      };
      ws.onclose = () => {
        clearTimeout(timeout);
        log({ action: 'stream.terminate', mode: 'real', detail: `Websocket closed for session ${sessionId}`, ok: true });
        finish();
      };
      ws.onerror = () => {
        clearTimeout(timeout);
        log({ action: 'stream.terminate', mode: 'real', detail: 'Websocket error', ok: false });
        finish();
      };
    } catch {
      log({ action: 'stream.terminate', mode: 'real', detail: 'Could not open websocket', ok: false });
      finish();
    }
  });
}

export async function buildNgProtocolPayload(
  incident: IncidentState,
  realDataMode: boolean,
  log: LogFn,
  onSessionId: (id: string) => void,
): Promise<void> {
  const sessionId = await ensureSession(incident, realDataMode, log, onSessionId);
  if (!sessionId) return;

  if (!realDataMode) {
    log({
      action: 'ng_protocol.build',
      mode: 'simulated',
      detail: 'Simulated PIDF-LO / RFC 7852 payload build — nothing built or transmitted',
      ok: true,
    });
    return;
  }

  await safely('ng_protocol.build', 'real', log, async () => {
    const res = await client.apiCall.invoke<{ transmitted: boolean }>({
      url: `/api/v1/incident_sessions/${sessionId}/ng_protocol/build`,
      method: 'POST',
      data: {
        latitude: incident.latitude ?? undefined,
        longitude: incident.longitude ?? undefined,
        accuracy_m: incident.accuracy ?? undefined,
      },
    });
    return {
      detail: `Built NG payload for session ${sessionId} (transmitted: ${res.data.transmitted})`,
      result: true,
    };
  });
}

export async function terminateInstitutionalSession(
  incident: IncidentState,
  realDataMode: boolean,
  log: LogFn,
): Promise<void> {
  const sessionId = incident.backendSessionId;
  if (!sessionId) return;

  if (!realDataMode || sessionId.startsWith('sim-')) {
    log({ action: 'session.terminate', mode: 'simulated', detail: `Simulated termination of ${sessionId}`, ok: true });
    return;
  }

  await safely('session.terminate', 'real', log, async () => {
    await client.apiCall.invoke({ url: `/api/v1/incident_sessions/${sessionId}/terminate`, method: 'POST' });
    return { detail: `Terminated backend session ${sessionId}`, result: true };
  });
}
