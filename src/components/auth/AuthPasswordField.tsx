import { useState } from 'react';
import {
  Pressable,
  ReturnKeyTypeOptions,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { authErrorTextStyle, authFieldWrapperStyle, authInputContainerStyle, authInputTextStyle } from '@/components/auth/authStyles';
import { AuthColors } from '@/constants/theme';

type AuthPasswordFieldProps = {
  placeholder?: string;
  value: string;
  onChangeText: (text: string) => void;
  error?: string;
  returnKeyType?: ReturnKeyTypeOptions;
  onSubmitEditing?: () => void;
  inputRef?: React.RefObject<TextInput | null>;
  testID?: string;
};

export function AuthPasswordField({
  placeholder = 'Password',
  value,
  onChangeText,
  error,
  returnKeyType = 'done',
  onSubmitEditing,
  inputRef,
  testID,
}: AuthPasswordFieldProps) {
  const [visible, setVisible] = useState(false);

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
          secureTextEntry={!visible}
          autoCapitalize="none"
          autoCorrect={false}
          returnKeyType={returnKeyType}
          onSubmitEditing={onSubmitEditing}
        />
        <Pressable
          onPress={() => setVisible((current) => !current)}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel={visible ? 'Hide password' : 'Show password'}
        >
          <Text style={styles.showText}>{visible ? 'Hide' : 'Show'}</Text>
        </Pressable>
      </View>
      {error ? <Text style={authErrorTextStyle}>{error}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  inputError: {
    borderColor: AuthColors.error,
  },
  showText: {
    color: AuthColors.textSecondary,
    fontSize: 14,
    fontWeight: '500',
    marginLeft: 8,
  },
});
