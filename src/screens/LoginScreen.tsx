import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  Alert,
  Image,
  ScrollView,
  Dimensions,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_BASE_URL } from '../config/api';
import GoogleAuthButton from '../components/GoogleAuthButton';
import { useI18n } from '../i18n/I18nContext';
import { colors, spacing, radius, gradients, shadow } from '../theme';

export default function LoginScreen({ navigation, onLogin, route }: any) {
  const goAfterAuth = () => {
    const redirectTo = route?.params?.redirectTo;
    const redirectParams = route?.params?.redirectParams;
    if (redirectTo) {
      navigation.replace(redirectTo, redirectParams || {});
      return;
    }
    navigation.replace('Home');
  };

  const { t } = useI18n();
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [apiError, setApiError] = useState('');

  const finalizeLogin = async (userData: any, actorKind: 'User' | 'Company', token: string) => {
    // Tag the session with which kind of account this is so ownership-transfer
    // confirmation can identify the acting party (User vs Company/brand).
    const tagged = { ...userData, actorKind };
    await AsyncStorage.setItem('userToken', token || '');
    await AsyncStorage.setItem('user', JSON.stringify(tagged));
    if (onLogin) {
      onLogin(tagged);
    }
    goAfterAuth();
  };

  // Brands/companies (the initial owner of every product) live in the companies
  // collection. If user login fails, fall back to company auth so an owner can
  // log in and confirm an ownership transfer.
  const tryCompanyLogin = async (): Promise<boolean> => {
    try {
      const response = await fetch(`${API_BASE_URL}company/auth`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
        body: JSON.stringify({ name, password }),
      });
      if (!response.ok) return false;
      const data = await response.json().catch(() => ({}));
      const doc = data?.data?.doc;
      if (data?.status === 'success' && doc) {
        await finalizeLogin(doc, 'Company', '');
        return true;
      }
    } catch (error) {
      // ignore and report the original user-login failure
    }
    return false;
  };

  const handleLogin = async () => {
    setApiError('');
    if (!name || !password) {
      Alert.alert(t('error'), t('fillAllFields'));
      return;
    }

    setLoading(true);
    const apiUrl = `${API_BASE_URL}user/login`;
    console.log('Attempting login to:', apiUrl);
    console.log('Request body:', { name, password: '***' });

    try {
      // Test connection first with timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout

      const response = await fetch(apiUrl, {
        method: 'POST',
        signal: controller.signal,
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify({ name, password }),
      });

      clearTimeout(timeoutId);

      console.log('Response status:', response.status);
      console.log('Response headers:', JSON.stringify([...response.headers.entries()]));

      if (!response.ok) {
        // User login failed — try company login before reporting an error.
        if (await tryCompanyLogin()) { setLoading(false); return; }
        const errorText = await response.text();
        console.error('Response error:', errorText);
        try {
          const errorData = JSON.parse(errorText);
          setApiError(errorData.message || `${t('serverError')}: ${response.status}`);
        } catch {
          setApiError(`${t('serverError')}: ${response.status} - ${errorText}`);
        }
        setLoading(false);
        return;
      }

      const data = await response.json();
      console.log('Response data:', data);

      if (data.status === 'success') {
        const userData = data.user || data.data;
        if (userData) {
          await finalizeLogin(userData, 'User', data.token || '');
        } else {
          Alert.alert(t('error'), t('invalidServerResponse'));
        }
      } else {
        if (await tryCompanyLogin()) { setLoading(false); return; }
        setApiError(data.message || t('loginFailed'));
      }
    } catch (error: any) {
      console.error('Login error details:', {
        message: error?.message,
        stack: error?.stack,
        name: error?.name,
        apiUrl: apiUrl,
        errorType: error?.constructor?.name
      });
      
      let errorMessage = 'Network request failed';
      let isTimeout = false;
      
      if (error?.name === 'AbortError' || error?.message?.includes('timeout') || error?.message?.includes('aborted')) {
        errorMessage = 'Connection timeout - Server not reachable';
        isTimeout = true;
      } else if (error?.message) {
        errorMessage = error.message;
      } else if (error?.toString) {
        errorMessage = error.toString();
      }
      
      // Provide more helpful error message
      let detailedMessage = `${errorMessage}\n\nAPI URL: ${apiUrl}\n\n`;
      
      if (isTimeout) {
        detailedMessage += 'Possible causes:\n';
        detailedMessage += '• LDPlayer network not properly configured\n';
        detailedMessage += '• Firewall blocking connection\n';
        detailedMessage += '• VPS server is down\n';
        detailedMessage += '• No internet access in emulator\n\n';
        detailedMessage += 'Try:\n';
        detailedMessage += '1. Check LDPlayer network settings\n';
        detailedMessage += '2. Restart LDPlayer\n';
        detailedMessage += '3. Test in browser: ' + apiUrl.replace('user/login', '');
      } else {
        detailedMessage += 'Please check:\n';
        detailedMessage += '• Internet connection\n';
        detailedMessage += '• VPS server is running\n';
        detailedMessage += '• Network security settings';
      }
      
      setApiError(detailedMessage);
    } finally {
      setLoading(false);
    }
  };

  const isWeb = Platform.OS === 'web';
  
  const scrollViewContent = (
    <ScrollView
      contentContainerStyle={[
        styles.scrollContent,
        isWeb && { minHeight: screenHeight }
      ]}
      style={[
        styles.scrollView,
        isWeb && { height: screenHeight }
      ]}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
      bounces={!isWeb}
      {...(Platform.OS === 'ios' && { contentInsetAdjustmentBehavior: 'automatic' })}
    >
      <View style={styles.content}>
        <View style={[styles.card, gradients.hero]}>
              <View style={styles.logoContainer}>
              <Image
                source={require('../assets/logo-shield.png')}
                style={styles.logoImage}
                resizeMode="contain"
              />
            </View>

            <TextInput
              style={styles.input}
              placeholder={t('username')}
              placeholderTextColor={colors.placeholder}
              value={name}
              onChangeText={setName}
              autoCapitalize="none"
            />

            <TextInput
              style={styles.input}
              placeholder={t('password')}
              placeholderTextColor={colors.placeholder}
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              autoCapitalize="none"
            />

            {!!apiError && (
              <View style={styles.apiErrorBox}>
                <Text style={styles.apiErrorText}>{apiError}</Text>
              </View>
            )}

            <TouchableOpacity
              style={[styles.button, loading && styles.buttonDisabled]}
              onPress={handleLogin}
              disabled={loading}
            >
              <Text style={styles.buttonText}>
                {loading ? `${t('signIn')}...` : t('signIn')}
              </Text>
            </TouchableOpacity>

            <GoogleAuthButton
              onSuccess={(userData) => {
                if (onLogin) {
                  onLogin(userData);
                }
                if (route?.params?.redirectTo) {
                  navigation.replace(route.params.redirectTo, route.params.redirectParams || {});
                } else {
                  navigation.replace('EditProfile', { fromGoogle: true });
                }
              }}
              onError={(error) => {
                Alert.alert('Error', error);
              }}
              navigation={navigation}
            />

            <TouchableOpacity
              style={styles.linkButton}
              onPress={() => navigation.navigate('Register', {
                redirectTo: route?.params?.redirectTo,
                redirectParams: route?.params?.redirectParams,
              })}
            >
              <Text style={styles.linkText}>
                {t('noAccount')} {t('signUp')}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
    </ScrollView>
  );

  return (
    <View style={styles.container}>
      {isWeb ? (
        scrollViewContent
      ) : (
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.keyboardView}
        >
          {scrollViewContent}
        </KeyboardAvoidingView>
      )}

    </View>
  );
}

const screenHeight = Dimensions.get('window').height;
const isWebPlatform = Platform.OS === 'web';

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#5b8ad9',
    ...(isWebPlatform && { height: screenHeight, minHeight: screenHeight }),
  },
  keyboardView: {
    flex: 1,
    zIndex: 1,
    ...(isWebPlatform && { height: screenHeight, minHeight: screenHeight }),
  },
  scrollView: {
    flex: 1,
    zIndex: 1,
    ...(isWebPlatform && { height: screenHeight, minHeight: screenHeight }),
  },
  scrollContent: {
    padding: spacing.xl,
    alignItems: 'center',
    flexGrow: 1,
    justifyContent: 'center',
    ...(isWebPlatform && { minHeight: screenHeight }),
  },
  content: {
    alignItems: 'center',
    width: '100%',
    paddingVertical: 40,
    ...(isWebPlatform && { minHeight: 0 }),
  },
  card: {
    backgroundColor: colors.primary,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.navy,
    padding: spacing.xxxl,
    width: '100%',
    maxWidth: 380,
    ...shadow(3),
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: spacing.xxl,
  },
  logoImage: {
    width: 96,
    height: 96,
  },
  logoTagline: {
    marginTop: 12,
    fontSize: 36,
    fontWeight: '800',
    letterSpacing: 3,
    color: colors.white,
    textAlign: 'center',
    ...(isWebPlatform && { fontFamily: 'Poppins, system-ui, sans-serif' }),
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
    color: colors.heading,
    marginBottom: spacing.xl,
  },
  input: {
    backgroundColor: colors.fieldBg,
    borderRadius: radius.md,
    paddingVertical: 13,
    paddingHorizontal: 14,
    marginBottom: spacing.md,
    fontSize: 16,
    color: colors.text,
    borderWidth: 1,
    borderColor: colors.border,
  },
  button: {
    backgroundColor: colors.accent,
    borderRadius: radius.md,
    paddingVertical: 15,
    alignItems: 'center',
    marginTop: spacing.sm,
    ...shadow(1),
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: colors.white,
    fontSize: 16,
    fontWeight: '700',
  },
  apiErrorBox: {
    backgroundColor: colors.dangerSoft,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    marginBottom: spacing.md,
  },
  apiErrorText: {
    color: colors.danger,
    fontSize: 13,
    textAlign: 'left',
  },
  linkButton: {
    marginTop: spacing.lg,
    alignItems: 'center',
  },
  linkText: {
    color: colors.onDarkAccent,
    fontSize: 14,
    fontWeight: '600',
  },
});
