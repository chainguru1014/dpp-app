import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  getTranslation,
  LocaleCode,
  TranslationKey,
  LANGUAGE_OPTIONS,
} from './translations';

const STORAGE_KEY = 'appLocale';

type I18nContextValue = {
  locale: LocaleCode;
  setLocale: (code: LocaleCode) => void;
  t: (key: TranslationKey) => string;
  languages: typeof LANGUAGE_OPTIONS;
};

const I18nContext = createContext<I18nContextValue | null>(null);

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocaleState] = useState<LocaleCode>('en');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const stored = await AsyncStorage.getItem(STORAGE_KEY);
        if (
          stored &&
          ['en', 'ja', 'de', 'fr', 'nl'].includes(stored) &&
          !cancelled
        ) {
          setLocaleState(stored as LocaleCode);
        }
      } catch {
        /* ignore */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const setLocale = useCallback(async (code: LocaleCode) => {
    setLocaleState(code);
    try {
      await AsyncStorage.setItem(STORAGE_KEY, code);
    } catch {
      /* ignore */
    }
  }, []);

  const t = useCallback(
    (key: TranslationKey) => getTranslation(locale, key),
    [locale]
  );

  const value = useMemo(
    () => ({
      locale,
      setLocale,
      t,
      languages: LANGUAGE_OPTIONS,
    }),
    [locale, setLocale, t]
  );

  return (
    <I18nContext.Provider value={value}>{children}</I18nContext.Provider>
  );
}

export function useI18n(): I18nContextValue {
  const ctx = useContext(I18nContext);
  if (!ctx) {
    throw new Error('useI18n must be used within I18nProvider');
  }
  return ctx;
}
