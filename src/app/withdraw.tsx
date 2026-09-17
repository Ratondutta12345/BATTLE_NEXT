import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { router } from 'expo-router';
import { AccountScreen } from '@/components/account/AccountScreen';
import { API_ENDPOINTS, apiRequest } from '@/constants/api';
import { useAuth } from '@/context/AuthContext';

type WithdrawStatus = { eligible: boolean; availableAt: string | null; balance: number };

export default function WithdrawScreen() {
  const { user } = useAuth();
  const [amount, setAmount] = useState('');
  const [upiId, setUpiId] = useState('');
  const [status, setStatus] = useState<WithdrawStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const loadStatus = async () => {
    if (!user) return;
    setLoading(true);
    const result = await apiRequest<WithdrawStatus>(API_ENDPOINTS.walletWithdrawStatus(user.id));
    if (result.ok) {
      setStatus({
        eligible: result.data.eligible !== false,
        availableAt: result.data.availableAt ?? null,
        balance: Number.isFinite(Number(result.data.balance)) ? Number(result.data.balance) : 0,
      });
    }
    else Alert.alert('Unable to load withdrawal status', result.error);
    setLoading(false);
  };

  useEffect(() => { void loadStatus(); }, [user]);

  const submit = async () => {
    const numericAmount = Number(amount);
    if (!user || !Number.isFinite(numericAmount) || numericAmount < 50 || !upiId.trim()) {
      Alert.alert('Complete the form', 'Enter at least ₹50 and the UPI ID where you want to receive the money.');
      return;
    }
    setSubmitting(true);
    const result = await apiRequest(API_ENDPOINTS.walletWithdrawRequest(user.id), { method: 'POST', body: JSON.stringify({ amount: numericAmount, upiId: upiId.trim() }) });
    setSubmitting(false);
    if (!result.ok) { Alert.alert('Withdrawal unavailable', result.error); await loadStatus(); return; }
    Alert.alert('Withdrawal submitted', 'Your withdrawal request is pending admin review.', [{ text: 'OK', onPress: () => router.back() }]);
  };

  return <AccountScreen title="Withdraw Money">
    <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <View style={styles.card}>
        <Text style={styles.title}>Request a withdrawal</Text>
        <Text style={styles.subtitle}>Minimum withdrawal amount is ₹50. Withdrawals are limited to one every 12 hours.</Text>
        <Text style={styles.label}>Amount</Text>
        <TextInput value={amount} onChangeText={setAmount} keyboardType="decimal-pad" placeholder="50" placeholderTextColor="#73849B" style={styles.input} />
        <Text style={styles.label}>UPI ID</Text>
        <TextInput value={upiId} onChangeText={setUpiId} autoCapitalize="none" keyboardType="email-address" placeholder="name@upi" placeholderTextColor="#73849B" style={styles.input} />
        {loading ? <ActivityIndicator color="#F7941D" style={styles.loader} /> : null}
        {!loading && status && !status.eligible ? <Text style={styles.notice}>Next withdrawal available {status.availableAt ? new Date(status.availableAt).toLocaleString() : 'after the current request is cancelled by admin'}.</Text> : null}
        {!loading && status ? <Text style={styles.balance}>Available balance: ₹{(Number.isFinite(status.balance) ? status.balance : 0).toFixed(2)}</Text> : null}
        <Pressable onPress={submit} disabled={submitting || loading || status?.eligible === false} style={({ pressed }) => [styles.button, (submitting || loading || status?.eligible === false) && styles.disabled, pressed && styles.pressed]}>
          {submitting ? <ActivityIndicator color="#0B1628" /> : <Text style={styles.buttonText}>Withdraw</Text>}
        </Pressable>
      </View>
    </ScrollView>
  </AccountScreen>;
}

const styles = StyleSheet.create({
  content: { paddingBottom: 24 },
  card: { backgroundColor: '#132238', borderRadius: 18, borderWidth: 1, borderColor: '#203A55', padding: 18 },
  title: { color: '#FFFFFF', fontSize: 22, fontWeight: '800' },
  subtitle: { color: '#B8C5D9', fontSize: 13, lineHeight: 20, marginTop: 7, marginBottom: 22 },
  label: { color: '#FFFFFF', fontSize: 13, fontWeight: '700', marginBottom: 7, marginTop: 12 },
  input: { color: '#FFFFFF', backgroundColor: '#0B1628', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 13, fontSize: 17 },
  loader: { marginTop: 18 },
  notice: { color: '#FFCC80', fontSize: 13, lineHeight: 19, marginTop: 16 },
  balance: { color: '#7BD88F', fontSize: 13, marginTop: 16 },
  button: { minHeight: 50, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F7941D', borderRadius: 10, marginTop: 22 },
  buttonText: { color: '#0B1628', fontSize: 15, fontWeight: '800' },
  disabled: { opacity: 0.45 },
  pressed: { opacity: 0.75 },
});