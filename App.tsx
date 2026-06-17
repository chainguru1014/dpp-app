import React from 'react';
import { NavigationContainer, useNavigationContainerRef } from '@react-navigation/native';
import AppNavigator from './src/navigation/AppNavigator';
import { I18nProvider } from './src/i18n/I18nContext';

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
    <I18nProvider>
      <NavigationContainer
        ref={navigationRef}
        linking={linking}
        documentTitle={{ formatter: () => 'Yometel DPP' }}
      >
        <AppNavigator navigationRef={navigationRef} />
      </NavigationContainer>
    </I18nProvider>
  );
}
