import { Stack, useRouter, useSegments } from 'expo-router';
import { useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { AuthProvider } from '@/context/AuthContext';
import { AuthColors } from '@/constants/theme';
import { useAuth } from '@/context/AuthContext';

function AuthGate() {
  const { user } = useAuth();
  const router = useRouter();
  const segments = useSegments();

  useEffect(() => {
    const route = segments[0];
    const publicRoute = route === 'login' || route === 'signup' || route === 'index';
    if (!user && route && !publicRoute) router.replace('/login');
  }, [segments, user, router]);

  return null;
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <AuthGate />
        <StatusBar style="dark" />
        <Stack
          screenOptions={{
            headerShown: false,
            contentStyle: { backgroundColor: AuthColors.background },
            animation: 'slide_from_right',
          }}
        />
      </AuthProvider>
    </SafeAreaProvider>
  );
}
