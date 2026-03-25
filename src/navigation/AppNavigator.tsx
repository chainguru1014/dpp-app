import React, { useState, useEffect, useRef } from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { CommonActions } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import LoginScreen from '../screens/LoginScreen';
import RegisterScreen from '../screens/RegisterScreen';
import HomeScreen from '../screens/HomeScreen';
import ScannerScreen from '../screens/ScannerScreen';
import ResultScreen from '../screens/ResultScreen';
import ScannedProductListScreen from '../screens/ScannedProductListScreen';
import EditProfileScreen from '../screens/EditProfileScreen';

const Stack = createNativeStackNavigator();

export default function AppNavigator({ navigationRef }: { navigationRef: any }) {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
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
      initialRouteName={user ? 'Home' : 'Login'}
    >
      <Stack.Screen name="Login">
        {(props) => <LoginScreen {...props} onLogin={handleLogin} />}
      </Stack.Screen>

      <Stack.Screen name="Register">
        {(props) => <RegisterScreen {...props} onLogin={handleLogin} />}
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

      <Stack.Screen name="Scanner">
        {(props) => <ScannerScreen {...props} user={user} onLogout={handleLogout} />}
      </Stack.Screen>

      <Stack.Screen name="Result">
        {(props) => <ResultScreen {...props} user={user} onLogout={handleLogout} />}
      </Stack.Screen>

      <Stack.Screen name="ScannedProducts">
        {(props) => (
          <ScannedProductListScreen {...props} user={user} onLogout={handleLogout} />
        )}
      </Stack.Screen>
    </Stack.Navigator>
  );
}
