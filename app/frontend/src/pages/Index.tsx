/**
 * S0 — Home / standby.
 *
 * The single most important action on this screen is calling 112. Everything
 * else is secondary. The emergency entry point does not gate on login: a
 * bystander must never be blocked by an auth screen at a crash site.
 */

import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Phone,
  Siren,
  UserRound,
  Scale,
  Backpack,
  GraduationCap,
  ChevronRight,
  ShieldCheck,
  Clock,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { useIncident } from '@/lib/incidentContext';
import { profileHasHealthData } from '@/lib/localStore';

const Index: React.FC = () => {
  const navigate = useNavigate();
  const { consent, profile, incident, startIncident } = useIncident();

  const beginIncident = () => {
    if (!consent.disclaimerAcknowledged) {
      navigate('/consent?next=/emergency');
      return;
    }
    if (!incident) startIncident();
    navigate('/emergency');
  };

  const shortcuts = [
    {
      to: '/profile',
      icon: UserRound,
      title: 'Safety Profile',
      description: profileHasHealthData(profile)
        ? 'Stored on this device only'
        : 'Add blood type, allergies, medication',
    },
    {
      to: '/kits',
      icon: Backpack,
      title: 'My Kits',
      description: 'Know what you actually carry',
    },
    {
      to: '/regulations',
      icon: Scale,
      title: 'Risks & regulations',
      description: 'Sourced EU obligations, no guesswork',
    },
    {
      to: '/learn',
      icon: GraduationCap,
      title: 'Learn & practise',
      description: 'Calm-time walkthrough of every procedure',
    },
  ];

  return (
    <div className="space-y-6">
      <section className="rounded-lg border border-emergency/30 bg-emergency/5 p-5">
        <p className="text-sm font-semibold uppercase tracking-wide text-emergency">
          If someone is hurt, call first
        </p>
        <h1 className="mt-2">Call 112 before anything else</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          ResQKit does not contact emergency services and does not send your location to anyone. Your
          phone and network deliver caller location to the emergency service under EU rules.
        </p>
        <div className="mt-4 flex flex-col gap-2 sm:flex-row">
          <Button asChild size="lg" variant="emergency" className="flex-1">
            <a href="tel:112">
              <Phone className="mr-2 h-5 w-5" aria-hidden="true" />
              Call 112
            </a>
          </Button>
          <Button size="lg" variant="secondary" className="flex-1" onClick={beginIncident}>
            <Siren className="mr-2 h-5 w-5" aria-hidden="true" />
            {incident ? 'Resume incident' : 'Start guided help'}
          </Button>
        </div>
      </section>

      {incident && (
        <Card className="border-primary/40">
          <CardContent className="flex items-center justify-between gap-3 p-4">
            <div className="flex items-start gap-2">
              <Clock className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
              <div>
                <p className="text-sm font-semibold">Incident in progress</p>
                <p className="text-xs text-muted-foreground">
                  Started {new Date(incident.startedAt).toLocaleTimeString()} · kept on this device
                </p>
              </div>
            </div>
            <Button size="sm" onClick={() => navigate('/emergency')}>
              Continue
            </Button>
          </CardContent>
        </Card>
      )}

      <section>
        <h2 className="mb-3">Prepare now, so you don't improvise later</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          {shortcuts.map((item) => (
            <Link key={item.to} to={item.to} className="group">
              <Card className="h-full transition-shadow hover:shadow-md">
                <CardContent className="flex h-full items-start gap-3 p-4">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-accent text-accent-foreground">
                    <item.icon className="h-5 w-5" aria-hidden="true" />
                  </span>
                  <span className="flex-1">
                    <span className="flex items-center justify-between gap-2">
                      <span className="font-semibold">{item.title}</span>
                      <ChevronRight
                        className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-0.5"
                        aria-hidden="true"
                      />
                    </span>
                    <span className="mt-0.5 block text-sm text-muted-foreground">
                      {item.description}
                    </span>
                  </span>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      </section>

      <section className="rounded-lg border border-border bg-card p-4">
        <p className="flex items-start gap-2 text-sm text-card-foreground">
          <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
          <span>
            <strong className="font-semibold">Local-first by design.</strong> Your Safety Profile and
            the incident record stay in this browser. Camera frames are analysed for object
            recognition only and are never stored or uploaded as images.{' '}
            <Link to="/regulations" className="underline underline-offset-2">
              See the legal basis
            </Link>
            .
          </span>
        </p>
      </section>
    </div>
  );
};

export default Index;