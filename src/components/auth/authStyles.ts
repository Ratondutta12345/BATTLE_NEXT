import { Platform, StyleSheet, ViewStyle } from 'react-native';

import { AuthColors } from '@/constants/theme';

export const authInputContainerStyle: ViewStyle = {
  backgroundColor: AuthColors.inputBackground,
  borderRadius: 28,
  borderWidth: 1,
  borderColor: AuthColors.border,
  height: 54,
  flexDirection: 'row',
  alignItems: 'center',
  paddingHorizontal: 20,
  ...Platform.select({
    ios: {
      shadowColor: AuthColors.shadow,
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.06,
      shadowRadius: 4,
    },
    android: {
      elevation: 1,
    },
    default: {},
  }),
};

export const authInputTextStyle = {
  flex: 1,
  fontSize: 15,
  color: AuthColors.text,
  paddingVertical: Platform.OS === 'ios' ? 14 : 10,
};

export const authErrorTextStyle = {
  color: AuthColors.error,
  fontSize: 12,
  marginTop: 6,
  marginLeft: 8,
};

export const authFieldWrapperStyle = {
  marginBottom: 14,
};

export const authStyles = StyleSheet.create({
  inputContainer: authInputContainerStyle,
  inputText: authInputTextStyle,
  errorText: authErrorTextStyle,
  fieldWrapper: authFieldWrapperStyle,
});
