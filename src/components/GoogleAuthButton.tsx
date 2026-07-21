import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  TouchableOpacity,
  Text,
  StyleSheet,
  ActivityIndicator,
  Platform,
  Alert,
} from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { API_BASE_URL } from '../config/api';
import {
  GOOGLE_WEB_CLIENT_ID,
  GOOGLE_ANDROID_CLIENT_ID,
  GOOGLE_IOS_CLIENT_ID,
} from '../config/auth';
import { colors, spacing, radius, shadow } from '../theme';

// Monochrome Google "G" mark (Simple Icons, CC0) — black to match this
// button's white background, mirroring how AppleAuthButton draws its glyph
// as an inline SVG rather than a bundled PNG.
const GoogleLogo = ({ size = 14, color = '#000000' }: { size?: number; color?: string }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24">
    <Path
      fill={color}
      d="M12.48 10.92v3.28h7.84c-.24 1.84-.853 3.187-1.787 4.133-1.147 1.147-2.933 2.4-6.053 2.4-4.827 0-8.6-3.893-8.6-8.72s3.773-8.72 8.6-8.72c2.6 0 4.507 1.027 5.907 2.347l2.307-2.307C18.747 1.44 16.133 0 12.48 0 5.867 0 .307 5.387.307 12s5.56 12 12.173 12c3.573 0 6.267-1.173 8.373-3.36 2.16-2.16 2.84-5.213 2.84-7.667 0-.76-.053-1.467-.173-2.053H12.48z"
    />
  </Svg>
);

// Native (Android/iOS) Google Sign-In. Not imported at all on web so the
// native module is never touched there.
let GoogleSignin: any = null;
if (Platform.OS === 'android' || Platform.OS === 'ios') {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  GoogleSignin = require('@react-native-google-signin/google-signin').GoogleSignin;
}

interface GoogleAuthButtonProps {
  // Called with the envelope returned by POST auth/google: { user, token, profileCompleted, ... }
  onSuccess: (result: { user: any; token: string; profileCompleted: boolean }) => void;
  onError?: (error: string) => void;
  navigation?: any;
}

declare global {
  interface Window {
    google?: any;
  }
}

const HIDDEN_BUTTON_CONTAINER_ID = 'google-id-hidden-button';

export default function GoogleAuthButton({ onSuccess, onError }: GoogleAuthButtonProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [gsiReady, setGsiReady] = useState(false);
  const configuredNativeRef = useRef(false);

  useEffect(() => {
    if (Platform.OS === 'web') {
      loadGoogleScript();
    } else if (GoogleSignin && !configuredNativeRef.current) {
      configuredNativeRef.current = true;
      GoogleSignin.configure({
        webClientId: GOOGLE_WEB_CLIENT_ID,
        // iosClientId only matters on iOS; harmless to pass on Android.
        iosClientId: GOOGLE_IOS_CLIENT_ID || undefined,
      });
    }
  }, []);

  useEffect(() => {
    if (Platform.OS === 'web' && gsiReady) {
      initIdClient();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gsiReady]);

  const loadGoogleScript = () => {
    const id = 'google-gsi-client';
    if (document.getElementById(id)) {
      setGsiReady(!!window.google?.accounts?.id);
      return;
    }

    const script = document.createElement('script');
    script.id = id;
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.defer = true;
    script.onload = () => {
      setGsiReady(!!window.google?.accounts?.id);
    };
    script.onerror = () => {
      console.error('Failed to load Google Identity Services script');
      if (onError) {
        onError('Failed to load Google login service');
      }
    };
    document.head.appendChild(script);
  };

  // ID-token flow (replaces the old access-token flow): initialize GIS with a
  // callback that receives a signed `credential` (the ID token), then forward
  // taps on our styled button to a hidden, official Google button so the
  // click counts as a real user gesture (required for the credential UI).
  const initIdClient = () => {
    if (!window.google?.accounts?.id) return;

    window.google.accounts.id.initialize({
      client_id: GOOGLE_WEB_CLIENT_ID,
      callback: handleCredentialResponse,
      ux_mode: 'popup',
      auto_select: false,
    });

    let container = document.getElementById(HIDDEN_BUTTON_CONTAINER_ID);
    if (!container) {
      container = document.createElement('div');
      container.id = HIDDEN_BUTTON_CONTAINER_ID;
      container.style.position = 'fixed';
      container.style.top = '-9999px';
      container.style.left = '-9999px';
      document.body.appendChild(container);
    }
    window.google.accounts.id.renderButton(container, { type: 'standard' });
  };

  const handleCredentialResponse = async (response: any) => {
    const idToken = response?.credential;
    if (!idToken) {
      setIsLoading(false);
      const msg = 'No credential returned from Google';
      onError ? onError(msg) : Alert.alert('Error', msg);
      return;
    }
    await postIdTokenToBackend(idToken);
  };

  const postIdTokenToBackend = async (idToken: string) => {
    try {
      const response = await fetch(`${API_BASE_URL}auth/google`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ idToken }),
      });

      const data = await response.json().catch(() => ({}));

      if (response.ok && data.status === 'success') {
        const userData = data.user || data.data;
        if (userData) {
          onSuccess({
            user: userData,
            token: data.token || '',
            profileCompleted: userData.profileCompleted !== false,
          });
        } else {
          throw new Error('Invalid response from server');
        }
      } else {
        throw new Error(data.message || 'Google login failed');
      }
    } catch (error: any) {
      console.error('Google login error:', error);
      const errorMsg = error?.message || 'Google login failed';
      if (onError) {
        onError(errorMsg);
      } else {
        Alert.alert('Error', errorMsg);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleWebLogin = () => {
    const container = document.getElementById(HIDDEN_BUTTON_CONTAINER_ID);
    const hiddenButton = container?.querySelector('div[role="button"]') as HTMLElement | null;
    setIsLoading(true);
    if (hiddenButton) {
      hiddenButton.click();
      return;
    }
    // Fallback: One Tap prompt, in case the hidden official button hasn't
    // rendered yet (e.g. GIS script still loading).
    if (window.google?.accounts?.id) {
      window.google.accounts.id.prompt();
    } else {
      setIsLoading(false);
      Alert.alert('Error', 'Google is not ready yet. Please try again in a moment.');
    }
  };

  const handleNativeLogin = async () => {
    if (!GoogleSignin) {
      Alert.alert('Error', 'Google Sign-In is not available on this platform.');
      return;
    }
    setIsLoading(true);
    try {
      await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
      const result = await GoogleSignin.signIn();
      if (result?.type === 'cancelled') {
        setIsLoading(false);
        return;
      }
      const idToken = result?.data?.idToken;
      if (!idToken) {
        throw new Error('Google did not return an ID token');
      }
      await postIdTokenToBackend(idToken);
    } catch (error: any) {
      setIsLoading(false);
      const errorMsg = error?.message || 'Google login failed';
      if (onError) {
        onError(errorMsg);
      } else {
        Alert.alert('Error', errorMsg);
      }
    }
  };

  const handleGoogleLogin = () => {
    if (Platform.OS === 'web') {
      handleWebLogin();
    } else {
      handleNativeLogin();
    }
  };

  // NOTE: GOOGLE_ANDROID_CLIENT_ID isn't referenced directly here — the
  // native Android OAuth client is resolved by Google Play Services from the
  // app's package name + signing cert SHA-1 registered against that client
  // in Google Cloud Console. Keeping the import/name around documents where
  // it must be created; see src/config/auth.ts.
  void GOOGLE_ANDROID_CLIENT_ID;

  return (
    <View style={styles.container}>
      <TouchableOpacity
        style={[styles.button, isLoading && styles.buttonDisabled]}
        onPress={handleGoogleLogin}
        disabled={isLoading}
      >
        {isLoading ? (
          <ActivityIndicator color={colors.text} />
        ) : (
          <>
            <View style={styles.googleIcon}>
              <GoogleLogo />
            </View>
            <Text style={styles.buttonText}>Google</Text>
          </>
        )}
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    marginVertical: spacing.sm,
  },
  // Height matches the frontend project's SMALL_CONTROL_HEIGHT (27, see
  // AuthPage.js) so the two projects' controls line up.
  button: {
    backgroundColor: colors.white,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    height: 27,
    paddingVertical: 0,
    paddingHorizontal: spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    ...shadow(1),
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: '#000000',
    fontSize: 13,
    fontWeight: '400',
  },
  googleIcon: {
    marginRight: spacing.sm,
  },
});
