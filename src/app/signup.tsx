import { useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
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
import { PhoneNumberField } from '@/components/auth/CountryCodeSelector';
import { PrimaryButton } from '@/components/auth/PrimaryButton';
import { PromoCodeField } from '@/components/auth/PromoCodeField';
import { AuthColors, AuthSpacing } from '@/constants/theme';
import { API_ENDPOINTS, apiRequest, type AuthUser } from '@/constants/api';
import { useAuth } from '@/context/AuthContext';
import {
  validateEmail,
  validateName,
  validatePassword,
  validatePhone,
  validateUsername,
} from '@/utils/validation';

type SignUpForm = {
  firstName: string;
  lastName: string;
  username: string;
  phone: string;
  email: string;
  password: string;
  promoCode: string;
};

type SignUpErrors = Partial<Record<keyof SignUpForm, string>>;

export default function SignUpScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { setUser } = useAuth();
  const [form, setForm] = useState<SignUpForm>({
    firstName: '',
    lastName: '',
    username: '',
    phone: '',
    email: '',
    password: '',
    promoCode: '',
  });
  const [errors, setErrors] = useState<SignUpErrors>({});
  const [loading, setLoading] = useState(false);
  const [promoMessage, setPromoMessage] = useState<string | undefined>();

  const updateField = useCallback((field: keyof SignUpForm, value: string) => {
    setForm((current) => ({ ...current, [field]: value }));
    setErrors((current) => ({ ...current, [field]: undefined }));
    if (field === 'promoCode') {
      setPromoMessage(undefined);
    }
  }, []);

  const validateForm = useCallback((): boolean => {
    const nextErrors: SignUpErrors = {
      firstName: validateName(form.firstName, 'First name'),
      lastName: validateName(form.lastName, 'Last name'),
      username: validateUsername(form.username),
      phone: validatePhone(form.phone),
      email: validateEmail(form.email),
      password: validatePassword(form.password),
    };

    const filtered = Object.fromEntries(
      Object.entries(nextErrors).filter(([, value]) => value !== undefined),
    ) as SignUpErrors;

    setErrors(filtered);
    return Object.keys(filtered).length === 0;
  }, [form]);

  const handleSignUp = useCallback(async () => {
    if (!validateForm()) {
      return;
    }

    setLoading(true);
    try {
      const result = await apiRequest<{ user: AuthUser }>(API_ENDPOINTS.users, {
        method: 'POST',
        body: JSON.stringify({
          firstName: form.firstName.trim(),
          lastName: form.lastName.trim(),
          username: form.username.trim(),
          countryCode: '+91',
          phone: form.phone.trim(),
          email: form.email.trim(),
          password: form.password,
          promoCode: form.promoCode.trim() || undefined,
        }),
      });

      if (!result.ok) {
        Alert.alert('Sign Up Failed', result.error);
        return;
      }

      await setUser(result.data.user);
      router.replace('/home');
    } finally {
      setLoading(false);
    }
  }, [form, router, setUser, validateForm]);

  const handleApplyPromo = useCallback(() => {
    const code = form.promoCode.trim();
    if (!code) {
      setErrors((current) => ({ ...current, promoCode: 'Enter a promo code to apply' }));
      setPromoMessage(undefined);
      return;
    }

    setErrors((current) => ({ ...current, promoCode: undefined }));
    setPromoMessage(`Promo code "${code.toUpperCase()}" applied!`);
  }, [form.promoCode]);

  const handleGoogleSignUp = useCallback(() => {
    Alert.alert('Google Sign Up', 'Google sign-up will be connected here.');
  }, []);

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        style={styles.flex}
        contentContainerStyle={[
          styles.content,
          {
            paddingTop: insets.top + 24,
            paddingBottom: insets.bottom + 32,
          },
        ]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <AuthHeading subtitle="Welcome to," title="Sign Up" />

        <AuthTextField
          placeholder="First Name"
          value={form.firstName}
          onChangeText={(value) => updateField('firstName', value)}
          error={errors.firstName}
          autoCapitalize="words"
          returnKeyType="next"
        />

        <AuthTextField
          placeholder="Last Name"
          value={form.lastName}
          onChangeText={(value) => updateField('lastName', value)}
          error={errors.lastName}
          autoCapitalize="words"
          returnKeyType="next"
        />

        <AuthTextField
          placeholder="Username"
          value={form.username}
          onChangeText={(value) => updateField('username', value)}
          error={errors.username}
          autoCapitalize="none"
          returnKeyType="next"
        />

        <PhoneNumberField
          value={form.phone}
          onChangeText={(value) => updateField('phone', value.replace(/\D/g, ''))}
          error={errors.phone}
        />

        <AuthTextField
          placeholder="Email"
          value={form.email}
          onChangeText={(value) => updateField('email', value)}
          error={errors.email}
          keyboardType="email-address"
          autoCapitalize="none"
          returnKeyType="next"
        />

        <AuthPasswordField
          value={form.password}
          onChangeText={(value) => updateField('password', value)}
          error={errors.password}
          returnKeyType="next"
        />

        <PromoCodeField
          value={form.promoCode}
          onChangeText={(value) => updateField('promoCode', value)}
          onApply={handleApplyPromo}
          error={errors.promoCode}
          successMessage={promoMessage}
        />

        <Text style={styles.termsText}>
          By Registering, I agree to Gampley&apos;s{' '}
          <Text style={styles.termsBold}>Terms and Conditions</Text> and{' '}
          <Text style={styles.termsBold}>Privacy Policy</Text>
        </Text>

        <PrimaryButton label="SIGN UP" onPress={handleSignUp} loading={loading} />

        <View style={styles.loginLink}>
          <AuthLinkText
            prefix="Already have an account?"
            linkText="LOGIN"
            onPress={() => router.push('/login')}
          />
        </View>

        <Text style={styles.orText}>or SignUp</Text>

        <GoogleLoginButton onPress={handleGoogleSignUp} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
    backgroundColor: AuthColors.background,
  },
  content: {
    flexGrow: 1,
    paddingHorizontal: AuthSpacing.screenHorizontal,
  },
  termsText: {
    color: AuthColors.textSecondary,
    fontSize: 13,
    lineHeight: 20,
    marginTop: 8,
    marginBottom: 4,
    textAlign: 'center',
  },
  termsBold: {
    color: AuthColors.text,
    fontWeight: '700',
  },
  loginLink: {
    marginTop: 24,
    alignItems: 'center',
  },
  orText: {
    textAlign: 'center',
    color: AuthColors.textSecondary,
    fontSize: 14,
    marginTop: 24,
    marginBottom: 20,
  },
});
