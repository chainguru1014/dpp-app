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
import { APPLE_WEB_CLIENT_ID } from '../config/auth';
import { colors, spacing, radius, fontSize, shadow } from '../theme';

// Apple logomark as an inline SVG (react-native-svg, already a project
// dependency) rather than a font icon or bundled asset — GoogleAuthButton
// uses a static PNG for its "G", but no vector-icon font is actually linked
// into the native iOS/Android builds here (no UIAppFonts entry, no Android
// fonts.gradle hookup), so an SVG path sidesteps that entirely and renders
// identically on iOS, Android, and web. Path data: Simple Icons (CC0).
const AppleLogo = ({ size = 18, color = '#000000' }: { size?: number; color?: string }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24">
    <Path
      fill={color}
      d="M12.152 6.896c-.948 0-2.415-1.078-3.96-1.04-2.04.027-3.91 1.183-4.961 3.014-2.117 3.675-.546 9.103 1.519 12.09 1.013 1.454 2.208 3.09 3.792 3.039 1.52-.06 2.09-.987 3.935-.987 1.831 0 2.35.987 3.96.948 1.637-.026 2.676-1.48 3.676-2.948 1.156-1.688 1.636-3.325 1.662-3.415-.039-.013-3.182-1.221-3.22-4.857-.026-3.04 2.48-4.494 2.597-4.559-1.429-2.09-3.623-2.324-4.39-2.376-2-.156-3.675 1.09-4.61 1.09zm3.325-3.014c.836-1.014 1.402-2.428 1.246-3.831-1.207.052-2.663.805-3.532 1.818-.78.896-1.454 2.336-1.273 3.703 1.336.104 2.702-.676 3.559-1.69z"
    />
  </Svg>
);

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
          <ActivityIndicator color={colors.primary} />
        ) : (
          <>
            <View style={styles.appleIcon}>
              <AppleLogo />
            </View>
            <Text style={styles.buttonText}>Apple</Text>
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
  appleIcon: {
    marginRight: spacing.sm,
  },
  button: {
    backgroundColor: colors.white,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: 14,
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
    color: colors.primary,
    fontSize: fontSize.lg,
    fontWeight: '400',
  },
});
