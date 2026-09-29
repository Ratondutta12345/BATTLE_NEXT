import { useEffect, useState } from 'react';
import { Pressable } from 'react-native';
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';

import { AccountScreen, accountStyles } from '@/components/account/AccountScreen';
import { JoinMatchModal } from '@/components/contest/JoinMatchModal';
import { MatchCard } from '@/components/contest/MatchCard';
import { API_ENDPOINTS, apiRequest, resolveApiUrl, type Match } from '@/constants/api';
import { useAuth } from '@/context/AuthContext';

type MatchStatus = 'ongoing' | 'upcoming' | 'complete';

export default function GameDetailsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { user } = useAuth();
  const [matches, setMatches] = useState<Match[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<MatchStatus>('upcoming');
  const [joiningMatchId, setJoiningMatchId] = useState<number | null>(null);
  const [checkingWallet, setCheckingWallet] = useState(false);

  useEffect(() => {
    const gameId = Number(id);
    if (!Number.isInteger(gameId) || gameId <= 0) { setError('Invalid game'); return; }
    setLoading(true);
    setError(null);
    apiRequest<{ matches: Match[] }>(API_ENDPOINTS.matchesByStatus(gameId, status, user?.id)).then((result) => {
      if (result.ok) setMatches(result.data.matches);
      else setError(result.error);
      setLoading(false);
    });
  }, [id, status, user?.id]);

  function refreshMatches() {
    const gameId = Number(id);
    if (!Number.isInteger(gameId) || gameId <= 0) return;
    apiRequest<{ matches: Match[] }>(API_ENDPOINTS.matchesByStatus(gameId, status, user?.id)).then((result) => {
      if (result.ok) setMatches(result.data.matches);
    });
  }

  async function requestToJoin(match: Match) {
    if (!user) {
      router.push('/login');
      return;
    }
    const entryFee = Number(match.entryFee ?? 0);
    if (entryFee <= 0) {
      setJoiningMatchId(match.id);
      return;
    }
    setCheckingWallet(true);
    const result = await apiRequest<{ wallet: { coinBalance: number } }>(API_ENDPOINTS.wallet(user.id));
    setCheckingWallet(false);
    if (!result.ok) {
      if (result.error === 'Wallet not found') router.push('/wallet');
      else Alert.alert('Unable to check wallet', result.error);
      return;
    }
    if (Number(result.data.wallet.coinBalance) < entryFee) {
      router.push('/wallet');
      return;
    }
    setJoiningMatchId(match.id);
  }

  return <AccountScreen title="Matches">
    <View style={styles.statusTabs}>{(['ongoing', 'upcoming', 'complete'] as MatchStatus[]).map((item) => <Pressable key={item} onPress={() => setStatus(item)} style={[styles.statusTab, status === item && styles.activeStatusTab]}><Text style={[styles.statusTabText, status === item && styles.activeStatusTabText]}>{item === 'complete' ? 'Complete' : item[0].toUpperCase() + item.slice(1)}</Text></Pressable>)}</View>
    {loading ? <ActivityIndicator color="#F7941D" /> : null}
    {error ? <Text style={accountStyles.muted}>{error}</Text> : null}
    <ScrollView showsVerticalScrollIndicator={false}>
      <View style={styles.matchList}>
        {matches.map((match) => {
          const openMatch = () => router.push({ pathname: '/match/[id]', params: { id: String(match.id), source: 'game' } });
          const isFull = match.joinedPlayers >= match.totalPlayers;
          const isComplete = status === 'complete';
          const userEntryCount = match.userEntryCount ?? 0;
          const hasExtraEntries = userEntryCount >= 2;
          return (
            <MatchCard
              key={match.id}
              match={match}
              onPress={openMatch}
              onAction={isComplete ? openMatch : () => { void requestToJoin(match); }}
              actionLabel={isComplete ? 'VIEW MATCH' : userEntryCount > 0 ? 'JOIN EXTRA ENTRIES' : 'JOIN'}
              actionDisabled={!isComplete && (isFull || hasExtraEntries || checkingWallet)}
              disabledLabel={checkingWallet ? 'CHECKING WALLET' : hasExtraEntries ? 'EXTRA ENTRIES JOINED' : 'FULL'}
            />
          );
        })}
        {!matches.length && !loading && !error ? <Text style={[accountStyles.muted, { marginTop: 16 }]}>No {status} matches for this Games Slot.</Text> : null}
      </View>
    </ScrollView>
    <JoinMatchModal matchId={joiningMatchId} userId={user?.id} onClose={() => setJoiningMatchId(null)} onJoined={() => {
      refreshMatches();
    }} />
  </AccountScreen>;
}

const styles = StyleSheet.create({
  statusTabs: { flexDirection: 'row', backgroundColor: '#111111', borderRadius: 12, padding: 4, marginBottom: 14 },
  statusTab: { flex: 1, alignItems: 'center', paddingVertical: 10, borderRadius: 9 },
  activeStatusTab: { backgroundColor: '#F7941D' },
  statusTabText: { color: '#AAAAAA', fontSize: 12, fontWeight: '700' as const },
  activeStatusTabText: { color: '#111111' },
  matchList: { marginTop: 12, gap: 14, paddingBottom: 10 },
});