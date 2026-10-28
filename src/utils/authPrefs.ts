import AsyncStorage from '@react-native-async-storage/async-storage';

// What this device/browser remembers about how its user signs in. Kept apart
// from the session keys (userToken/user) so logging out doesn't forget them:
// the next visit should still show Login (not Signup) with the last-used
// method already selected.

export type AuthMethod = 'face' | 'google' | 'apple' | 'email';

const HAS_ACCOUNT_KEY = 'authHasAccount';
const METHOD_KEY = 'authPreferredMethod';
const METHODS: AuthMethod[] = ['face', 'google', 'apple', 'email'];

export async function loadAuthPrefs(): Promise<{ hasAccount: boolean; method: AuthMethod | null }> {
  try {
    const [[, has], [, method]] = await AsyncStorage.multiGet([HAS_ACCOUNT_KEY, METHOD_KEY]);
    return {
      hasAccount: has === '1',
      method: METHODS.includes(method as AuthMethod) ? (method as AuthMethod) : null,
    };
  } catch (e) {
    return { hasAccount: false, method: null };
  }
}

/** Call after every successful signup or sign-in. */
export async function rememberAuthMethod(method: AuthMethod): Promise<void> {
  try {
    await AsyncStorage.multiSet([
      [HAS_ACCOUNT_KEY, '1'],
      [METHOD_KEY, method],
    ]);
  } catch (e) {
    console.error('rememberAuthMethod failed:', e);
  }
}
