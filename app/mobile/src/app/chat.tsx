/**
 * ResQKit AI — calls POST /api/v1/resqkit/chat (Section E5). History is
 * kept on-device only (AsyncStorage via lib/storage.ts), never persisted
 * server-side, matching the app's local-first ethos.
 */
import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import {
  AlertTriangle,
  Backpack,
  ChevronRight,
  Flame,
  MessageCircleQuestion,
  Send,
  Sparkles,
  Stethoscope,
  Trash2,
} from 'lucide-react-native';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { client } from '@/lib/apiClient';
import {
  ChatTurn,
  clearChatHistory,
  loadChatHistory,
  saveChatHistory,
} from '@/lib/storage';
import { useTokenColors } from '@/lib/tokenColors';

// Ported from Alexandra's QuickActionsSection — four canned prompts that run
// through the exact same real send pipeline as typed text, not a mock. Her
// fourth prompt ("check ResQKit device status") has no equivalent here (no
// hardware), so it's swapped for a kit-prep question instead.
const QUICK_ACTIONS = [
  {
    icon: Flame,
    label: 'How do I treat a burn?',
    prompt: 'How do I treat a burn?',
  },
  {
    icon: Stethoscope,
    label: 'First-aid basics',
    prompt: 'What are the first-aid basics everyone should know?',
  },
  {
    icon: Backpack,
    label: 'What should be in my kit?',
    prompt: 'What should be in my first-aid kit?',
  },
  {
    icon: MessageCircleQuestion,
    label: 'I have a question about ResQKit',
    prompt: 'I have a question about how ResQKit works.',
  },
];

export default function ChatScreen() {
  const { t } = useTranslation('chat');
  const colors = useTokenColors();
  const [turns, setTurns] = useState<ChatTurn[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const listRef = useRef<FlatList>(null);

  useEffect(() => {
    void loadChatHistory().then(setTurns);
  }, []);

  const send = async (override?: string) => {
    const text = (override ?? input).trim();
    if (!text || sending) return;
    setInput('');
    const next: ChatTurn[] = [...turns, { role: 'user', content: text }];
    setTurns(next);
    void saveChatHistory(next);
    setSending(true);
    try {
      const res = await client.apiCall.invoke<{
        reply: string;
        degraded: boolean;
        model: string;
      }>({
        url: '/api/v1/resqkit/chat',
        method: 'POST',
        data: { messages: next },
      });
      const withReply: ChatTurn[] = [
        ...next,
        { role: 'assistant', content: res.data.reply },
      ];
      setTurns(withReply);
      void saveChatHistory(withReply);
    } catch {
      const withReply: ChatTurn[] = [
        ...next,
        { role: 'assistant', content: t('error') },
      ];
      setTurns(withReply);
      void saveChatHistory(withReply);
    } finally {
      setSending(false);
      setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100);
    }
  };

  const clear = () => {
    setTurns([]);
    void clearChatHistory();
  };

  return (
    <SafeAreaView className="flex-1 bg-background" edges={['top']}>
      <KeyboardAvoidingView
        className="flex-1"
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View className="flex-row items-center justify-between px-4 py-3">
          <Text className="text-xl font-bold text-foreground">
            {t('title')}
          </Text>
          {turns.length > 0 && (
            <Button variant="ghost" size="sm" onPress={clear}>
              <Trash2 color={colors.mutedForeground} size={16} />
            </Button>
          )}
        </View>

        <View className="mx-4 mb-2 flex-row items-start gap-2 rounded-md border border-emergency/40 bg-emergency/5 p-3">
          <AlertTriangle color={colors.emergency} size={16} />
          <Text className="flex-1 text-xs text-emergency">
            {t('disclaimer')}
          </Text>
        </View>

        <FlatList
          ref={listRef}
          data={turns}
          keyExtractor={(_, index) => String(index)}
          contentContainerClassName="gap-2 px-4 pb-4"
          ListEmptyComponent={
            <View className="gap-6 px-4 pt-16">
              <View className="items-center gap-3 px-4">
                <View className="h-16 w-16 items-center justify-center rounded-full bg-primary-tint">
                  <Sparkles color={colors.primary} size={28} />
                </View>
                <Text className="text-center text-lg font-bold text-foreground">
                  {t('title')}
                </Text>
                <Text className="text-center text-sm text-muted-foreground">
                  {t('greeting')}
                </Text>
              </View>

              {/* Ported from Alexandra's QuickActionsSection — canned prompts
                  that run through the real send pipeline below. */}
              <View className="gap-3">
                <Text className="text-base font-bold text-foreground">
                  Quick suggestions
                </Text>
                {QUICK_ACTIONS.map((action) => (
                  <Pressable
                    key={action.label}
                    onPress={() => void send(action.prompt)}
                    disabled={sending}
                  >
                    <Card>
                      <CardContent className="flex-row items-center gap-3">
                        <View className="h-11 w-11 items-center justify-center rounded-md bg-primary-tint">
                          <action.icon size={22} color={colors.primary} />
                        </View>
                        <Text className="flex-1 font-semibold text-foreground">
                          {action.label}
                        </Text>
                        <ChevronRight
                          size={18}
                          color={colors.mutedForeground}
                        />
                      </CardContent>
                    </Card>
                  </Pressable>
                ))}
              </View>
            </View>
          }
          renderItem={({ item }) => {
            const isUser = item.role === 'user';
            // Matches Alexandra's AIChatBubble exactly: flat (no shadow),
            // solid primary for the user side vs. a light primary tint for
            // the assistant side, with the "tail" corner (bottom-right for
            // user, bottom-left for assistant) squared to 4px against an
            // otherwise 16px radius — her src/components/ai/aiChatBubble.styles.js.
            return (
              <Card
                className={`max-w-[85%] rounded-2xl border-0 p-3 ${
                  isUser
                    ? 'self-end rounded-br-[4px] bg-primary'
                    : 'self-start rounded-bl-[4px] bg-primary/15'
                }`}
              >
                <Text
                  className={
                    isUser ? 'text-primary-foreground' : 'text-foreground'
                  }
                >
                  {item.content}
                </Text>
              </Card>
            );
          }}
        />

        {sending && (
          <View className="flex-row items-center gap-2 px-4 pb-2">
            <ActivityIndicator size="small" />
            <Text className="text-xs text-muted-foreground">
              {t('sending')}
            </Text>
          </View>
        )}

        <View className="px-4 pb-3 pt-1">
          <Card
            elevated
            className="flex-row items-center gap-2 rounded-full border-0 bg-card py-1.5 pl-4 pr-1.5"
          >
            <Input
              className="h-10 flex-1 border-0 bg-transparent px-0"
              value={input}
              onChangeText={setInput}
              placeholder={t('placeholder')}
              onSubmitEditing={() => void send()}
            />
            <Button
              size="sm"
              onPress={() => void send()}
              disabled={!input.trim() || sending}
              className="h-9 w-9 rounded-full p-0"
            >
              <Send color={colors.primaryForeground} size={16} />
            </Button>
          </Card>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
