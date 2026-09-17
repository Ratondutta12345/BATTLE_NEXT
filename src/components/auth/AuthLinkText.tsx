import { Pressable, StyleSheet, Text, View } from 'react-native';

import { AuthColors } from '@/constants/theme';

type AuthLinkTextProps = {
  prefix: string;
  linkText: string;
  onPress: () => void;
};

export function AuthLinkText({ prefix, linkText, onPress }: AuthLinkTextProps) {
  return (
    <View style={styles.container}>
      <Text style={styles.prefix}>{prefix}</Text>
      <Pressable onPress={onPress} hitSlop={8} accessibilityRole="link">
        <Text style={styles.link}>{linkText}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    flexWrap: 'wrap',
  },
  prefix: {
    color: AuthColors.text,
    fontSize: 15,
  },
  link: {
    color: AuthColors.link,
    fontSize: 15,
    fontWeight: '700',
    marginLeft: 4,
  },
});
