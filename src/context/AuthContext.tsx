import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

import { API_ENDPOINTS, apiRequest, type AuthUser } from '@/constants/api';

type AuthContextValue = {
  user: AuthUser | null;
  setUser: (user: AuthUser | null) => void;
  signOut: () => void;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);

  const signOut = useCallback(() => {
    setUser(null);
  }, []);

  useEffect(() => {
    if (!user) return undefined;
    let active = true;
    const checkBlockedStatus = async () => {
      const result = await apiRequest<{ user: AuthUser }>(API_ENDPOINTS.userProfile(user.id));
      if (active && result.ok && result.data.user.isBlocked) setUser(null);
    };
    void checkBlockedStatus();
    const interval = setInterval(() => { void checkBlockedStatus(); }, 5000);
    return () => { active = false; clearInterval(interval); };
  }, [user]);

  const value = useMemo(
    () => ({
      user,
      setUser,
      signOut,
    }),
    [user, signOut],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
}
