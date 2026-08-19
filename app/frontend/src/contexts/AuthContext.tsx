import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import { client, CurrentUser } from '@/lib/api';

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

  const refetch = useCallback(async () => {
    setLoading(true);
    try {
      const res = await client.auth.me();
      setUser(res?.data ?? null);
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refetch();
  }, [refetch]);

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
