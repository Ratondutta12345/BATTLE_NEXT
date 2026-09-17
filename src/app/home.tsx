import { Redirect, useFocusEffect, useRouter } from 'expo-router';
import { Image } from 'expo-image';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Dimensions, FlatList, Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { SymbolView } from 'expo-symbols';
import { AccountAction } from '@/components/home/AccountAction';
import { ContestAction } from '@/components/home/ContestAction';
import { GameCard } from '@/components/home/GameCard';
import { HomeHeader } from '@/components/home/HomeHeader';
import { BottomNav } from '@/components/navigation/BottomNav';
import { useAuth } from '@/context/AuthContext';
import { API_ENDPOINTS, apiRequest, resolveApiUrl, type Announcement, type Banner, type Game } from '@/constants/api';
import { AuthColors, AppHeaderColors } from '@/constants/theme';

export default function HomeScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const [announcement, setAnnouncement] = useState<Announcement | null>(null);
  const [announcementState, setAnnouncementState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [banners, setBanners] = useState<Banner[]>([]);
  const [bannerIndex, setBannerIndex] = useState(0);
  const bannerListRef = useRef<FlatList<Banner>>(null);
  const [games, setGames] = useState<Game[]>([]);
  const [notificationCount, setNotificationCount] = useState(0);
  const [coinBalance, setCoinBalance] = useState(0);

  useEffect(() => {
    let cancelled = false;
    apiRequest<{ announcements: Announcement[] }>(API_ENDPOINTS.activeAnnouncements).then((result) => {
      if (cancelled) return;
      if (result.ok) {
        setAnnouncement(result.data.announcements[0] ?? null);
        setAnnouncementState('ready');
      } else {
        setAnnouncementState('error');
      }
    });
    return () => { cancelled = true; };
  }, []);

  useFocusEffect(
    useCallback(() => {
      if (!user) return undefined;
      let active = true;
      apiRequest<{ unreadCount: number }>(API_ENDPOINTS.notifications(user.id)).then((result) => {
        if (active && result.ok) setNotificationCount(result.data.unreadCount);
      });
      apiRequest<{ wallet: { coinBalance: number } }>(API_ENDPOINTS.wallet(user.id)).then((result) => {
        if (active && result.ok) setCoinBalance(Number(result.data.wallet.coinBalance) || 0);
      });
      return () => { active = false; };
    }, [user]),
  );

  useEffect(() => {
    apiRequest<{ games: Game[] }>(API_ENDPOINTS.activeGames).then((result) => {
      if (result.ok) setGames(result.data.games);
    });
  }, []);

  useEffect(() => {
    apiRequest<{ banners: Banner[] }>(API_ENDPOINTS.activeBanners).then((result) => {
      if (result.ok) setBanners(result.data.banners);
    });
  }, []);

  useEffect(() => {
    if (banners.length <= 1) return;

    const timer = setInterval(() => {
      setBannerIndex((currentIndex) => {
        const nextIndex = (currentIndex + 1) % banners.length;
        bannerListRef.current?.scrollToIndex({ index: nextIndex, animated: true });
        return nextIndex;
      });
    }, 3000);

    return () => clearInterval(timer);
  }, [banners.length]);

  if (!user) {
    return <Redirect href="/login" />;
  }

  return (
    <View style={styles.screen}>
      <HomeHeader
        coinBalance={coinBalance}
        notificationCount={notificationCount}
        onNotificationPress={() => router.push('/notifications')}
        onCoinPress={() => router.push('/wallet')}
      />
      <ScrollView contentContainerStyle={[styles.body, { paddingBottom: insets.bottom + 24 }]} showsVerticalScrollIndicator={false}>
        <View style={styles.announcementCard}>
          <View style={styles.announcementIcon}>
            <SymbolView name={{ android: 'campaign', ios: 'megaphone.fill' }} size={24} tintColor="#FFFFFF" fallback={<Text style={styles.fallback}>!</Text>} />
          </View>
          <View style={styles.announcementCopy}>
            {announcementState === 'loading' ? <ActivityIndicator color={AuthColors.primary} /> : null}
            {announcementState === 'error' ? <Text style={styles.announcementText}>Announcements are temporarily unavailable.</Text> : null}
            {announcementState === 'ready' && announcement ? (
              <><Text style={styles.announcementTitle} numberOfLines={1}>{announcement.title || 'Announcement'}</Text><Text style={styles.announcementText} numberOfLines={3}>{announcement.message}</Text></>
            ) : null}
            {announcementState === 'ready' && !announcement ? <Text style={styles.announcementText}>No active announcements right now.</Text> : null}
          </View>
        </View>

        <Text style={styles.sectionTitle}>Account Details</Text>
        <View style={styles.actionsRow}>
          <AccountAction label="My Profile" icon="person" onPress={() => router.push('/profile')} />
          <AccountAction label="My Wallet" icon="account_balance_wallet" onPress={() => router.push('/wallet')} />
          <AccountAction label="Top Players" icon="emoji_events" onPress={() => router.push('/top-players')} />
          <AccountAction label="Contact Us" icon="headset_mic" onPress={() => router.push('/contact')} />
        </View>

        <View style={styles.bannerSection}>
          {banners.length ? (
            <>
              <FlatList
                ref={bannerListRef}
                data={banners}
                horizontal
                pagingEnabled
                showsHorizontalScrollIndicator={false}
                keyExtractor={(item) => String(item.id)}
                onMomentumScrollEnd={(event) => setBannerIndex(Math.round(event.nativeEvent.contentOffset.x / (Dimensions.get('window').width - 32)))}
                renderItem={({ item }) => <Pressable style={styles.bannerFrame} onPress={() => item.targetUrl && Linking.openURL(item.targetUrl)} disabled={!item.targetUrl} accessibilityRole={item.targetUrl ? 'link' : 'imagebutton'} accessibilityLabel={item.targetUrl ? 'Open banner link' : 'Banner'}><Image source={{ uri: resolveApiUrl(item.imageUrl) }} style={styles.bannerImage} contentFit="cover" /></Pressable>}
              />
              {banners.length > 1 ? <View style={styles.dots}>{banners.map((item, index) => <View key={item.id} style={[styles.dot, index === bannerIndex && styles.activeDot]} />)}</View> : null}
            </>
          ) : <View style={styles.bannerEmpty}><Text style={styles.bannerEmptyText}>No active banners</Text></View>}
        </View>

        <Text style={styles.sectionTitle}>My Contest</Text>
        <View style={styles.contestRow}>
          <ContestAction label="Upcoming" onPress={() => router.push('/contests/upcoming')} />
          <ContestAction label="Ongoing" onPress={() => router.push('/contests/ongoing')} />
          <ContestAction label="Completed" onPress={() => router.push('/contests/completed')} />
        </View>

        <Text style={styles.sectionTitle}>eSport Games</Text>
        {games.length ? <View style={styles.gameGrid}>{games.map((game) => <GameCard key={game.id} game={game} onPress={() => router.push({ pathname: '/game/[id]', params: { id: String(game.id) } })} />)}</View> : <Text style={styles.emptyGames}>No active games available.</Text>}
      </ScrollView>
      <BottomNav />
    </View>
  );
}

var styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: AppHeaderColors.background,
  },
  body: {
    paddingHorizontal: 16,
    paddingTop: 18,
  },
  announcementCard: {
    minHeight: 86,
    flexDirection: 'row',
    overflow: 'hidden',
    borderRadius: 14,
    backgroundColor: '#FFFFFF',
  },
  announcementIcon: {
    width: 68,
    backgroundColor: AuthColors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  announcementCopy: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  announcementTitle: {
    color: '#1A1A1A',
    fontSize: 14,
    fontWeight: '800',
    marginBottom: 3,
  },
  announcementText: {
    color: '#333333',
    fontSize: 13,
    lineHeight: 19,
  },
  fallback: {
    color: '#FFFFFF',
    fontSize: 28,
    fontWeight: '800',
  },
  sectionTitle: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '800',
    marginTop: 28,
    marginBottom: 18,
  },
  actionsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  bannerSection: {
    marginTop: 28,
  },
  bannerFrame: {
    width: Dimensions.get('window').width - 32,
    height: 156,
    borderRadius: 14,
    overflow: 'hidden',
    backgroundColor: '#132238',
  },
  bannerImage: {
    width: '100%',
    height: '100%',
  },
  bannerEmpty: {
    height: 156,
    borderRadius: 14,
    backgroundColor: '#132238',
    alignItems: 'center',
    justifyContent: 'center',
  },
  bannerEmptyText: {
    color: '#B8C5D9',
    fontSize: 13,
  },
  dots: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 6,
    marginTop: 10,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#607089',
  },
  activeDot: {
    width: 18,
    backgroundColor: AuthColors.primary,
  },
  contestRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  gameGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: 90,
  },
  emptyGames: {
    color: '#B8C5D9',
    fontSize: 13,
    marginBottom: 100,
  },
});
