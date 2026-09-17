import { useEffect, useState } from 'react';
import { router } from 'expo-router';
import { ActivityIndicator, Alert, Image, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SymbolView } from 'expo-symbols';
import { AccountScreen } from '@/components/account/AccountScreen';
import { API_BASE_URL, API_ENDPOINTS, apiRequest } from '@/constants/api';
import { useAuth } from '@/context/AuthContext';

type Wallet = { coinBalance: number; deposit: number; winning: number; bonus: number; updatedAt: string };
type Transaction = { id: number; type: 'added' | 'received' | 'withdraw'; amount: number; description: string; createdAt: string };
type PaymentConfig = { upiId: string; payeeName: string; qrImageUrl: string | null; configured: boolean };
type WithdrawStatus = { eligible: boolean; availableAt: string | null; balance: number };

const transactionLabels: Record<Transaction['type'], string> = { added: 'Added', received: 'Received', withdraw: 'Withdrawn' };

export default function WalletScreen() {
  const { user } = useAuth();
  const [wallet, setWallet] = useState<Wallet | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [transactionsVisible, setTransactionsVisible] = useState(false);
  const [transactionsLoading, setTransactionsLoading] = useState(false);
  const [addWalletVisible, setAddWalletVisible] = useState(false);
  const [addAmount, setAddAmount] = useState('');
  const [transactionId, setTransactionId] = useState('');
  const [paymentConfig, setPaymentConfig] = useState<PaymentConfig | null>(null);
  const [addStep, setAddStep] = useState<'amount' | 'qr' | 'transaction'>('amount');
  const [addLoading, setAddLoading] = useState(false);
  const [withdrawStatus, setWithdrawStatus] = useState<WithdrawStatus | null>(null);

  const loadWallet = async () => {
    if (!user) return;
    const result = await apiRequest<{ wallet: Wallet }>(API_ENDPOINTS.wallet(user.id));
    if (result.ok) setWallet(result.data.wallet);
    else setError(result.error);
  };

  useEffect(() => {
    void loadWallet();
    void apiRequest<{ payment: PaymentConfig }>(API_ENDPOINTS.walletPaymentConfig).then((result) => {
      if (result.ok) setPaymentConfig(result.data.payment);
    });
    if (user) void apiRequest<WithdrawStatus>(API_ENDPOINTS.walletWithdrawStatus(user.id)).then((result) => {
      if (result.ok) setWithdrawStatus(result.data);
    });
  }, [user]);

  const showTransactions = async () => {
    setTransactionsVisible(true);
    if (!user || transactionsLoading) return;
    setTransactionsLoading(true);
    const result = await apiRequest<{ transactions: Transaction[] }>(API_ENDPOINTS.walletTransactions(user.id));
    if (result.ok) setTransactions(result.data.transactions);
    else setError(result.error);
    setTransactionsLoading(false);
  };

  const openAddWallet = () => {
    setAddAmount('');
    setTransactionId('');
    setAddStep('amount');
    setAddWalletVisible(true);
  };

  const showPaymentQr = () => {
    const amount = Number(addAmount);
    if (!Number.isFinite(amount) || amount < 10) {
      Alert.alert('Minimum amount is ₹10', 'Enter at least ₹10 to continue.');
      return;
    }
    if (!paymentConfig?.configured) {
      Alert.alert('Payment is not configured', 'Ask the administrator to set PAYMENT_UPI_ID on the backend.');
      return;
    }
    setAddStep('qr');
  };

  const submitDepositRequest = async () => {
    const amount = Number(addAmount);
    if (!user || !Number.isFinite(amount) || amount < 10 || !transactionId.trim()) {
      Alert.alert('Complete the form', 'Enter an amount of at least ₹10 and the transaction ID.');
      return;
    }
    setAddLoading(true);
    const result = await apiRequest(API_ENDPOINTS.walletDepositRequest(user.id), { method: 'POST', body: JSON.stringify({ amount, transactionId: transactionId.trim() }) });
    setAddLoading(false);
    if (!result.ok) {
      Alert.alert('Unable to send request', result.error);
      return;
    }
    setAddAmount('');
    setTransactionId('');
    setAddStep('amount');
    setAddWalletVisible(false);
    Alert.alert('Request sent', 'Your payment is pending admin approval. Your wallet will be credited after approval.');
  };

  const qrValue = paymentConfig ? `upi://pay?pa=${encodeURIComponent(paymentConfig.upiId)}&pn=${encodeURIComponent(paymentConfig.payeeName)}&am=${encodeURIComponent(Number(addAmount).toFixed(2))}&cu=INR&tn=${encodeURIComponent('Wallet deposit')}` : '';
  const generatedQrImageUrl = `https://api.qrserver.com/v1/create-qr-code/?size=240x240&data=${encodeURIComponent(qrValue)}`;
  const qrImageUrl = paymentConfig?.qrImageUrl ? `${API_BASE_URL}${paymentConfig.qrImageUrl}` : generatedQrImageUrl;

  return (
    <AccountScreen title="My Wallet">
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {error ? <Text style={styles.error}>{error}</Text> : null}
        {!wallet && !error ? <ActivityIndicator color="#F7941D" size="large" /> : null}
        {wallet ? <>
          <View style={styles.balanceHero}>
            <View style={styles.coinIcon}>
              <SymbolView name={{ android: 'monetization_on', ios: 'dollarsign.circle.fill' }} size={64} tintColor="#F7941D" fallback={<Text style={styles.coinFallback}>$</Text>} />
            </View>
            <View><Text style={styles.balanceLabel}>Total coins</Text><Text style={styles.balanceValue}>{wallet.coinBalance}</Text></View>
          </View>

          <View style={styles.balanceRow}>
            <BalanceCard label="Deposit" value={wallet.deposit} color="#4CC9F0" />
            <BalanceCard label="Winning" value={wallet.winning} color="#F7941D" />
            <BalanceCard label="Bonus" value={wallet.bonus} color="#7BD88F" />
          </View>

          <View style={styles.actionsRow}>
            <WalletAction label="Add Wallet" icon="+" onPress={openAddWallet} primary />
            <WalletAction label="Withdraw" icon="↑" onPress={() => router.push('/withdraw')} disabled={withdrawStatus?.eligible === false} />
            <WalletAction label="Transactions" icon="≡" onPress={showTransactions} />
          </View>

          {transactionsVisible ? <View style={styles.transactionsSection}>
            <Text style={styles.sectionTitle}>Transactions</Text>
            {transactionsLoading ? <ActivityIndicator color="#F7941D" /> : null}
            {!transactionsLoading && transactions.length === 0 ? <Text style={styles.emptyText}>No transactions yet.</Text> : null}
            {transactions.map((transaction) => <View key={transaction.id} style={styles.transactionRow}>
              <View style={[styles.transactionIcon, transaction.type === 'withdraw' && styles.withdrawIcon]}><Text style={styles.transactionIconText}>{transaction.type === 'withdraw' ? '↑' : '+'}</Text></View>
              <View style={styles.transactionCopy}><Text style={styles.transactionTitle}>{transactionLabels[transaction.type]}</Text><Text style={styles.transactionDescription}>{transaction.description}</Text><Text style={styles.transactionDate}>{new Date(transaction.createdAt).toLocaleString()}</Text></View>
              <Text style={[styles.transactionAmount, transaction.type === 'withdraw' && styles.withdrawAmount]}>{transaction.type === 'withdraw' ? '-' : '+'}{transaction.amount}</Text>
            </View>)}
          </View> : null}
          <Text style={styles.updatedText}>Updated {new Date(wallet.updatedAt).toLocaleString()}</Text>
        </> : null}
      </ScrollView>
      <Modal visible={addWalletVisible} transparent animationType="fade" onRequestClose={() => setAddWalletVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>{addStep === 'amount' ? 'Add money' : addStep === 'qr' ? 'Pay using QR' : 'Confirm payment'}</Text>
            {addStep === 'amount' ? <>
              <Text style={styles.modalSubtitle}>Enter at least ₹10. You will receive a QR code for this amount.</Text>
              <TextInput value={addAmount} onChangeText={setAddAmount} keyboardType="decimal-pad" placeholder="100" placeholderTextColor="#73849B" style={styles.amountInput} />
            </> : null}
            {addStep === 'qr' ? <>
              <Text style={styles.modalSubtitle}>Pay ₹{Number(addAmount).toFixed(2)} to {paymentConfig?.upiId}, then continue.</Text>
              <Image source={{ uri: qrImageUrl }} style={styles.qrImage} />
              <Text style={styles.qrHint}>{paymentConfig?.qrImageUrl ? 'Scan the payment QR code shown above.' : `UPI ID: ${paymentConfig?.upiId}`}</Text>
            </> : null}
            {addStep === 'transaction' ? <>
              <Text style={styles.modalSubtitle}>After paying ₹{Number(addAmount).toFixed(2)}, enter the transaction ID shown by your payment app.</Text>
              <TextInput value={transactionId} onChangeText={setTransactionId} autoCapitalize="characters" placeholder="Transaction ID" placeholderTextColor="#73849B" style={styles.amountInput} />
            </> : null}
            <View style={styles.modalActions}>
              <Pressable onPress={() => setAddWalletVisible(false)} style={styles.modalCancel}><Text style={styles.modalCancelText}>Cancel</Text></Pressable>
              {addStep === 'qr' ? <Pressable onPress={() => setAddStep('transaction')} style={styles.modalConfirm}><Text style={styles.modalConfirmText}>I paid</Text></Pressable> : null}
              {addStep === 'transaction' ? <Pressable onPress={submitDepositRequest} disabled={addLoading} style={styles.modalConfirm}>{addLoading ? <ActivityIndicator color="#0B1628" /> : <Text style={styles.modalConfirmText}>Send request</Text>}</Pressable> : null}
              {addStep === 'amount' ? <Pressable onPress={showPaymentQr} style={styles.modalConfirm}><Text style={styles.modalConfirmText}>Show QR</Text></Pressable> : null}
            </View>
          </View>
        </View>
      </Modal>
    </AccountScreen>
  );
}

function BalanceCard({ label, value, color }: { label: string; value: number; color: string }) {
  return <View style={styles.balanceCard}><View style={[styles.cardDot, { backgroundColor: color }]} /><Text style={styles.cardLabel}>{label}</Text><Text style={styles.cardValue}>{value}</Text></View>;
}

function WalletAction({ label, icon, onPress, primary = false, disabled = false }: { label: string; icon: string; onPress: () => void; primary?: boolean; disabled?: boolean }) {
  return <Pressable onPress={onPress} disabled={disabled} style={({ pressed }) => [styles.action, primary && styles.primaryAction, disabled && styles.disabledAction, pressed && styles.pressed]} accessibilityRole="button"><Text style={[styles.actionIcon, primary && styles.primaryActionText]}>{icon}</Text><Text style={[styles.actionLabel, primary && styles.primaryActionText]}>{label}</Text></Pressable>;
}

const styles = StyleSheet.create({
  content: { paddingBottom: 24 },
  error: { color: '#FF8A80', fontSize: 14, lineHeight: 21, marginBottom: 16 },
  balanceHero: { minHeight: 176, borderRadius: 20, backgroundColor: '#132238', borderWidth: 1, borderColor: '#203A55', alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 18, marginBottom: 16 },
  coinIcon: { width: 92, height: 92, borderRadius: 46, backgroundColor: '#203A55', alignItems: 'center', justifyContent: 'center' },
  coinFallback: { color: '#F7941D', fontSize: 58, fontWeight: '800' },
  balanceLabel: { color: '#B8C5D9', fontSize: 13, marginBottom: 2 },
  balanceValue: { color: '#FFFFFF', fontSize: 42, fontWeight: '800' },
  balanceRow: { flexDirection: 'row', gap: 8, marginBottom: 18 },
  balanceCard: { flex: 1, minHeight: 94, borderRadius: 14, backgroundColor: '#132238', padding: 11 },
  cardDot: { width: 8, height: 8, borderRadius: 4, marginBottom: 8 },
  cardLabel: { color: '#B8C5D9', fontSize: 12, marginBottom: 4 },
  cardValue: { color: '#FFFFFF', fontSize: 20, fontWeight: '800' },
  actionsRow: { flexDirection: 'row', gap: 8, marginBottom: 18 },
  action: { flex: 1, minHeight: 74, borderRadius: 14, backgroundColor: '#132238', borderWidth: 1, borderColor: '#203A55', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4 },
  primaryAction: { backgroundColor: '#F7941D', borderColor: '#F7941D' },
  pressed: { opacity: 0.75 },
  disabledAction: { opacity: 0.45 },
  actionIcon: { color: '#F7941D', fontSize: 25, lineHeight: 28, fontWeight: '600', marginBottom: 3 },
  actionLabel: { color: '#FFFFFF', fontSize: 11, fontWeight: '700', textAlign: 'center' },
  primaryActionText: { color: '#0B1628' },
  transactionsSection: { backgroundColor: '#132238', borderRadius: 14, padding: 14, marginBottom: 14 },
  sectionTitle: { color: '#FFFFFF', fontSize: 18, fontWeight: '800', marginBottom: 12 },
  emptyText: { color: '#B8C5D9', fontSize: 14, paddingVertical: 10 },
  transactionRow: { flexDirection: 'row', alignItems: 'center', borderTopWidth: 1, borderTopColor: '#203A55', paddingVertical: 12, gap: 10 },
  transactionIcon: { width: 34, height: 34, borderRadius: 17, backgroundColor: '#1C4C42', alignItems: 'center', justifyContent: 'center' },
  withdrawIcon: { backgroundColor: '#4C2B35' },
  transactionIconText: { color: '#7BD88F', fontSize: 20, fontWeight: '700' },
  transactionCopy: { flex: 1, minWidth: 0 },
  transactionTitle: { color: '#FFFFFF', fontSize: 14, fontWeight: '700' },
  transactionDescription: { color: '#B8C5D9', fontSize: 12, marginTop: 2 },
  transactionDate: { color: '#73849B', fontSize: 11, marginTop: 3 },
  transactionAmount: { color: '#7BD88F', fontSize: 16, fontWeight: '800' },
  withdrawAmount: { color: '#FF8A80' },
  updatedText: { color: '#73849B', fontSize: 11, textAlign: 'center', marginTop: 4 },
  modalOverlay: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.7)', padding: 20 },
  modalCard: { width: '100%', maxWidth: 420, borderRadius: 18, backgroundColor: '#132238', padding: 20 },
  modalTitle: { color: '#FFFFFF', fontSize: 20, fontWeight: '800' },
  modalSubtitle: { color: '#B8C5D9', fontSize: 13, marginTop: 6 },
  amountInput: { color: '#FFFFFF', backgroundColor: '#0B1628', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 13, marginTop: 18, fontSize: 18 },
  qrImage: { width: 240, height: 240, alignSelf: 'center', marginTop: 18, backgroundColor: '#FFFFFF' },
  qrHint: { color: '#B8C5D9', fontSize: 12, textAlign: 'center', marginTop: 10 },
  modalActions: { flexDirection: 'row', gap: 10, marginTop: 18 },
  modalCancel: { flex: 1, alignItems: 'center', paddingVertical: 13, borderRadius: 10, borderWidth: 1, borderColor: '#52657C' },
  modalCancelText: { color: '#FFFFFF', fontWeight: '700' },
  modalConfirm: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 13, borderRadius: 10, backgroundColor: '#F7941D' },
  modalConfirmText: { color: '#0B1628', fontWeight: '800' },
});