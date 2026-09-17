import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';

import { AccountScreen, accountStyles } from '@/components/account/AccountScreen';
import { API_ENDPOINTS, apiRequest, resolveApiUrl } from '@/constants/api';
import { useAuth } from '@/context/AuthContext';

type Contest = { id: number; matchId?: number; name?: string; gameName?: string; gameVersion?: string; status?: string; startsAt?: string; entryFee?: number; prizePool?: number; perKill?: number; teamType?: string; map?: string; totalPlayers?: number; joinedPlayers?: number; bannerUrl?: string; inGameName?: string };

export function ContestListScreen({ status, title }: { status: 'upcoming' | 'ongoing' | 'completed'; title: string }) {
  const { user } = useAuth();
  const router = useRouter();
  const [contests, setContests] = useState<Contest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    apiRequest<{ contests: Contest[] }>(API_ENDPOINTS.myContests(status, user.id)).then((result) => {
      if (result.ok) setContests(result.data.contests);
      else setError(result.error);
      setLoading(false);
    });
  }, [status, user]);

  return <AccountScreen title={title}>
    {loading ? <ActivityIndicator color="#F7941D" /> : null}
    {error ? <Text style={accountStyles.muted}>{error}</Text> : null}
    {!loading && !error && contests.length === 0 ? <View style={styles.empty}><Text style={styles.emptyTitle}>No {status} contests</Text><Text style={accountStyles.muted}>Your {status} matches will appear here when available.</Text></View> : null}
    <ScrollView showsVerticalScrollIndicator={false}><View style={styles.matchList}>{contests.map((contest) => <Pressable key={contest.id} style={styles.matchCard} onPress={() => router.push({ pathname: '/match/[id]', params: { id: String(contest.id) } })} accessibilityRole="button" accessibilityLabel={`Open ${contest.name || `Match ${contest.id}`}`}><View>{contest.bannerUrl ? <Image source={{ uri: resolveApiUrl(contest.bannerUrl) }} style={styles.matchBanner} contentFit="cover" /> : null}</View><View style={styles.matchContent}><Text style={styles.matchName} numberOfLines={1}>{contest.name || `Match #${contest.matchId || contest.id}`}</Text><Text style={styles.matchMeta}>Prize ₹{contest.prizePool ?? 0}  ·  Per kill ₹{contest.perKill ?? 0}  ·  Entry ₹{contest.entryFee ?? 0}</Text><Text style={styles.matchMeta}>{contest.teamType || '—'}  ·  v{contest.gameVersion || 'Current'}  ·  {contest.map || '—'}</Text><Text style={styles.joinedName}>In-game name: {contest.inGameName || '—'}</Text><View style={styles.matchFooter}><Text style={styles.matchStatus}>{contest.joinedPlayers ?? 0}/{contest.totalPlayers ?? 0} joined</Text><Text style={styles.viewMatch}>View Match</Text></View></View></Pressable>)}</View></ScrollView>
  </AccountScreen>;
}

const styles = StyleSheet.create({
  empty: { alignItems: 'center', paddingVertical: 60 },
  emptyTitle: { color: '#FFFFFF', fontSize: 18, fontWeight: '800', marginBottom: 8 },
  matchList: { marginTop: 12, gap: 12 },
  matchCard: { overflow: 'hidden', borderRadius: 14, backgroundColor: '#111111', borderWidth: 1, borderColor: '#2A2A2A' },
  matchBanner: { width: '100%', height: 118 },
  matchContent: { padding: 12 },
  matchName: { color: '#FFFFFF', fontSize: 16, fontWeight: '800' },
  matchMeta: { color: '#B8B8B8', fontSize: 12, marginTop: 6 },
  joinedName: { color: '#999999', fontSize: 12, marginTop: 8 },
  matchFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 12 },
  matchStatus: { color: '#FFFFFF', backgroundColor: '#000000', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8, fontSize: 12, fontWeight: '800' },
  viewMatch: { color: '#F7941D', fontSize: 12, fontWeight: '700' },
});