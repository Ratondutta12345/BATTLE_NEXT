import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { authErrorTextStyle, authFieldWrapperStyle, authInputContainerStyle, authInputTextStyle } from '@/components/auth/authStyles';
import { AuthColors } from '@/constants/theme';

type PromoCodeFieldProps = {
  value: string;
  onChangeText: (text: string) => void;
  onApply: () => void;
  error?: string;
  successMessage?: string;
};

export function PromoCodeField({
  value,
  onChangeText,
  onApply,
  error,
  successMessage,
}: PromoCodeFieldProps) {
  return (
    <View style={authFieldWrapperStyle}>
      <View style={[styles.row, error ? styles.rowError : null]}>
        <TextInput
          style={[authInputTextStyle, styles.input]}
          placeholder="Promo Code (Optional)"
          placeholderTextColor={AuthColors.placeholder}
          value={value}
          onChangeText={onChangeText}
          autoCapitalize="characters"
          returnKeyType="done"
        />
        <Pressable
          onPress={onApply}
          style={({ pressed }) => [styles.applyButton, pressed && styles.applyButtonPressed]}
          accessibilityRole="button"
          accessibilityLabel="Apply promo code"
        >
          <Text style={styles.applyText}>APPLY</Text>
        </Pressable>
      </View>
      {error ? <Text style={authErrorTextStyle}>{error}</Text> : null}
      {successMessage && !error ? (
        <Text style={styles.successText}>{successMessage}</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    ...authInputContainerStyle,
    paddingRight: 6,
    paddingLeft: 20,
  },
  rowError: {
    borderColor: AuthColors.error,
  },
  input: {
    flex: 1,
    paddingHorizontal: 0,
  },
  applyButton: {
    backgroundColor: AuthColors.applyButton,
    borderRadius: 22,
    paddingHorizontal: 18,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
  },
  applyButtonPressed: {
    opacity: 0.85,
  },
  applyText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  successText: {
    color: '#2E7D32',
    fontSize: 12,
    marginTop: 6,
    marginLeft: 8,
  },
});
