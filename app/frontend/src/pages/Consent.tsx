/**
 * S1 — Disclaimer and consent gate.
 *
 * Two separate decisions, never bundled (GDPR Art. 7): the mandatory
 * acknowledgement that ResQKit is not an emergency service, and the optional,
 * granular consent to store health data locally.
 */

import React, { useState } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { AlertTriangle, Check, Lock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { useIncident } from '@/lib/incidentContext';

const Consent: React.FC = () => {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const next = params.get('next') || '/';
  const { consent, updateConsent, startIncident } = useIncident();

  const [ack, setAck] = useState(consent.disclaimerAcknowledged);
  const [health, setHealth] = useState(consent.healthDataConsent);

  const confirm = () => {
    const now = new Date().toISOString();
    updateConsent({
      disclaimerAcknowledged: true,
      disclaimerAt: consent.disclaimerAt ?? now,
      healthDataConsent: health,
      healthDataConsentAt: health ? (consent.healthDataConsentAt ?? now) : null,
    });
    if (next === '/emergency') startIncident();
    navigate(next);
  };

  return (
    <div className="space-y-5">
      <div>
        <h1>Before you use ResQKit</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Read this once. It takes fifteen seconds and it decides what this app is allowed to do.
        </p>
      </div>

      <Card className="border-emergency/40">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg">
            <AlertTriangle className="h-5 w-5 text-emergency" aria-hidden="true" />
            ResQKit is not an emergency service
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <ul className="list-disc space-y-1.5 pl-5 text-muted-foreground">
            <li>It does not call 112 for you and does not notify anyone automatically.</li>
            <li>It does not transmit your location to emergency services.</li>
            <li>
              It gives general first-aid orientation for bystanders. It is not a medical device and
              not a diagnosis.
            </li>
            <li>
              The legal information it shows is sourced reference material, not legal advice for your
              specific case.
            </li>
            <li>Always follow the instructions of the 112 operator over anything shown here.</li>
          </ul>
          <label className="flex cursor-pointer items-start gap-3 rounded-md border border-border bg-background p-3">
            <Checkbox
              checked={ack}
              onCheckedChange={(v) => setAck(v === true)}
              aria-label="Acknowledge that ResQKit does not replace emergency services"
              className="mt-0.5"
            />
            <span className="text-sm">
              I understand ResQKit assists me and never replaces calling 112.
              <span className="text-destructive"> (required)</span>
            </span>
          </label>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Lock className="h-5 w-5 text-primary" aria-hidden="true" />
            Health data in your Safety Profile
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <p className="text-muted-foreground">
            Blood type, allergies, conditions, medication and implants are special-category health
            data under GDPR Article 9. This is optional and separate from the acknowledgement above —
            the app works fully without it.
          </p>
          <p className="text-muted-foreground">
            If you allow it, this data is stored in this browser only. It is never uploaded. It is
            shown to rescuers only when you tap Share on the handoff screen, and you can delete it at
            any time.
          </p>
          <label className="flex cursor-pointer items-start gap-3 rounded-md border border-border bg-background p-3">
            <Checkbox
              checked={health}
              onCheckedChange={(v) => setHealth(v === true)}
              aria-label="Consent to store health data locally"
              className="mt-0.5"
            />
            <span className="text-sm">
              I consent to storing my health data on this device.
              <span className="text-muted-foreground"> (optional, withdrawable)</span>
            </span>
          </label>
        </CardContent>
      </Card>

      <div className="flex flex-col gap-2 sm:flex-row">
        <Button size="lg" className="flex-1" disabled={!ack} onClick={confirm}>
          <Check className="mr-2 h-5 w-5" aria-hidden="true" />
          Continue
        </Button>
        <Button asChild size="lg" variant="emergency" className="flex-1">
          <a href="tel:112">Skip and call 112</a>
        </Button>
      </div>

      <p className="text-xs text-muted-foreground">
        You can change or withdraw any of this later from{' '}
        <Link to="/review" className="underline underline-offset-2">
          your data and rights
        </Link>
        .
      </p>
    </div>
  );
};

export default Consent;