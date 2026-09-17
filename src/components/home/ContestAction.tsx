import { Image } from 'expo-image';
import { Pressable, StyleSheet, Text, View } from 'react-native';

type ContestActionProps = {
  label: string;
  onPress: () => void;
};

export function ContestAction({ label, onPress }: ContestActionProps) {
  return (
    <Pressable style={({ pressed }) => [styles.card, pressed && styles.pressed]} onPress={onPress} accessibilityRole="button" accessibilityLabel={`${label} contests`}>
      <View style={styles.imageFrame}>
        <Image source={require('../../../assets/new/upcoming matches.jpeg')} style={styles.image} contentFit="cover" />
      </View>
      <Text style={styles.label} numberOfLines={1}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { flex: 1, minHeight: 126, borderRadius: 12, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4, paddingVertical: 10, gap: 8 },
  pressed: { opacity: 0.72, transform: [{ scale: 0.97 }] },
  imageFrame: { width: 60, height: 60, borderRadius: 30, overflow: 'hidden', backgroundColor: '#F7941D' },
  image: { width: '100%', height: '100%' },
  label: { color: '#171717', fontSize: 12, fontWeight: '700' },
});