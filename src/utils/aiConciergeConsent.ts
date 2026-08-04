import AsyncStorage from '@react-native-async-storage/async-storage';

// Local-device record of the AI Concierge personalization choice. The actual
// gate (see AppNavigator's initialRouteName / LoginScreen's goAfterAuth) is
// account-bound via the backend's `aiConciergeConsentAt` field, not this —
// this cache exists only to pre-fill AiConciergeConsentScreen (e.g. the
// pre-login "Privacy Preferences" review, where no account may exist yet).
const STORAGE_KEY = 'aiConciergeConsentChoice';

export type AiConciergeConsentChoice = { consent: boolean; decidedAt: number };

export const getStoredAiConciergeConsent = async (): Promise<AiConciergeConsentChoice | null> => {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return typeof parsed?.consent === 'boolean' ? parsed : null;
  } catch (error) {
    return null;
  }
};

export const setStoredAiConciergeConsent = async (consent: boolean): Promise<void> => {
  try {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify({ consent, decidedAt: Date.now() }));
  } catch (error) {
    // Best effort — a storage failure shouldn't block the consent flow.
  }
};
