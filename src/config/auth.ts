// OAuth / passwordless auth configuration.
//
// IMPORTANT (external, non-code steps for whoever owns the Google Cloud /
// Apple Developer consoles):
//
// Google Sign-In needs THREE separate OAuth 2.0 client IDs from the same
// Google Cloud project (APIs & Services > Credentials):
//   1. A "Web application" client   -> GOOGLE_WEB_CLIENT_ID
//   2. An "Android" client          -> GOOGLE_ANDROID_CLIENT_ID
//      (needs the app's package name `com.qrauthapp` + the SHA-1 of the
//      signing certificate used for the build, debug AND release.)
//   3. An "iOS" client              -> GOOGLE_IOS_CLIENT_ID
//      (needs the app's bundle id `com.qrauthapp`.)
//
// `@react-native-google-signin/google-signin` is configured with
// `webClientId` (used to request an ID token whose audience the backend can
// verify) and, on iOS, `iosClientId`. The Android client ID itself is never
// passed to `GoogleSignin.configure` directly — it's wired up via the SHA-1
// fingerprint registered against the Android OAuth client above; Google
// Play Services resolves it from the app's package name + signing cert.
//
// The web client ID below is the SAME value that was previously hardcoded
// in `GoogleAuthButton.tsx` for the old web-only access-token flow — reused
// here as-is so existing web sign-in keeps working. Android/iOS client IDs
// are placeholders until they're created in Google Cloud Console.
export const GOOGLE_WEB_CLIENT_ID =
  '827449082182-gv23mpvpgi7jfh4v62ju5m6vgsi7fnv0.apps.googleusercontent.com';

// PLACEHOLDER — replace once the Android OAuth client exists.
export const GOOGLE_ANDROID_CLIENT_ID = '';

// PLACEHOLDER — replace once the iOS OAuth client exists. Also update the
// reversed-client-id URL scheme in ios/QRAuthApp/Info.plist to match.
export const GOOGLE_IOS_CLIENT_ID = '';

// Sign In with Apple has no client-id concept on the client side — the
// entitlement + bundle id (com.qrauthapp) registered in the Apple Developer
// portal is what ties native requests to the app. Nothing to configure here.
