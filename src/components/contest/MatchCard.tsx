import { Image } from 'expo-image';
import { SymbolView } from 'expo-symbols';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { resolveApiUrl } from '@/constants/api';
import { formatMatchTimeFirst } from '@/utils/matchTime';

export type MatchCardInfo = {
  id: number;
  matchId?: number | null;
  gameName?: string | null;
  startsAt?: string | Date | null;
  matchSchedule?: string | Date | null;
  bannerUrl?: string | null;
  prizePool?: number | null;
  perKill?: number | null;
  entryFee?: number | null;
  teamType?: string | null;
  gameVersion?: string | null;
  map?: string | null;
  totalPlayers?: number | null;
  joinedPlayers?: number | null;
  userEntryCount?: number;
};

type MatchCardProps = {
  match: MatchCardInfo;
  onPress: () => void;
  onAction: () => void;
  actionLabel?: string;
  actionDisabled?: boolean;
  disabledLabel?: string;
};

function formatSchedule(value: MatchCardInfo['startsAt']) {
  if (!value) return 'Schedule to be announced';
  return formatMatchTimeFirst(value);
}

function formatAmount(amount: number | null | undefined) {
  return `₹${amount ?? 0}`;
}

export function MatchCard({
  match,
  onPress,
  onAction,
  actionLabel = 'JOIN',
  actionDisabled = false,
  disabledLabel = 'FULL',
}: MatchCardProps) {
  const totalPlayers = Math.max(0, match.totalPlayers ?? 0);
  const joinedPlayers = Math.max(0, match.joinedPlayers ?? 0);
  const progress = totalPlayers > 0 ? Math.min(100, (joinedPlayers / totalPlayers) * 100) : 0;
  const title = `${match.gameName || 'FF MAX'} - Match #${match.matchId ?? match.id}`;
  const buttonLabel = actionDisabled ? disabledLabel : actionLabel;

  return (
    <View style={styles.frame}>
      <View style={styles.card}>
        <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={`Open ${title}`}>
          {match.bannerUrl ? (
            <Image source={{ uri: resolveApiUrl(match.bannerUrl) }} style={styles.banner} contentFit="cover" />
          ) : (
            <View style={[styles.banner, styles.bannerFallback]}>
              <SymbolView name={{ android: 'emoji_events', ios: 'trophy.fill' }} size={32} tintColor="#D4B2FF" fallback={<Text style={styles.fallbackIcon}>★</Text>} />
            </View>
          )}

          <View style={styles.header}>
            <View style={styles.avatar}>
              {match.bannerUrl ? (
                <Image source={{ uri: resolveApiUrl(match.bannerUrl) }} style={styles.avatarImage} contentFit="cover" />
              ) : (
                <SymbolView name={{ android: 'sports_esports', ios: 'gamecontroller.fill' }} size={24} tintColor="#6C5CE7" fallback={<Text style={styles.avatarFallback}>G</Text>} />
              )}
            </View>
            <View style={styles.heading}>
              <Text style={styles.title} numberOfLines={1}>{title}</Text>
              <View style={styles.schedule}>
                <SymbolView name={{ android: 'calendar_month', ios: 'calendar' }} size={14} tintColor="#6C5CE7" fallback={<Text style={styles.scheduleFallback}>D</Text>} />
                <Text style={styles.date} numberOfLines={1}>{formatSchedule(match.startsAt ?? match.matchSchedule)}</Text>
              </View>
            </View>
          </View>

          <View style={styles.stats}>
            <View style={[styles.statsRow, styles.firstStatsRow]}>
              <View style={styles.statCell}>
                <Text style={styles.label}>PRIZE POOL</Text>
                <View style={styles.valueWithIcon}>
                  <SymbolView name={{ android: 'emoji_events', ios: 'trophy.fill' }} size={15} tintColor="#6C5CE7" fallback={<Text style={styles.valueIconFallback}>★</Text>} />
                  <Text style={styles.value} numberOfLines={1}>{formatAmount(match.prizePool)}</Text>
                </View>
              </View>
              <View style={[styles.statCell, styles.centerCell]}>
                <Text style={styles.label}>PER KILL</Text>
                <View style={styles.valueWithIcon}>
                  <SymbolView name={{ android: 'bolt', ios: 'bolt.fill' }} size={15} tintColor="#6C5CE7" fallback={<Text style={styles.valueIconFallback}>ϟ</Text>} />
                  <Text style={styles.value} numberOfLines={1}>{formatAmount(match.perKill)}</Text>
                </View>
              </View>
              <View style={[styles.statCell, styles.lastCell]}>
                <Text style={styles.label}>ENTRY FEE</Text>
                <View style={styles.valueWithIcon}>
                  <SymbolView name={{ android: 'confirmation_number', ios: 'ticket.fill' }} size={15} tintColor="#6C5CE7" fallback={<Text style={styles.valueIconFallback}>#</Text>} />
                  <Text style={styles.value} numberOfLines={1}>{formatAmount(match.entryFee)}</Text>
                </View>
              </View>
            </View>

            <View style={styles.statsRow}>
              <View style={styles.statCell}>
                <Text style={styles.label}>TYPE</Text>
                <Text style={styles.value} numberOfLines={1}>{match.teamType || '—'}</Text>
              </View>
              <View style={[styles.statCell, styles.centerCell]}>
                <Text style={styles.label}>VERSION</Text>
                <Text style={styles.value} numberOfLines={1}>{match.gameVersion || '—'}</Text>
              </View>
              <View style={[styles.statCell, styles.lastCell]}>
                <Text style={styles.label}>MAP</Text>
                <Text style={styles.value} numberOfLines={1}>{match.map || '—'}</Text>
              </View>
            </View>
          </View>
        </Pressable>

        <View style={styles.footer}>
          <View style={styles.slots}>
            <View
              style={styles.progressTrack}
              accessibilityRole="progressbar"
              accessibilityValue={{ min: 0, max: totalPlayers, now: Math.min(joinedPlayers, totalPlayers) }}
            >
              <View style={[styles.progressFill, { width: `${progress}%` }]} />
            </View>
            <Text style={styles.slotCount}>{joinedPlayers}/{totalPlayers} slots filled</Text>
          </View>
          <Pressable
            onPress={onAction}
            disabled={actionDisabled}
            style={({ pressed }) => [styles.actionButton, actionDisabled && styles.actionDisabled, pressed && !actionDisabled && styles.actionPressed]}
            accessibilityRole="button"
            accessibilityState={{ disabled: actionDisabled }}
          >
            <Text style={styles.actionText}>{buttonLabel}</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  frame: { padding: 7, borderRadius: 17, backgroundColor: '#0B132B' },
  card: { overflow: 'hidden', borderRadius: 12, backgroundColor: '#FFFFFF' },
  banner: { width: '100%', height: 173, backgroundColor: '#162449' },
  bannerFallback: { alignItems: 'center', justifyContent: 'center' },
  fallbackIcon: { color: '#D4B2FF', fontSize: 30 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 14, paddingTop: 14, paddingBottom: 12 },
  avatar: { width: 50, height: 50, flexShrink: 0, overflow: 'hidden', alignItems: 'center', justifyContent: 'center', borderRadius: 10, backgroundColor: '#F0EDFA' },
  avatarImage: { width: '100%', height: '100%' },
  avatarFallback: { color: '#6C5CE7', fontSize: 20, fontWeight: '800' },
  heading: { flex: 1, minWidth: 0 },
  title: { color: '#172033', fontSize: 16, fontWeight: '800' },
  schedule: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', gap: 6, marginTop: 6, paddingHorizontal: 8, paddingVertical: 5, borderRadius: 6, backgroundColor: '#F2EFFF' },
  scheduleFallback: { color: '#6C5CE7', fontSize: 10, fontWeight: '800' },
  date: { color: '#5B5472', fontSize: 11, fontWeight: '700' },
  stats: { paddingHorizontal: 14, paddingBottom: 8 },
  statsRow: { flexDirection: 'row', minHeight: 57 },
  firstStatsRow: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#E8EAF0' },
  statCell: { flex: 1, minWidth: 0, justifyContent: 'center', paddingVertical: 8, paddingRight: 5 },
  centerCell: { alignItems: 'center', borderLeftWidth: StyleSheet.hairlineWidth, borderRightWidth: StyleSheet.hairlineWidth, borderColor: '#E8EAF0', paddingHorizontal: 5 },
  lastCell: { alignItems: 'flex-end', paddingRight: 0 },
  label: { marginBottom: 5, color: '#858B98', fontSize: 9, fontWeight: '700' },
  valueWithIcon: { flexDirection: 'row', alignItems: 'center', gap: 4, minWidth: 0 },
  valueIconFallback: { color: '#6C5CE7', fontSize: 13, fontWeight: '800' },
  value: { flexShrink: 1, color: '#172033', fontSize: 13, fontWeight: '800' },
  footer: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 14, paddingTop: 10, paddingBottom: 14, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#E8EAF0' },
  slots: { flex: 1, minWidth: 0 },
  progressTrack: { height: 7, overflow: 'hidden', borderRadius: 5, backgroundColor: '#E9E5F4' },
  progressFill: { height: '100%', borderRadius: 5, backgroundColor: '#7C3AED' },
  slotCount: { marginTop: 5, color: '#777F8D', fontSize: 11, fontWeight: '600' },
  actionButton: { minWidth: 96, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 20, paddingVertical: 12, borderRadius: 9, backgroundColor: '#6C5CE7' },
  actionDisabled: { backgroundColor: '#B7B3CA' },
  actionPressed: { opacity: 0.8 },
  actionText: { color: '#FFFFFF', fontSize: 13, fontWeight: '800' },
});