import { useEffect, useState } from 'react';
import { useRef } from 'react';
import { Animated, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';

import { resolveApiUrl, type Match } from '@/constants/api';
import { formatMatchTimeFirst, parseMatchSchedule } from '@/utils/matchTime';

type UpcomingMyContestDetailsProps = {
  match: Match;
  userId?: number;
  isJoined: boolean;
};

function getCountdown(matchTime: string, startedAt: string | undefined, now: number) {
  const parsedSchedule = parseMatchSchedule(matchTime);
  if (!parsedSchedule) return { label: 'Match time unavailable', progress: 0 };

  const matchStart = parsedSchedule.getTime();
  const remainingSeconds = Math.max(0, Math.floor((matchStart - now) / 1000));
  const parsedOrigin = parseMatchSchedule(startedAt || matchTime);
  const totalDuration = parsedOrigin ? matchStart - parsedOrigin.getTime() : 0;
  const progress = totalDuration > 0
    ? Math.min(100, Math.max(0, ((totalDuration - Math.max(0, matchStart - now)) / totalDuration) * 100))
    : remainingSeconds === 0 ? 100 : 0;
  if (remainingSeconds === 0) return { label: 'Match is starting now', progress };

  const days = Math.floor(remainingSeconds / 86400);
  const hours = Math.floor((remainingSeconds % 86400) / 3600);
  const minutes = Math.floor((remainingSeconds % 3600) / 60);
  const seconds = remainingSeconds % 60;
  const clock = [hours, minutes, seconds].map((part) => String(part).padStart(2, '0')).join(':');
  const label = days > 0 ? `${days} ${days === 1 ? 'day' : 'days'} ${clock}` : clock;
  return { label, progress };
}

export function UpcomingMyContestDetails({ match, userId, isJoined }: UpcomingMyContestDetailsProps) {
  const [now, setNow] = useState(Date.now());
  const [showMembers, setShowMembers] = useState(false);
  const progressAnimation = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, []);

  const myEntry = match.participants?.find((participant) => Number(participant.userId) === userId);
  const countdown = getCountdown(match.matchSchedule, match.createdAt ?? myEntry?.joinedAt, now);

  useEffect(() => {
    const animation = Animated.timing(progressAnimation, {
      toValue: countdown.progress,
      duration: 900,
      useNativeDriver: false,
    });
    animation.start();
    return () => animation.stop();
  }, [countdown.progress, progressAnimation]);

  return <>
    <ScrollView showsVerticalScrollIndicator={false}>
      {match.bannerUrl ? <Image source={{ uri: resolveApiUrl(match.bannerUrl) }} style={styles.banner} contentFit="cover" /> : <View style={[styles.banner, styles.bannerFallback]}><Text style={styles.bannerFallbackText}>{match.gameName || 'Match'}</Text></View>}
      <View style={styles.titleRow}>
        <View style={styles.titleCopy}>
          <Text style={styles.title}>{match.name}</Text>
          <Text style={styles.subtitle}>{match.gameName || 'Games Slot'} · v{match.gameVersion}</Text>
        </View>
        <View style={styles.playerBadge}><Text style={styles.playerBadgeText}>{match.joinedPlayers}/{match.totalPlayers} joined</Text></View>
      </View>

      <View style={styles.grid}>
        <View style={styles.detail}><Text style={styles.label}>TEAM</Text><Text style={styles.value}>{match.teamType}</Text></View>
        <View style={styles.detail}><Text style={styles.label}>MAP</Text><Text style={styles.value}>{match.map}</Text></View>
        <View style={styles.detail}><Text style={styles.label}>ENTRY FEE</Text><Text style={styles.value}>₹{match.entryFee}</Text></View>
        <View style={styles.detail}><Text style={styles.label}>PRIZE POOL</Text><Text style={styles.value}>₹{match.prizePool}</Text></View>
        <View style={styles.detail}><Text style={styles.label}>PER KILL</Text><Text style={styles.value}>₹{match.perKill}</Text></View>
        <View style={styles.detail}><Text style={styles.label}>MATCH TIME · IST</Text><Text style={styles.timeValue}>{formatMatchTimeFirst(match.matchSchedule)}</Text></View>
      </View>

      <View style={styles.countdownCard}>
        <Text style={styles.countdownLabel}>MATCH STARTS IN</Text>
        <Text style={styles.countdownValue}>{countdown.label}</Text>
        <View style={styles.countdownTrack}>
          <Animated.View style={[styles.countdownProgress, { width: progressAnimation.interpolate({ inputRange: [0, 100], outputRange: ['0%', '100%'] }) }]} />
        </View>
        <Text style={styles.progressPercent}>{Math.round(countdown.progress)}% elapsed</Text>
      </View>

      <View style={styles.roomCard}>
        <Text style={styles.sectionTitle}>Room Details</Text>
        {isJoined && match.roomId ? <>
          <View style={styles.roomRow}><Text style={styles.roomLabel}>Room ID</Text><Text style={styles.roomValue}>{match.roomId}</Text></View>
          <View style={styles.roomRow}><Text style={styles.roomLabel}>Password</Text><Text style={styles.roomValue}>{match.roomPassword || '—'}</Text></View>
        </> : <Text style={styles.body}>Room ID and password will appear here after you join this match.</Text>}
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Prize Description</Text>
        <Text style={styles.body}>{match.prizeDescription || 'Prize details will be shown here.'}</Text>
      </View>
      <View style={styles.actionRow}>
        <Pressable style={styles.secondaryAction} onPress={() => setShowMembers(true)} accessibilityRole="button">
          <Text style={styles.secondaryActionText}>Joined Members</Text>
        </Pressable>
      </View>
    </ScrollView>

    <Modal visible={showMembers} transparent animationType="fade" onRequestClose={() => setShowMembers(false)}>
      <View style={styles.modalBackdrop}>
        <View style={styles.modalCard}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Joined Members</Text>
            <Pressable onPress={() => setShowMembers(false)} accessibilityRole="button" accessibilityLabel="Close joined members"><Text style={styles.modalClose}>×</Text></Pressable>
          </View>
          <ScrollView style={styles.memberList}>
            {match.participants?.length ? match.participants.map((participant) => (
              <View key={participant.id} style={styles.memberRow}>
                <Text style={styles.memberName}>{participant.inGameName || participant.username || participant.name || 'Player'}</Text>
              </View>
            )) : <Text style={styles.body}>No members have joined yet.</Text>}
          </ScrollView>
          <Pressable style={styles.modalDone} onPress={() => setShowMembers(false)}><Text style={styles.modalDoneText}>Done</Text></Pressable>
        </View>
      </View>
    </Modal>
  </>;
}

const styles = StyleSheet.create({
  banner: { width: '100%', height: 190, marginBottom: 16, borderRadius: 14 },
  bannerFallback: { alignItems: 'center', justifyContent: 'center', backgroundColor: '#132238' },
  bannerFallbackText: { color: '#D4B2FF', fontSize: 22, fontWeight: '800' },
  titleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  titleCopy: { flex: 1, minWidth: 0 },
  title: { color: '#FFFFFF', fontSize: 22, fontWeight: '800' },
  subtitle: { color: '#AEBBD0', fontSize: 13, marginTop: 5 },
  playerBadge: { paddingHorizontal: 10, paddingVertical: 7, borderRadius: 9, backgroundColor: '#24164A' },
  playerBadgeText: { color: '#DCCBFF', fontSize: 11, fontWeight: '800' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: 8, marginTop: 18 },
  detail: { width: '31.5%', minHeight: 68, justifyContent: 'center', padding: 10, borderRadius: 10, backgroundColor: '#151F32' },
  label: { color: '#8793A7', fontSize: 10, fontWeight: '700' },
  value: { color: '#FFFFFF', fontSize: 13, fontWeight: '700', marginTop: 5 },
  timeValue: { color: '#FFFFFF', fontSize: 11, fontWeight: '700', marginTop: 5 },
  countdownCard: { alignItems: 'center', marginTop: 18, padding: 18, borderRadius: 13, backgroundColor: '#24164A', borderWidth: 1, borderColor: '#5635A5' },
  countdownLabel: { color: '#C8B6F0', fontSize: 11, fontWeight: '800', letterSpacing: 1 },
  countdownValue: { color: '#FFFFFF', fontSize: 27, fontWeight: '900', fontVariant: ['tabular-nums'], marginTop: 7, textAlign: 'center' },
  countdownTrack: { width: '100%', height: 8, overflow: 'hidden', marginTop: 14, borderRadius: 5, backgroundColor: '#46356B' },
  countdownProgress: { height: '100%', borderRadius: 5, backgroundColor: '#7C3AED' },
  progressPercent: { alignSelf: 'flex-end', marginTop: 5, color: '#C8B6F0', fontSize: 10, fontWeight: '700' },
  roomCard: { marginTop: 18, padding: 15, borderRadius: 12, backgroundColor: '#151F32', borderWidth: 1, borderColor: '#354661' },
  section: { marginTop: 14, padding: 15, borderRadius: 12, backgroundColor: '#151F32' },
  sectionTitle: { color: '#C7B4F2', fontSize: 15, fontWeight: '800', marginBottom: 8 },
  roomRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 7 },
  roomLabel: { color: '#B8C5D9', fontSize: 13 },
  roomValue: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
  body: { color: '#D0D8E5', lineHeight: 21 },
  actionRow: { flexDirection: 'row', gap: 10, marginTop: 18, marginBottom: 24 },
  secondaryAction: { flex: 1, minHeight: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderRadius: 10, borderWidth: 1, borderColor: '#7254C7', backgroundColor: '#1B1531' },
  secondaryActionText: { color: '#E6DCFF', fontSize: 12, fontWeight: '800' },
  modalBackdrop: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 20, backgroundColor: 'rgba(0, 0, 0, 0.72)' },
  modalCard: { width: '100%', maxWidth: 430, maxHeight: '80%', padding: 20, borderRadius: 16, backgroundColor: '#101A2A', borderWidth: 1, borderColor: '#354661' },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  modalTitle: { color: '#FFFFFF', fontSize: 19, fontWeight: '800' },
  modalClose: { color: '#B8C5D9', fontSize: 28, lineHeight: 30, paddingHorizontal: 4 },
  modalSubtitle: { color: '#AAB6C8', fontSize: 13, marginTop: 5, marginBottom: 13 },
  memberList: { flexGrow: 0 },
  memberRow: { paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#344156' },
  memberName: { color: '#FFFFFF', fontWeight: '700' },
  modalDone: { flex: 1, alignItems: 'center', justifyContent: 'center', minHeight: 44, paddingHorizontal: 15, borderRadius: 9, backgroundColor: '#6C5CE7' },
  modalDoneText: { color: '#FFFFFF', fontWeight: '800' },
});