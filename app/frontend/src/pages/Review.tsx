/**
 * S10 / S12 — Incident review, retention choice and data rights.
 *
 * Default is deletion. Keeping a copy is an opt-in action, and archiving to the
 * account is a second, separate opt-in that requires being signed in. This is
 * where GDPR Articles 15–18 are made operational for the user without them
 * having to contact anybody.
 */

import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Archive,
  ClipboardList,
  Download,
  Loader2,
  LogIn,
  ShieldCheck,
  Trash2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { client } from '@/lib/api';
import { useIncident } from '@/lib/incidentContext';
import { buildBrief } from '@/lib/brief';
import { terminateInstitutionalSession } from '@/lib/institutionalActions';
import { CONTEXTS, procedureById } from '@/lib/knowledge';
import { RetentionChoice } from '@/lib/localStore';

const RETENTION_LABELS: Record<RetentionChoice, string> = {
  session: 'Delete as soon as I close the incident',
  '24h': 'Keep on this device for 24 hours',
  '7d': 'Keep on this device for 7 days (default)',
  '30d': 'Keep on this device for 30 days',
};

const RETENTION_HINTS: Record<RetentionChoice, string> = {
  session: 'Nothing is kept. Export or archive it first if you might need it.',
  '24h': 'Long enough to write up what happened.',
  '7d': 'Covers most insurance and workplace reporting deadlines.',
  '30d': 'The longest available. Only choose it if you know you need it.',
};

const RETENTION_ORDER: RetentionChoice[] = ['session', '24h', '7d', '30d'];

/** Human phrasing for the confirmation copy, e.g. "kept for 7 days". */
const RETENTION_WINDOW: Record<RetentionChoice, string> = {
  session: 'no time at all',
  '24h': '24 hours',
  '7d': '7 days',
  '30d': '30 days',
};

const Review: React.FC = () => {
  const navigate = useNavigate();
  const {
    incident,
    profile,
    settings,
    updateSettings,
    closeIncident,
    wipeEverything,
    logInstitutional,
  } = useIncident();

  const [authState, setAuthState] = useState<'loading' | 'authenticated' | 'anonymous'>('loading');
  const [archiving, setArchiving] = useState(false);
  const [archivedId, setArchivedId] = useState<number | null>(null);

  useEffect(() => {
    client.auth
      .me()
      .then((res) => setAuthState(res?.data ? 'authenticated' : 'anonymous'))
      .catch(() => setAuthState('anonymous'));
  }, []);

  const brief = useMemo(
    () =>
      incident
        ? buildBrief(incident, profile, {
            includeHealth: incident.includeHealthData,
            includeReporter: true,
          })
        : '',
    [incident, profile],
  );

  const downloadBrief = () => {
    const blob = new Blob([brief], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `resqkit-incident-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')}.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    toast.success('Copy saved to your device.');
  };

  const archive = async () => {
    if (!incident) return;
    setArchiving(true);
    try {
      const response = await client.entities.incident_records.create({
        data: {
          context_type: incident.context ?? 'other',
          occurred_at: incident.startedAt,
          location_summary: incident.locationNote,
          latitude: incident.latitude,
          longitude: incident.longitude,
          location_accuracy: incident.accuracy,
          victim_count: incident.victimCount,
          triage_summary: `responsive=${incident.responsive || 'n/a'}; breathing=${
            incident.breathing || 'n/a'
          }; injury=${incident.injury || 'n/a'}; age=${incident.ageBand || 'n/a'}; access=${
            incident.trapped || 'n/a'
          }`,
          hazards: incident.hazards.join(','),
          kit_items: incident.kitItems.join(','),
          procedure_id: incident.procedureId ?? '',
          interventions: incident.completedSteps
            .map((s) => `${s.at} ${s.title}`)
            .join(' | '),
          includes_health_data: incident.includeHealthData,
          called_112: incident.called112,
          brief_text: brief,
          content_pack_version: incident.contentPackVersion,
          retention_choice: settings.retention,
        },
      });
      const created = response.data as { id?: number };
      setArchivedId(created?.id ?? null);
      toast.success('Archived to your account. You can delete it there at any time.');
    } catch (e: unknown) {
      const err = e as { data?: { detail?: string }; message?: string };
      toast.error(err?.data?.detail || err?.message || 'Could not archive this incident.');
    } finally {
      setArchiving(false);
    }
  };

  const finishIncident = () => {
    if (incident) void terminateInstitutionalSession(incident, settings.realDataMode, logInstitutional);
    closeIncident();
    toast.success(
      settings.retention === 'session'
        ? 'Incident closed and deleted from this device.'
        : `Incident closed. Kept for ${RETENTION_WINDOW[settings.retention]}, then deleted automatically.`,
    );
    navigate('/');
  };

  const procedure = incident?.procedureId ? procedureById(incident.procedureId) : undefined;
  const ctxLabel = CONTEXTS.find((c) => c.id === incident?.context)?.label;

  return (
    <div className="space-y-5">
      <div>
        <h1>Your data and your rights</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Nothing here was uploaded. You decide what happens to it next.
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          Kit recognition and the spoken brief use an open-source AI model self-hosted on this
          server — your data never reaches an outside company by default. Changing that is an
          explicit choice made by whoever runs this server, not something the app does on its
          own.
        </p>
      </div>

      {incident ? (
        <>
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-lg">
                <ClipboardList className="h-5 w-5 text-primary" aria-hidden="true" />
                What was recorded
              </CardTitle>
              <CardDescription>
                Started {new Date(incident.startedAt).toLocaleString()}
                {ctxLabel ? ` · ${ctxLabel}` : ''}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div className="flex flex-wrap gap-1.5">
                <Badge variant="secondary">{incident.victimCount} injured</Badge>
                {incident.hazards.length > 0 && (
                  <Badge variant="emergency">{incident.hazards.length} hazard(s)</Badge>
                )}
                {incident.kitItems.length > 0 && (
                  <Badge variant="secondary">{incident.kitItems.length} kit item(s)</Badge>
                )}
                {procedure && <Badge>{procedure.shortLabel}</Badge>}
                <Badge variant={incident.includeHealthData ? 'default' : 'secondary'}>
                  {incident.includeHealthData ? 'Health data shared' : 'No health data shared'}
                </Badge>
              </div>
              <p className="text-muted-foreground">
                {incident.completedSteps.length} step(s) recorded as completed. No camera image was
                kept.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg">How long to keep it on this device</CardTitle>
              <CardDescription>Storage limitation, GDPR Article 5(1)(e).</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {RETENTION_ORDER.map((key) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => updateSettings({ retention: key })}
                  aria-pressed={settings.retention === key}
                  className={`w-full rounded-md border p-3 text-left text-sm transition-colors ${
                    settings.retention === key
                      ? 'border-primary bg-primary/10 font-medium'
                      : 'border-border bg-card hover:bg-accent'
                  }`}
                >
                  {RETENTION_LABELS[key]}
                  <span className="mt-0.5 block text-xs font-normal text-muted-foreground">
                    {RETENTION_HINTS[key]}
                  </span>
                </button>
              ))}
              <p className="pt-1 text-xs text-muted-foreground">
                This governs the copy on this device only. Anything you archive to your account is
                separate and stays until you delete it there.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg">Keep a copy</CardTitle>
              <CardDescription>
                Useful for an insurance claim or a workplace incident report.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <Button variant="secondary" className="w-full" onClick={downloadBrief}>
                <Download className="mr-2 h-4 w-4" aria-hidden="true" />
                Download as a text file
              </Button>

              {authState === 'loading' && (
                <Button variant="secondary" className="w-full" disabled>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
                  Checking your account…
                </Button>
              )}
              {authState === 'anonymous' && (
                <div className="rounded-md border border-border bg-muted p-3">
                  <p className="text-sm text-muted-foreground">
                    You can also archive this incident to your account so it survives clearing this
                    browser. That requires signing in and is entirely optional.
                  </p>
                  <Button
                    size="sm"
                    variant="secondary"
                    className="mt-2"
                    onClick={() => client.auth.toLogin()}
                  >
                    <LogIn className="mr-1.5 h-4 w-4" aria-hidden="true" />
                    Sign in to archive
                  </Button>
                </div>
              )}
              {authState === 'authenticated' && (
                <Button
                  variant="secondary"
                  className="w-full"
                  onClick={archive}
                  disabled={archiving || archivedId !== null}
                >
                  {archiving ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
                  ) : (
                    <Archive className="mr-2 h-4 w-4" aria-hidden="true" />
                  )}
                  {archivedId !== null ? 'Archived to your account' : 'Archive to my account'}
                </Button>
              )}
            </CardContent>
          </Card>

          <Button size="lg" variant="destructive" className="w-full" onClick={finishIncident}>
            <Trash2 className="mr-2 h-5 w-5" aria-hidden="true" />
            {settings.retention === 'session'
              ? 'Close incident and delete it now'
              : `Close incident (kept ${RETENTION_WINDOW[settings.retention]})`}
          </Button>
        </>
      ) : (
        <Card>
          <CardContent className="p-5">
            <p className="text-sm text-muted-foreground">
              No incident is stored on this device right now.
            </p>
          </CardContent>
        </Card>
      )}

      <Card className="border-destructive/40">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg">
            <ShieldCheck className="h-5 w-5 text-primary" aria-hidden="true" />
            Erasure and withdrawal
          </CardTitle>
          <CardDescription>
            GDPR Articles 15–18: access, rectification, erasure and restriction — exercised here, with
            no request form.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            This removes your Safety Profile, your consent record, your settings and any stored
            incident from this browser. Anything you explicitly archived to your account stays there
            until you delete it from your account.
          </p>
          <Button
            variant="destructive"
            className="w-full"
            onClick={() => {
              wipeEverything();
              toast.success('All local ResQKit data deleted.');
              navigate('/');
            }}
          >
            <Trash2 className="mr-2 h-4 w-4" aria-hidden="true" />
            Delete everything on this device
          </Button>
        </CardContent>
      </Card>
    </div>
  );
};

export default Review;