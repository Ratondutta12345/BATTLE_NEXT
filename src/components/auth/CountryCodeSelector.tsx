import { StyleSheet, Text, TextInput, View } from 'react-native';

import { authErrorTextStyle, authFieldWrapperStyle, authInputContainerStyle, authInputTextStyle } from '@/components/auth/authStyles';
import { AuthColors } from '@/constants/theme';

type CountryCodeSelectorProps = {
  flag: string;
  dialCode: string;
};

export function CountryCodeSelector({ flag, dialCode }: CountryCodeSelectorProps) {
  return (
    <View style={styles.selector}>
      <Text style={styles.flag}>{flag}</Text>
      <Text style={styles.dialCode}>{dialCode}</Text>
      <Text style={styles.arrow}>▾</Text>
    </View>
  );
}

type PhoneNumberFieldProps = {
  value: string;
  onChangeText: (text: string) => void;
  error?: string;
  countryFlag?: string;
  countryDialCode?: string;
};

export function PhoneNumberField({
  value,
  onChangeText,
  error,
  countryFlag = '🇮🇳',
  countryDialCode = '+91',
}: PhoneNumberFieldProps) {
  return (
    <View style={authFieldWrapperStyle}>
      <View style={[styles.row, error ? styles.rowError : null]}>
        <CountryCodeSelector flag={countryFlag} dialCode={countryDialCode} />
        <View style={styles.divider} />
        <TextInput
          style={[authInputTextStyle, styles.phoneInput]}
          placeholder="Phone number"
          placeholderTextColor={AuthColors.placeholder}
          value={value}
          onChangeText={onChangeText}
          keyboardType="phone-pad"
          maxLength={10}
          returnKeyType="next"
        />
      </View>
      {error ? <Text style={authErrorTextStyle}>{error}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    ...authInputContainerStyle,
    paddingHorizontal: 12,
  },
  rowError: {
    borderColor: AuthColors.error,
  },
  selector: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingRight: 4,
  },
  flag: {
    fontSize: 18,
    marginRight: 4,
  },
  dialCode: {
    fontSize: 15,
    color: AuthColors.text,
    fontWeight: '500',
    marginRight: 2,
  },
  arrow: {
    fontSize: 12,
    color: AuthColors.textSecondary,
    marginTop: 2,
  },
  divider: {
    width: 1,
    height: 24,
    backgroundColor: AuthColors.border,
    marginHorizontal: 10,
  },
  phoneInput: {
    flex: 1,
    paddingHorizontal: 0,
  },
});
