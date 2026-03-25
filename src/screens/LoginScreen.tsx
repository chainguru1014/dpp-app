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
          await AsyncStorage.setItem('userToken', data.token || '');
          await AsyncStorage.setItem('user', JSON.stringify(userData));
          if (onLogin) {
            onLogin(userData);
          }
          goAfterAuth();
        } else {
          Alert.alert(t('error'), t('invalidServerResponse'));
        }
      } else {
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
        <View style={styles.card}>
              <View style={styles.logoContainer}>
              <Image
                source={require('../assets/yometel-logo.png')}
                style={styles.logoImage}
                resizeMode="contain"
              />
            </View>
            <Text style={styles.title}>{t('signIn')}</Text>

            <TextInput
              style={styles.input}
              placeholder={t('username')}
              placeholderTextColor="#999"
              value={name}
              onChangeText={setName}
              autoCapitalize="none"
            />

            <TextInput
              style={styles.input}
              placeholder={t('password')}
              placeholderTextColor="#999"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              autoCapitalize="none"
            />

            {!!apiError && (
              <Text style={styles.apiErrorText}>{apiError}</Text>
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
      <View style={styles.overlay} />
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
    backgroundColor: '#f5f5f5',
    ...(isWebPlatform && { height: screenHeight, minHeight: screenHeight }),
  },
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
    zIndex: 0,
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
    padding: 20,
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
    backgroundColor: 'rgba(255, 255, 255, 0.98)',
    borderRadius: 16,
    padding: 30,
    width: '100%',
    maxWidth: 380,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 24 },
    shadowOpacity: 0.35,
    shadowRadius: 60,
    elevation: 10,
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: 30,
  },
  logoImage: {
    width: 300,
    height: 90,
  },
  title: {
    fontSize: 24,
    fontWeight: '600',
    color: '#333',
    marginBottom: 20,
  },
  input: {
    backgroundColor: '#f5f5f5',
    borderRadius: 8,
    padding: 12,
    marginBottom: 15,
    fontSize: 16,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  button: {
    backgroundColor: '#1976d2',
    borderRadius: 8,
    padding: 14,
    alignItems: 'center',
    marginTop: 10,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  apiErrorText: {
    color: '#d32f2f',
    fontSize: 13,
    textAlign: 'left',
    marginBottom: 10,
  },
  linkButton: {
    marginTop: 15,
    alignItems: 'center',
  },
  linkText: {
    color: '#1976d2',
    fontSize: 14,
  },
});
