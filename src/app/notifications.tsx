import { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';

import { AccountScreen, accountStyles } from '@/components/account/AccountScreen';
import { API_ENDPOINTS, apiRequest } from '@/constants/api';
import { useAuth } from '@/context/AuthContext';

type Notification = {
  id: number;
  title: string | null;
  message: string;
  isRead: boolean;
  createdAt: string;
};

export default function NotificationsScreen() {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    apiRequest<{ notifications: Notification[] }>(API_ENDPOINTS.notifications(user.id)).then(async (result) => {
      if (result.ok) {
        setNotifications(result.data.notifications);
        await apiRequest(API_ENDPOINTS.markNotificationsRead, {
          method: 'POST',
          body: JSON.stringify({ userId: user.id }),
        });
      } else {
        setError(result.error);
      }
      setLoading(false);
    });
  }, [user]);

  return (
    <AccountScreen title="Notifications">
      {loading ? <ActivityIndicator color="#F7941D" /> : null}
      {error ? <Text style={accountStyles.muted}>{error}</Text> : null}
      {!loading && !error && notifications.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyTitle}>No notifications</Text>
          <Text style={accountStyles.muted}>You are all caught up.</Text>
        </View>
      ) : null}
      <ScrollView showsVerticalScrollIndicator={false}>
        {notifications.map((notification) => (
          <View key={notification.id} style={[accountStyles.card, !notification.isRead && styles.unreadCard]}>
            <View style={styles.cardHeader}>
              <Text style={accountStyles.value}>{notification.title || 'BATTLE-NEXT'}</Text>
              {!notification.isRead ? <View style={styles.unreadDot} /> : null}
            </View>
            <Text style={[accountStyles.text, styles.message]}>{notification.message}</Text>
            <Text style={accountStyles.muted}>{new Date(notification.createdAt).toLocaleString()}</Text>
          </View>
        ))}
      </ScrollView>
    </AccountScreen>
  );
}

const styles = StyleSheet.create({
  empty: { alignItems: 'center', paddingVertical: 60 },
  emptyTitle: { color: '#FFFFFF', fontSize: 18, fontWeight: '800', marginBottom: 8 },
  unreadCard: { borderLeftWidth: 3, borderLeftColor: '#E53935' },
  cardHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  message: { marginBottom: 8 },
  unreadDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#E53935' },
});