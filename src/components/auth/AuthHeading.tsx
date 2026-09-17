import { StyleSheet, Text, View } from 'react-native';

import { AuthColors, AuthSizes, AuthSpacing } from '@/constants/theme';

type AuthHeadingProps = {
  subtitle: string;
  title: string;
};

export function AuthHeading({ subtitle, title }: AuthHeadingProps) {
  return (
    <View style={styles.container}>
      <Text style={styles.subtitle}>{subtitle}</Text>
      <Text style={styles.title}>{title}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: AuthSpacing.sectionGap,
  },
  subtitle: {
    fontSize: AuthSizes.headingSmall,
    color: AuthColors.text,
    fontWeight: '400',
    marginBottom: AuthSpacing.headingGap,
  },
  title: {
    fontSize: AuthSizes.headingLarge,
    color: AuthColors.text,
    fontWeight: '700',
    letterSpacing: -0.5,
  },
});
