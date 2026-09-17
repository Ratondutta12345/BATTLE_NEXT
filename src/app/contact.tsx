import { useEffect, useState } from 'react';
import { ActivityIndicator, Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SymbolView } from 'expo-symbols';
import { AccountScreen } from '@/components/account/AccountScreen';
import { API_ENDPOINTS, apiRequest } from '@/constants/api';

type ContactOption = { id: number; type: 'phone' | 'telegram' | 'email'; label: string; value: string };
const contactUrl = (option: ContactOption) => option.type === 'phone' ? `tel:${option.value}` : option.type === 'email' ? `mailto:${option.value}` : (option.value.startsWith('http') ? option.value : `https://t.me/${option.value.replace(/^@/, '')}`);

export default function ContactScreen() {
  const [options, setOptions] = useState<ContactOption[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => { apiRequest<{ support: { options: ContactOption[] } }>(API_ENDPOINTS.support).then((result) => { if (result.ok) setOptions(result.data.support.options || []); setLoading(false); }); }, []);
  return <AccountScreen title="Contact Us"><ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
    <View style={styles.heading}><Text style={styles.title}>Need a hand?</Text><Text style={styles.subtitle}>Choose a support channel and send us a message.</Text></View>
    {loading ? <ActivityIndicator color="#F7941D" size="large" /> : null}
    {!loading && options.length === 0 ? <Text style={styles.empty}>No contact options are available right now.</Text> : null}
    {options.map((option) => <Pressable key={option.id} style={({ pressed }) => [styles.option, pressed && styles.pressed]} onPress={() => Linking.openURL(contactUrl(option))} accessibilityRole="button"><View style={styles.icon}><SymbolView name={{ android: option.type === 'phone' ? 'phone' : option.type === 'email' ? 'email' : 'send', ios: option.type === 'phone' ? 'phone.fill' : option.type === 'email' ? 'envelope.fill' : 'paperplane.fill' }} size={22} tintColor="#0B1628" fallback={<Text style={styles.iconFallback}>*</Text>} /></View><View style={styles.optionCopy}><Text style={styles.optionLabel}>{option.label}</Text><Text style={styles.optionValue}>{option.value}</Text></View><Text style={styles.arrow}>›</Text></Pressable>)}
  </ScrollView></AccountScreen>;
}

const styles = StyleSheet.create({ content: { paddingBottom: 24 }, heading: { marginBottom: 20 }, title: { color: '#FFFFFF', fontSize: 25, fontWeight: '800' }, subtitle: { color: '#B8C5D9', fontSize: 14, lineHeight: 21, marginTop: 6 }, empty: { color: '#B8C5D9', textAlign: 'center', marginTop: 20 }, option: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#132238', borderRadius: 14, borderWidth: 1, borderColor: '#203A55', padding: 14, marginBottom: 10 }, pressed: { opacity: 0.75 }, icon: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#F7941D', alignItems: 'center', justifyContent: 'center', marginRight: 12 }, iconFallback: { color: '#0B1628', fontSize: 22 }, optionCopy: { flex: 1, minWidth: 0 }, optionLabel: { color: '#FFFFFF', fontSize: 15, fontWeight: '800' }, optionValue: { color: '#F7941D', fontSize: 13, marginTop: 4 }, arrow: { color: '#7E91A8', fontSize: 28, fontWeight: '300' }, });