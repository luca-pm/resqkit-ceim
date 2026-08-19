/**
 * S2 — Safety Profile.
 *
 * Health fields are only editable when explicit Article 9 consent exists.
 * Everything is written straight to localStorage; there is no upload path.
 */

import React from 'react';
import { Link } from 'react-router-dom';
import { Lock, ShieldCheck, Trash2, UserRound } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { useIncident } from '@/lib/incidentContext';

const BLOOD_TYPES = ['', 'A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', '0+', '0-', 'Unknown'];

const Profile: React.FC = () => {
  const { profile, updateProfile, deleteProfile, consent } = useIncident();
  const healthAllowed = consent.healthDataConsent;

  return (
    <div className="space-y-5">
      <div>
        <h1>Safety Profile</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          What a paramedic would want to know about you in the first thirty seconds. Stored in this
          browser only, and shared only when you tap Share on a handoff card.
        </p>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg">
            <UserRound className="h-5 w-5 text-primary" aria-hidden="true" />
            Identity and contact
          </CardTitle>
          <CardDescription>Not special-category data, but still only kept locally.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="displayName">Name</Label>
            <Input
              id="displayName"
              value={profile.displayName}
              onChange={(e) => updateProfile({ displayName: e.target.value })}
              placeholder="How rescuers should address you"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="language">Preferred language</Label>
            <Input
              id="language"
              value={profile.language}
              onChange={(e) => updateProfile({ language: e.target.value })}
              placeholder="e.g. Romanian, English"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ecName">Emergency contact name</Label>
            <Input
              id="ecName"
              value={profile.emergencyContactName}
              onChange={(e) => updateProfile({ emergencyContactName: e.target.value })}
              placeholder="Next of kin"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ecPhone">Emergency contact phone</Label>
            <Input
              id="ecPhone"
              type="tel"
              value={profile.emergencyContactPhone}
              onChange={(e) => updateProfile({ emergencyContactPhone: e.target.value })}
              placeholder="+40 ..."
            />
          </div>
        </CardContent>
      </Card>

      <Card className={healthAllowed ? undefined : 'border-dashed'}>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Lock className="h-5 w-5 text-primary" aria-hidden="true" />
            Medical facts
          </CardTitle>
          <CardDescription>
            Special-category health data under GDPR Article 9. Requires your explicit consent.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {!healthAllowed && (
            <div className="rounded-md border border-border bg-muted p-3 text-sm">
              <p className="text-muted-foreground">
                These fields are locked because you have not consented to storing health data on this
                device.
              </p>
              <Button asChild size="sm" variant="secondary" className="mt-2">
                <Link to="/consent?next=/profile">Review consent</Link>
              </Button>
            </div>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="bloodType">Blood type</Label>
              <select
                id="bloodType"
                disabled={!healthAllowed}
                value={profile.bloodType}
                onChange={(e) => updateProfile({ bloodType: e.target.value })}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {BLOOD_TYPES.map((t) => (
                  <option key={t || 'none'} value={t}>
                    {t || 'Not specified'}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="implants">Implants or devices</Label>
              <Input
                id="implants"
                disabled={!healthAllowed}
                value={profile.implants}
                onChange={(e) => updateProfile({ implants: e.target.value })}
                placeholder="Pacemaker, insulin pump, stent…"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="allergies">Allergies</Label>
            <Textarea
              id="allergies"
              disabled={!healthAllowed}
              value={profile.allergies}
              onChange={(e) => updateProfile({ allergies: e.target.value })}
              placeholder="Penicillin, latex, nuts… and the reaction if you know it"
              rows={2}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="conditions">Conditions</Label>
            <Textarea
              id="conditions"
              disabled={!healthAllowed}
              value={profile.conditions}
              onChange={(e) => updateProfile({ conditions: e.target.value })}
              placeholder="Diabetes, epilepsy, asthma, heart condition…"
              rows={2}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="medications">Medications</Label>
            <Textarea
              id="medications"
              disabled={!healthAllowed}
              value={profile.medications}
              onChange={(e) => updateProfile({ medications: e.target.value })}
              placeholder="Anticoagulants, insulin, beta blockers…"
              rows={2}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="flex items-start gap-2 text-sm text-muted-foreground">
            <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
            Saved automatically as you type. Nothing leaves this device.
          </p>
          <Button
            variant="destructive"
            size="sm"
            className="shrink-0"
            onClick={() => {
              deleteProfile();
              toast.success('Safety Profile deleted from this device.');
            }}
          >
            <Trash2 className="mr-1.5 h-4 w-4" aria-hidden="true" />
            Delete profile
          </Button>
        </CardContent>
      </Card>
    </div>
  );
};

export default Profile;