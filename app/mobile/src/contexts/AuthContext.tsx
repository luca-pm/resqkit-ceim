import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import { client, CurrentUser } from '@/lib/apiClient';

interface AuthContextType {
  user: CurrentUser | null;
  loading: boolean;
  isAdmin: boolean;
  refetch: () => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [loading, setLoading] = useState(true);

  // fetchMe does the actual work; refetch additionally resets `loading` to
  // true first, which is only safe to do synchronously from an event
  // handler (e.g. after login), not from the mount effect below — `loading`
  // already starts true via useState, so the effect calls fetchMe directly.
  const fetchMe = useCallback(async () => {
    try {
      const res = await client.auth.me();
      setUser(res?.data ?? null);
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  const refetch = useCallback(async () => {
    setLoading(true);
    await fetchMe();
  }, [fetchMe]);

  useEffect(() => {
    // react-hooks/set-state-in-effect flags any effect that calls a function
    // it can trace to an eventual setState, even async ones — this is the
    // standard "fetch on mount" pattern React's own docs endorse, not the
    // synchronous-derived-state anti-pattern the rule targets.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void fetchMe();
  }, [fetchMe]);

  const logout = useCallback(async () => {
    await client.auth.logout();
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, isAdmin: user?.role === 'admin', refetch, logout }}>
      {children}
    </AuthContext.Provider>
  );
};
