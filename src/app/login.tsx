import { useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AuthHeading } from '@/components/auth/AuthHeading';
import { AuthLinkText } from '@/components/auth/AuthLinkText';
import { AuthPasswordField } from '@/components/auth/AuthPasswordField';
import { AuthTextField } from '@/components/auth/AuthTextField';
import { GoogleLoginButton } from '@/components/auth/GoogleLoginButton';
import { PrimaryButton } from '@/components/auth/PrimaryButton';
import { AuthColors, AuthSpacing } from '@/constants/theme';
import { API_ENDPOINTS, apiRequest, type AuthUser } from '@/constants/api';
import { useAuth } from '@/context/AuthContext';
import { validateLoginIdentifier, validatePassword } from '@/utils/validation';

type LoginForm = {
  identifier: string;
  password: string;
};

type LoginErrors = Partial<Record<keyof LoginForm, string>>;

export default function LoginScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { setUser } = useAuth();
  const [form, setForm] = useState<LoginForm>({ identifier: '', password: '' });
  const [errors, setErrors] = useState<LoginErrors>({});
  const [loading, setLoading] = useState(false);

  const updateField = useCallback((field: keyof LoginForm, value: string) => {
    setForm((current) => ({ ...current, [field]: value }));
    setErrors((current) => ({ ...current, [field]: undefined }));
  }, []);

  const validateForm = useCallback((): boolean => {
    const nextErrors: LoginErrors = {
      identifier: validateLoginIdentifier(form.identifier),
      password: validatePassword(form.password),
    };

    const filtered = Object.fromEntries(
      Object.entries(nextErrors).filter(([, value]) => value !== undefined),
    ) as LoginErrors;

    setErrors(filtered);
    return Object.keys(filtered).length === 0;
  }, [form.identifier, form.password]);

  const handleLogin = useCallback(async () => {
    if (!validateForm()) {
      return;
    }

    setLoading(true);
    try {
      const result = await apiRequest<{ user: AuthUser }>(API_ENDPOINTS.login, {
        method: 'POST',
        body: JSON.stringify({
          identifier: form.identifier.trim(),
          password: form.password,
        }),
      });

      if (!result.ok) {
        Alert.alert('Login Failed', result.error);
        return;
      }

      await setUser(result.data.user);
      router.replace('/home');
    } finally {
      setLoading(false);
    }
  }, [form.identifier, form.password, router, setUser, validateForm]);

  const handleForgotPassword = useCallback(() => {
    Alert.alert('Forgot Password', 'Password reset link will be sent to your email.');
  }, []);

  const handleGoogleLogin = useCallback(() => {
    Alert.alert('Google Login', 'Google sign-in will be connected here.');
  }, []);

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
    >
      <ScrollView
        style={styles.flex}
        contentContainerStyle={[
          styles.content,
          {
            paddingTop: insets.top + 24,
            paddingBottom: insets.bottom + 24,
          },
        ]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <AuthHeading subtitle="Welcome to," title="Login" />

        <AuthTextField
          placeholder="Email/Mobile No/Username"
          value={form.identifier}
          onChangeText={(value) => updateField('identifier', value)}
          error={errors.identifier}
          autoCapitalize="none"
          returnKeyType="next"
        />

        <AuthPasswordField
          value={form.password}
          onChangeText={(value) => updateField('password', value)}
          error={errors.password}
          returnKeyType="done"
          onSubmitEditing={handleLogin}
        />

        <Pressable
          onPress={handleForgotPassword}
          style={styles.forgotPassword}
          accessibilityRole="button"
        >
          <Text style={styles.forgotPasswordText}>Forgot Password?</Text>
        </Pressable>

        <PrimaryButton label="LOGIN" onPress={handleLogin} loading={loading} />

        <Text style={styles.orText}>or Login</Text>

        <GoogleLoginButton onPress={handleGoogleLogin} />

        <View style={styles.bottomLink}>
          <AuthLinkText
            prefix="Don't have an account?"
            linkText="Sign Up"
            onPress={() => router.push('/signup')}
          />
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

var styles = StyleSheet.create({
  flex: {
    flex: 1,
    backgroundColor: AuthColors.background,
  },
  content: {
    flexGrow: 1,
    paddingHorizontal: AuthSpacing.screenHorizontal,
  },
  forgotPassword: {
    alignSelf: 'flex-end',
    marginTop: 4,
    marginBottom: 8,
  },
  forgotPasswordText: {
    color: AuthColors.textSecondary,
    fontSize: 14,
    fontWeight: '500',
  },
  orText: {
    textAlign: 'center',
    color: AuthColors.textSecondary,
    fontSize: 14,
    marginTop: 28,
    marginBottom: 20,
  },
  bottomLink: {
    marginTop: 'auto',
    paddingTop: 32,
    alignItems: 'center',
  },
});
