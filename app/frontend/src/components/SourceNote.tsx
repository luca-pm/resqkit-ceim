/**
 * Provenance chip.
 *
 * Every procedure step and every obligation card must show where its content
 * came from. If a claim has no source, it is not displayed at all — the app
 * never renders unsourced medical or legal text.
 */

import React from 'react';
import { FileText } from 'lucide-react';
import { SOURCE_DOCS, CONTENT_PACK_VERSION } from '@/lib/knowledge';

interface SourceNoteProps {
  sources: string[];
  className?: string;
}

const SourceNote: React.FC<SourceNoteProps> = ({ sources, className }) => {
  const docs = sources.map((code) => SOURCE_DOCS[code] ?? code);
  return (
    <p
      className={`flex flex-wrap items-start gap-1.5 text-xs text-muted-foreground ${className ?? ''}`}
    >
      <FileText className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
      <span>
        Source:{' '}
        <span className="font-mono">{docs.join(', ')}</span>
        {' · '}
        <span className="font-mono">pack {CONTENT_PACK_VERSION}</span>
      </span>
    </p>
  );
};

export default SourceNote;