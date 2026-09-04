import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { NavigationContainer, useNavigationContainerRef } from '@react-navigation/native';
import AppNavigator from './src/navigation/AppNavigator';
import { I18nProvider } from './src/i18n/I18nContext';

// Web-only: remembers the current screen (+ its params) across a browser
// refresh. When present, this is handed to NavigationContainer as
// `initialState`, which makes react-navigation skip its own URL-based
// deep-link resolution for the initial load entirely (see useLinking.ts) --
// so a refresh lands back on whatever screen was open instead of always
// falling back to the `linking` config's matched (or default) route.
// Cleared on logout (see AppNavigator's handleLogout multiRemove).
const NAV_STATE_KEY = 'navState';

// Catches any render error that would otherwise unmount the whole app to a
// blank white screen with zero indication anything went wrong (the default
// behavior in a production bundle, which has no redbox to show it) --
// showing a plain "Something went wrong" + retry button instead. Deliberately
// self-contained (no theme/i18n imports) so it still renders even if the
// crash originated in one of those providers.
class AppErrorBoundary extends React.Component<{ children: React.ReactNode }, { error: Error | null }> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { error: null };
  }
  static getDerivedStateFromError(error: Error) {
    return { error };
  }
  componentDidCatch(error: Error, info: { componentStack?: string }) {
    console.error('App crashed:', error && error.message, error && error.stack, info && info.componentStack);
  }
  render() {
    if (this.state.error) {
      return (
        <View style={errorStyles.container}>
          <Text style={errorStyles.title}>Something went wrong</Text>
          <Text style={errorStyles.message}>{this.state.error.message}</Text>
          <TouchableOpacity style={errorStyles.button} onPress={() => this.setState({ error: null })}>
            <Text style={errorStyles.buttonText}>Try again</Text>
          </TouchableOpacity>
        </View>
      );
    }
    return this.props.children;
  }
}

const errorStyles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, backgroundColor: '#fff' },
  title: { fontSize: 18, fontWeight: '600', color: '#1b1f27', marginBottom: 8, textAlign: 'center' },
  message: { fontSize: 13, color: '#6b7280', marginBottom: 20, textAlign: 'center' },
  button: { backgroundColor: '#2f80c8', borderRadius: 24, paddingVertical: 12, paddingHorizontal: 28 },
  buttonText: { color: '#fff', fontSize: 14, fontWeight: '600' },
});

export default function App() {
  const navigationRef = useNavigationContainerRef();
  // On native, always start fresh (skip the restore round-trip). On web,
  // wait for the AsyncStorage read so `initialState` is ready before the
  // NavigationContainer's very first render.
  const [isReady, setIsReady] = React.useState(Platform.OS !== 'web');
  const [initialState, setInitialState] = React.useState<any>(undefined);

  React.useEffect(() => {
    if (Platform.OS !== 'web') return;
    (async () => {
      try {
        const saved = await AsyncStorage.getItem(NAV_STATE_KEY);
        if (saved) setInitialState(JSON.parse(saved));
      } catch (e) {
        // Corrupt/unavailable storage -- fall through to normal linking-based
        // initial route resolution.
      } finally {
        setIsReady(true);
      }
    })();
  }, []);

  const linking = {
    prefixes: ['https://dpp.innosynch.com', 'http://localhost:3001', 'http://localhost:19006'],
    config: {
      screens: {
        Result: 'product/:productId/:qrcodeId',
        TransferConfirm: 'transfer/:code',
        Home: 'home',
        Login: 'login',
        StaffLogin: 'staff-login',
        Register: 'register',
        AiConciergeConsent: 'ai-consent',
        Scanner: 'scanner',
        EnterCode: 'enter-code',
        ScanSuccessful: 'scan-successful',
        EditProfile: 'profile/edit',
        ScannedProducts: 'scanned-products',
        ProductSummary: 'product-summary',
        ProductLifecycle: 'product-lifecycle',
        ProductHistory: 'product-history',
        SendProductInfo: 'send-product-info',
        FavoriteBrands: 'favorite-brands',
        BrandDetail: 'brand-detail',
        PurchaseHistory: 'purchase-history',
        History: 'history-activity',
        Notifications: 'notifications',
        PrivatePolicy: 'privacy-policy',
        ShopNow: 'shop-now',
        EmployeeHome: 'employee-home',
        CorporateScanner: 'corporate-scanner',
        CorporateReview: 'corporate-review',
      },
    },
  };

  if (!isReady) return null;

  return (
    <AppErrorBoundary>
      <I18nProvider>
        <NavigationContainer
          ref={navigationRef}
          linking={linking}
          initialState={initialState}
          onStateChange={(state) => {
            if (Platform.OS === 'web') {
              AsyncStorage.setItem(NAV_STATE_KEY, JSON.stringify(state)).catch(() => {});
            }
          }}
          documentTitle={{ formatter: () => 'Yometel DPP' }}
        >
          <AppNavigator navigationRef={navigationRef} />
        </NavigationContainer>
      </I18nProvider>
    </AppErrorBoundary>
  );
}
