/**
 * ResQKit AI — calls POST /api/v1/resqkit/chat (Section E5). History is
 * kept on-device only (AsyncStorage via lib/storage.ts), never persisted
 * server-side, matching the app's local-first ethos.
 */
import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, KeyboardAvoidingView, Platform, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { AlertTriangle, Send, Sparkles, Trash2 } from 'lucide-react-native';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { client } from '@/lib/apiClient';
import { ChatTurn, clearChatHistory, loadChatHistory, saveChatHistory } from '@/lib/storage';
import { useTokenColors } from '@/lib/tokenColors';

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

  const send = async () => {
    const text = input.trim();
    if (!text || sending) return;
    setInput('');
    const next: ChatTurn[] = [...turns, { role: 'user', content: text }];
    setTurns(next);
    void saveChatHistory(next);
    setSending(true);
    try {
      const res = await client.apiCall.invoke<{ reply: string; degraded: boolean; model: string }>({
        url: '/api/v1/resqkit/chat',
        method: 'POST',
        data: { messages: next },
      });
      const withReply: ChatTurn[] = [...next, { role: 'assistant', content: res.data.reply }];
      setTurns(withReply);
      void saveChatHistory(withReply);
    } catch {
      const withReply: ChatTurn[] = [...next, { role: 'assistant', content: t('error') }];
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
      <KeyboardAvoidingView className="flex-1" behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View className="flex-row items-center justify-between px-4 py-3">
          <Text className="text-xl font-bold text-foreground">{t('title')}</Text>
          {turns.length > 0 && (
            <Button variant="ghost" size="sm" onPress={clear}>
              <Trash2 color={colors.mutedForeground} size={16} />
            </Button>
          )}
        </View>

        <View className="mx-4 mb-2 flex-row items-start gap-2 rounded-md border border-emergency/40 bg-emergency/5 p-3">
          <AlertTriangle color={colors.emergency} size={16} />
          <Text className="flex-1 text-xs text-emergency">{t('disclaimer')}</Text>
        </View>

        <FlatList
          ref={listRef}
          data={turns}
          keyExtractor={(_, index) => String(index)}
          contentContainerClassName="gap-2 px-4 pb-4"
          ListEmptyComponent={
            <View className="items-center gap-3 px-8 pt-16">
              <View className="h-16 w-16 items-center justify-center rounded-full bg-primary-tint">
                <Sparkles color={colors.primary} size={28} />
              </View>
              <Text className="text-center text-lg font-bold text-foreground">{t('title')}</Text>
              <Text className="text-center text-sm text-muted-foreground">{t('greeting')}</Text>
            </View>
          }
          renderItem={({ item }) => {
            const isUser = item.role === 'user';
            return (
              <Card
                elevated={!isUser}
                className={`max-w-[85%] rounded-2xl border-0 p-3 ${isUser ? 'self-end bg-primary' : 'self-start bg-muted'}`}
              >
                <Text className={isUser ? 'text-primary-foreground' : 'text-foreground'}>{item.content}</Text>
              </Card>
            );
          }}
        />

        {sending && (
          <View className="flex-row items-center gap-2 px-4 pb-2">
            <ActivityIndicator size="small" />
            <Text className="text-xs text-muted-foreground">{t('sending')}</Text>
          </View>
        )}

        <View className="px-4 pb-3 pt-1">
          <Card elevated className="flex-row items-center gap-2 rounded-full border-0 bg-card py-1.5 pl-4 pr-1.5">
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
