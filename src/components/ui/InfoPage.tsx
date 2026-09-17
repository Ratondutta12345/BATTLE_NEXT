import { PropsWithChildren } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { AccountScreen } from '@/components/account/AccountScreen';

export function InfoPage({ title, eyebrow, intro, children }: PropsWithChildren<{ title: string; eyebrow: string; intro: string }>) {
  return <AccountScreen title={title}>
    <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
      <Text style={styles.eyebrow}>{eyebrow}</Text>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.intro}>{intro}</Text>
      {children}
    </ScrollView>
  </AccountScreen>;
}

export function InfoSection({ title, children }: PropsWithChildren<{ title: string }>) {
  return <View style={styles.section}><Text style={styles.sectionTitle}>{title}</Text>{children}</View>;
}

export function InfoText({ children }: PropsWithChildren) {
  return <Text style={styles.text}>{children}</Text>;
}

export function InfoBullet({ children }: PropsWithChildren) {
  return <View style={styles.bulletRow}><Text style={styles.bullet}>•</Text><Text style={styles.bulletText}>{children}</Text></View>;
}

const styles = StyleSheet.create({
  content: { paddingBottom: 28 },
  eyebrow: { color: '#F7941D', fontSize: 11, fontWeight: '800', letterSpacing: 1, textTransform: 'uppercase', marginTop: 4 },
  title: { color: '#FFFFFF', fontSize: 28, fontWeight: '800', marginTop: 6 },
  intro: { color: '#B8C5D9', fontSize: 15, lineHeight: 23, marginTop: 10, marginBottom: 18 },
  section: { backgroundColor: '#132238', borderRadius: 14, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: '#203A55' },
  sectionTitle: { color: '#FFFFFF', fontSize: 16, fontWeight: '800', marginBottom: 8 },
  text: { color: '#C8D4E3', fontSize: 14, lineHeight: 22 },
  bulletRow: { flexDirection: 'row', alignItems: 'flex-start', marginTop: 7 },
  bullet: { color: '#F7941D', fontSize: 20, lineHeight: 20, width: 18 },
  bulletText: { flex: 1, color: '#C8D4E3', fontSize: 14, lineHeight: 22 },
});

export const infoStyles = styles;
