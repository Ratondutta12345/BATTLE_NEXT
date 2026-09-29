import { useCallback, useEffect, useState } from 'react';
import { router } from 'expo-router';
import { ActivityIndicator, Alert, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SymbolView } from 'expo-symbols';
import * as WebBrowser from 'expo-web-browser';
import QRCode from 'react-native-qrcode-svg';
import { AccountScreen } from '@/components/account/AccountScreen';
import { API_ENDPOINTS, apiRequest } from '@/constants/api';
import { useAuth } from '@/context/AuthContext';

type Wallet = { coinBalance: number; deposit: number; winning: number; bonus: number; updatedAt: string };
type Transaction = { id: number; type: 'added' | 'received' | 'withdraw'; amount: number; description: string; createdAt: string };
type ZapupiOrder = { orderId: string; paymentUrl: string; qrValue: string; amount: string; status: 'PENDING' | 'FAILED' };
type WithdrawStatus = { eligible: boolean; availableAt: string | null; balance: number };

const transactionLabels: Record<Transaction['type'], string> = { added: 'Added', received: 'Received', withdraw: 'Withdrawn' };

function showWalletAlert(title: string, message: string) {
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    window.alert(`${title}\n\n${message}`);
    return;
  }
  Alert.alert(title, message);
}

export default function WalletScreen() {
  const { user } = useAuth();
  const [wallet, setWallet] = useState<Wallet | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [transactionsVisible, setTransactionsVisible] = useState(false);
  const [transactionsLoading, setTransactionsLoading] = useState(false);
  const [addWalletVisible, setAddWalletVisible] = useState(false);
  const [addAmount, setAddAmount] = useState('');
  const [activeOrder, setActiveOrder] = useState<ZapupiOrder | null>(null);
  const [remainingSeconds, setRemainingSeconds] = useState(300);
  const [addLoading, setAddLoading] = useState(false);
  const [withdrawStatus, setWithdrawStatus] = useState<WithdrawStatus | null>(null);

  const loadWallet = useCallback(async () => {
    if (!user) return;
    const result = await apiRequest<{ wallet: Wallet }>(API_ENDPOINTS.wallet(user.id));
    if (result.ok) setWallet(result.data.wallet);
    else setError(result.error);
  }, [user]);

  useEffect(() => {
    void loadWallet();
    if (user) void apiRequest<WithdrawStatus>(API_ENDPOINTS.walletWithdrawStatus(user.id)).then((result) => {
      if (result.ok) setWithdrawStatus(result.data);
    });
  }, [loadWallet, user]);

  useEffect(() => {
    if (!activeOrder || !user || activeOrder.status !== 'PENDING') return undefined;
    let active = true;
    let checking = false;
    const checkStatus = async () => {
      if (checking) return;
      checking = true;
      const result = await apiRequest<{ orderId: string; status: 'COMPLETED' | 'PENDING' | 'FAILED' }>(
        API_ENDPOINTS.walletZapupiStatus(activeOrder.orderId, user.id),
      );
      checking = false;
      if (!active || !result.ok) return;
      if (result.data.status === 'COMPLETED') {
        setActiveOrder(null);
        setAddWalletVisible(false);
        setAddAmount('');
        await loadWallet();
        if (transactionsVisible) {
          const transactionsResult = await apiRequest<{ transactions: Transaction[] }>(API_ENDPOINTS.walletTransactions(user.id));
          if (transactionsResult.ok) setTransactions(transactionsResult.data.transactions);
        }
        showWalletAlert('Payment successful', `₹${activeOrder.amount} added to your wallet successfully.`);
      } else if (result.data.status === 'FAILED') {
        setActiveOrder((current) => current?.orderId === activeOrder.orderId ? { ...current, status: 'FAILED' } : current);
      }
    };

    void checkStatus();
    const interval = setInterval(() => { void checkStatus(); }, 3000);
    return () => {
      active = false;
      clearInterval(interval);
    };
  }, [activeOrder, loadWallet, transactionsVisible, user]);

  useEffect(() => {
    if (!activeOrder || remainingSeconds <= 0) return undefined;
    const interval = setInterval(() => setRemainingSeconds((seconds) => Math.max(0, seconds - 1)), 1000);
    return () => clearInterval(interval);
  }, [activeOrder, remainingSeconds > 0]);

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
    setActiveOrder(null);
    setRemainingSeconds(300);
    setAddWalletVisible(true);
  };

  const createZapupiOrder = async () => {
    const amount = Number(addAmount);
    if (!Number.isFinite(amount) || amount < 10) {
      showWalletAlert('Minimum amount is ₹10', 'Enter at least ₹10 to continue.');
      return;
    }
    if (!user) {
      showWalletAlert('Sign in required', 'Sign in before adding money to your wallet.');
      return;
    }
    setAddLoading(true);
    const result = await apiRequest<ZapupiOrder>(API_ENDPOINTS.walletZapupiCreate, {
      method: 'POST',
      body: JSON.stringify({ userId: user.id, amount }),
    });
    setAddLoading(false);
    if (!result.ok) {
      showWalletAlert('Unable to start payment', result.error);
      return;
    }
    setRemainingSeconds(300);
    setActiveOrder(result.data);
  };

  const openPaymentCheckout = async () => {
    if (!activeOrder) return;
    try {
      await WebBrowser.openBrowserAsync(activeOrder.paymentUrl);
    } catch {
      showWalletAlert('Unable to open checkout', 'Scan the QR code to continue payment.');
    }
  };

  const closeAddWallet = () => {
    setAddWalletVisible(false);
    setActiveOrder(null);
  };

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
      <Modal visible={addWalletVisible} transparent animationType="fade" onRequestClose={closeAddWallet}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>{activeOrder ? 'Complete payment' : 'Add money'}</Text>
            {!activeOrder ? <>
              <Text style={styles.modalSubtitle}>Enter at least ₹10. A secure ZapUPI checkout QR will be created for this amount.</Text>
              <TextInput value={addAmount} onChangeText={setAddAmount} keyboardType="decimal-pad" placeholder="100" placeholderTextColor="#73849B" style={styles.amountInput} />
            </> : null}
            {activeOrder ? <>
              <Text style={styles.modalSubtitle}>Scan to pay ₹{activeOrder.amount}. Your wallet is credited after ZapUPI confirms payment.</Text>
              <View style={styles.qrFrame}><QRCode value={activeOrder.qrValue} size={220} backgroundColor="#FFFFFF" color="#0B1628" /></View>
              <Text style={[styles.paymentStatus, activeOrder.status === 'FAILED' && styles.paymentFailed]}>
                {activeOrder.status === 'FAILED' ? 'Payment failed or expired.' : 'Waiting for payment...'}
              </Text>
              {activeOrder.status === 'PENDING' ? <>
                <Text style={styles.countdownText}>
                  {remainingSeconds > 0
                    ? `Checkout timer ${String(Math.floor(remainingSeconds / 60)).padStart(2, '0')}:${String(remainingSeconds % 60).padStart(2, '0')}`
                    : 'Still waiting. Keep this screen open or use the payment app; confirmation can arrive later.'}
                </Text>
                <Pressable onPress={openPaymentCheckout} style={styles.upiButton} accessibilityRole="button">
                  <Text style={styles.upiButtonText}>Pay via UPI App</Text>
                </Pressable>
                <Text style={styles.qrHint}>The hosted checkout lets you choose an available UPI app.</Text>
              </> : null}
            </> : null}
            <View style={styles.modalActions}>
              <Pressable onPress={closeAddWallet} style={styles.modalCancel}><Text style={styles.modalCancelText}>Cancel</Text></Pressable>
              {activeOrder?.status === 'FAILED' ? <Pressable onPress={() => setActiveOrder(null)} style={styles.modalConfirm}><Text style={styles.modalConfirmText}>Try again</Text></Pressable> : null}
              {!activeOrder ? <Pressable onPress={createZapupiOrder} disabled={addLoading} style={styles.modalConfirm}>{addLoading ? <ActivityIndicator color="#0B1628" /> : <Text style={styles.modalConfirmText}>Show QR</Text>}</Pressable> : null}
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
  qrFrame: { width: 244, height: 244, alignSelf: 'center', alignItems: 'center', justifyContent: 'center', marginTop: 18, backgroundColor: '#FFFFFF', borderRadius: 8 },
  paymentStatus: { color: '#7BD88F', fontSize: 14, fontWeight: '800', textAlign: 'center', marginTop: 14 },
  paymentFailed: { color: '#FF8A80' },
  countdownText: { color: '#B8C5D9', fontSize: 12, textAlign: 'center', marginTop: 6 },
  upiButton: { alignItems: 'center', justifyContent: 'center', paddingVertical: 13, borderRadius: 10, backgroundColor: '#203A55', marginTop: 14 },
  upiButtonText: { color: '#FFFFFF', fontWeight: '800' },
});