import { Image } from 'expo-image';
import { Pressable, StyleSheet, Text, View } from 'react-native';

type AccountActionProps = {
  label: string;
  icon: string;
  onPress: () => void;
};

export function AccountAction({ label, icon, onPress }: AccountActionProps) {
  const iconSources: Record<string, number> = {
    person: require('../../../assets/new/profile.jpeg'),
    account_balance_wallet: require('../../../assets/new/wallet.jpeg'),
    emoji_events: require('../../../assets/new/top player.jpeg'),
    headset_mic: require('../../../assets/new/contact.jpeg'),
  };

  return (
    <Pressable style={styles.action} onPress={onPress} accessibilityRole="button" accessibilityLabel={label}>
      <View style={styles.iconCircle}>
        <Image source={iconSources[icon]} style={styles.iconImage} contentFit="cover" />
      </View>
      <Text style={styles.label} numberOfLines={2}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  action: {
    flex: 1,
    alignItems: 'center',
    minWidth: 0,
  },
  iconCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconImage: {
    width: 52,
    height: 52,
    borderRadius: 26,
  },
  label: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '600',
    textAlign: 'center',
    marginTop: 8,
  },
});