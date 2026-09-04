/**
 * The CEIM incident report (Plan D) — additive to, not a replacement for,
 * the deterministic plain-text brief in lib/brief.ts / handoff.tsx, which
 * keeps working unchanged. This is the human-readable + shareable view of
 * the Canonical Emergency Incident Model built by the interview stage.
 *
 * Copy correction (see ResQKit_Canonical_Incident_Model.md): the mentor's
 * "we send this to any institution" is deliberately NOT implemented as
 * autonomous transmission — nothing in this app sends data anywhere today.
 * The honest framing is "exportable/shareable format", stated explicitly
 * below and reused verbatim wherever the report is introduced.
 */
import React, { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Share, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import {
  Archive,
  Backpack,
  ChevronDown,
  ChevronUp,
  Copy,
  MapPin,
  Radio,
  Share2,
  ShieldAlert,
  User,
} from 'lucide-react-native';
import * as Clipboard from 'expo-clipboard';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from '@/components/ui/toast';
import { useIncident } from '@/contexts/IncidentContext';
import { client } from '@/lib/apiClient';
import { CeimIncident, Fact } from '@/lib/ceim';
import { useTokenColors } from '@/lib/tokenColors';

const COPY_CORRECTION =
  'This report is built in a standardized, shareable format — like the one European emergency ' +
  'systems use — so you can hand it to whichever service or person you choose. ResQKit does not ' +
  'send it anywhere on its own.\n\n' +
  'Acest raport este construit într-un format standardizat, ușor de distribuit — asemănător celui ' +
  'folosit de sistemele europene de urgență — astfel încât să îl poți preda oricărui serviciu sau ' +
  'persoane alegi. ResQKit nu îl trimite nicăieri de la sine.';

const CONFIDENCE_VARIANT: Record<string, 'secondary' | 'emergency' | 'default'> = {
  high: 'secondary',
  medium: 'default',
  low: 'emergency',
};

/** One fact rendered as a labelled line with a confidence badge — skipped entirely if empty. */
const FactRow: React.FC<{ label: string; fact?: Fact<unknown> | null }> = ({ label, fact }) => {
  if (!fact || fact.value === null || fact.value === undefined || fact.value === '') return null;
  return (
    <View className="flex-row items-start justify-between gap-2">
      <View className="flex-1">
        <Text className="text-xs uppercase tracking-wide text-muted-foreground">{label}</Text>
        <Text className="text-sm text-foreground">{String(fact.value)}</Text>
      </View>
      <Badge variant={CONFIDENCE_VARIANT[fact.confidence] ?? 'secondary'}>{fact.confidence}</Badge>
    </View>
  );
};

/** Builds a human-readable plain-text summary for sharing — separate from the raw JSON export. */
function formatCeimAsText(ceim: CeimIncident): string {
  const lines: string[] = ['SCENE REPORT (ResQKit)', ''];
  const add = (label: string, fact?: Fact<unknown> | null) => {
    if (fact && fact.value !== null && fact.value !== undefined && fact.value !== '') {
      lines.push(`${label}: ${fact.value} [${fact.confidence}]`);
    }
  };

  add('Incident type', ceim.incident_type);
  add('112 status', ceim.called_112);
  add('Location', ceim.location.description);
  add('Coordinates', ceim.location.latitude);
  add('Victim count', ceim.victim_count);
  lines.push('');

  ceim.victims.forEach((v, i) => {
    lines.push(`Victim ${i + 1}:`);
    add('  Condition', v.condition_description);
    add('  Injury', v.injury_type);
    add('  Access', v.trapped);
  });

  if (ceim.hazards.length) {
    lines.push('', 'Hazards:');
    ceim.hazards.forEach((h) => add('  -', h.description));
  }

  if (ceim.scene_observations.length) {
    lines.push('', 'Observations:');
    ceim.scene_observations.forEach((o) => {
      if (o.value) lines.push(`  - ${o.value} [${o.confidence}]`);
    });
  }

  add('Notes', ceim.additional_notes);
  lines.push('', `Content pack ${ceim.content_pack_version} — CEIM ${ceim.ceim_schema_version}`);
  return lines.join('\n');
}

interface NgPreview {
  pidf_lo: string | null;
  additional_data: { provider_info: string; comment: string };
  note: string;
  ceim_driven: boolean;
}

export default function ReportScreen() {
  const router = useRouter();
  const { incident } = useIncident();
  const colors = useTokenColors();
  const [showRaw, setShowRaw] = useState(false);
  const [ngPreview, setNgPreview] = useState<NgPreview | null>(null);
  const [ngLoading, setNgLoading] = useState(false);
  const [ngError, setNgError] = useState('');

  const ceim = incident?.ceimReport ?? null;

  const share = async () => {
    if (!ceim) return;
    try {
      await Share.share({ message: formatCeimAsText(ceim) });
    } catch {
      toast.error('Could not open the share sheet.');
    }
  };

  const copyRawJson = async () => {
    if (!ceim) return;
    try {
      await Clipboard.setStringAsync(JSON.stringify(ceim, null, 2));
      toast.success('Raw CEIM JSON copied.');
    } catch {
      toast.error('Could not copy.');
    }
  };

  const previewNg112 = async () => {
    const sessionId = incident?.backendSessionId;
    if (!sessionId || sessionId.startsWith('sim-')) {
      setNgError('Turn on Local backend mode in Settings to preview the NG112 payload.');
      return;
    }
    setNgLoading(true);
    setNgError('');
    try {
      const res = await client.apiCall.invoke<NgPreview>({
        url: `/api/v1/incident_sessions/${sessionId}/ng_protocol/build`,
        method: 'POST',
        data: {},
      });
      setNgPreview(res.data);
    } catch {
      setNgError('Could not build the NG112 preview.');
    } finally {
      setNgLoading(false);
    }
  };

  if (!incident) {
    return (
      <ScrollView className="flex-1 bg-background" contentContainerClassName="p-4">
        <Card>
          <CardContent className="p-5">
            <Text className="text-sm text-muted-foreground">There is no active incident.</Text>
          </CardContent>
        </Card>
      </ScrollView>
    );
  }

  if (!ceim) {
    return (
      <ScrollView className="flex-1 bg-background" contentContainerClassName="gap-4 p-4">
        <Card>
          <CardContent className="gap-3 p-5">
            <Text className="text-sm text-muted-foreground">
              No report has been generated for this incident yet
              {incident.interviewSkipped ? ' — the interview was skipped.' : '.'}
            </Text>
            <Button variant="secondary" onPress={() => router.back()}>
              Back
            </Button>
          </CardContent>
        </Card>
      </ScrollView>
    );
  }

  return (
    <ScrollView className="flex-1 bg-background" contentContainerClassName="gap-4 p-4 pb-10">
      <View>
        <Text className="text-2xl font-bold text-foreground">Scene report</Text>
        {ceim.degraded && (
          <Badge variant="emergency" className="mt-2 self-start">
            Built from your answers directly — AI summary unavailable
          </Badge>
        )}
      </View>

      <Card className="border-primary/40">
        <CardContent className="p-4">
          <Text className="text-xs leading-relaxed text-muted-foreground">{COPY_CORRECTION}</Text>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex-row items-center gap-2 pb-2">
          <MapPin size={16} color={colors.primary} />
          <CardTitle className="text-base">Location</CardTitle>
        </CardHeader>
        <CardContent className="gap-2">
          <FactRow label="Note" fact={ceim.location.description} />
          <FactRow label="Latitude" fact={ceim.location.latitude} />
          <FactRow label="Longitude" fact={ceim.location.longitude} />
          <FactRow label="Accuracy (m)" fact={ceim.location.accuracy_m} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex-row items-center gap-2 pb-2">
          <User size={16} color={colors.primary} />
          <CardTitle className="text-base">Victims</CardTitle>
        </CardHeader>
        <CardContent className="gap-3">
          {ceim.victims.map((v) => (
            <View key={v.index} className="gap-2 border-b border-border pb-2 last:border-b-0 last:pb-0">
              <FactRow label="Responsive" fact={v.responsive} />
              <FactRow label="Breathing" fact={v.breathing} />
              <FactRow label="Age" fact={v.age_band} />
              <FactRow label="Injury" fact={v.injury_type} />
              <FactRow label="Access" fact={v.trapped} />
              <FactRow label="Condition" fact={v.condition_description} />
            </View>
          ))}
        </CardContent>
      </Card>

      {ceim.hazards.length > 0 && (
        <Card>
          <CardHeader className="flex-row items-center gap-2 pb-2">
            <ShieldAlert size={16} color={colors.emergency} />
            <CardTitle className="text-base">Hazards</CardTitle>
          </CardHeader>
          <CardContent className="gap-2">
            {ceim.hazards.map((h, i) => (
              <FactRow key={i} label={h.code?.value ?? 'Observed'} fact={h.description} />
            ))}
          </CardContent>
        </Card>
      )}

      {ceim.scene_observations.length > 0 && (
        <Card>
          <CardHeader className="flex-row items-center gap-2 pb-2">
            <Backpack size={16} color={colors.primary} />
            <CardTitle className="text-base">Observations</CardTitle>
          </CardHeader>
          <CardContent className="gap-2">
            {ceim.scene_observations.map((o, i) => (
              <FactRow key={i} label="Observation" fact={o} />
            ))}
            <FactRow label="Additional notes" fact={ceim.additional_notes} />
          </CardContent>
        </Card>
      )}

      <View className="gap-2">
        <Button onPress={share}>
          <Share2 size={16} color={colors.primaryForeground} />
          <Text className="text-sm font-medium text-primary-foreground">Share</Text>
        </Button>
        <Button variant="secondary" onPress={copyRawJson}>
          <Copy size={16} color={colors.secondaryForeground} />
          <Text className="text-sm font-medium text-secondary-foreground">Copy raw CEIM JSON</Text>
        </Button>
      </View>

      <Pressable
        onPress={() => setShowRaw((v) => !v)}
        className="flex-row items-center justify-between rounded-md border border-dashed border-border p-3"
      >
        <Text className="text-sm text-muted-foreground">View raw CEIM JSON</Text>
        {showRaw ? (
          <ChevronUp size={16} color={colors.mutedForeground} />
        ) : (
          <ChevronDown size={16} color={colors.mutedForeground} />
        )}
      </Pressable>
      {showRaw && (
        <View className="rounded-md bg-muted p-3">
          <Text className="font-mono text-xs text-foreground">{JSON.stringify(ceim, null, 2)}</Text>
        </View>
      )}

      <Card className="border-dashed">
        <CardContent className="gap-2">
          <View className="flex-row items-center gap-1.5">
            <Radio size={16} color={colors.primary} />
            <Text className="font-semibold text-foreground">NG112 payload preview</Text>
          </View>
          <Text className="text-sm text-muted-foreground">
            Adapts this report into a PIDF-LO + RFC 7852-style payload. Proof-of-concept only —
            never transmitted anywhere.
          </Text>
          <Button size="sm" variant="secondary" disabled={ngLoading} onPress={previewNg112}>
            {ngLoading ? (
              <ActivityIndicator size="small" color={colors.secondaryForeground} />
            ) : (
              <Archive size={16} color={colors.secondaryForeground} />
            )}
            <Text className="text-xs font-medium text-secondary-foreground">Build preview</Text>
          </Button>
          {ngError !== '' && <Text className="text-xs text-destructive">{ngError}</Text>}
          {ngPreview && (
            <View className="gap-2 rounded-md border border-border bg-background p-3">
              <Badge variant="secondary">{ngPreview.ceim_driven ? 'CEIM-driven' : 'From session log'}</Badge>
              <Text className="font-mono text-xs text-foreground">{ngPreview.additional_data.comment}</Text>
              {ngPreview.pidf_lo && (
                <Text className="font-mono text-xs text-foreground">{ngPreview.pidf_lo}</Text>
              )}
              <Text className="text-xs text-muted-foreground">{ngPreview.note}</Text>
            </View>
          )}
        </CardContent>
      </Card>
    </ScrollView>
  );
}
