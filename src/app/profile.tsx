import { Redirect, useRouter } from 'expo-router';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { SymbolView } from 'expo-symbols';
import { useEffect, useState } from 'react';
import { Alert, Linking, Pressable, ScrollView, Share, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { HomeHeader } from '@/components/home/HomeHeader';
import { BottomNav } from '@/components/navigation/BottomNav';
import { API_ENDPOINTS, apiRequest, resolveApiUrl, type AuthUser } from '@/constants/api';
import { AppHeaderColors } from '@/constants/theme';
import { useAuth } from '@/context/AuthContext';

const profileActions = [
  { label: 'My Profile', icon: 'person', route: '/profile' },
  { label: 'My Wallet', icon: 'account_balance_wallet', route: '/wallet' },
  { label: 'Top Players', icon: 'emoji_events', route: '/top-players' },
  { label: 'Notifications', icon: 'notifications', route: '/notifications' },
  { label: 'Contact Us', icon: 'headset_mic', route: '/contact' },
];

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: AppHeaderColors.background },
  content: { padding: 16, paddingBottom: 100 },
  profileHero: { alignItems: 'center', paddingVertical: 12 },
  avatarButton: { width: 108, height: 108, borderRadius: 54, alignItems: 'center', justifyContent: 'center', backgroundColor: '#18283A', borderWidth: 2, borderColor: '#F7941D', position: 'relative' },
  avatar: { width: '100%', height: '100%', borderRadius: 54 },
  avatarFallback: { color: '#F7941D', fontSize: 38, fontWeight: '300' },
  cameraBadge: { position: 'absolute', right: -2, bottom: 1, width: 30, height: 30, borderRadius: 15, backgroundColor: '#F7941D', alignItems: 'center', justifyContent: 'center', borderWidth: 3, borderColor: AppHeaderColors.background },
  name: { color: '#FFFFFF', fontSize: 23, fontWeight: '800', marginTop: 12 },
  username: { color: '#A9B6C8', fontSize: 13, marginTop: 3 },
  statsRow: { flexDirection: 'row', backgroundColor: '#132238', borderRadius: 14, paddingVertical: 15, marginTop: 12 },
  stat: { flex: 1, alignItems: 'center', borderRightWidth: 1, borderRightColor: '#29405A' },
  statValue: { color: '#F7941D', fontSize: 20, fontWeight: '800' },
  statLabel: { color: '#B8C5D9', fontSize: 10, textAlign: 'center', marginTop: 4 },
  menu: { marginTop: 18, backgroundColor: '#132238', borderRadius: 14, overflow: 'hidden' },
  menuButton: { flexDirection: 'row', alignItems: 'center', minHeight: 54, paddingHorizontal: 14, borderBottomWidth: 1, borderBottomColor: '#263B52' },
  menuIcon: { width: 34, alignItems: 'flex-start' },
  iconFallback: { color: '#F7941D', fontSize: 22 },
  menuText: { flex: 1, color: '#FFFFFF', fontSize: 14, fontWeight: '600' },
  chevron: { color: '#7E91A8', fontSize: 26, fontWeight: '300' },
  logoutButton: { borderBottomWidth: 0 },
  logoutText: { flex: 1, color: '#E36B5D', fontSize: 14, fontWeight: '700' },
});

export default function ProfileScreen() {
  const router = useRouter();
  const { user, setUser, signOut } = useAuth();
  const [profile, setProfile] = useState<AuthUser | null>(user);

  useEffect(() => {
    if (!user) return;
    apiRequest<{ user: AuthUser }>(API_ENDPOINTS.userProfile(user.id)).then((result) => {
      if (result.ok) {
        setProfile(result.data.user);
        void setUser(result.data.user);
      }
    });
  }, [user?.id, setUser]);

  if (!user) return <Redirect href="/login" />;

  async function chooseAvatar() {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Permission required', 'Allow photo access to choose a profile image.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.85,
    });
    const asset = result.canceled ? null : result.assets[0];
    if (!asset) return;
    try {
      const imageResponse = await fetch(asset.uri);
      const imageBlob = await imageResponse.blob();
      const formData = new FormData();
      formData.append('avatar', imageBlob, `profile-${user.id}.jpg`);
      const response = await fetch(API_ENDPOINTS.userAvatar(user.id), { method: 'PATCH', body: formData });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Upload failed');
      const nextProfile = { ...(profile || user), avatarUrl: data.avatarUrl };
      setProfile(nextProfile);
      await setUser(nextProfile);
    } catch (error) {
      Alert.alert('Upload failed', error instanceof Error ? error.message : 'Could not upload image.');
    }
  }

  function openExtra(label: string) {
    if (label === 'Rate App') {
      Linking.openURL('https://play.google.com/store');
      return;
    }
    if (label === 'More Apps') {
      Linking.openURL('https://play.google.com/store/apps');
      return;
    }
    if (label === 'Share App') {
      Share.share({ message: 'Join me on BATTLE-NEXT esports tournaments.' });
      return;
    }
    Alert.alert(label, `${label} information will be available soon.`);
  }

  const menuItems = [
    ...profileActions,
    { label: 'FAQ', icon: 'help', route: '/faq' },
    { label: 'About Us', icon: 'info', route: '/about' },
    { label: 'Privacy Policy', icon: 'privacy_tip', route: '/privacy' },
    { label: 'Terms & Conditions', icon: 'description', route: '/terms' },
    { label: 'Rate App', icon: 'star', onPress: () => openExtra('Rate App') },
    { label: 'Share App', icon: 'share', onPress: () => openExtra('Share App') },
    { label: 'More Apps', icon: 'apps', onPress: () => openExtra('More Apps') },
  ];

  return <SafeAreaView style={styles.screen}>
    <HomeHeader coinBalance={profile?.coinsWon ?? 0} onCoinPress={() => router.push('/wallet')} onNotificationPress={() => router.push('/notifications')} />
    <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <View style={styles.profileHero}>
        <Pressable onPress={chooseAvatar} style={styles.avatarButton} accessibilityRole="button" accessibilityLabel="Upload profile image">
          {profile?.avatarUrl ? <Image source={{ uri: resolveApiUrl(profile.avatarUrl) }} style={styles.avatar} contentFit="cover" /> : <SymbolView name={{ android: 'person', ios: 'person.fill' }} size={42} tintColor="#F7941D" fallback={<Text style={styles.avatarFallback}>+</Text>} />}
          <View style={styles.cameraBadge}><SymbolView name={{ android: 'photo_camera', ios: 'camera.fill' }} size={14} tintColor="#111111" fallback={<Text>+</Text>} /></View>
        </Pressable>
        <Text style={styles.name}>{profile?.fullName || profile?.username}</Text>
        <Text style={styles.username}>@{profile?.username}</Text>
      </View>
      <View style={styles.statsRow}>
        <Stat label="Matches Played" value={profile?.matches ?? 0} />
        <Stat label="Total Kills" value={profile?.totalKills ?? 0} />
        <Stat label="Coins Won" value={profile?.coinsWon ?? 0} />
      </View>
      <View style={styles.menu}>
        {menuItems.map((item) => <Pressable key={item.label} style={styles.menuButton} onPress={'route' in item ? () => router.push(item.route as never) : item.onPress} accessibilityRole="button"><View style={styles.menuIcon}><SymbolView name={{ android: item.icon, ios: item.icon }} size={20} tintColor="#F7941D" fallback={<Text style={styles.iconFallback}>•</Text>} /></View><Text style={styles.menuText}>{item.label}</Text><Text style={styles.chevron}>›</Text></Pressable>)}
        <Pressable style={[styles.menuButton, styles.logoutButton]} onPress={async () => { await signOut(); router.replace('/login'); }} accessibilityRole="button"><View style={styles.menuIcon}><SymbolView name={{ android: 'logout', ios: 'rectangle.portrait.and.arrow.right' }} size={20} tintColor="#E36B5D" fallback={<Text style={styles.iconFallback}>•</Text>} /></View><Text style={styles.logoutText}>Log Out</Text><Text style={styles.chevron}>›</Text></Pressable>
      </View>
    </ScrollView>
    <BottomNav />
  </SafeAreaView>;
}

function Stat({ label, value }: { label: string; value: number }) {
  return <View style={styles.stat}><Text style={styles.statValue}>{value}</Text><Text style={styles.statLabel}>{label}</Text></View>;
}