/**
 * S9 — Rescuer handoff.
 *
 * The written brief is composed deterministically on-device and is complete on
 * its own. The optional spoken version is generated server-side by
 * claude-opus-5 from that exact text and is clearly labelled; if it fails, the
 * written brief remains fully usable.
 */

import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Copy, Loader2, Radio, Share2, Sparkles, Volume2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { client } from '@/lib/api';
import { useIncident } from '@/lib/incidentContext';
import { buildBrief } from '@/lib/brief';
import { buildNgProtocolPayload } from '@/lib/institutionalActions';
import { RESPONDER_PRIORITIES } from '@/lib/knowledge';
import { profileHasHealthData } from '@/lib/localStore';

const Handoff: React.FC = () => {
  const navigate = useNavigate();
  const { incident, profile, consent, updateIncident, settings, logInstitutional } = useIncident();
  const [includeHealth, setIncludeHealth] = useState(false);
  const [includeReporter, setIncludeReporter] = useState(false);
  const [spoken, setSpoken] = useState('');
  const [narrating, setNarrating] = useState(false);
  const [buildingNgPayload, setBuildingNgPayload] = useState(false);

  const brief = useMemo(() => {
    if (!incident) return '';
    return buildBrief(incident, profile, { includeHealth, includeReporter });
  }, [incident, profile, includeHealth, includeReporter]);

  if (!incident) {
    return (
      <Card>
        <CardContent className="p-5">
          <p className="text-sm text-muted-foreground">
            There is no active incident to hand over.
          </p>
          <Button className="mt-3" onClick={() => navigate('/')}>
            Back to start
          </Button>
        </CardContent>
      </Card>
    );
  }

  const healthAvailable = consent.healthDataConsent && profileHasHealthData(profile);

  const copyBrief = () => {
    void navigator.clipboard
      ?.writeText(brief)
      .then(() => toast.success('Brief copied.'))
      .catch(() => toast.error('Could not copy. Show the screen instead.'));
  };

  const shareBrief = async () => {
    updateIncident({ includeHealthData: includeHealth });
    const nav = navigator as Navigator & { share?: (data: ShareData) => Promise<void> };
    if (nav.share) {
      try {
        await nav.share({ title: 'ResQKit scene brief', text: brief });
        toast.success('Shared.');
        return;
      } catch {
        /* user cancelled — fall through to clipboard */
      }
    }
    copyBrief();
  };

  const narrate = async () => {
    setNarrating(true);
    try {
      const response = await client.apiCall.invoke({
        url: '/api/v1/resqkit/polish_brief',
        method: 'POST',
        data: { brief_text: brief },
      });
      setSpoken((response.data as { spoken: string }).spoken);
    } catch (e: unknown) {
      const err = e as { data?: { detail?: string }; message?: string };
      toast.error(
        err?.data?.detail || err?.message || 'Spoken version unavailable. Read the written brief.',
      );
    } finally {
      setNarrating(false);
    }
  };

  return (
    <div className="space-y-5">
      <div>
        <h1>Hand over to the crew</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Ordered the way rescuers ask for it: {RESPONDER_PRIORITIES.slice(0, 4).join(', ').toLowerCase()}
          , then medical history and what you already did.
        </p>
      </div>

      <Card>
        <CardContent className="space-y-3 p-4">
          <p className="font-semibold">What to include</p>
          <label className="flex cursor-pointer items-start gap-3">
            <Checkbox
              checked={includeHealth}
              disabled={!healthAvailable}
              onCheckedChange={(v) => setIncludeHealth(v === true)}
              className="mt-0.5"
              aria-label="Include medical information"
            />
            <span className="text-sm">
              My medical information
              <span className="block text-xs text-muted-foreground">
                {healthAvailable
                  ? 'Health data, shared only on this explicit action.'
                  : 'Unavailable — no consented health data in your Safety Profile.'}
              </span>
            </span>
          </label>
          <label className="flex cursor-pointer items-start gap-3">
            <Checkbox
              checked={includeReporter}
              onCheckedChange={(v) => setIncludeReporter(v === true)}
              className="mt-0.5"
              aria-label="Include my contact details"
            />
            <span className="text-sm">
              My name and phone
              <span className="block text-xs text-muted-foreground">
                So the crew can reach you as a witness.
              </span>
            </span>
          </label>
          {includeReporter && (
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="reporterName">Your name</Label>
                <Input
                  id="reporterName"
                  value={incident.reporterName}
                  onChange={(e) => updateIncident({ reporterName: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="reporterPhone">Your phone</Label>
                <Input
                  id="reporterPhone"
                  type="tel"
                  value={incident.reporterPhone}
                  onChange={(e) => updateIncident({ reporterPhone: e.target.value })}
                />
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="space-y-3 p-4">
          <div className="flex items-center justify-between gap-2">
            <p className="font-semibold">Scene brief</p>
            <Badge variant="secondary">Composed on this device</Badge>
          </div>
          <pre className="max-h-96 overflow-auto whitespace-pre-wrap rounded-md bg-muted p-3 font-mono text-xs leading-relaxed text-foreground">
            {brief}
          </pre>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Button className="flex-1" onClick={shareBrief}>
              <Share2 className="mr-2 h-4 w-4" aria-hidden="true" />
              Share with the crew
            </Button>
            <Button variant="secondary" className="flex-1" onClick={copyBrief}>
              <Copy className="mr-2 h-4 w-4" aria-hidden="true" />
              Copy text
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="space-y-3 p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="flex items-center gap-1.5 font-semibold">
                <Volume2 className="h-4 w-4 text-primary" aria-hidden="true" />
                Spoken handover
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                A short paragraph you can read aloud, rewritten from the brief above. It adds no new
                facts.
              </p>
              <p className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
                <Badge variant="secondary">Open-source AI</Badge>
                Rewritten by a model self-hosted on this server — nothing is sent off this
                machine.
              </p>
            </div>
            <Button size="sm" variant="secondary" onClick={narrate} disabled={narrating}>
              {narrating ? (
                <Loader2 className="mr-1.5 h-4 w-4 animate-spin" aria-hidden="true" />
              ) : (
                <Sparkles className="mr-1.5 h-4 w-4" aria-hidden="true" />
              )}
              Generate
            </Button>
          </div>
          {spoken && (
            <div className="rounded-md border border-border bg-background p-3">
              <p className="text-sm leading-relaxed">{spoken}</p>
              <p className="mt-2 text-xs text-muted-foreground">
                AI-rewritten wording. The written brief above is the authoritative record.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="border-dashed">
        <CardContent className="space-y-2 p-4">
          <p className="flex items-center gap-1.5 font-semibold">
            <Radio className="h-4 w-4 text-primary" aria-hidden="true" />
            NG protocol payload (prototype)
          </p>
          <p className="text-sm text-muted-foreground">
            Previews the PIDF-LO + RFC 7852-style payload ResQKit would eventually hand to an
            authorized NG112 channel. Proof-of-concept only — never transmitted anywhere; logged to
            Settings → Institutional actions trace.{' '}
            {settings.realDataMode ? 'Real data mode is on.' : 'Currently simulated.'}
          </p>
          <Button
            size="sm"
            variant="secondary"
            disabled={buildingNgPayload}
            onClick={async () => {
              if (!incident) return;
              setBuildingNgPayload(true);
              try {
                await buildNgProtocolPayload(incident, settings.realDataMode, logInstitutional, (id, code) =>
                  updateIncident({ backendSessionId: id, sessionCode: code }),
                );
                toast.success('Logged to the institutional actions trace.');
              } finally {
                setBuildingNgPayload(false);
              }
            }}
          >
            {buildingNgPayload ? (
              <Loader2 className="mr-1.5 h-4 w-4 animate-spin" aria-hidden="true" />
            ) : (
              <Radio className="mr-1.5 h-4 w-4" aria-hidden="true" />
            )}
            Build NG protocol payload
          </Button>
        </CardContent>
      </Card>

      <Button size="lg" variant="secondary" className="w-full" onClick={() => navigate('/review')}>
        Incident over — review and delete data
      </Button>
    </div>
  );
};

export default Handoff;