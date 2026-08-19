/**
 * S11 — Risks and regulations.
 *
 * Every card is a curated entry with an instrument, article reference and source
 * document. Topics without a verified source are shown as an explicit gap
 * instead of being filled with generated text — this is the anti-hallucination
 * guarantee made visible to the user.
 */

import React, { useMemo, useState } from 'react';
import { AlertCircle, Filter, Scale } from 'lucide-react';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import SourceNote from '@/components/SourceNote';
import { OBLIGATIONS, PENDING_VERIFICATION } from '@/lib/knowledge';

const TAGS = [
  { value: 'all', label: 'All' },
  { value: 'privacy', label: 'Privacy' },
  { value: 'communication', label: '112 & eCall' },
  { value: 'road', label: 'Road' },
  { value: 'health', label: 'Health data' },
  { value: 'security', label: 'Security' },
];

const Regulations: React.FC = () => {
  const [tag, setTag] = useState('all');
  const [term, setTerm] = useState('');

  const visible = useMemo(() => {
    const q = term.trim().toLowerCase();
    return OBLIGATIONS.filter((o) => {
      const tagOk = tag === 'all' || o.tags.includes(tag);
      const termOk =
        q === '' ||
        o.title.toLowerCase().includes(q) ||
        o.summary.toLowerCase().includes(q) ||
        o.instrument.toLowerCase().includes(q);
      return tagOk && termOk;
    });
  }, [tag, term]);

  return (
    <div className="space-y-5">
      <div>
        <h1>Risks and regulations</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Reference material with a named instrument and article for every claim. This is not legal
          advice for your specific situation.
        </p>
      </div>

      <div className="space-y-3">
        <Input
          value={term}
          onChange={(e) => setTerm(e.target.value)}
          placeholder="Search instrument, article or topic"
          aria-label="Search regulations"
        />
        <div className="flex flex-wrap gap-2">
          {TAGS.map((t) => (
            <button
              key={t.value}
              type="button"
              onClick={() => setTag(t.value)}
              aria-pressed={tag === t.value}
              className={`rounded-md border px-3 py-1.5 text-sm transition-colors ${
                tag === t.value
                  ? 'border-primary bg-primary text-primary-foreground'
                  : 'border-border bg-card hover:bg-accent'
              }`}
            >
              {t.value === 'all' && <Filter className="mr-1 inline h-3.5 w-3.5" aria-hidden="true" />}
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {visible.length === 0 ? (
        <Card>
          <CardContent className="p-5">
            <p className="text-sm text-muted-foreground">
              Nothing in the verified content pack matches that. Rather than generate an answer,
              ResQKit shows nothing.
            </p>
          </CardContent>
        </Card>
      ) : (
        <Accordion type="single" collapsible className="space-y-2">
          {visible.map((o) => (
            <AccordionItem
              key={o.id}
              value={o.id}
              className="rounded-md border border-border bg-card px-4"
            >
              <AccordionTrigger className="text-left hover:no-underline">
                <span className="flex-1 pr-2">
                  <span className="block font-semibold">{o.title}</span>
                  <span className="mt-0.5 block text-sm font-normal text-muted-foreground">
                    {o.summary}
                  </span>
                </span>
              </AccordionTrigger>
              <AccordionContent className="space-y-3">
                <p className="text-sm leading-relaxed">{o.detail}</p>
                <div className="grid gap-2 rounded-md bg-muted p-3 text-xs sm:grid-cols-2">
                  <p>
                    <span className="font-semibold">Instrument: </span>
                    <span className="text-muted-foreground">{o.instrument}</span>
                  </p>
                  <p>
                    <span className="font-semibold">Reference: </span>
                    <span className="font-mono text-muted-foreground">{o.articles}</span>
                  </p>
                  <p>
                    <span className="font-semibold">Applies in: </span>
                    <span className="text-muted-foreground">{o.jurisdiction}</span>
                  </p>
                  <p>
                    <span className="font-semibold">Verified: </span>
                    <span className="font-mono text-muted-foreground">{o.lastVerified}</span>
                  </p>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {o.tags.map((t) => (
                    <Badge key={t} variant="secondary">
                      {t}
                    </Badge>
                  ))}
                </div>
                <SourceNote sources={[o.sourceDoc]} />
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      )}

      <Card className="border-dashed">
        <CardContent className="space-y-3 p-4">
          <p className="flex items-center gap-2 font-semibold">
            <AlertCircle className="h-4 w-4 text-destructive" aria-hidden="true" />
            Known gaps in this content pack
          </p>
          <p className="text-sm text-muted-foreground">
            These topics are deliberately empty. ResQKit will not invent law to fill a gap.
          </p>
          <ul className="space-y-2">
            {PENDING_VERIFICATION.map((p) => (
              <li key={p.topic} className="rounded-md bg-muted p-3">
                <p className="text-sm font-medium">{p.topic}</p>
                <p className="mt-0.5 text-sm text-muted-foreground">{p.note}</p>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4">
          <p className="flex items-start gap-2 text-sm text-muted-foreground">
            <Scale className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
            ResQKit is complementary to official emergency channels. Where this screen and a 112
            operator disagree, the operator is correct.
          </p>
        </CardContent>
      </Card>
    </div>
  );
};

export default Regulations;