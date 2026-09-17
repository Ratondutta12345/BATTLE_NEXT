import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';

import { AuthColors, AuthSizes } from '@/constants/theme';

type GoogleLoginButtonProps = {
  onPress?: () => void;
};

function GoogleLogo() {
  return (
    <View style={styles.logoContainer}>
      <Text style={styles.logoText}>G</Text>
    </View>
  );
}

export function GoogleLoginButton({ onPress }: GoogleLoginButtonProps) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.button, pressed && styles.buttonPressed]}
      accessibilityRole="button"
      accessibilityLabel="Login with Google"
    >
      <GoogleLogo />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    width: AuthSizes.googleButtonSize,
    height: AuthSizes.googleButtonSize,
    borderRadius: AuthSizes.googleButtonSize / 2,
    backgroundColor: AuthColors.background,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    ...Platform.select({
      ios: {
        shadowColor: AuthColors.shadow,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.12,
        shadowRadius: 6,
      },
      android: {
        elevation: 3,
      },
      default: {},
    }),
  },
  buttonPressed: {
    opacity: 0.85,
  },
  logoContainer: {
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoText: {
    fontSize: 22,
    fontWeight: '700',
    color: '#4285F4',
    fontFamily: Platform.select({ ios: 'System', android: 'sans-serif-medium', default: 'sans-serif' }),
  },
});
