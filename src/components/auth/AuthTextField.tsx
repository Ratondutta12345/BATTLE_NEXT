import {
  KeyboardTypeOptions,
  ReturnKeyTypeOptions,
  StyleSheet,
  Text,
  TextInput,
  TextInputProps,
  View,
} from 'react-native';

import { authErrorTextStyle, authFieldWrapperStyle, authInputContainerStyle, authInputTextStyle } from '@/components/auth/authStyles';
import { AuthColors } from '@/constants/theme';

type AuthTextFieldProps = {
  placeholder: string;
  value: string;
  onChangeText: (text: string) => void;
  error?: string;
  keyboardType?: KeyboardTypeOptions;
  autoCapitalize?: TextInputProps['autoCapitalize'];
  returnKeyType?: ReturnKeyTypeOptions;
  onSubmitEditing?: TextInputProps['onSubmitEditing'];
  inputRef?: React.RefObject<TextInput | null>;
  testID?: string;
};

export function AuthTextField({
  placeholder,
  value,
  onChangeText,
  error,
  keyboardType = 'default',
  autoCapitalize = 'none',
  returnKeyType = 'next',
  onSubmitEditing,
  inputRef,
  testID,
}: AuthTextFieldProps) {
  return (
    <View style={authFieldWrapperStyle}>
      <View style={[authInputContainerStyle, error ? styles.inputError : null]}>
        <TextInput
          ref={inputRef}
          testID={testID}
          style={authInputTextStyle}
          placeholder={placeholder}
          placeholderTextColor={AuthColors.placeholder}
          value={value}
          onChangeText={onChangeText}
          keyboardType={keyboardType}
          autoCapitalize={autoCapitalize}
          autoCorrect={false}
          returnKeyType={returnKeyType}
          onSubmitEditing={onSubmitEditing}
        />
      </View>
      {error ? <Text style={authErrorTextStyle}>{error}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  inputError: {
    borderColor: AuthColors.error,
  },
});
