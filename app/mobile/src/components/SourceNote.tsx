/**
 * Provenance chip (RN port of app/frontend/src/components/SourceNote.tsx).
 *
 * Every procedure step and every obligation card must show where its content
 * came from. If a claim has no source, it is not displayed at all — the app
 * never renders unsourced medical or legal text.
 */
import React from 'react';
import { Text, View } from 'react-native';
import { FileText } from 'lucide-react-native';

import { CONTENT_PACK_VERSION, SOURCE_DOCS } from '@/lib/knowledge';
import { useTokenColors } from '@/lib/tokenColors';

interface SourceNoteProps {
  sources: string[];
  className?: string;
}

const SourceNote: React.FC<SourceNoteProps> = ({ sources, className = '' }) => {
  const colors = useTokenColors();
  const docs = sources.map((code) => SOURCE_DOCS[code] ?? code);
  return (
    <View className={`flex-row items-start gap-1.5 ${className}`}>
      <FileText size={14} color={colors.mutedForeground} style={{ marginTop: 2 }} />
      <Text className="flex-1 text-xs text-muted-foreground">
        Source: <Text className="font-mono">{docs.join(', ')}</Text>
        {' · '}
        <Text className="font-mono">pack {CONTENT_PACK_VERSION}</Text>
      </Text>
    </View>
  );
};

export default SourceNote;
