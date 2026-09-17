import { useState } from 'react';
import { ActivityIndicator, Alert, Modal, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { API_ENDPOINTS, apiRequest } from '@/constants/api';

type JoinMatchModalProps = {
  matchId: number | null;
  userId?: number;
  onClose: () => void;
  onJoined: () => void;
};

export function JoinMatchModal({ matchId, userId, onClose, onJoined }: JoinMatchModalProps) {
  const [inGameName, setInGameName] = useState('');
  const [loading, setLoading] = useState(false);

  async function joinMatch() {
    if (!matchId || !userId) {
      Alert.alert('Login required', 'Please log in before joining a match.');
      return;
    }
    if (!inGameName.trim()) {
      Alert.alert('In-game name required', 'Enter the name used in the game.');
      return;
    }
    setLoading(true);
    const result = await apiRequest(API_ENDPOINTS.joinMatch(matchId), {
      method: 'POST',
      body: JSON.stringify({ userId, inGameName: inGameName.trim() }),
    });
    setLoading(false);
    if (!result.ok) {
      Alert.alert('Unable to join', result.error);
      return;
    }
    setInGameName('');
    onClose();
    onJoined();
  }

  return <Modal visible={matchId !== null} transparent animationType="slide" onRequestClose={onClose}>
    <View style={styles.overlay}>
      <View style={styles.sheet}>
        <Text style={styles.title}>Join Match</Text>
        <Text style={styles.subtitle}>Enter your in-game name exactly as it appears in the game.</Text>
        <TextInput
          value={inGameName}
          onChangeText={setInGameName}
          placeholder="Your in-game name"
          placeholderTextColor="#777777"
          maxLength={150}
          autoCapitalize="none"
          style={styles.input}
        />
        <View style={styles.actions}>
          <Pressable onPress={onClose} style={styles.cancelButton}><Text style={styles.cancelText}>Cancel</Text></Pressable>
          <Pressable onPress={joinMatch} disabled={loading} style={styles.joinButton}>{loading ? <ActivityIndicator color="#111111" /> : <Text style={styles.joinText}>Join Now</Text>}</Pressable>
        </View>
      </View>
    </View>
  </Modal>;
}

const styles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.65)' },
  sheet: { backgroundColor: '#171717', padding: 22, borderTopLeftRadius: 20, borderTopRightRadius: 20 },
  title: { color: '#FFFFFF', fontSize: 21, fontWeight: '800' },
  subtitle: { color: '#A5A5A5', lineHeight: 20, marginTop: 7 },
  input: { color: '#FFFFFF', backgroundColor: '#242424', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 13, marginTop: 18, fontSize: 16 },
  actions: { flexDirection: 'row', gap: 10, marginTop: 18 },
  cancelButton: { flex: 1, alignItems: 'center', paddingVertical: 13, borderRadius: 10, borderWidth: 1, borderColor: '#555555' },
  cancelText: { color: '#FFFFFF', fontWeight: '700' },
  joinButton: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 13, borderRadius: 10, backgroundColor: '#F7941D' },
  joinText: { color: '#111111', fontWeight: '800' },
});