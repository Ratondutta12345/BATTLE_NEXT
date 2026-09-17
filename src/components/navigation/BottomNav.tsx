import { SymbolView } from 'expo-symbols';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { usePathname, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppHeaderColors, AuthColors } from '@/constants/theme';

const tabs = [
  { label: 'Home', icon: 'home', route: '/home' as const },
  { label: 'Money', icon: 'account_balance_wallet', route: '/wallet' as const },
  { label: 'History', icon: 'history', route: '/history' as const },
  { label: 'Me', icon: 'person', route: '/profile' as const },
];

export function BottomNav() {
  const pathname = usePathname();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  return <View style={[styles.container, { paddingBottom: Math.max(insets.bottom, 8) }]}>
    {tabs.map((tab) => {
      const active = pathname === tab.route || (tab.route === '/home' && pathname === '/');
      return <Pressable key={tab.route} style={styles.tab} onPress={() => router.replace(tab.route)} accessibilityRole="button" accessibilityLabel={tab.label}>
        <SymbolView name={{ android: tab.icon as never, ios: tab.icon as never }} size={22} tintColor={active ? AuthColors.primary : '#B8C5D9'} fallback={<Text style={styles.fallback}>•</Text>} />
        <Text style={[styles.label, active && styles.activeLabel]}>{tab.label}</Text>
      </Pressable>;
    })}
  </View>;
}

const styles = StyleSheet.create({
  container: { position: 'absolute', left: 0, right: 0, bottom: 0, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around', backgroundColor: '#132238', borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.08)', paddingTop: 8 },
  tab: { flex: 1, alignItems: 'center', gap: 3 },
  label: { color: '#B8C5D9', fontSize: 11, fontWeight: '600' },
  activeLabel: { color: AuthColors.primary, fontWeight: '800' },
  fallback: { color: AppHeaderColors.subtitle, fontSize: 22 },
});