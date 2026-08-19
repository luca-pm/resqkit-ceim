/**
 * S12 — My Kits.
 *
 * Preparedness screen: register the kits you actually own, record what is
 * missing, and note when you last checked them. Kits are tied to an account so
 * they survive a browser wipe, which is the whole point of preparing in
 * advance. Browsing is possible without login; saving requires signing in.
 */

import React, { useCallback, useEffect, useState } from 'react';
import {
  Backpack,
  Check,
  Loader2,
  LogIn,
  Pencil,
  Plus,
  RefreshCw,
  Trash2,
  X,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { client } from '@/lib/api';
import { CONTEXTS, ContextId, kitItemByCode, kitItemsForContext } from '@/lib/knowledge';

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

const Kits: React.FC = () => {
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
      const response = await client.entities.registered_kits.query({ sort: '-updated_at' });
      setKits(((response.data as { items?: KitRecord[] })?.items ?? []) as KitRecord[]);
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
    <div className="space-y-5">
      <div>
        <h1>My Kits</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Check your kits while nothing is wrong. Knowing what is missing today is what stops you
          searching for it during an emergency.
        </p>
      </div>

      {authState === 'loading' && (
        <div className="flex items-center justify-center py-10">
          <Loader2 className="h-6 w-6 animate-spin text-primary" aria-hidden="true" />
        </div>
      )}

      {authState === 'anonymous' && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">Sign in to save your kits</CardTitle>
            <CardDescription>
              Kits are stored on your account so they survive clearing this browser. The emergency
              flow itself never requires an account.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={() => client.auth.toLogin()}>
              <LogIn className="mr-2 h-4 w-4" aria-hidden="true" />
              Sign in
            </Button>
          </CardContent>
        </Card>
      )}

      {authState === 'authenticated' && (
        <>
          <div className="flex flex-wrap gap-2">
            <Button
              onClick={() => {
                setDraft(emptyDraft);
                setEditingId(null);
                setFormOpen(true);
              }}
            >
              <Plus className="mr-2 h-4 w-4" aria-hidden="true" />
              Add a kit
            </Button>
            <Button variant="secondary" onClick={loadKits} disabled={loading}>
              {loading ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
              ) : (
                <RefreshCw className="mr-2 h-4 w-4" aria-hidden="true" />
              )}
              Refresh
            </Button>
          </div>

          {formOpen && (
            <Card className="border-primary/40">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg">
                  {editingId !== null ? 'Edit kit' : 'New kit'}
                </CardTitle>
                <CardDescription>
                  Tick only what is really inside. Anything unticked is recorded as missing.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label htmlFor="kitType">Environment</Label>
                    <select
                      id="kitType"
                      value={draft.kit_type}
                      onChange={(e) =>
                        setDraft((p) => ({ ...p, kit_type: e.target.value as ContextId, contents: [] }))
                      }
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                    >
                      {CONTEXTS.filter((c) => c.id !== 'other').map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="kitLabel">Name</Label>
                    <Input
                      id="kitLabel"
                      value={draft.label}
                      onChange={(e) => setDraft((p) => ({ ...p, label: e.target.value }))}
                      placeholder="Family car boot kit"
                    />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="kitWhere">Where it is kept</Label>
                  <Input
                    id="kitWhere"
                    value={draft.location_note}
                    onChange={(e) => setDraft((p) => ({ ...p, location_note: e.target.value }))}
                    placeholder="Under the boot floor, next to the spare wheel"
                  />
                </div>
                <div>
                  <Label className="mb-2 block">Contents</Label>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {kitItemsForContext(draft.kit_type).map((item) => {
                      const active = draft.contents.includes(item.code);
                      return (
                        <button
                          key={item.code}
                          type="button"
                          onClick={() => toggleContent(item.code)}
                          aria-pressed={active}
                          className={`flex items-start gap-2 rounded-md border p-2.5 text-left transition-colors ${
                            active ? 'border-primary bg-primary/10' : 'border-border bg-card hover:bg-accent'
                          }`}
                        >
                          <span
                            className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-sm border ${
                              active
                                ? 'border-primary bg-primary text-primary-foreground'
                                : 'border-border'
                            }`}
                          >
                            {active && <Check className="h-3.5 w-3.5" aria-hidden="true" />}
                          </span>
                          <span className="text-sm">{item.name}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button className="flex-1" onClick={save} disabled={saving}>
                    {saving ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
                    ) : (
                      <Check className="mr-2 h-4 w-4" aria-hidden="true" />
                    )}
                    Save kit
                  </Button>
                  <Button variant="secondary" onClick={resetForm}>
                    <X className="mr-2 h-4 w-4" aria-hidden="true" />
                    Cancel
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {error && (
            <Card className="border-destructive/50">
              <CardContent className="flex items-center justify-between gap-3 p-4">
                <p className="text-sm text-destructive">{error}</p>
                <Button size="sm" variant="secondary" onClick={loadKits}>
                  Retry
                </Button>
              </CardContent>
            </Card>
          )}

          {!loading && !error && kits.length === 0 && !formOpen && (
            <Card className="border-dashed">
              <CardContent className="p-6 text-center">
                <Backpack className="mx-auto h-8 w-8 text-muted-foreground" aria-hidden="true" />
                <p className="mt-3 font-semibold">No kits registered yet</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Start with the one in your car — it is the one you are most likely to need.
                </p>
              </CardContent>
            </Card>
          )}

          <div className="grid gap-3">
            {kits.map((kit) => {
              const contents = (kit.contents ?? '').split(',').filter(Boolean);
              const missing = (kit.missing_items ?? '').split(',').filter(Boolean);
              const ctx = CONTEXTS.find((c) => c.id === kit.kit_type);
              return (
                <Card key={kit.id}>
                  <CardContent className="space-y-3 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-semibold">{kit.label}</p>
                        <p className="text-sm text-muted-foreground">
                          {ctx?.label ?? kit.kit_type}
                          {kit.location_note ? ` · ${kit.location_note}` : ''}
                        </p>
                      </div>
                      <div className="flex shrink-0 gap-1.5">
                        <Button size="sm" variant="secondary" onClick={() => startEdit(kit)}>
                          <Pencil className="h-4 w-4" aria-hidden="true" />
                          <span className="sr-only">Edit {kit.label}</span>
                        </Button>
                        <Button size="sm" variant="destructive" onClick={() => remove(kit.id)}>
                          <Trash2 className="h-4 w-4" aria-hidden="true" />
                          <span className="sr-only">Delete {kit.label}</span>
                        </Button>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      <Badge variant="secondary">{contents.length} present</Badge>
                      {missing.length > 0 && (
                        <Badge variant="destructive">{missing.length} missing</Badge>
                      )}
                      {kit.last_checked && (
                        <Badge variant="secondary">
                          Checked {new Date(kit.last_checked).toLocaleDateString()}
                        </Badge>
                      )}
                    </div>
                    {missing.length > 0 && (
                      <p className="text-sm text-muted-foreground">
                        <span className="font-medium text-foreground">Buy or refill: </span>
                        {missing.map((c) => kitItemByCode(c)?.name ?? c).join(', ')}
                      </p>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
};

export default Kits;