import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { LogIn, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { client } from '@/lib/api';

const Login: React.FC = () => {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await client.auth.login(email, password);
      toast.success('Signed in.');
      navigate('/kits');
    } catch (err: unknown) {
      const e2 = err as { data?: { detail?: string }; message?: string };
      toast.error(e2?.data?.detail || e2?.message || 'Could not sign in.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="mx-auto max-w-sm space-y-5">
      <div>
        <h1>Sign in</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Sign in to archive incidents and manage your kits. The emergency flow itself never
          requires an account.
        </p>
      </div>
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">Account sign-in</CardTitle>
          <CardDescription>Local account, stored on this server's own database.</CardDescription>
        </CardHeader>
        <CardContent>
          <form className="space-y-4" onSubmit={submit}>
            <div className="space-y-1.5">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                required
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
            <Button type="submit" className="w-full" disabled={submitting}>
              {submitting ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
              ) : (
                <LogIn className="mr-2 h-4 w-4" aria-hidden="true" />
              )}
              Sign in
            </Button>
          </form>
          <p className="mt-4 text-center text-sm text-muted-foreground">
            No account yet?{' '}
            <Link to="/register" className="font-medium text-primary underline-offset-4 hover:underline">
              Create one
            </Link>
          </p>
        </CardContent>
      </Card>
    </div>
  );
};

export default Login;
