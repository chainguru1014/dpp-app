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
const HOSTING_URL = 'http://82.165.217.122:5052/';

// Localhost backend for Android emulator (10.0.2.2 maps to host's localhost)
const LOCALHOST_URL = 'http://localhost:5052/';

// Toggle between local backend and hosted backend.
// - true  => local backend (Android emulator uses 10.0.2.2)
// - false => hosted backend (internet required on emulator/device)
// Default to hosted backend to avoid localhost URLs in shared/public links.
// Set to true only when actively developing against a local backend.
const USE_LOCAL_BACKEND = false;

export const API_BASE_URL = USE_LOCAL_BACKEND ? LOCALHOST_URL : HOSTING_URL;

// Log configuration for debugging
console.log('API Configuration:');
console.log('  Platform:', Platform.OS);
console.log('  API_BASE_URL:', API_BASE_URL);

// Helper function to get full API URL
export const getApiUrl = (endpoint: string) => {
  return `${API_BASE_URL}${endpoint.startsWith('/') ? endpoint : '/' + endpoint}`;
};
