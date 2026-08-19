/**
 * Global shell.
 *
 * Enforces MVP guardrail 1: once an incident is running and the 112 call has
 * not been confirmed, a non-dismissible dialler banner stays visible for the
 * rest of the session.
 */

import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Phone, WifiOff, ShieldAlert, LifeBuoy, Settings as SettingsIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useIncident } from '@/lib/incidentContext';
import { CONTENT_PACK_VERSION } from '@/lib/knowledge';

const AppShell: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { incident, online } = useIncident();
  const location = useLocation();

  const showCallBanner =
    Boolean(incident) &&
    incident?.called112 === 'not_confirmed' &&
    location.pathname !== '/consent';

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      <header className="sticky top-0 z-40 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
        <div className="mx-auto flex h-16 w-full max-w-screen-md items-center justify-between gap-3 px-4">
          <Link to="/" className="flex items-center gap-2">
            <span className="flex h-9 w-9 items-center justify-center rounded-md bg-primary text-primary-foreground">
              <LifeBuoy className="h-5 w-5" aria-hidden="true" />
            </span>
            <span className="flex flex-col leading-none">
              <span className="text-lg font-bold tracking-tight">ResQKit</span>
              <span className="text-xs text-muted-foreground">Assists. Does not replace 112.</span>
            </span>
          </Link>
          <div className="flex items-center gap-2">
            {!online && (
              <span className="flex items-center gap-1 rounded-md bg-muted px-2 py-1 text-xs text-muted-foreground">
                <WifiOff className="h-3.5 w-3.5" aria-hidden="true" />
                Offline
              </span>
            )}
            <Button asChild variant="ghost" size="sm" title="Settings">
              <Link to="/settings">
                <SettingsIcon className="h-4 w-4" aria-hidden="true" />
              </Link>
            </Button>
            <Button asChild variant="destructive" size="sm">
              <a href="tel:112">
                <Phone className="mr-1.5 h-4 w-4" aria-hidden="true" />
                112
              </a>
            </Button>
          </div>
        </div>
      </header>

      {showCallBanner && (
        <div className="border-b border-destructive/40 bg-destructive/10">
          <div className="mx-auto flex w-full max-w-screen-md flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="flex items-start gap-2 text-sm text-foreground">
              <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-destructive" aria-hidden="true" />
              <span>
                <strong className="font-semibold">112 not confirmed.</strong> ResQKit does not contact
                emergency services for you.
              </span>
            </p>
            <Button asChild variant="destructive" size="sm" className="shrink-0">
              <a href="tel:112">Call 112 now</a>
            </Button>
          </div>
        </div>
      )}

      <main className="mx-auto w-full max-w-screen-md flex-1 px-4 py-6">{children}</main>

      <footer className="border-t border-border">
        <div className="mx-auto w-full max-w-screen-md px-4 py-5 text-xs text-muted-foreground">
          <p>
            ResQKit provides information and first-aid orientation. It is not a medical device, not
            legal advice, and never a substitute for calling 112.
          </p>
          <p className="mt-1 font-mono">Content pack {CONTENT_PACK_VERSION}</p>
        </div>
      </footer>
    </div>
  );
};

export default AppShell;