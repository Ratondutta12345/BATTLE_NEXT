import { PropsWithChildren } from 'react';
import { Redirect } from 'expo-router';
import { Pressable, SafeAreaView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';

import { AppHeaderColors } from '@/constants/theme';
import { useAuth } from '@/context/AuthContext';
import { BottomNav } from '@/components/navigation/BottomNav';

export function AccountScreen({ title, children }: PropsWithChildren<{ title: string }>) {
  const router = useRouter();
  const { user } = useAuth();
  if (!user) return <Redirect href="/login" />;

  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.back} accessibilityRole="button" accessibilityLabel="Go back">
          <Text style={styles.backText}>‹</Text>
        </Pressable>
        <Text style={styles.title}>{title}</Text>
        <View style={styles.spacer} />
      </View>
      <View style={styles.content}>{children}</View>
      <BottomNav />
    </SafeAreaView>
  );
}

export const accountStyles = StyleSheet.create({
  text: { color: '#FFFFFF', fontSize: 16, lineHeight: 24 },
  muted: { color: '#B8C5D9', fontSize: 14, lineHeight: 22 },
  card: { backgroundColor: '#132238', borderRadius: 14, padding: 18, marginBottom: 12 },
  label: { color: '#B8C5D9', fontSize: 12, textTransform: 'uppercase', marginBottom: 4 },
  value: { color: '#FFFFFF', fontSize: 17, fontWeight: '700' },
});

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: AppHeaderColors.background },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14 },
  back: { width: 38 },
  backText: { color: '#FFFFFF', fontSize: 34, lineHeight: 34 },
  title: { flex: 1, color: '#FFFFFF', fontSize: 21, fontWeight: '800', textAlign: 'center' },
  spacer: { width: 38 },
  content: { flex: 1, padding: 16, paddingBottom: 92 },
});