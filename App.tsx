import React from 'react';
import { NavigationContainer, useNavigationContainerRef } from '@react-navigation/native';
import AppNavigator from './src/navigation/AppNavigator';
import { I18nProvider } from './src/i18n/I18nContext';

export default function App() {
  const navigationRef = useNavigationContainerRef();
  const linking = {
    prefixes: ['http://localhost:3001', 'http://localhost:19006', 'https://localhost:3001'],
    config: {
      screens: {
        Result: 'product/:productId/:qrcodeId',
        Home: 'home',
        Login: 'login',
        Register: 'register',
        Scanner: 'scanner',
        EditProfile: 'profile/edit',
        ScannedProducts: 'scanned-products',
      },
    },
  };

  return (
    <I18nProvider>
      <NavigationContainer ref={navigationRef} linking={linking}>
        <AppNavigator navigationRef={navigationRef} />
      </NavigationContainer>
    </I18nProvider>
  );
}
