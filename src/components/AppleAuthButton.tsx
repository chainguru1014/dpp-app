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
import { API_BASE_URL } from '../config/api';
import { APPLE_WEB_CLIENT_ID } from '../config/auth';
import { colors, spacing, radius, fontSize, shadow } from '../theme';

// NOTE: "Continue with Apple" is not (yet) part of src/i18n/translations.ts
// (a large, strictly-typed 5-locale table). Rather than hand-translate a new
// key into ja/de/fr/nl as a side effect of this change, this button uses a
// plain literal for now — add a proper `continueWithApple` translation key
// alongside the rest of the auth copy when that's done as its own pass.

// Sign In with Apple is only meaningful on iOS (native module) and web (JS
// SDK) — Apple has never offered an Android implementation, and Apple's own
// Human Interface Guidelines don't permit showing the button there, so this
// component renders nothing on Android.
let appleAuth: any = null;
if (Platform.OS === 'ios') {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  appleAuth = require('@invertase/react-native-apple-authentication').appleAuth;
}

const APPLE_JS_SDK_SRC =
  'https://appleid.cdn-apple.com/appleauth/static/jsapi/appleid/1/en_US/appleid.auth.js';
const APPLE_JS_SDK_SCRIPT_ID = 'appleid-auth-client';

interface AppleAuthButtonProps {
  // Called with the envelope returned by POST auth/apple: { user, token, profileCompleted, ... }
  onSuccess: (result: { user: any; token: string; profileCompleted: boolean }) => void;
  onError?: (error: string) => void;
}

export default function AppleAuthButton({ onSuccess, onError }: AppleAuthButtonProps) {
  const [isLoading, setIsLoading] = useState(false);
  const webReadyRef = useRef(false);

  // Mirrors frontend/src/features/auth/useAppleAuth.js — loads Apple's "Sign
  // in with Apple JS" once and initializes it against APPLE_WEB_CLIENT_ID.
  // Inert (signIn() will fail with an Apple-side error) until that's replaced
  // with a real Services ID registered for this app's web domain.
  useEffect(() => {
    if (Platform.OS !== 'web') return;

    const init = () => {
      if (!(window as any).AppleID?.auth || webReadyRef.current) return;
      try {
        (window as any).AppleID.auth.init({
          clientId: APPLE_WEB_CLIENT_ID,
          scope: 'name email',
          redirectURI: window.location.origin,
          usePopup: true,
        });
        webReadyRef.current = true;
      } catch (err) {
        console.error('Sign in with Apple init failed (check APPLE_WEB_CLIENT_ID):', err);
      }
    };

    if (document.getElementById(APPLE_JS_SDK_SCRIPT_ID)) {
      init();
      return;
    }
    const script = document.createElement('script');
    script.id = APPLE_JS_SDK_SCRIPT_ID;
    script.src = APPLE_JS_SDK_SRC;
    script.async = true;
    script.defer = true;
    script.onload = init;
    script.onerror = () => console.error('Failed to load Sign in with Apple JS');
    document.head.appendChild(script);
  }, []);

  if (Platform.OS === 'android' || (Platform.OS === 'ios' && !appleAuth)) {
    return null;
  }

  const postIdentityTokenToBackend = async (identityToken: string, fullName?: { firstName?: string; lastName?: string }) => {
    const body: any = { identityToken };
    if (fullName && (fullName.firstName || fullName.lastName)) {
      body.user = { firstName: fullName.firstName || '', lastName: fullName.lastName || '' };
    }

    const apiResponse = await fetch(`${API_BASE_URL}auth/apple`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(body),
    });

    const data = await apiResponse.json().catch(() => ({}));
    if (apiResponse.ok && data.status === 'success') {
      const userData = data.user || data.data;
      if (!userData) {
        throw new Error('Invalid response from server');
      }
      onSuccess({
        user: userData,
        token: data.token || '',
        profileCompleted: userData.profileCompleted !== false,
      });
    } else {
      throw new Error(data.message || 'Apple login failed');
    }
  };

  const handleAppleLoginNative = async () => {
    const response = await appleAuth.performRequest({
      requestedOperation: appleAuth.Operation.LOGIN,
      requestedScopes: [appleAuth.Scope.FULL_NAME, appleAuth.Scope.EMAIL],
    });
    const { identityToken, fullName } = response;
    if (!identityToken) {
      throw new Error('Apple did not return an identity token');
    }
    // fullName is only ever populated on the FIRST authorization for a given
    // Apple ID + app — the backend should persist it then, since subsequent
    // sign-ins will not include it again.
    await postIdentityTokenToBackend(identityToken, fullName ? { firstName: fullName.givenName, lastName: fullName.familyName } : undefined);
  };

  const handleAppleLoginWeb = async () => {
    if (!(window as any).AppleID?.auth) {
      throw new Error('Apple sign-in is not ready yet. Please try again in a moment.');
    }
    const result = await (window as any).AppleID.auth.signIn();
    const identityToken = result?.authorization?.id_token;
    if (!identityToken) {
      throw new Error('Apple did not return an identity token');
    }
    const rawName = result?.user?.name;
    await postIdentityTokenToBackend(identityToken, rawName ? { firstName: rawName.firstName, lastName: rawName.lastName } : undefined);
  };

  const handleAppleLogin = async () => {
    setIsLoading(true);
    try {
      if (Platform.OS === 'web') {
        await handleAppleLoginWeb();
      } else {
        await handleAppleLoginNative();
      }
    } catch (error: any) {
      // appleAuth.Error.CANCELED / code '1001' -> user simply dismissed the
      // sheet (native); the web popup rejects similarly on user cancel.
      const code = error?.code;
      if (code === appleAuth?.Error?.CANCELED || code === '1001') {
        setIsLoading(false);
        return;
      }
      console.error('Apple login error:', error);
      const errorMsg = error?.message || 'Apple login failed';
      if (onError) {
        onError(errorMsg);
      } else {
        Alert.alert('Error', errorMsg);
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <TouchableOpacity
        style={[styles.button, isLoading && styles.buttonDisabled]}
        onPress={handleAppleLogin}
        disabled={isLoading}
      >
        {isLoading ? (
          <ActivityIndicator color={colors.white} />
        ) : (
          <Text style={styles.buttonText}>Continue with Apple</Text>
        )}
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    marginVertical: spacing.sm,
  },
  button: {
    backgroundColor: '#000000',
    borderRadius: radius.md,
    paddingVertical: 14,
    paddingHorizontal: spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    ...shadow(1),
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: colors.white,
    fontSize: fontSize.lg,
    fontWeight: '400',
  },
});
