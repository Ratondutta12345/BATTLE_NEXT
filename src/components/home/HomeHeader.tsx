import { Image } from 'expo-image';
import { SymbolView } from 'expo-symbols';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppHeaderColors } from '@/constants/theme';

const LOGO = require('@/assets/logo1.png');

type HomeHeaderProps = {
  coinBalance?: number;
  notificationCount?: number;
  onNotificationPress?: () => void;
  onCoinPress?: () => void;
};

export function HomeHeader({
  coinBalance = 0,
  notificationCount = 0,
  onNotificationPress,
  onCoinPress,
}: HomeHeaderProps) {
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.container, { paddingTop: insets.top + 10 }]}>
      <View style={styles.inner}>
        <View style={styles.leftSection}>
          <View style={styles.logoWrap}>
            <Image source={LOGO} style={styles.logo} contentFit="cover" />
          </View>

          <View style={styles.titleBlock}>
            <Text style={styles.welcomeText} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8} allowFontScaling={false}>
              Welcome Back
            </Text>
            <Text style={styles.appName} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.72} allowFontScaling={false}>
              BATTLE-NEXT
            </Text>
          </View>
        </View>

        <View style={styles.rightSection}>
          <Pressable
            onPress={onNotificationPress}
            style={styles.iconButton}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="Notifications"
          >
            <SymbolView
              name={{ android: 'notifications', ios: 'bell.fill' }}
              size={22}
              tintColor={AppHeaderColors.icon}
              fallback={<Text style={styles.iconFallback}>🔔</Text>}
            />
            {notificationCount > 0 ? (
              <View style={styles.badge} accessibilityLabel={`${notificationCount} unread notifications`} />
            ) : null}
          </Pressable>

          <Pressable onPress={onCoinPress} style={styles.coinPill} hitSlop={8} accessibilityRole="button" accessibilityLabel="Open wallet">
            <SymbolView
              name={{ android: 'monetization_on', ios: 'dollarsign.circle.fill' }}
              size={16}
              tintColor={AppHeaderColors.coinIcon}
              fallback={<Text style={styles.coinEmoji}>🪙</Text>}
            />
            <Text style={styles.coinText} numberOfLines={1}>
              {coinBalance}
            </Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: 'transparent',
    paddingHorizontal: 16,
    paddingBottom: 14,
  },
  inner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  leftSection: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    minWidth: 0,
    gap: 8,
  },
  logoWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    overflow: 'hidden',
    backgroundColor: AppHeaderColors.logoBackground,
    borderWidth: 1,
    borderColor: AppHeaderColors.logoBorder,
  },
  logo: {
    width: '100%',
    height: '100%',
  },
  titleBlock: {
    flex: 1,
    minWidth: 0,
    justifyContent: 'center',
    alignItems: 'center',
  },
  welcomeText: {
    color: AppHeaderColors.subtitle,
    fontSize: 10,
    fontWeight: '600',
    lineHeight: 15,
    includeFontPadding: false,
    textAlign: 'center',
  },
  appName: {
    color: AppHeaderColors.title,
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: 0.2,
    lineHeight: 21,
    marginTop: 1,
    includeFontPadding: false,
    textAlign: 'center',
  },
  rightSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexShrink: 0,
  },
  iconButton: {
    width: 34,
    height: 34,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconFallback: {
    fontSize: 18,
    color: AppHeaderColors.icon,
  },
  badge: {
    position: 'absolute',
    top: 3,
    right: 2,
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: AppHeaderColors.badge,
  },
  coinPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: AppHeaderColors.coinIcon,
    borderRadius: 16,
    paddingHorizontal: 10,
    paddingVertical: 6,
    gap: 4,
    maxWidth: 88,
  },
  coinEmoji: {
    color: AppHeaderColors.coinIcon,
    fontSize: 14,
  },
  coinText: {
    color: AppHeaderColors.coinIcon,
    fontSize: 14,
    fontWeight: '700',
  },
});
