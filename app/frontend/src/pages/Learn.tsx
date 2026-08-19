/**
 * S12b — Learn and practise.
 *
 * Calm-time reading of the exact same curated procedures used in an emergency,
 * plus what each kit item is for. Nothing here is generated at runtime, and
 * every procedure carries its source and clinical-review status.
 */

import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { BookOpen, GraduationCap, Stethoscope } from 'lucide-react';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import SourceNote from '@/components/SourceNote';
import { CONTEXTS, ContextId, PROCEDURES, kitItemByCode, kitItemsForContext } from '@/lib/knowledge';

const Learn: React.FC = () => {
  const [tab, setTab] = useState<'procedures' | 'items'>('procedures');
  const [ctx, setCtx] = useState<ContextId>('road');

  return (
    <div className="space-y-5">
      <div>
        <h1>Learn and practise</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Read this now, not at the roadside. It is the same content the emergency flow uses, without
          the time pressure.
        </p>
      </div>

      <div className="flex gap-2">
        <Button
          variant={tab === 'procedures' ? 'default' : 'secondary'}
          className="flex-1"
          onClick={() => setTab('procedures')}
        >
          <GraduationCap className="mr-2 h-4 w-4" aria-hidden="true" />
          Procedures
        </Button>
        <Button
          variant={tab === 'items' ? 'default' : 'secondary'}
          className="flex-1"
          onClick={() => setTab('items')}
        >
          <BookOpen className="mr-2 h-4 w-4" aria-hidden="true" />
          Kit items
        </Button>
      </div>

      {tab === 'procedures' && (
        <Accordion type="single" collapsible className="space-y-2">
          {PROCEDURES.map((p) => (
            <AccordionItem
              key={p.id}
              value={p.id}
              className="rounded-md border border-border bg-card px-4"
            >
              <AccordionTrigger className="text-left hover:no-underline">
                <span className="flex-1 pr-2">
                  <span className="block font-semibold">{p.shortLabel}</span>
                  <span className="mt-0.5 block text-sm font-normal text-muted-foreground">
                    {p.whenToUse}
                  </span>
                </span>
              </AccordionTrigger>
              <AccordionContent className="space-y-3">
                <ol className="space-y-3">
                  {p.steps.map((step, i) => (
                    <li key={step.title} className="rounded-md bg-muted p-3">
                      <p className="flex items-start gap-2 font-medium">
                        <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-sm bg-primary text-xs text-primary-foreground tabular">
                          {i + 1}
                        </span>
                        <span>
                          {step.title}
                          {step.critical && (
                            <Badge variant="destructive" className="ml-2 align-middle">
                              critical
                            </Badge>
                          )}
                        </span>
                      </p>
                      <p className="mt-1.5 text-sm text-muted-foreground">{step.detail}</p>
                      {step.requiresItems && step.requiresItems.length > 0 && (
                        <p className="mt-1.5 text-xs text-muted-foreground">
                          Needs:{' '}
                          {step.requiresItems
                            .map((c) => kitItemByCode(c)?.name ?? c)
                            .join(', ')}
                          {step.withoutItem ? ` · Without it: ${step.withoutItem}` : ''}
                        </p>
                      )}
                    </li>
                  ))}
                </ol>
                <p className="flex items-start gap-2 text-sm text-muted-foreground">
                  <Stethoscope className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
                  {p.clinicalReview === 'pending'
                    ? 'Pending independent clinical sign-off. Bystander orientation only.'
                    : 'Clinically reviewed.'}
                </p>
                <SourceNote sources={p.sources} />
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      )}

      {tab === 'items' && (
        <div className="space-y-3">
          <div className="flex flex-wrap gap-2">
            {CONTEXTS.filter((c) => c.id !== 'other').map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => setCtx(c.id)}
                aria-pressed={ctx === c.id}
                className={`rounded-md border px-3 py-1.5 text-sm transition-colors ${
                  ctx === c.id
                    ? 'border-primary bg-primary text-primary-foreground'
                    : 'border-border bg-card hover:bg-accent'
                }`}
              >
                {c.label}
              </button>
            ))}
          </div>
          <div className="grid gap-3">
            {kitItemsForContext(ctx).map((item) => (
              <Card key={item.code}>
                <CardContent className="p-4">
                  <p className="font-semibold">{item.name}</p>
                  <p className="mt-1 text-sm text-muted-foreground">{item.purpose}</p>
                  <p className="mt-1.5 text-sm">
                    <span className="font-medium">How to use it: </span>
                    {item.howTo}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      <Card>
        <CardContent className="p-4">
          <p className="text-sm text-muted-foreground">
            Reading is not training. Book a certified first-aid course — and check{' '}
            <Link to="/kits" className="underline underline-offset-2">
              your kits
            </Link>{' '}
            while you are thinking about it.
          </p>
        </CardContent>
      </Card>
    </div>
  );
};

export default Learn;