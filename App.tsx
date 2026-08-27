import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { NavigationContainer, useNavigationContainerRef } from '@react-navigation/native';
import AppNavigator from './src/navigation/AppNavigator';
import { I18nProvider } from './src/i18n/I18nContext';

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
  const linking = {
    prefixes: ['https://dpp.innosynch.com', 'http://localhost:3001', 'http://localhost:19006'],
    config: {
      screens: {
        Result: 'product/:productId/:qrcodeId',
        TransferConfirm: 'transfer/:code',
        Home: 'home',
        Login: 'login',
        Register: 'register',
        Scanner: 'scanner',
        EditProfile: 'profile/edit',
        ScannedProducts: 'scanned-products',
        PurchaseHistory: 'purchase-history',
        History: 'history-activity',
      },
    },
  };

  return (
    <AppErrorBoundary>
      <I18nProvider>
        <NavigationContainer
          ref={navigationRef}
          linking={linking}
          documentTitle={{ formatter: () => 'Yometel DPP' }}
        >
          <AppNavigator navigationRef={navigationRef} />
        </NavigationContainer>
      </I18nProvider>
    </AppErrorBoundary>
  );
}
