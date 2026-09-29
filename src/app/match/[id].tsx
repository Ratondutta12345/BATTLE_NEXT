import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';

import { AccountScreen, accountStyles } from '@/components/account/AccountScreen';
import { JoinMatchModal } from '@/components/contest/JoinMatchModal';
import { UpcomingMyContestDetails } from '@/components/contest/UpcomingMyContestDetails';
import { API_ENDPOINTS, apiRequest, resolveApiUrl, type Match } from '@/constants/api';
import { useAuth } from '@/context/AuthContext';
import { formatMatchTimeFirst } from '@/utils/matchTime';

export default function MatchDetailsScreen() {
  const { id, source, contestStatus } = useLocalSearchParams<{ id: string; source?: string; contestStatus?: string }>();
  const router = useRouter();
  const { user } = useAuth();
  const isMyContestsView = source === 'my-contests';
  const [match, setMatch] = useState<Match | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isJoined, setIsJoined] = useState(false);
  const [showJoinForm, setShowJoinForm] = useState(false);
  const [showMembers, setShowMembers] = useState(false);
  const [checkingWallet, setCheckingWallet] = useState(false);
  const showUpcomingContestDetails = isMyContestsView && (contestStatus === 'upcoming' || (!contestStatus && match?.status === 'Upcoming'));

  useEffect(() => {
    const matchId = Number(id);
    if (!Number.isInteger(matchId) || matchId <= 0) {
      setError('Invalid match');
      return;
    }
    apiRequest<{ match: Match; isJoined: boolean }>(API_ENDPOINTS.match(matchId, user?.id)).then((result) => {
      if (result.ok) {
        setMatch(result.data.match);
        setIsJoined(result.data.isJoined);
      }
      else setError(result.error);
    });
  }, [id, user?.id]);

  function reloadMatch() {
    const matchId = Number(id);
    if (!Number.isInteger(matchId) || matchId <= 0) return;
    apiRequest<{ match: Match; isJoined: boolean }>(API_ENDPOINTS.match(matchId, user?.id)).then((result) => {
      if (result.ok) {
        setMatch(result.data.match);
        setIsJoined(result.data.isJoined);
      }
    });
  }

  async function requestToJoin() {
    if (!user || !match) {
      router.push('/login');
      return;
    }
    const entryFee = Number(match.entryFee ?? 0);
    if (entryFee <= 0) {
      setShowJoinForm(true);
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
    setShowJoinForm(true);
  }

  return <AccountScreen title="Match Details">
    {!match && !error ? <ActivityIndicator color="#F7941D" /> : null}
    {error ? <Text style={accountStyles.muted}>{error}</Text> : null}
    {match ? (showUpcomingContestDetails ? <UpcomingMyContestDetails match={match} userId={user?.id} isJoined={isJoined} /> : <ScrollView showsVerticalScrollIndicator={false}>
      {match.bannerUrl ? <Image source={{ uri: resolveApiUrl(match.bannerUrl) }} style={styles.banner} contentFit="cover" /> : null}
      <Text style={styles.title}>{match.name}</Text>
      {match.status !== 'Complete' ? <>
        <Text style={styles.game}>{match.gameName || 'Games Slot'} · v{match.gameVersion}</Text>
        <View style={styles.playerBadge}><Text style={styles.playerBadgeText}>{match.joinedPlayers}/{match.totalPlayers} joined</Text></View>
        <View style={styles.grid}>
          <View style={styles.detail}><Text style={styles.label}>Team</Text><Text style={styles.value}>{match.teamType}</Text></View>
          <View style={styles.detail}><Text style={styles.label}>Map</Text><Text style={styles.value}>{match.map}</Text></View>
          <View style={styles.detail}><Text style={styles.label}>Entry Fee</Text><Text style={styles.value}>₹{match.entryFee}</Text></View>
          <View style={styles.detail}><Text style={styles.label}>Prize Pool</Text><Text style={styles.value}>₹{match.prizePool}</Text></View>
          <View style={styles.detail}><Text style={styles.label}>Per Kill</Text><Text style={styles.value}>₹{match.perKill}</Text></View>
          <View style={styles.detail}><Text style={styles.label}>Match Time · IST</Text><Text style={styles.value}>{formatMatchTimeFirst(match.matchSchedule)}</Text></View>
        </View>
        {isMyContestsView ? <View style={styles.roomCard}><Text style={styles.sectionTitle}>Room Details</Text>{isJoined && match.roomId ? <View style={styles.roomRows}><View style={styles.roomRow}><Text style={styles.roomLabel}>Room ID</Text><Text style={styles.roomValue}>{match.roomId}</Text></View><View style={styles.roomRow}><Text style={styles.roomLabel}>Password</Text><Text style={styles.roomValue}>{match.roomPassword || '—'}</Text></View></View> : <Text style={styles.body}>Room ID and password will appear here after you join this match.</Text>}</View> : null}
        <View style={styles.section}><Text style={styles.sectionTitle}>Prize Description</Text><Text style={styles.body}>{match.prizeDescription || 'Prize details will be shown here.'}</Text></View>
        <View style={styles.section}><Text style={styles.sectionTitle}>Rules</Text><Text style={styles.body}>{match.ruleContent || match.ruleTitle || 'Rules will be shown here.'}</Text></View>
        <View style={styles.section}><Pressable style={styles.membersButton} onPress={() => setShowMembers((current) => !current)} accessibilityRole="button" accessibilityState={{ expanded: showMembers }}><View><Text style={styles.sectionTitle}>Joined Members</Text><Text style={styles.memberCount}>{match.participants?.length || 0} member{match.participants?.length === 1 ? '' : 's'}</Text></View><Text style={styles.chevron}>{showMembers ? '−' : '+'}</Text></Pressable>{showMembers ? (match.participants?.length ? match.participants.map((participant) => <View key={participant.id} style={styles.memberRow}><Text style={styles.memberName}>{participant.inGameName || 'Player'}</Text><Text style={styles.memberStatus}>{participant.status || 'Joined'}</Text></View>) : <Text style={styles.body}>No members have joined yet.</Text>) : null}</View>
        {!isMyContestsView ? <View style={styles.joinSection}>
          <View style={styles.spotsCopy}><Text style={styles.spotsLabel}>SPOTS FILLED</Text><Text style={styles.spotsCount}>{match.joinedPlayers}/{match.totalPlayers} joined</Text></View>
          <View style={styles.progressTrack}><View style={[styles.progressFill, { width: `${match.totalPlayers > 0 ? Math.min(100, match.joinedPlayers / match.totalPlayers * 100) : 0}%` }]} /></View>
          <Pressable disabled={isJoined || match.joinedPlayers >= match.totalPlayers || checkingWallet} style={[styles.joinButton, (isJoined || match.joinedPlayers >= match.totalPlayers || checkingWallet) && styles.joinButtonDisabled]} onPress={() => { void requestToJoin(); }}><Text style={styles.joinButtonText}>{checkingWallet ? 'Checking wallet...' : isJoined ? 'Joined' : match.joinedPlayers >= match.totalPlayers ? 'Full' : 'Join Match'}</Text></Pressable>
          <JoinMatchModal matchId={showJoinForm && !isJoined ? match.id : null} userId={user?.id} onClose={() => setShowJoinForm(false)} onJoined={reloadMatch} />
        </View> : null}
      </> : null}
      {match.status === 'Complete' ? <View style={styles.resultsSection}><Text style={styles.resultsTitle}>Match Results</Text>{match.participants?.length ? <View style={styles.resultsTable}><View style={[styles.resultsRow, styles.resultsHeader]}><Text style={[styles.resultsCell, styles.playerCell, styles.resultsHeaderText]}>Member</Text><Text style={[styles.resultsCell, styles.resultsHeaderText]}>Kills</Text><Text style={[styles.resultsCell, styles.resultsHeaderText]}>Position</Text><Text style={[styles.resultsCell, styles.resultsHeaderText]}>Booyah</Text><Text style={[styles.resultsCell, styles.resultsHeaderText]}>Total</Text></View>{match.participants.map((participant) => <View key={participant.id} style={styles.resultsRow}><Text style={[styles.resultsCell, styles.playerCell, styles.resultName]} numberOfLines={1}>{participant.inGameName || participant.username || participant.name || 'Player'}</Text><Text style={[styles.resultsCell, styles.resultValue]}>{participant.kills ?? 0}</Text><Text style={[styles.resultsCell, styles.resultValue]}>{participant.position || '—'}</Text><Text style={[styles.resultsCell, styles.resultValue]}>₹{(participant.booyahPrize ?? 0).toFixed(2)}</Text><Text style={[styles.resultsCell, styles.resultTotal]}>₹{(participant.totalPrize ?? participant.prizeAmount ?? 0).toFixed(2)}</Text></View>)}</View> : <Text style={styles.body}>No result has been entered yet.</Text>}</View> : null}
    </ScrollView>) : null}
  </AccountScreen>;
}

const styles = StyleSheet.create({
  banner: { width: '100%', height: 190, borderRadius: 14, marginBottom: 18 },
  title: { color: '#FFFFFF', fontSize: 25, fontWeight: '800' },
  matchId: { color: '#F7941D', fontSize: 15, fontWeight: '700' as const },
  game: { color: '#AAAAAA', fontSize: 14, marginTop: 5 },
  playerBadge: { alignSelf: 'flex-start', backgroundColor: '#000000', borderRadius: 9, paddingHorizontal: 12, paddingVertical: 7, marginTop: 14 },
  playerBadgeText: { color: '#FFFFFF', fontWeight: '800', fontSize: 13 },
  grid: { display: 'flex', flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 18 },
  detail: { width: '47%', backgroundColor: '#151515', borderRadius: 10, padding: 12 },
  label: { color: '#888888', fontSize: 11 },
  value: { color: '#FFFFFF', fontSize: 15, fontWeight: '700', marginTop: 4 },
  section: { marginTop: 20, padding: 15, borderRadius: 12, backgroundColor: '#151515' },
  sectionTitle: { color: '#F7941D', fontSize: 15, fontWeight: '800', marginBottom: 8 },
  body: { color: '#D0D0D0', lineHeight: 21 },
  roomCard: { marginTop: 20, padding: 15, borderRadius: 12, backgroundColor: '#1A1A1A', borderWidth: 1, borderColor: '#3A2A18' },
  roomRows: { gap: 10 },
  roomRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 4 },
  roomLabel: { color: '#999999', fontSize: 13 },
  memberRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 9, borderBottomWidth: 1, borderBottomColor: '#2A2A2A' },
  memberName: { color: '#FFFFFF', fontWeight: '700' },
  memberStatus: { color: '#999999' },
  roomValue: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
  membersButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  memberCount: { color: '#999999', fontSize: 13, marginTop: -3 },
  chevron: { color: '#F7941D', fontSize: 25, fontWeight: '700', paddingHorizontal: 4 },
  resultsSection: { marginTop: 20, padding: 15, borderRadius: 12, backgroundColor: '#151515', borderWidth: 1, borderColor: '#3A2A18' },
  resultsTitle: { color: '#F7941D', fontSize: 16, fontWeight: '800', marginBottom: 12 },
  resultsTable: { width: '100%' },
  resultsRow: { flexDirection: 'row', alignItems: 'center', minHeight: 48, borderBottomWidth: 1, borderBottomColor: '#292929' },
  resultsHeader: { minHeight: 34, borderBottomColor: '#444444' },
  resultsCell: { flex: 0.8, color: '#D0D0D0', fontSize: 10, fontWeight: '600' },
  playerCell: { flex: 1.35, paddingRight: 4 },
  resultsHeaderText: { color: '#888888', fontSize: 9, fontWeight: '700', textTransform: 'uppercase' },
  resultName: { color: '#FFFFFF', fontSize: 10, fontWeight: '700' },
  resultValue: { color: '#D0D0D0', fontSize: 10, fontWeight: '600' },
  resultTotal: { color: '#F7941D', fontSize: 10, fontWeight: '800' },
  joinSection: { marginTop: 20, padding: 15, borderRadius: 12, backgroundColor: '#151F32' },
  spotsCopy: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  spotsLabel: { color: '#B8C5D9', fontSize: 11, fontWeight: '800' },
  spotsCount: { color: '#FFFFFF', fontSize: 12, fontWeight: '700' },
  progressTrack: { height: 8, overflow: 'hidden', borderRadius: 5, backgroundColor: '#29364B' },
  progressFill: { height: '100%', borderRadius: 5, backgroundColor: '#7C3AED' },
  joinButton: { marginTop: 22, borderRadius: 12, backgroundColor: '#F7941D', alignItems: 'center', paddingVertical: 14, marginBottom: 24 },
  joinButtonDisabled: { backgroundColor: '#475268' },
  joinButtonText: { color: '#111111', fontWeight: '800', fontSize: 16 },
});
