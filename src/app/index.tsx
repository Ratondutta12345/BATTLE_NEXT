import { Redirect } from 'expo-router';
import { Image } from 'expo-image';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { useAuth } from '@/context/AuthContext';
import { AuthColors } from '@/constants/theme';

const LOGO = require('@/assets/logo1.png');

export default function Index() {
  const { user, isReady } = useAuth();
  if (!isReady) {
    return (
      <View style={styles.loadingScreen}>
        <Image source={LOGO} style={styles.logo} contentFit="contain" />
        <ActivityIndicator color={AuthColors.primary} />
      </View>
    );
  }

  return <Redirect href={user ? '/home' : '/login'} />;
}

const styles = StyleSheet.create({
  loadingScreen: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 20,
    backgroundColor: AuthColors.background,
  },
  logo: {
    width: 140,
    height: 140,
  },
});
