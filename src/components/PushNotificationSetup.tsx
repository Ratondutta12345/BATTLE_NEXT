import { useEffect } from 'react';
import Constants from 'expo-constants';
import * as Device from 'expo-device';
import { Platform } from 'react-native';

import { API_ENDPOINTS, apiRequest } from '@/constants/api';
import { useAuth } from '@/context/AuthContext';
import { getNativeNotifications } from '@/utils/nativeNotifications';

export function PushNotificationSetup() {
  const { user } = useAuth();

  useEffect(() => {
    if (!user || Platform.OS === 'web' || !Device.isDevice) return undefined;
    let notifications: ReturnType<typeof getNativeNotifications>;
    try {
      notifications = getNativeNotifications();
    } catch (error) {
      console.warn('Push notifications are unavailable in this native build.', error);
      return undefined;
    }
    if (!notifications) return undefined;
    const userId = user.id;
    let active = true;
    let registeredToken: string | null = null;

    async function registerDevice() {
      try {
        notifications.setNotificationHandler({
          handleNotification: async () => ({
            shouldShowBanner: true,
            shouldShowList: true,
            shouldPlaySound: true,
            shouldSetBadge: true,
            priority: notifications.AndroidNotificationPriority.HIGH,
          }),
        });
        if (Platform.OS === 'android') {
          await notifications.setNotificationChannelAsync('high_importance_channel', {
            name: 'Game alerts',
            importance: Notifications.AndroidImportance.MAX,
            vibrationPattern: [0, 250, 250, 250],
            lightColor: '#F7941D',
            sound: 'default',
          });
        }

        let permission = await notifications.getPermissionsAsync();
        if (!permission.granted) permission = await notifications.requestPermissionsAsync();
        if (!permission.granted || !active) return;

        let token: string;
        let provider: 'fcm' | 'expo';
        if (Platform.OS === 'android') {
          token = (await notifications.getDevicePushTokenAsync()).data;
          provider = 'fcm';
        } else {
          const projectId = Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
          if (!projectId) throw new Error('Expo project ID is missing.');
          token = (await notifications.getExpoPushTokenAsync({ projectId })).data;
          provider = 'expo';
        }
        if (!active) return;

        const result = await apiRequest<{ ok: boolean }>(API_ENDPOINTS.registerPushToken, {
          method: 'POST',
          body: JSON.stringify({ userId, token, platform: Platform.OS, provider }),
        });
        if (!result.ok) throw new Error(result.error);
        if (active) registeredToken = token;
        else {
          await apiRequest(API_ENDPOINTS.unregisterPushToken, {
            method: 'POST',
            body: JSON.stringify({ userId, token }),
          });
        }
      } catch (error) {
        console.warn('Push notification registration failed.', error);
      }
    }

    void registerDevice();
    return () => {
      active = false;
      if (registeredToken) {
        void apiRequest(API_ENDPOINTS.unregisterPushToken, {
          method: 'POST',
          body: JSON.stringify({ userId, token: registeredToken }),
        });
      }
    };
  }, [user?.id]);

  return null;
}
