import { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SymbolView } from 'expo-symbols';
import { AccountScreen } from '@/components/account/AccountScreen';
import { API_ENDPOINTS, apiRequest } from '@/constants/api';

type Player = { rank: number; username: string; fullName: string; inGameName: string; winningCoins: number; matches: number };

export default function TopPlayersScreen() {
  const [players, setPlayers] = useState<Player[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => { apiRequest<{ players: Player[] }>(API_ENDPOINTS.topPlayers).then((result) => { if (result.ok) setPlayers(result.data.players); else setError(result.error); setLoading(false); }); }, []);
  return <AccountScreen title="Top Players">
    <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <View style={styles.hero}><View style={styles.trophy}><SymbolView name={{ android: 'emoji_events', ios: 'trophy.fill' }} size={34} tintColor="#0B1628" fallback={<Text style={styles.trophyFallback}>*</Text>} /></View><Text style={styles.heroTitle}>Top 15 Winners</Text><Text style={styles.heroText}>Players ranked by total prize money won.</Text></View>
      {loading ? <ActivityIndicator color="#F7941D" size="large" /> : null}
      {error ? <Text style={styles.error}>{error}</Text> : null}
      {!loading && !error && players.length === 0 ? <Text style={styles.empty}>No prize winners yet.</Text> : null}
      {players.map((player) => <View key={player.rank} style={[styles.playerCard, player.rank <= 3 && styles.podiumCard]}><View style={[styles.rank, player.rank === 1 && styles.firstRank]}><Text style={styles.rankText}>{player.rank}</Text></View><View style={styles.playerCopy}><Text style={styles.username}>{player.username}</Text><Text style={styles.inGameName}>In-game: {player.inGameName}</Text><Text style={styles.matches}>{player.matches} completed match{player.matches === 1 ? '' : 'es'}</Text></View><View style={styles.winnings}><Text style={styles.winningsValue}>{player.winningCoins}</Text><Text style={styles.winningsLabel}>coins won</Text></View></View>)}
    </ScrollView>
  </AccountScreen>;
}

const styles = StyleSheet.create({
  content: { paddingBottom: 24 }, hero: { alignItems: 'center', backgroundColor: '#132238', borderRadius: 18, borderWidth: 1, borderColor: '#203A55', padding: 22, marginBottom: 18 }, trophy: { width: 64, height: 64, borderRadius: 32, backgroundColor: '#F7941D', alignItems: 'center', justifyContent: 'center', marginBottom: 10 }, trophyFallback: { color: '#0B1628', fontSize: 28 }, heroTitle: { color: '#FFFFFF', fontSize: 22, fontWeight: '800' }, heroText: { color: '#B8C5D9', fontSize: 13, marginTop: 5, textAlign: 'center' }, error: { color: '#FF8A80', fontSize: 14, marginBottom: 14 }, empty: { color: '#B8C5D9', textAlign: 'center', marginTop: 20 }, playerCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#132238', borderRadius: 14, padding: 13, marginBottom: 9, borderWidth: 1, borderColor: '#203A55' }, podiumCard: { borderColor: '#6B5024' }, rank: { width: 34, height: 34, borderRadius: 17, backgroundColor: '#203A55', alignItems: 'center', justifyContent: 'center', marginRight: 11 }, firstRank: { backgroundColor: '#F7941D' }, rankText: { color: '#FFFFFF', fontSize: 15, fontWeight: '800' }, playerCopy: { flex: 1, minWidth: 0 }, username: { color: '#FFFFFF', fontSize: 15, fontWeight: '800' }, inGameName: { color: '#F7941D', fontSize: 12, marginTop: 3 }, matches: { color: '#73849B', fontSize: 11, marginTop: 3 }, winnings: { alignItems: 'flex-end', marginLeft: 8 }, winningsValue: { color: '#7BD88F', fontSize: 18, fontWeight: '800' }, winningsLabel: { color: '#B8C5D9', fontSize: 10, marginTop: 2 },
});