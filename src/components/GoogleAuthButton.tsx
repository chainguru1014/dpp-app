import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  TouchableOpacity,
  Text,
  Image,
  StyleSheet,
  ActivityIndicator,
  Platform,
  Alert,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_BASE_URL } from '../config/api';

const GOOGLE_CLIENT_ID = '877290656114-taabbrtvlt1dsi7tc9cotjv91g0jo4e9.apps.googleusercontent.com';

interface GoogleAuthButtonProps {
  onSuccess: (userData: any) => void;
  onError?: (error: string) => void;
  navigation: any;
}

declare global {
  interface Window {
    google?: any;
  }
}

export default function GoogleAuthButton({ onSuccess, onError, navigation }: GoogleAuthButtonProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [gsiReady, setGsiReady] = useState(false);
  const tokenClientRef = useRef<any>(null);

  useEffect(() => {
    if (Platform.OS === 'web') {
      loadGoogleScript();
    }
  }, []);

  useEffect(() => {
    if (Platform.OS === 'web' && gsiReady && !tokenClientRef.current) {
      initTokenClient();
    }
  }, [gsiReady]);

  const loadGoogleScript = () => {
    const id = 'google-gsi-client';
    if (document.getElementById(id)) {
      setGsiReady(!!window.google?.accounts?.oauth2);
      return;
    }

    const script = document.createElement('script');
    script.id = id;
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.defer = true;
    script.onload = () => {
      setGsiReady(!!window.google?.accounts?.oauth2);
    };
    script.onerror = () => {
      console.error('Failed to load Google Identity Services script');
      if (onError) {
        onError('Failed to load Google login service');
      }
    };
    document.head.appendChild(script);
  };

  const initTokenClient = () => {
    if (!window.google?.accounts?.oauth2) return;

    tokenClientRef.current = window.google.accounts.oauth2.initTokenClient({
      client_id: GOOGLE_CLIENT_ID,
      scope: 'openid email profile',
      callback: () => {},
      error_callback: (err: any) => {
        console.error('GIS error:', err);
        setIsLoading(false);
        const errorMsg = err?.error || 'unknown_error';
        if (onError) {
          onError(`Google login failed: ${errorMsg}`);
        } else {
          Alert.alert('Error', `Google login failed: ${errorMsg}`);
        }
      },
    });
  };

  const handleGoogleLogin = async () => {
    if (Platform.OS !== 'web') {
      Alert.alert('Info', 'Google login is currently only available on web');
      return;
    }

    if (!gsiReady || !tokenClientRef.current) {
      Alert.alert('Error', 'Google is not ready yet. Please try again in a moment.');
      return;
    }

    setIsLoading(true);

    tokenClientRef.current.callback = async (tokenResponse: any) => {
      try {
        const response = await fetch(`${API_BASE_URL}user/google-login`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            accessToken: tokenResponse.access_token,
          }),
        });

        const data = await response.json();

        if (response.ok && data.status === 'success') {
          const userData = data.user || data.data;
          if (userData) {
            await AsyncStorage.setItem('userToken', data.token || '');
            await AsyncStorage.setItem('user', JSON.stringify(userData));
            setIsLoading(false);
            onSuccess(userData);
          } else {
            throw new Error('Invalid response from server');
          }
        } else {
          throw new Error(data.message || 'Login failed');
        }
      } catch (error: any) {
        console.error('Google login error:', error);
        setIsLoading(false);
        const errorMsg = error?.message || 'Login failed';
        if (onError) {
          onError(errorMsg);
        } else {
          Alert.alert('Error', errorMsg);
        }
      }
    };

    tokenClientRef.current.requestAccessToken({ prompt: 'consent' });
  };

  if (Platform.OS !== 'web') {
    return null; // Google login only on web for now
  }

  return (
    <View style={styles.container}>
      <TouchableOpacity
        style={[styles.button, isLoading && styles.buttonDisabled]}
        onPress={handleGoogleLogin}
        disabled={isLoading}
      >
        {isLoading ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <>
            <Image
              source={require('../assets/icons8-google-50.png')}
              style={styles.googleIcon}
              resizeMode="contain"
            />
            <Text style={styles.buttonText}>Continue with Google</Text>
          </>
        )}
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    marginVertical: 10,
  },
  button: {
    backgroundColor: '#4285f4',
    borderRadius: 8,
    padding: 14,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  googleIcon: {
    width: 20,
    height: 20,
    marginRight: 10,
  },
});
