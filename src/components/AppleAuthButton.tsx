import React, { useState } from 'react';
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
import { colors, spacing, radius, fontSize, shadow } from '../theme';

// NOTE: "Continue with Apple" is not (yet) part of src/i18n/translations.ts
// (a large, strictly-typed 5-locale table). Rather than hand-translate a new
// key into ja/de/fr/nl as a side effect of this change, this button uses a
// plain literal for now — add a proper `continueWithApple` translation key
// alongside the rest of the auth copy when that's done as its own pass.

// Sign In with Apple is only meaningful (and only allowed by Apple's Human
// Interface Guidelines to be shown) on iOS. There is no Android/web
// equivalent wired up here — the component renders nothing anywhere else.
let appleAuth: any = null;
if (Platform.OS === 'ios') {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  appleAuth = require('@invertase/react-native-apple-authentication').appleAuth;
}

interface AppleAuthButtonProps {
  // Called with the envelope returned by POST auth/apple: { user, token, profileCompleted, ... }
  onSuccess: (result: { user: any; token: string; profileCompleted: boolean }) => void;
  onError?: (error: string) => void;
}

export default function AppleAuthButton({ onSuccess, onError }: AppleAuthButtonProps) {
  const [isLoading, setIsLoading] = useState(false);

  if (Platform.OS !== 'ios' || !appleAuth) {
    return null;
  }

  const handleAppleLogin = async () => {
    setIsLoading(true);
    try {
      const response = await appleAuth.performRequest({
        requestedOperation: appleAuth.Operation.LOGIN,
        requestedScopes: [appleAuth.Scope.FULL_NAME, appleAuth.Scope.EMAIL],
      });

      const { identityToken, fullName } = response;
      if (!identityToken) {
        throw new Error('Apple did not return an identity token');
      }

      // fullName is only ever populated on the FIRST authorization for a
      // given Apple ID + app — the backend should persist it then, since
      // subsequent sign-ins will not include it again.
      const body: any = { identityToken };
      if (fullName && (fullName.givenName || fullName.familyName)) {
        body.user = {
          firstName: fullName.givenName || '',
          lastName: fullName.familyName || '',
        };
      }

      const apiResponse = await fetch(`${API_BASE_URL}auth/apple`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify(body),
      });

      const data = await apiResponse.json().catch(() => ({}));

      if (apiResponse.ok && data.status === 'success') {
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
        throw new Error(data.message || 'Apple login failed');
      }
    } catch (error: any) {
      // appleAuth.Error.CANCELED / code '1001' -> user simply dismissed the
      // sheet; don't surface that as a hard error.
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
