import { Stack, useRouter, useSegments, type Href } from 'expo-router';
import { useEffect } from 'react';
import { Linking, Platform } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { AuthProvider } from '@/context/AuthContext';
import { AuthColors } from '@/constants/theme';
import { useAuth } from '@/context/AuthContext';
import { PushNotificationSetup } from '@/components/PushNotificationSetup';
import { getNativeNotifications } from '@/utils/nativeNotifications';

function NotificationObserver() {
  const router = useRouter();

  useEffect(() => {
    let notifications: ReturnType<typeof getNativeNotifications>;
    try {
      notifications = getNativeNotifications();
    } catch (error) {
      console.warn('Native notification listeners are unavailable in this build.', error);
      return undefined;
    }
    if (!notifications) return undefined;
    let active = true;
    const openLink = (value: unknown) => {
      if (typeof value !== 'string' || !value) return;
      if (value.startsWith('/') && !value.startsWith('//')) {
        router.push(value as Href);
        return;
      }
      if (value.startsWith('myapp://')) {
        const parsed = new URL(value);
        router.push(`${parsed.host ? `/${parsed.host}` : ''}${parsed.pathname}${parsed.search}` as Href);
        return;
      }
      if (/^https?:\/\//i.test(value)) void Linking.openURL(value);
    };

    notifications.getLastNotificationResponseAsync().then((response) => {
      if (!active || !response) return;
      openLink(response.notification.request.content.data?.url);
      void notifications.clearLastNotificationResponseAsync();
    });
    const subscription = notifications.addNotificationResponseReceivedListener((response) => {
      openLink(response.notification.request.content.data?.url);
    });

    return () => {
      active = false;
      subscription.remove();
    };
  }, [router]);

  return null;
}

function AuthGate() {
  const { user, isReady } = useAuth();
  const router = useRouter();
  const segments = useSegments();

  useEffect(() => {
    const route = segments[0];
    if (!isReady || !route) return;

    const publicRoute = route === 'login' || route === 'signup';
    if (user && publicRoute) router.replace('/home');
    else if (!user && !publicRoute) router.replace('/login');
  }, [segments, user, isReady, router]);

  return null;
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <AuthGate />
        <PushNotificationSetup />
        <NotificationObserver />
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
