// API Configuration
// Update this file with your backend URL

// For Android Studio Emulator, use: http://10.0.2.2:5052
// For LDPlayer/Other Emulators, use your computer's IP: http://192.168.x.x:5052
// For iOS Simulator, use: http://localhost:5052
// For physical device, use your computer's IP: http://192.168.x.x:5052

import { Platform } from 'react-native';

// Configuration for different environments
// IMPORTANT: Set USE_LOCAL_BACKEND to true if backend is running locally
// Set to false to use VPS backend (requires emulator/device to have internet)

// VPS hosted backend - backend is on port 5052
// If using reverse proxy on port 80, use: 'http://82.165.217.122/'
// Otherwise use port 5052 directly
const HOSTING_URL = 'https://api.innosynch.com/';

// Localhost backend for Android emulator (10.0.2.2 maps to host's localhost)
const LOCALHOST_URL = 'http://localhost:5052/';

// Toggle between local backend and hosted backend.
// - true  => local backend (Android emulator uses 10.0.2.2)
// - false => hosted backend (internet required on emulator/device)
// Default to hosted backend to avoid localhost URLs in shared/public links.
// Set to true only when actively developing against a local backend.
const USE_LOCAL_BACKEND = false;

// Resolve the backend URL.
// - Web: derive from the hostname so the SAME build works locally and when
//   deployed — localhost/127.0.0.1 -> local backend, any real host -> hosted.
// - Native: use the USE_LOCAL_BACKEND toggle (set false for release APKs).
const resolveBaseUrl = () => {
  if (Platform.OS === 'web') {
    try {
      const host = (globalThis as any)?.location?.hostname || '';
      if (host && host !== 'localhost' && host !== '127.0.0.1') {
        return HOSTING_URL;
      }
      return LOCALHOST_URL;
    } catch (e) {
      // fall through to the toggle
    }
  }
  return USE_LOCAL_BACKEND ? LOCALHOST_URL : HOSTING_URL;
};

export const API_BASE_URL = resolveBaseUrl();

// Log configuration for debugging
console.log('API Configuration:');
console.log('  Platform:', Platform.OS);
console.log('  API_BASE_URL:', API_BASE_URL);

// Helper function to get full API URL
export const getApiUrl = (endpoint: string) => {
  return `${API_BASE_URL}${endpoint.startsWith('/') ? endpoint : '/' + endpoint}`;
};
