/**
 * S5b — My Kits (RN port of app/frontend/src/pages/Kits.tsx).
 *
 * Registered kits live in the user's account (not local-first like the
 * incident data), so this screen requires being signed in. Knowing what you
 * actually carry ahead of time is what lets the emergency wizard filter
 * guidance to real equipment instead of a generic checklist.
 */
import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Backpack, Check, LogIn, Pencil, Plus, Trash2 } from 'lucide-react-native';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from '@/components/ui/toast';
import { client } from '@/lib/apiClient';
import { CONTEXTS, ContextId, kitItemByCode, kitItemsForContext } from '@/lib/knowledge';
import { useTokenColors } from '@/lib/tokenColors';

interface KitRecord {
  id: number;
  kit_type: string;
  label: string;
  location_note?: string;
  contents?: string;
  missing_items?: string;
  last_checked?: string;
}

const emptyDraft = {
  kit_type: 'road' as ContextId,
  label: '',
  location_note: '',
  contents: [] as string[],
};

export default function KitsScreen() {
  const router = useRouter();
  const colors = useTokenColors();

  const [authState, setAuthState] = useState<'loading' | 'authenticated' | 'anonymous'>('loading');
  const [kits, setKits] = useState<KitRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [draft, setDraft] = useState(emptyDraft);
  const [formOpen, setFormOpen] = useState(false);

  const loadKits = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const response = await client.entities.registered_kits.query<{ items?: KitRecord[] }>({
        sort: '-updated_at',
      });
      setKits(response.data?.items ?? []);
    } catch (e: unknown) {
      const err = e as { data?: { detail?: string }; message?: string };
      setError(err?.data?.detail || err?.message || 'Could not load your kits.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    client.auth
      .me()
      .then((res) => {
        if (res?.data) {
          setAuthState('authenticated');
          void loadKits();
        } else {
          setAuthState('anonymous');
        }
      })
      .catch(() => setAuthState('anonymous'));
  }, [loadKits]);

  const resetForm = () => {
    setDraft(emptyDraft);
    setEditingId(null);
    setFormOpen(false);
  };

  const startEdit = (kit: KitRecord) => {
    setEditingId(kit.id);
    setDraft({
      kit_type: (kit.kit_type as ContextId) || 'road',
      label: kit.label,
      location_note: kit.location_note ?? '',
      contents: (kit.contents ?? '').split(',').filter(Boolean),
    });
    setFormOpen(true);
  };

  const toggleContent = (code: string) => {
    setDraft((prev) => ({
      ...prev,
      contents: prev.contents.includes(code)
        ? prev.contents.filter((c) => c !== code)
        : [...prev.contents, code],
    }));
  };

  const save = async () => {
    if (!draft.label.trim()) {
      toast.error('Give the kit a name so you can recognise it later.');
      return;
    }
    setSaving(true);
    const expected = kitItemsForContext(draft.kit_type).map((i) => i.code);
    const payload = {
      kit_type: draft.kit_type,
      label: draft.label.trim(),
      location_note: draft.location_note.trim(),
      contents: draft.contents.join(','),
      missing_items: expected.filter((c) => !draft.contents.includes(c)).join(','),
      last_checked: new Date().toISOString(),
    };
    try {
      if (editingId !== null) {
        await client.entities.registered_kits.update({ id: String(editingId), data: payload });
        toast.success('Kit updated.');
      } else {
        await client.entities.registered_kits.create({ data: payload });
        toast.success('Kit saved.');
      }
      resetForm();
      await loadKits();
    } catch (e: unknown) {
      const err = e as { data?: { detail?: string }; message?: string };
      toast.error(err?.data?.detail || err?.message || 'Could not save this kit.');
    } finally {
      setSaving(false);
    }
  };

  const remove = async (id: number) => {
    try {
      await client.entities.registered_kits.delete({ id: String(id) });
      toast.success('Kit deleted.');
      setKits((prev) => prev.filter((k) => k.id !== id));
    } catch (e: unknown) {
      const err = e as { data?: { detail?: string }; message?: string };
      toast.error(err?.data?.detail || err?.message || 'Could not delete this kit.');
    }
  };

  return (
    <ScrollView className="flex-1 bg-background" contentContainerClassName="gap-5 p-4 pb-10">
      <View>
        <View className="flex-row items-center gap-2">
          <Backpack size={22} color={colors.primary} />
          <Text className="text-2xl font-bold text-foreground">My Kits</Text>
        </View>
        <Text className="mt-2 text-sm text-muted-foreground">
          Record what you actually carry, so guidance during an incident is filtered to real
          equipment. Kits are stored in your account, not on this device.
        </Text>
      </View>

      {authState === 'loading' && (
        <View className="items-center py-8">
          <ActivityIndicator color={colors.primary} />
        </View>
      )}

      {authState === 'anonymous' && (
        <Card>
          <CardContent className="gap-3">
            <Text className="text-sm text-muted-foreground">
              Registered kits are tied to your account. Sign in to add one — the emergency flow works
              fully without this.
            </Text>
            <Button variant="secondary" onPress={() => router.push('/sign-in')}>
              <LogIn size={16} color={colors.secondaryForeground} />
              <Text className="text-sm font-medium text-secondary-foreground">Sign in</Text>
            </Button>
          </CardContent>
        </Card>
      )}

      {authState === 'authenticated' && (
        <>
          {error !== '' && (
            <Card className="border-destructive/50">
              <CardContent className="flex-row items-center justify-between gap-3">
                <Text className="flex-1 text-sm text-destructive">{error}</Text>
                <Button size="sm" variant="secondary" onPress={loadKits}>
                  Retry
                </Button>
              </CardContent>
            </Card>
          )}

          {!formOpen && (
            <Button onPress={() => setFormOpen(true)}>
              <Plus size={18} color={colors.primaryForeground} />
              <Text className="text-sm font-medium text-primary-foreground">Add a kit</Text>
            </Button>
          )}

          {formOpen && (
            <Card>
              <CardContent className="gap-4">
                <Text className="font-semibold text-foreground">
                  {editingId !== null ? 'Edit kit' : 'New kit'}
                </Text>

                <View className="gap-1.5">
                  <Label>Where is it used?</Label>
                  <View className="flex-row flex-wrap gap-2">
                    {CONTEXTS.map((ctx) => {
                      const active = draft.kit_type === ctx.id;
                      return (
                        <Pressable
                          key={ctx.id}
                          onPress={() =>
                            setDraft((p) => ({ ...p, kit_type: ctx.id, contents: [] }))
                          }
                          className={`rounded-md border px-3 py-2 ${
                            active ? 'border-primary bg-primary/10' : 'border-border bg-card'
                          }`}
                        >
                          <Text
                            className={`text-sm ${active ? 'font-medium text-foreground' : 'text-muted-foreground'}`}
                          >
                            {ctx.label}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>
                </View>

                <View className="gap-1.5">
                  <Label>Name</Label>
                  <Input
                    value={draft.label}
                    onChangeText={(t) => setDraft((p) => ({ ...p, label: t }))}
                    placeholder="e.g. Car boot kit"
                    placeholderTextColor={colors.mutedForeground}
                  />
                </View>

                <View className="gap-1.5">
                  <Label>Where do you keep it?</Label>
                  <Input
                    value={draft.location_note}
                    onChangeText={(t) => setDraft((p) => ({ ...p, location_note: t }))}
                    placeholder="e.g. Under the boot floor"
                    placeholderTextColor={colors.mutedForeground}
                  />
                </View>

                <View className="gap-1.5">
                  <Label>What is in it?</Label>
                  <View className="gap-2">
                    {kitItemsForContext(draft.kit_type).map((item) => {
                      const active = draft.contents.includes(item.code);
                      return (
                        <Pressable
                          key={item.code}
                          onPress={() => toggleContent(item.code)}
                          accessibilityRole="checkbox"
                          accessibilityState={{ checked: active }}
                          className={`flex-row items-center gap-2 rounded-md border p-2.5 ${
                            active ? 'border-primary bg-primary/10' : 'border-border bg-card'
                          }`}
                        >
                          <View
                            className={`h-5 w-5 items-center justify-center rounded-sm border ${
                              active ? 'border-primary bg-primary' : 'border-border'
                            }`}
                          >
                            {active && <Check size={14} color={colors.primaryForeground} />}
                          </View>
                          <Text className="flex-1 text-sm text-foreground">{item.name}</Text>
                        </Pressable>
                      );
                    })}
                  </View>
                </View>

                <View className="gap-2">
                  <Button onPress={save} disabled={saving} loading={saving}>
                    {editingId !== null ? 'Save changes' : 'Save kit'}
                  </Button>
                  <Button variant="secondary" onPress={resetForm}>
                    Cancel
                  </Button>
                </View>
              </CardContent>
            </Card>
          )}

          {loading && (
            <View className="items-center py-6">
              <ActivityIndicator color={colors.primary} />
            </View>
          )}

          {!loading && kits.length === 0 && !formOpen && (
            <Text className="text-sm text-muted-foreground">
              No kits registered yet. Add the one in your car or your bag.
            </Text>
          )}

          <View className="gap-3">
            {kits.map((kit) => {
              const ctx = CONTEXTS.find((c) => c.id === kit.kit_type);
              const contents = (kit.contents ?? '').split(',').filter(Boolean);
              const missing = (kit.missing_items ?? '').split(',').filter(Boolean);
              return (
                <Card key={kit.id}>
                  <CardContent className="gap-2">
                    <View className="flex-row items-start justify-between gap-2">
                      <View className="flex-1">
                        <Text className="font-semibold text-foreground">{kit.label}</Text>
                        <Text className="text-xs text-muted-foreground">
                          {ctx?.label ?? kit.kit_type}
                          {kit.location_note ? ` · ${kit.location_note}` : ''}
                        </Text>
                      </View>
                      <View className="flex-row gap-2">
                        <Button size="sm" variant="secondary" onPress={() => startEdit(kit)}>
                          <Pencil size={16} color={colors.secondaryForeground} />
                        </Button>
                        <Button size="sm" variant="destructive" onPress={() => remove(kit.id)}>
                          <Trash2 size={16} color={colors.destructiveForeground} />
                        </Button>
                      </View>
                    </View>

                    <View className="flex-row flex-wrap gap-1.5">
                      <Badge variant="secondary">{`${contents.length} present`}</Badge>
                      {missing.length > 0 && (
                        <Badge variant="destructive">{`${missing.length} missing`}</Badge>
                      )}
                    </View>

                    {missing.length > 0 && (
                      <Text className="text-xs text-muted-foreground">
                        Missing: {missing.map((c) => kitItemByCode(c)?.name ?? c).join(', ')}
                      </Text>
                    )}

                    {kit.last_checked && (
                      <Text className="text-xs text-muted-foreground">
                        {`Checked ${new Date(kit.last_checked).toLocaleDateString()}`}
                      </Text>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </View>
        </>
      )}
    </ScrollView>
  );
}
