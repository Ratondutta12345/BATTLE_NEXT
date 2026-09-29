import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

import { API_ENDPOINTS, apiRequest, type AuthUser } from '@/constants/api';

const AUTH_USER_KEY = 'authenticated-user';

async function readStoredUser() {
  if (Platform.OS === 'web') {
    return typeof window === 'undefined' ? null : window.localStorage.getItem(AUTH_USER_KEY);
  }
  return SecureStore.getItemAsync(AUTH_USER_KEY);
}

async function writeStoredUser(user: AuthUser | null) {
  if (Platform.OS === 'web') {
    if (typeof window === 'undefined') return;
    if (user) window.localStorage.setItem(AUTH_USER_KEY, JSON.stringify(user));
    else window.localStorage.removeItem(AUTH_USER_KEY);
    return;
  }

  if (user) await SecureStore.setItemAsync(AUTH_USER_KEY, JSON.stringify(user));
  else await SecureStore.deleteItemAsync(AUTH_USER_KEY);
}

function isAuthUser(value: unknown): value is AuthUser {
  return typeof value === 'object' && value !== null &&
    'id' in value && typeof value.id === 'number' && value.id > 0 &&
    'username' in value && typeof value.username === 'string';
}

type AuthContextValue = {
  user: AuthUser | null;
  isReady: boolean;
  setUser: (user: AuthUser | null) => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUserState] = useState<AuthUser | null>(null);
  const [isReady, setIsReady] = useState(false);

  const setUser = useCallback(async (nextUser: AuthUser | null) => {
    setUserState(nextUser);
    try {
      await writeStoredUser(nextUser);
    } catch (error) {
      console.warn('Could not update the saved login session.', error);
    }
  }, []);

  const signOut = useCallback(async () => {
    await setUser(null);
  }, [setUser]);

  useEffect(() => {
    let active = true;

    const restoreUser = async () => {
      try {
        const storedUser = await readStoredUser();
        if (!storedUser) return;

        const parsedUser: unknown = JSON.parse(storedUser);
        if (!isAuthUser(parsedUser)) {
          await writeStoredUser(null);
          return;
        }

        let restoredUser = parsedUser;
        try {
          const response = await fetch(API_ENDPOINTS.userProfile(parsedUser.id));
          if (response.status === 401 || response.status === 403 || response.status === 404) {
            await writeStoredUser(null);
            return;
          }
          if (response.ok) {
            const result: { user?: unknown } = await response.json();
            if (!isAuthUser(result.user) || result.user.isBlocked) {
              await writeStoredUser(null);
              return;
            }
            restoredUser = result.user;
            await writeStoredUser(restoredUser);
          }
        } catch {
          // Keep the saved session when the backend is temporarily unreachable.
        }

        if (active) setUserState((currentUser) => currentUser ?? restoredUser);
      } catch {
        await writeStoredUser(null).catch(() => {});
      } finally {
        if (active) setIsReady(true);
      }
    };

    void restoreUser();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!user) return undefined;
    let active = true;
    const checkBlockedStatus = async () => {
      const result = await apiRequest<{ user: AuthUser }>(API_ENDPOINTS.userProfile(user.id));
      if (active && result.ok && result.data.user.isBlocked) await setUser(null);
    };
    void checkBlockedStatus();
    const interval = setInterval(() => { void checkBlockedStatus(); }, 5000);
    return () => { active = false; clearInterval(interval); };
  }, [user, setUser]);

  const value = useMemo(
    () => ({
      user,
      isReady,
      setUser,
      signOut,
    }),
    [user, isReady, setUser, signOut],
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
