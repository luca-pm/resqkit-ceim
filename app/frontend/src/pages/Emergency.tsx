/**
 * S3–S8 — the emergency wizard.
 *
 * Stage order is deliberate and matches the MVP flow: context, then the 112
 * gate (which can never be silently skipped), then triage, hazards, kit, and
 * only then guided first aid. Location is captured from the device but is used
 * solely to help the user tell the dispatcher where they are — it is never
 * transmitted anywhere by the app.
 */

import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Anchor,
  Building2,
  Car,
  Check,
  ChevronRight,
  Copy,
  Crosshair,
  HelpCircle,
  Loader2,
  Mountain,
  Phone,
  Radio,
  ShieldAlert,
  Users,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import KitScanner from '@/components/KitScanner';
import ProcedureRunner from '@/components/ProcedureRunner';
import { useIncident } from '@/lib/incidentContext';
import { buildDispatcherScript, formatCoords } from '@/lib/brief';
import {
  connectNg112,
  ensureSession,
  logHazards,
  logKitSelection,
  logProcedureStep,
  logTriageAnswer,
  testInstitutionalVoiceChannel,
} from '@/lib/institutionalActions';
import {
  CONTEXTS,
  ContextId,
  INJURY_OPTIONS,
  hazardsForContext,
  procedureById,
  routeProcedure,
} from '@/lib/knowledge';
import { CompletedStep } from '@/lib/localStore';

type Stage = 'context' | 'call' | 'triage' | 'hazards' | 'kit' | 'guide';

const CONTEXT_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  car: Car,
  building: Building2,
  anchor: Anchor,
  mountain: Mountain,
  help: HelpCircle,
};

const Emergency: React.FC = () => {
  const navigate = useNavigate();
  const {
    ready,
    consent,
    incident,
    startIncident,
    updateIncident,
    settings,
    updateSettings,
    logInstitutional,
  } = useIncident();
  const [stage, setStage] = useState<Stage>('context');
  const [locating, setLocating] = useState(false);
  const [testingVoiceChannel, setTestingVoiceChannel] = useState(false);

  const onSession = (id: string, code: string | null) =>
    updateIncident({ backendSessionId: id, sessionCode: code });

  useEffect(() => {
    if (!ready) return;
    if (!consent.disclaimerAcknowledged) {
      navigate('/consent?next=/emergency', { replace: true });
      return;
    }
    if (!incident) startIncident();
  }, [ready, consent.disclaimerAcknowledged, incident, startIncident, navigate]);

  useEffect(() => {
    if (incident?.context && stage === 'context') setStage('call');
  }, [incident?.context, stage]);

  const captureLocation = () => {
    if (!('geolocation' in navigator)) {
      toast.error('This device does not expose location. Describe your position instead.');
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        updateIncident({
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
          locationFixAt: new Date().toISOString(),
        });
        setLocating(false);
        toast.success('Position captured for you to read out. Not sent anywhere.');
      },
      () => {
        setLocating(false);
        toast.error('Could not get a fix. Describe a landmark instead.');
      },
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 30000 },
    );
  };

  const procedure = useMemo(() => {
    if (!incident) return undefined;
    const id = incident.procedureId ?? routeProcedure(incident);
    return procedureById(id);
  }, [incident]);

  if (!ready || !incident) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-6 w-6 animate-spin text-primary" aria-hidden="true" />
      </div>
    );
  }

  /* ------------------------- Stage: context ------------------------- */
  if (stage === 'context') {
    return (
      <div className="space-y-5">
        <div>
          <h1>Where are you?</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            This decides which kit contents and which hazards ResQKit shows you. Pick the closest
            match — you can be approximate.
          </p>
        </div>
        <div className="grid gap-3">
          {CONTEXTS.map((ctx) => {
            const Icon = CONTEXT_ICONS[ctx.icon] ?? HelpCircle;
            return (
              <button
                key={ctx.id}
                type="button"
                onClick={() => {
                  updateIncident({ context: ctx.id });
                  updateSettings({ lastContext: ctx.id });
                  // updateIncident is async (React state), so read incident.context
                  // from this closure would still see the pre-update value — pass
                  // the new context explicitly instead of relying on stale state.
                  void ensureSession({ ...incident, context: ctx.id }, settings.realDataMode, logInstitutional, onSession);
                  setStage('call');
                }}
                className="flex items-center gap-3 rounded-md border border-border bg-card p-4 text-left transition-colors hover:bg-accent"
              >
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md bg-primary text-primary-foreground">
                  <Icon className="h-5 w-5" />
                </span>
                <span className="flex-1">
                  <span className="block font-semibold">{ctx.label}</span>
                  <span className="block text-sm text-muted-foreground">{ctx.blurb}</span>
                </span>
                <ChevronRight className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
              </button>
            );
          })}
        </div>
        {settings.lastContext && (
          <p className="text-xs text-muted-foreground">
            Last time you used{' '}
            {CONTEXTS.find((c) => c.id === settings.lastContext)?.label ?? settings.lastContext}.
          </p>
        )}
      </div>
    );
  }

  /* --------------------------- Stage: 112 --------------------------- */
  if (stage === 'call') {
    const script = buildDispatcherScript(incident);
    return (
      <div className="space-y-5">
        <div>
          <h1>Has 112 been called?</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Nothing else in this app matters more than this answer. ResQKit cannot make the call for
            you.
          </p>
        </div>

        <Card>
          <CardContent className="space-y-3 p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-semibold">Your position</p>
                <p className="text-sm text-muted-foreground tabular">{formatCoords(incident)}</p>
              </div>
              <Button size="sm" variant="secondary" onClick={captureLocation} disabled={locating}>
                {locating ? (
                  <Loader2 className="mr-1.5 h-4 w-4 animate-spin" aria-hidden="true" />
                ) : (
                  <Crosshair className="mr-1.5 h-4 w-4" aria-hidden="true" />
                )}
                Get fix
              </Button>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="locationNote">Landmark or address (say this out loud)</Label>
              <Textarea
                id="locationNote"
                rows={2}
                value={incident.locationNote}
                onChange={(e) => updateIncident({ locationNote: e.target.value })}
                placeholder="E1 northbound, 3 km after the Sibiu exit, red van in the ditch"
              />
            </div>
          </CardContent>
        </Card>

        <Card className="border-primary/40">
          <CardContent className="space-y-3 p-4">
            <p className="font-semibold">What to say</p>
            <pre className="whitespace-pre-wrap rounded-md bg-muted p-3 font-mono text-xs leading-relaxed text-foreground">
              {script}
            </pre>
            <Button
              size="sm"
              variant="secondary"
              onClick={() => {
                void navigator.clipboard
                  ?.writeText(script)
                  .then(() => toast.success('Script copied.'))
                  .catch(() => toast.error('Could not copy. Read it from the screen.'));
              }}
            >
              <Copy className="mr-1.5 h-4 w-4" aria-hidden="true" />
              Copy script
            </Button>
          </CardContent>
        </Card>

        <div className="space-y-2">
          <Button asChild size="lg" variant="emergency" className="w-full">
            <a
              href="tel:112"
              onClick={() => {
                updateIncident({ called112: 'called' });
                toast.success('Marked as called. Stay on the line with the operator.');
                void connectNg112(incident, settings.realDataMode, 'called', logInstitutional, onSession);
              }}
            >
              <Phone className="mr-2 h-5 w-5" aria-hidden="true" />
              Call 112 now
            </a>
          </Button>
          <Button
            size="lg"
            variant="secondary"
            className="w-full"
            onClick={() => {
              updateIncident({ called112: 'already_called' });
              void connectNg112(
                incident,
                settings.realDataMode,
                'already_called',
                logInstitutional,
                onSession,
              );
              setStage('triage');
            }}
          >
            <Check className="mr-2 h-5 w-5" aria-hidden="true" />
            Someone already called 112
          </Button>
          <Button size="lg" className="w-full" onClick={() => setStage('triage')}>
            Continue to first aid
            <ChevronRight className="ml-2 h-5 w-5" aria-hidden="true" />
          </Button>
          <p className="text-xs text-muted-foreground">
            If nobody has called, the red banner stays on screen for the whole session until you do.
          </p>
        </div>

        {incident.backendSessionId && (
          <Card className="border-dashed">
            <CardContent className="space-y-1.5 p-4">
              <p className="flex items-center gap-1.5 text-sm font-semibold">
                <Radio className="h-4 w-4 text-primary" aria-hidden="true" />
                ISU dashboard pairing code
              </p>
              {incident.sessionCode ? (
                <>
                  <p className="font-mono text-2xl tracking-widest">{incident.sessionCode}</p>
                  <p className="text-xs text-muted-foreground">
                    Enter this code on the ISU dashboard to watch this incident live.
                  </p>
                </>
              ) : (
                <p className="text-xs text-muted-foreground">
                  Simulated in browser — no dashboard can connect. Turn on Local backend mode in
                  Settings to get a real pairing code (still never sent beyond this machine).
                </p>
              )}
            </CardContent>
          </Card>
        )}

        <Card className="border-dashed">
          <CardContent className="space-y-2 p-4">
            <p className="flex items-center gap-1.5 text-sm font-semibold">
              <Radio className="h-4 w-4 text-primary" aria-hidden="true" />
              Institutional voice channel (prototype)
            </p>
            <p className="text-xs text-muted-foreground">
              Fires a passive-voice-recognition request and a transcript websocket test, logged to
              Settings → Institutional actions trace.{' '}
              {settings.realDataMode
                ? 'Local backend mode is on (this machine only).'
                : 'Currently simulated in browser — nothing is sent, not even locally.'}
            </p>
            <Button
              size="sm"
              variant="secondary"
              disabled={testingVoiceChannel}
              onClick={async () => {
                setTestingVoiceChannel(true);
                try {
                  await testInstitutionalVoiceChannel(
                    incident,
                    settings.realDataMode,
                    logInstitutional,
                    onSession,
                  );
                } finally {
                  setTestingVoiceChannel(false);
                }
              }}
            >
              {testingVoiceChannel ? (
                <Loader2 className="mr-1.5 h-4 w-4 animate-spin" aria-hidden="true" />
              ) : (
                <Radio className="mr-1.5 h-4 w-4" aria-hidden="true" />
              )}
              Test voice channel
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  /* -------------------------- Stage: triage ------------------------- */
  if (stage === 'triage') {
    const canContinue = incident.responsive !== '' && incident.breathing !== '';
    const choice = (
      field: 'responsive' | 'breathing',
      value: string,
      label: string,
      danger?: boolean,
    ) => (
      <button
        key={value}
        type="button"
        onClick={() => {
          updateIncident({ [field]: value });
          void logTriageAnswer(incident, settings.realDataMode, field, value, logInstitutional, onSession);
        }}
        aria-pressed={incident[field] === value}
        className={`flex-1 rounded-md border p-3 text-sm font-medium transition-colors ${
          incident[field] === value
            ? danger
              ? 'border-emergency bg-emergency text-emergency-foreground'
              : 'border-primary bg-primary text-primary-foreground'
            : 'border-border bg-card hover:bg-accent'
        }`}
      >
        {label}
      </button>
    );

    return (
      <div className="space-y-5">
        <div>
          <h1>The injured person</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Two questions decide everything. Answer for the most seriously injured person first.
          </p>
        </div>

        <Card>
          <CardContent className="space-y-4 p-4">
            <div>
              <p className="mb-2 font-semibold">Do they respond when you shout and tap them?</p>
              <div className="flex gap-2">
                {choice('responsive', 'yes', 'Yes')}
                {choice('responsive', 'no', 'No', true)}
                {choice('responsive', 'unsure', 'Unsure')}
              </div>
            </div>
            <div>
              <p className="mb-2 font-semibold">Are they breathing normally?</p>
              <p className="mb-2 text-xs text-muted-foreground">
                Occasional gasping is NOT normal breathing.
              </p>
              <div className="flex gap-2">
                {choice('breathing', 'yes', 'Yes')}
                {choice('breathing', 'no', 'No', true)}
                {choice('breathing', 'unsure', 'Unsure')}
              </div>
            </div>
          </CardContent>
        </Card>

        {incident.breathing === 'no' && (
          <Card className="border-emergency">
            <CardContent className="p-4">
              <p className="flex items-start gap-2 text-sm font-semibold text-emergency">
                <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                Not breathing means CPR now. Skip the rest of the questions.
              </p>
              <Button
                className="mt-3 w-full"
                size="lg"
                onClick={() => {
                  updateIncident({ procedureId: 'cpr_aed' });
                  setStage('kit');
                }}
              >
                Start CPR guidance
              </Button>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardContent className="space-y-4 p-4">
            <div className="space-y-1.5">
              <Label>Main visible problem</Label>
              <div className="grid gap-2 sm:grid-cols-2">
                {INJURY_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => updateIncident({ injury: opt.value })}
                    aria-pressed={incident.injury === opt.value}
                    className={`rounded-md border p-2.5 text-left text-sm transition-colors ${
                      incident.injury === opt.value
                        ? 'border-primary bg-primary/10 font-medium'
                        : 'border-border bg-card hover:bg-accent'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="victimCount" className="flex items-center gap-1.5">
                  <Users className="h-4 w-4" aria-hidden="true" />
                  How many injured people
                </Label>
                <Input
                  id="victimCount"
                  type="number"
                  min={1}
                  max={99}
                  value={incident.victimCount}
                  onChange={(e) =>
                    updateIncident({ victimCount: Math.max(1, Number(e.target.value) || 1) })
                  }
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="ageBand">Approximate age</Label>
                <select
                  id="ageBand"
                  value={incident.ageBand}
                  onChange={(e) => updateIncident({ ageBand: e.target.value })}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                >
                  <option value="">Not sure</option>
                  <option value="Infant (under 1)">Infant (under 1)</option>
                  <option value="Child">Child</option>
                  <option value="Adult">Adult</option>
                  <option value="Elderly">Elderly</option>
                </select>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="trapped">Can you reach them?</Label>
              <select
                id="trapped"
                value={incident.trapped}
                onChange={(e) => updateIncident({ trapped: e.target.value })}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              >
                <option value="">Not recorded</option>
                <option value="Accessible">Yes, I can reach them</option>
                <option value="Trapped in vehicle">Trapped in a vehicle</option>
                <option value="Trapped under load or debris">Trapped under load or debris</option>
                <option value="In water">In the water</option>
                <option value="Unreachable — hazard in the way">Unreachable, hazard in the way</option>
              </select>
            </div>
          </CardContent>
        </Card>

        <Button size="lg" className="w-full" disabled={!canContinue} onClick={() => setStage('hazards')}>
          Continue to hazards
          <ChevronRight className="ml-2 h-5 w-5" aria-hidden="true" />
        </Button>
      </div>
    );
  }

  /* ------------------------- Stage: hazards ------------------------- */
  if (stage === 'hazards') {
    const options = hazardsForContext(incident.context ?? 'other');
    const toggle = (code: string) => {
      const next = incident.hazards.includes(code)
        ? incident.hazards.filter((c) => c !== code)
        : [...incident.hazards, code];
      updateIncident({ hazards: next });
    };
    const blocking = options.filter((h) => incident.hazards.includes(h.code) && h.blocking);

    return (
      <div className="space-y-5">
        <div>
          <h1>What can hurt you?</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            A dead rescuer helps nobody. Tick everything you can see — rescuers need this on arrival.
          </p>
        </div>

        <div className="grid gap-2">
          {options.map((h) => {
            const active = incident.hazards.includes(h.code);
            return (
              <button
                key={h.code}
                type="button"
                onClick={() => toggle(h.code)}
                aria-pressed={active}
                className={`rounded-md border p-3 text-left transition-colors ${
                  active ? 'border-emergency bg-emergency/10' : 'border-border bg-card hover:bg-accent'
                }`}
              >
                <span className="flex items-center justify-between gap-2">
                  <span className="font-medium">{h.label}</span>
                  <Badge variant={active ? 'emergency' : 'secondary'}>{h.family}</Badge>
                </span>
                {active && <span className="mt-1 block text-sm">{h.warning}</span>}
              </button>
            );
          })}
        </div>

        {incident.context === 'road' && (
          <Card>
            <CardContent className="space-y-1.5 p-4">
              <Label htmlFor="powertrain">Vehicle type (changes how rescuers cut it open)</Label>
              <select
                id="powertrain"
                value={incident.powertrain}
                onChange={(e) => updateIncident({ powertrain: e.target.value })}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              >
                <option value="">Not sure</option>
                <option value="Petrol or diesel">Petrol or diesel</option>
                <option value="Electric (high-voltage battery)">Electric (high-voltage battery)</option>
                <option value="Hybrid">Hybrid</option>
                <option value="LPG or CNG">LPG or CNG</option>
                <option value="Heavy goods vehicle">Heavy goods vehicle</option>
              </select>
            </CardContent>
          </Card>
        )}

        {blocking.length > 0 && (
          <Card className="border-emergency">
            <CardContent className="p-4">
              <p className="flex items-start gap-2 text-sm font-semibold text-emergency">
                <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                Do not approach. Stay back, keep others back, and report this to 112.
              </p>
              <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-muted-foreground">
                {blocking.map((h) => (
                  <li key={h.code}>{h.warning}</li>
                ))}
              </ul>
            </CardContent>
          </Card>
        )}

        <Button
          size="lg"
          className="w-full"
          onClick={() => {
            void logHazards(incident, settings.realDataMode, incident.hazards, logInstitutional, onSession);
            setStage('kit');
          }}
        >
          Continue to your kit
          <ChevronRight className="ml-2 h-5 w-5" aria-hidden="true" />
        </Button>
      </div>
    );
  }

  /* --------------------------- Stage: kit --------------------------- */
  if (stage === 'kit') {
    return (
      <div className="space-y-5">
        <div>
          <h1>What do you have to work with?</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Guidance is filtered to your actual equipment, so you are never told to use something you
            do not have.
          </p>
        </div>

        <KitScanner
          context={incident.context ?? 'other'}
          selected={incident.kitItems}
          onChange={(codes, source) => updateIncident({ kitItems: codes, kitSource: source })}
        />

        <Button
          size="lg"
          className="w-full"
          onClick={() => {
            const id = incident.procedureId ?? routeProcedure(incident);
            updateIncident({ procedureId: id });
            void logKitSelection(
              incident,
              settings.realDataMode,
              incident.kitItems,
              incident.kitSource,
              logInstitutional,
              onSession,
            );
            setStage('guide');
          }}
        >
          Start step-by-step guidance
          <ChevronRight className="ml-2 h-5 w-5" aria-hidden="true" />
        </Button>
      </div>
    );
  }

  /* -------------------------- Stage: guide -------------------------- */
  if (!procedure) {
    return (
      <Card>
        <CardContent className="p-5">
          <p className="text-sm text-muted-foreground">
            No guidance matches those answers. Go back and review the triage questions.
          </p>
          <Button className="mt-3" variant="secondary" onClick={() => setStage('triage')}>
            Back to triage
          </Button>
        </CardContent>
      </Card>
    );
  }

  const addStep = (step: CompletedStep) => {
    const existing = incident.completedSteps.filter((s) => s.index !== step.index);
    updateIncident({ completedSteps: [...existing, step].sort((a, b) => a.index - b.index) });
    void logProcedureStep(incident, settings.realDataMode, step.index, step.title, logInstitutional, onSession);
  };

  return (
    <div className="space-y-5">
      <ProcedureRunner
        procedure={procedure}
        kitItems={incident.kitItems}
        completedSteps={incident.completedSteps}
        onStepDone={addStep}
        onFinish={() => navigate('/handoff')}
      />
      <div className="flex flex-col gap-2 sm:flex-row">
        <Button variant="secondary" className="flex-1" onClick={() => setStage('kit')}>
          Change my kit
        </Button>
        <Button variant="secondary" className="flex-1" onClick={() => navigate('/handoff')}>
          Rescuers are here — open handoff
        </Button>
      </div>
    </div>
  );
};

export default Emergency;