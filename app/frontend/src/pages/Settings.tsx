/**
 * Settings — Local backend mode + the institutional actions trace.
 *
 * "Institutional actions" are the app's NG112 connection, passive voice
 * recognition, transcript websocket and NG protocol payload build — the
 * pieces that stand in for talking to outside emergency infrastructure.
 * They are simulated entirely in the browser by default (no network call at
 * all); "local backend mode" only ever reaches this app's own FastAPI
 * server on this machine, never a real emergency service. See
 * lib/institutionalActions.ts.
 */

import React from 'react';
import { AlertTriangle, ListTree, RadioTower, Trash2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';
import { useIncident } from '@/lib/incidentContext';

const ACTION_LABELS: Record<string, string> = {
  'session.create': 'Session created',
  'ng112.connect': 'NG112 connection',
  'pvr.request': 'PVR requested',
  'stream.connect': 'Websocket connected',
  'stream.terminate': 'Websocket terminated',
  'triage.answer': 'Triage answer logged',
  'hazards.confirm': 'Hazards confirmed',
  'kit.confirm': 'Kit selection confirmed',
  'procedure.step': 'Procedure step completed',
  'ng_protocol.build': 'NG protocol payload built',
  'session.terminate': 'Session terminated',
};

const Settings: React.FC = () => {
  const { settings, updateSettings, institutionalLog, clearInstitutionalLog } = useIncident();

  const clearLog = () => {
    clearInstitutionalLog();
    toast.success('Institutional actions trace cleared.');
  };

  return (
    <div className="space-y-5">
      <div>
        <h1>Settings</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Controls what happens when ResQKit talks to institutional systems — NG112, passive voice
          recognition, and the NG protocol payload it would eventually hand to emergency services.
        </p>
      </div>

      <Card className={settings.realDataMode ? 'border-destructive/50' : undefined}>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg">
            <RadioTower className="h-5 w-5 text-primary" aria-hidden="true" />
            Local backend mode
          </CardTitle>
          <CardDescription>Off by default. This is the explicit opt-in, not a default.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center justify-between gap-4 rounded-md border border-border p-3">
            <div>
              <p className="text-sm font-medium">
                {settings.realDataMode ? 'Local backend mode is ON' : 'Simulated in browser (default)'}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                {settings.realDataMode
                  ? 'Institutional actions now call this app’s own local backend (this machine, 127.0.0.1) — creating a session, and sending it your context, called-112 status, triage answers, and location if captured. Nothing leaves this machine, and it never reaches any real emergency service (see NG protocol note below).'
                  : 'Institutional actions (NG112 connection, PVR, the transcript websocket, NG protocol build) are faked entirely in the browser, with no network call at all — not even to this app’s own backend.'}
              </p>
            </div>
            <Switch
              checked={settings.realDataMode}
              onCheckedChange={(checked) => {
                updateSettings({ realDataMode: checked });
                toast.success(checked ? 'Local backend mode enabled.' : 'Back to simulated-in-browser mode.');
              }}
              aria-label="Toggle local backend mode"
            />
          </div>
          <p className="flex items-start gap-2 text-xs text-muted-foreground">
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-destructive" aria-hidden="true" />
            Neither mode ever contacts a real emergency service. "Local backend received" only means
            this app's own FastAPI server, running on this machine, logged the action to its own
            local database — never 112, NG112, ISU, or any outside institution. The NG protocol
            payload builder is proof-of-concept only, always returns "transmitted: false", and is not
            an authorized channel to Romanian emergency services (STS/ANCOM). The only real 112
            channel in this app is the dialer button.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg">
            <ListTree className="h-5 w-5 text-primary" aria-hidden="true" />
            Institutional actions trace
          </CardTitle>
          <CardDescription>
            Every institutional action fired, most recent first, tagged by whether it reached this
            app's own local backend or was faked entirely in the browser.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {institutionalLog.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Nothing fired yet. Actions appear here as you go through the 112 call step, the voice
              channel test, or the NG protocol preview during handoff.
            </p>
          ) : (
            <div className="max-h-96 space-y-2 overflow-auto">
              {[...institutionalLog].reverse().map((entry) => (
                <div key={entry.id} className="rounded-md border border-border p-2.5 text-sm">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <Badge variant={entry.mode === 'real' ? 'destructive' : 'secondary'}>
                      {entry.mode === 'real' ? 'LOCAL BACKEND RECEIVED' : 'SIMULATED IN BROWSER'}
                    </Badge>
                    {!entry.ok && <Badge variant="outline">failed</Badge>}
                    <span className="font-medium">{ACTION_LABELS[entry.action] ?? entry.action}</span>
                    <span className="ml-auto text-xs text-muted-foreground">
                      {new Date(entry.at).toLocaleTimeString()}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">{entry.detail}</p>
                </div>
              ))}
            </div>
          )}
          {institutionalLog.length > 0 && (
            <Button variant="secondary" size="sm" onClick={clearLog}>
              <Trash2 className="mr-1.5 h-4 w-4" aria-hidden="true" />
              Clear trace
            </Button>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default Settings;
