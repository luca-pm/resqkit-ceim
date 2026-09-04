/**
 * The AI scene interview (Plan A) — a small set of fixed, pre-written
 * open-ended prompts (lib/ceim.ts's INTERVIEW_PROMPTS), answered one at a
 * time with zero AI latency between them, then exactly ONE model call at
 * the end structures everything into a CEIM report.
 *
 * Every prompt is optional and skippable — a bystander at a real scene must
 * never be blocked by a mandatory field. The escalation banner further up
 * the wizard (breathing === 'no') already routes straight to `guide`,
 * bypassing this stage entirely, so nothing here ever delays CPR.
 */
import React, { useState } from 'react';
import { ActivityIndicator, Text, TextInput, View } from 'react-native';
import { ChevronRight, MessageCircleQuestion, Sparkles } from 'lucide-react-native';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { toast } from '@/components/ui/toast';
import { client } from '@/lib/apiClient';
import {
  CeimGenerateResponse,
  INTERVIEW_PROMPTS,
  buildKnownFactsFromIncident,
} from '@/lib/ceim';
import { logCeimGenerated, logInterviewAnswer } from '@/lib/institutionalActions';
import { AppSettings, IncidentState, InstitutionalLogEntry } from '@/lib/storage';
import { useTokenColors } from '@/lib/tokenColors';

type LogFn = (entry: Omit<InstitutionalLogEntry, 'id' | 'at'>) => void;
type SessionFn = (id: string, code: string | null) => void;

/** After this long with no response, offer an escape rather than trap the
 * user behind a silent spinner — Ollama on this project's dev hardware
 * measures 30-57s/call, well past the point a bystander should be made to
 * wait with no way out. */
const SLOW_GENERATE_MS = 15000;

interface InterviewStageProps {
  incident: IncidentState;
  settings: AppSettings;
  logInstitutional: LogFn;
  onSession: SessionFn;
  updateIncident: (patch: Partial<IncidentState>) => void;
  onDone: () => void;
}

const InterviewStage: React.FC<InterviewStageProps> = ({
  incident,
  settings,
  logInstitutional,
  onSession,
  updateIncident,
  onDone,
}) => {
  const colors = useTokenColors();
  // Resume where a prior visit left off, rather than re-asking answered prompts.
  const [index, setIndex] = useState(() => Math.min(incident.interviewAnswers.length, INTERVIEW_PROMPTS.length - 1));
  const [answerText, setAnswerText] = useState('');
  const [generating, setGenerating] = useState(false);
  const [showSkipGenerating, setShowSkipGenerating] = useState(false);

  const prompt = INTERVIEW_PROMPTS[index];
  const isLast = index === INTERVIEW_PROMPTS.length - 1;

  const generateReport = async () => {
    setGenerating(true);
    const slowTimer = setTimeout(() => setShowSkipGenerating(true), SLOW_GENERATE_MS);

    try {
      const res = await client.apiCall.invoke<CeimGenerateResponse>({
        url: '/api/v1/resqkit/ceim/generate',
        method: 'POST',
        data: {
          known_facts: buildKnownFactsFromIncident(incident),
          interview_answers: incident.interviewAnswers.map((a) => ({
            prompt_id: a.promptId,
            prompt_text: a.promptText,
            answer_text: a.answerText,
          })),
          content_pack_version: incident.contentPackVersion,
        },
      });

      updateIncident({
        ceimReport: res.data.ceim,
        ceimGeneratedAt: new Date().toISOString(),
        ceimDegraded: res.data.degraded,
      });
      void logCeimGenerated(incident, settings.realDataMode, res.data.ceim, logInstitutional, onSession);
      if (res.data.degraded) {
        toast.info('Report built from your answers directly — the AI summary was unavailable.');
      } else {
        toast.success('Report generated.');
      }
    } catch {
      // Never dead-end the emergency flow on an AI failure — proceed with
      // no report rather than trapping the user here.
      updateIncident({ ceimReport: null, ceimGeneratedAt: null, ceimDegraded: true });
      toast.error('Could not generate the report right now. You can continue without it.');
    } finally {
      clearTimeout(slowTimer);
      setGenerating(false);
      onDone();
    }
  };

  const next = () => {
    const trimmed = answerText.trim();
    if (trimmed) {
      const answer = { promptId: prompt.id, promptText: prompt.prompt, answerText: trimmed, answeredAt: new Date().toISOString() };
      updateIncident({ interviewAnswers: [...incident.interviewAnswers, answer] });
      void logInterviewAnswer(incident, settings.realDataMode, prompt.id, prompt.prompt, trimmed, logInstitutional, onSession);
    }
    setAnswerText('');
    if (isLast) {
      void generateReport();
    } else {
      setIndex((i) => i + 1);
    }
  };

  const skipInterview = () => {
    updateIncident({ interviewSkipped: true });
    onDone();
  };

  if (generating) {
    return (
      <View className="flex-1 items-center justify-center gap-4 p-6">
        <ActivityIndicator size="large" color={colors.primary} />
        <Text className="text-center text-base text-foreground">Building your report — this can take up to a minute.</Text>
        {showSkipGenerating && (
          <Button variant="secondary" onPress={onDone}>
            <Text className="text-sm font-medium text-secondary-foreground">Skip for now</Text>
          </Button>
        )}
      </View>
    );
  }

  return (
    <View className="flex-1 gap-4 p-4">
      <View className="flex-row items-center justify-between">
        <View className="flex-row items-center gap-1.5">
          <MessageCircleQuestion size={16} color={colors.primary} />
          <Text className="text-sm font-semibold text-foreground">A few quick questions</Text>
        </View>
        <Badge variant="secondary">{`${index + 1} / ${INTERVIEW_PROMPTS.length}`}</Badge>
      </View>
      <Text className="text-xs text-muted-foreground">
        Build a detailed, shareable scene report — in your own words. Skip any you can&apos;t answer. This
        stays on your phone until you choose to share it.
      </Text>

      <Card>
        <CardContent className="gap-3">
          <Text className="text-base font-medium text-foreground">{prompt.prompt}</Text>
          <TextInput
            value={answerText}
            onChangeText={setAnswerText}
            multiline
            numberOfLines={4}
            placeholder="Type your answer, or leave blank to skip"
            placeholderTextColor={colors.mutedForeground}
            className="min-h-[96px] rounded-md border border-input bg-background p-3 text-foreground"
            textAlignVertical="top"
          />
        </CardContent>
      </Card>

      <Button size="lg" onPress={next}>
        {isLast ? <Sparkles size={18} color={colors.primaryForeground} /> : <ChevronRight size={18} color={colors.primaryForeground} />}
        <Text className="text-base font-medium text-primary-foreground">
          {isLast ? 'Generate report' : 'Next'}
        </Text>
      </Button>
      <Button variant="ghost" onPress={skipInterview}>
        <Text className="text-sm text-muted-foreground">Skip interview, continue</Text>
      </Button>
    </View>
  );
};

export default InterviewStage;
