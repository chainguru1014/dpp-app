import React, { useState, useEffect, useRef } from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { CommonActions } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import LoginScreen from '../screens/LoginScreen';
import RegisterScreen from '../screens/RegisterScreen';
import AiConciergeConsentScreen from '../screens/AiConciergeConsentScreen';
import HomeScreen from '../screens/HomeScreen';
import ShopNowScreen from '../screens/ShopNowScreen';
import ScannerScreen from '../screens/ScannerScreen';
import ResultScreen from '../screens/ResultScreen';
import TransferConfirmScreen from '../screens/TransferConfirmScreen';
import ScanSuccessfulScreen from '../screens/ScanSuccessfulScreen';
import PrivatePolicyScreen from '../screens/PrivatePolicyScreen';
import ScannedProductListScreen from '../screens/ScannedProductListScreen';
import EditProfileScreen from '../screens/EditProfileScreen';
import FavoriteBrandsScreen from '../screens/FavoriteBrandsScreen';
import PurchaseHistoryScreen from '../screens/PurchaseHistoryScreen';
import HistoryScreen from '../screens/HistoryScreen';
import NotificationsScreen from '../screens/NotificationsScreen';
import StaffLoginScreen from '../screens/StaffLoginScreen';
import EmployeeHomeScreen from '../screens/EmployeeHomeScreen';
import { getStoredAiConciergeConsent } from '../utils/aiConciergeConsent';

const Stack = createNativeStackNavigator();

export default function AppNavigator({ navigationRef }: { navigationRef: any }) {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  // Pre-login gate: shown before Login/Home on every fresh app instance until
  // the user has made a local AI Concierge choice — see aiConciergeConsent.ts.
  const [hasAiConsentChoice, setHasAiConsentChoice] = useState(false);
  const prevUserRef = useRef<any>(undefined);
  const handledWebProductPathRef = useRef(false);

  useEffect(() => {
    checkAuth();
  }, []);

  // Web deep-link fallback:
  // Force /product/:productId/:qrcodeId into Result route if automatic linking misses it.
  useEffect(() => {
    if (handledWebProductPathRef.current) return;
    if (loading) return;
    if (Platform.OS !== 'web') return;
    if (!navigationRef?.current) return;

    const pathname = (globalThis as any)?.location?.pathname || '';

    // /transfer/:code -> ownership-transfer confirmation screen.
    const transferMatch = pathname.match(/^\/transfer\/([^/]+)\/?$/);
    if (transferMatch) {
      const code = decodeURIComponent(transferMatch[1]);
      handledWebProductPathRef.current = true;
      navigationRef.current.dispatch(
        CommonActions.reset({
          index: 0,
          routes: [{ name: 'TransferConfirm', params: { code } }],
        })
      );
      return;
    }

    const match = pathname.match(/^\/product\/([^/]+)\/([^/]+)\/?$/);
    if (!match) return;

    const productId = decodeURIComponent(match[1]);
    const qrcodeId = decodeURIComponent(match[2]);
    handledWebProductPathRef.current = true;

    navigationRef.current.dispatch(
      CommonActions.reset({
        index: 0,
        routes: [{ name: 'Result', params: { productId, qrcodeId } }],
      })
    );
  }, [loading, navigationRef]);

  // Reset navigation when we detect a logout (user changes from truthy -> null).
  useEffect(() => {
    // When user becomes null after being logged in (logout), navigate to Login
    // This ensures we only reset navigation on logout, not on initial load
    if (!loading && prevUserRef.current !== undefined && !user && navigationRef.current) {
      // User was logged in (prevUserRef.current was truthy) and now is null (logout)
      if (prevUserRef.current) {
        navigationRef.current.dispatch(
          CommonActions.reset({
            index: 0,
            routes: [{ name: 'Login' }],
          })
        );
      }
    }
    prevUserRef.current = user;
  }, [user, loading, navigationRef]);

  const checkAuth = async () => {
    try {
      const userData = await AsyncStorage.getItem('user');
      if (userData && userData !== 'null' && userData !== 'undefined') {
        try {
          const parsed = JSON.parse(userData);
          if (parsed) {
            setUser(parsed);
          }
        } catch (parseError) {
          console.error('Parse error:', parseError);
          await AsyncStorage.removeItem('user');
        }
      }
      const consentChoice = await getStoredAiConciergeConsent();
      setHasAiConsentChoice(!!consentChoice);
    } catch (error) {
      console.error('Auth check error:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = (userData: any) => {
    setUser(userData);
  };

  const handleUserUpdate = (userData: any) => {
    setUser(userData);
  };

  const handleLogout = async () => {
    try {
      // Clear all user-related persisted data before redirecting to Login.
      await AsyncStorage.multiRemove(['userToken', 'user', 'scannedProducts']);
    } catch (error) {
      console.error('Logout storage cleanup error:', error);
    } finally {
      setUser(null);
      // Ensure we always redirect to the Login screen when the user taps Logout.
      // (Avoid relying solely on the user state effect, which can be timing-dependent.)
      if (navigationRef.current) {
        navigationRef.current.dispatch(
          CommonActions.reset({
            index: 0,
            routes: [{ name: 'Login' }],
          })
        );
      }
    }
  };

  if (loading) {
    return null; // Or a loading screen
  }

  return (
    <Stack.Navigator
      screenOptions={{ headerShown: false }}
      initialRouteName={
        !hasAiConsentChoice
          ? 'AiConciergeConsent'
          : !user
          ? 'Login'
          : user.actorKind === 'Employee'
          ? 'EmployeeHome'
          : 'Home'
      }
    >
      <Stack.Screen name="Login">
        {(props) => <LoginScreen {...props} onLogin={handleLogin} />}
      </Stack.Screen>

      <Stack.Screen name="StaffLogin">
        {(props) => <StaffLoginScreen {...props} onLogin={handleLogin} />}
      </Stack.Screen>

      <Stack.Screen name="EmployeeHome">
        {(props) => <EmployeeHomeScreen {...props} user={user} onLogout={handleLogout} />}
      </Stack.Screen>

      <Stack.Screen name="Register">
        {(props) => <RegisterScreen {...props} onLogin={handleLogin} />}
      </Stack.Screen>

      <Stack.Screen name="AiConciergeConsent">
        {(props) => <AiConciergeConsentScreen {...props} onLogin={handleLogin} />}
      </Stack.Screen>

      <Stack.Screen name="EditProfile">
        {(props) => (
          <EditProfileScreen
            {...props}
            user={user}
            onLogout={handleLogout}
            onUserUpdate={handleUserUpdate}
          />
        )}
      </Stack.Screen>

      <Stack.Screen name="Home">
        {(props) => <HomeScreen {...props} user={user} onLogout={handleLogout} />}
      </Stack.Screen>

      <Stack.Screen name="ShopNow">
        {(props) => <ShopNowScreen {...props} user={user} onLogout={handleLogout} />}
      </Stack.Screen>

      <Stack.Screen name="Scanner">
        {(props) => <ScannerScreen {...props} user={user} onLogout={handleLogout} />}
      </Stack.Screen>

      <Stack.Screen name="Result">
        {(props) => <ResultScreen {...props} user={user} onLogout={handleLogout} />}
      </Stack.Screen>

      <Stack.Screen name="TransferConfirm">
        {(props) => <TransferConfirmScreen {...props} user={user} onLogout={handleLogout} />}
      </Stack.Screen>

      <Stack.Screen name="ScanSuccessful">
        {(props) => <ScanSuccessfulScreen {...props} user={user} onLogout={handleLogout} />}
      </Stack.Screen>

      <Stack.Screen name="PrivatePolicy">
        {(props) => <PrivatePolicyScreen {...props} user={user} onLogout={handleLogout} />}
      </Stack.Screen>

      <Stack.Screen name="ScannedProducts">
        {(props) => (
          <ScannedProductListScreen {...props} user={user} onLogout={handleLogout} />
        )}
      </Stack.Screen>

      <Stack.Screen name="FavoriteBrands">
        {(props) => <FavoriteBrandsScreen {...props} user={user} onLogout={handleLogout} />}
      </Stack.Screen>

      <Stack.Screen name="PurchaseHistory">
        {(props) => <PurchaseHistoryScreen {...props} user={user} onLogout={handleLogout} />}
      </Stack.Screen>

      <Stack.Screen name="History">
        {(props) => <HistoryScreen {...props} user={user} onLogout={handleLogout} />}
      </Stack.Screen>

      <Stack.Screen name="Notifications">
        {(props) => <NotificationsScreen {...props} user={user} onLogout={handleLogout} />}
      </Stack.Screen>
    </Stack.Navigator>
  );
}
