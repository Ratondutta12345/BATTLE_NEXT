import Constants, { AppOwnership } from 'expo-constants';
import { Platform } from 'react-native';

type NotificationsModule = typeof import('expo-notifications');

export function getNativeNotifications(): NotificationsModule | null {
  if (Platform.OS === 'web' || (Platform.OS === 'android' && Constants.appOwnership === AppOwnership.Expo)) {
    return null;
  }
  return require('expo-notifications') as NotificationsModule;
}
