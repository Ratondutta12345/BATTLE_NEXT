import { Image } from 'expo-image';
import { Pressable, StyleSheet, Text } from 'react-native';

import type { Game } from '@/constants/api';
import { resolveApiUrl } from '@/constants/api';

export function GameCard({ game, onPress }: { game: Game; onPress: () => void }) {
  return (
    <Pressable style={({ pressed }) => [styles.card, pressed && styles.pressed]} onPress={onPress} accessibilityRole="button" accessibilityLabel={`Open ${game.name}`}>
      <Image source={{ uri: resolveApiUrl(game.imageUrl) }} style={styles.image} contentFit="cover" />
      <Text style={styles.name} numberOfLines={2}>{game.name}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { width: '31.8%', borderRadius: 10, overflow: 'hidden', backgroundColor: '#F7941D', marginBottom: 12 },
  pressed: { opacity: 0.72, transform: [{ scale: 0.97 }] },
  image: { width: '100%', aspectRatio: 1.15, backgroundColor: '#132238' },
  name: { minHeight: 39, paddingHorizontal: 4, paddingVertical: 8, color: '#171717', fontSize: 11, fontWeight: '800', textAlign: 'center', textAlignVertical: 'center' },
});