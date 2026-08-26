/**
 * ResQKit AI — calls POST /api/v1/resqkit/chat (Section E5). History is
 * kept on-device only (AsyncStorage via lib/storage.ts), never persisted
 * server-side, matching the app's local-first ethos.
 */
import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, KeyboardAvoidingView, Platform, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { AlertTriangle, Send, Trash2 } from 'lucide-react-native';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { client } from '@/lib/apiClient';
import { ChatTurn, clearChatHistory, loadChatHistory, saveChatHistory } from '@/lib/storage';

export default function ChatScreen() {
  const { t } = useTranslation('chat');
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
              <Trash2 color="hsl(207 15% 40%)" size={16} />
            </Button>
          )}
        </View>

        <View className="mx-4 mb-2 flex-row items-start gap-2 rounded-md border border-emergency/40 bg-emergency/5 p-3">
          <AlertTriangle color="hsl(356 72% 48%)" size={16} />
          <Text className="flex-1 text-xs text-emergency">{t('disclaimer')}</Text>
        </View>

        <FlatList
          ref={listRef}
          data={turns}
          keyExtractor={(_, index) => String(index)}
          contentContainerClassName="gap-2 px-4 pb-4"
          ListEmptyComponent={
            <Card>
              <CardContent>
                <Text className="text-sm text-foreground">{t('greeting')}</Text>
              </CardContent>
            </Card>
          }
          renderItem={({ item }) => (
            <View className={`max-w-[85%] rounded-lg p-3 ${item.role === 'user' ? 'self-end bg-primary' : 'self-start bg-muted'}`}>
              <Text className={item.role === 'user' ? 'text-primary-foreground' : 'text-foreground'}>
                {item.content}
              </Text>
            </View>
          )}
        />

        {sending && (
          <View className="flex-row items-center gap-2 px-4 pb-2">
            <ActivityIndicator size="small" />
            <Text className="text-xs text-muted-foreground">{t('sending')}</Text>
          </View>
        )}

        <View className="flex-row items-center gap-2 border-t border-border p-3">
          <Input
            className="flex-1"
            value={input}
            onChangeText={setInput}
            placeholder={t('placeholder')}
            onSubmitEditing={() => void send()}
          />
          <Button size="sm" onPress={() => void send()} disabled={!input.trim() || sending}>
            <Send color="white" size={16} />
          </Button>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
