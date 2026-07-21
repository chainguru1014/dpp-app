import AsyncStorage from '@react-native-async-storage/async-storage';

// Local-device record of the AI Concierge personalization choice. Deliberately
// device-local rather than account-bound: the consent gate now runs before
// login (see AppNavigator's initialRouteName), so there is no account yet to
// attach a decision to when it's first made.
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
