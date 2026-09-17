import { useEffect, useState } from 'react';
import { Pressable } from 'react-native';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';

import { AccountScreen, accountStyles } from '@/components/account/AccountScreen';
import { JoinMatchModal } from '@/components/contest/JoinMatchModal';
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

  useEffect(() => {
    const gameId = Number(id);
    if (!Number.isInteger(gameId) || gameId <= 0) { setError('Invalid game'); return; }
    setLoading(true);
    setError(null);
    apiRequest<{ matches: Match[] }>(API_ENDPOINTS.matchesByStatus(gameId, status)).then((result) => {
      if (result.ok) setMatches(result.data.matches);
      else setError(result.error);
      setLoading(false);
    });
  }, [id, status]);

  function refreshMatches() {
    const gameId = Number(id);
    if (!Number.isInteger(gameId) || gameId <= 0) return;
    apiRequest<{ matches: Match[] }>(API_ENDPOINTS.matchesByStatus(gameId, status)).then((result) => {
      if (result.ok) setMatches(result.data.matches);
    });
  }

  return <AccountScreen title="Matches">
    <View style={styles.statusTabs}>{(['ongoing', 'upcoming', 'complete'] as MatchStatus[]).map((item) => <Pressable key={item} onPress={() => setStatus(item)} style={[styles.statusTab, status === item && styles.activeStatusTab]}><Text style={[styles.statusTabText, status === item && styles.activeStatusTabText]}>{item === 'complete' ? 'Complete' : item[0].toUpperCase() + item.slice(1)}</Text></Pressable>)}</View>
    {loading ? <ActivityIndicator color="#F7941D" /> : null}
    {error ? <Text style={accountStyles.muted}>{error}</Text> : null}
    <ScrollView showsVerticalScrollIndicator={false}><View style={styles.matchList}>{matches.map((match) => <View key={match.id} style={styles.matchCard}><Pressable style={styles.matchCardBody} onPress={() => router.push({ pathname: '/match/[id]', params: { id: String(match.id) } })} accessibilityRole="button" accessibilityLabel={`Open ${match.name}`}><View>{match.bannerUrl ? <Image source={{ uri: resolveApiUrl(match.bannerUrl) }} style={styles.matchBanner} contentFit="cover" /> : null}</View><View style={styles.matchContent}><Text style={styles.matchName} numberOfLines={1}>{match.name}</Text><Text style={styles.matchMeta}>Prize ₹{match.prizePool}  ·  Per kill ₹{match.perKill}  ·  Entry ₹{match.entryFee}</Text><Text style={styles.matchMeta}>{match.teamType}  ·  v{match.gameVersion}  ·  {match.map}</Text></View></Pressable><View style={styles.matchFooter}><Text style={styles.matchStatus}>{match.joinedPlayers}/{match.totalPlayers} joined</Text>{status !== 'complete' ? <Pressable disabled={match.joinedPlayers >= match.totalPlayers} style={[styles.joinButton, match.joinedPlayers >= match.totalPlayers && styles.joinButtonDisabled]} onPress={() => setJoiningMatchId(match.id)} accessibilityRole="button" accessibilityState={{ disabled: match.joinedPlayers >= match.totalPlayers }}><Text style={[styles.matchType, match.joinedPlayers >= match.totalPlayers && styles.matchTypeDisabled]}>{match.joinedPlayers >= match.totalPlayers ? 'Full' : 'Join Now'}</Text></Pressable> : <Text style={styles.completeText}>Completed</Text>}</View></View>)}{!matches.length && !loading && !error ? <Text style={[accountStyles.muted, { marginTop: 16 }]}>No {status} matches for this Games Slot.</Text> : null}</View></ScrollView>
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
  matchList: { marginTop: 12, gap: 12 },
  matchCard: { overflow: 'hidden' as const, borderRadius: 14, backgroundColor: '#111111', borderWidth: 1, borderColor: '#2A2A2A' },
  matchCardBody: { backgroundColor: '#111111' },
  matchBanner: { width: '100%', height: 118 },
  matchContent: { padding: 12 },
  matchName: { color: '#FFFFFF', fontSize: 16, fontWeight: '800' as const },
  matchId: { color: '#F7941D', fontSize: 13, fontWeight: '700' as const },
  matchMeta: { color: '#B8B8B8', fontSize: 12, marginTop: 6 },
  matchFooter: { flexDirection: 'row' as const, justifyContent: 'space-between' as const, alignItems: 'center' as const, padding: 12, paddingTop: 0 },
  matchStatus: { color: '#FFFFFF', backgroundColor: '#000000', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8, fontSize: 12, fontWeight: '800' as const },
  matchType: { color: '#F7941D', fontSize: 12, fontWeight: '700' as const },
  completeText: { color: '#8F8F8F', fontSize: 12, fontWeight: '700' as const },
  joinButton: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 8, backgroundColor: '#2A1B0A' },
  joinButtonDisabled: { backgroundColor: '#252525' },
  matchTypeDisabled: { color: '#777777' },
});