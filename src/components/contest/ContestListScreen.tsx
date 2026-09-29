import { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';

import { AccountScreen, accountStyles } from '@/components/account/AccountScreen';
import { MatchCard, type MatchCardInfo } from '@/components/contest/MatchCard';
import { API_ENDPOINTS, apiRequest } from '@/constants/api';
import { useAuth } from '@/context/AuthContext';

export function ContestListScreen({ status, title }: { status: 'upcoming' | 'ongoing' | 'completed'; title: string }) {
  const { user } = useAuth();
  const router = useRouter();
  const [contests, setContests] = useState<MatchCardInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    apiRequest<{ contests: MatchCardInfo[] }>(API_ENDPOINTS.myContests(status, user.id)).then((result) => {
      if (result.ok) setContests(result.data.contests);
      else setError(result.error);
      setLoading(false);
    });
  }, [status, user]);

  return <AccountScreen title={title}>
    {loading ? <ActivityIndicator color="#F7941D" /> : null}
    {error ? <Text style={accountStyles.muted}>{error}</Text> : null}
    {!loading && !error && contests.length === 0 ? <View style={styles.empty}><Text style={styles.emptyTitle}>No {status} contests</Text><Text style={accountStyles.muted}>Your {status} matches will appear here when available.</Text></View> : null}
    <ScrollView showsVerticalScrollIndicator={false}>
      <View style={styles.matchList}>
        {contests.map((contest) => {
          const openMatch = () => router.push({ pathname: '/match/[id]', params: { id: String(contest.id), source: 'my-contests', contestStatus: status } });
          return (
            <MatchCard
              key={contest.id}
              match={contest}
              onPress={openMatch}
              onAction={openMatch}
              actionLabel={status === 'completed' ? 'VIEW MATCH' : 'JOIN'}
            />
          );
        })}
      </View>
    </ScrollView>
  </AccountScreen>;
}

const styles = StyleSheet.create({
  empty: { alignItems: 'center', paddingVertical: 60 },
  emptyTitle: { color: '#FFFFFF', fontSize: 18, fontWeight: '800', marginBottom: 8 },
  matchList: { marginTop: 12, gap: 14, paddingBottom: 10 },
});