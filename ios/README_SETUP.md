# iOS project — scaffolded, UNBUILT / UNVERIFIED

This `ios/` folder was generated on a Windows machine with no macOS, Xcode,
or CocoaPods available. It is **structurally** scaffolded — copied from
React Native 0.72.6's own template (`node_modules/react-native/template/ios`,
internally named `HelloWorld`) and renamed throughout to `QRAuthApp` — but it
has **never been opened in Xcode, never had `pod install` run against it, and
never been built**. Treat it as a starting point, not a verified project.

## What was done

- Copied `node_modules/react-native/template/ios` → `ios/`.
- Renamed every `HelloWorld` occurrence (directories, the `.xcodeproj`, the
  scheme, target names, `productName`/`PRODUCT_NAME`, the launch-screen
  label, `AppDelegate.mm`'s `moduleName`, the Podfile's `target` blocks) to
  `QRAuthApp`, matching the RN `moduleName` used elsewhere in this app and
  the Android module name (`QRAuthApp` app display name, `com.qrauthapp`
  Android `applicationId`).
- Renamed the template's `_xcode.env` to `.xcode.env` (npm doesn't publish
  dotfiles cleanly, so the template ships it with a leading underscore;
  `react-native init` normally renames it on generation — done by hand here
  since this folder was copied manually instead).
- Set `PRODUCT_BUNDLE_IDENTIFIER` to `com.qrauthapp` for the main app
  target's Debug and Release configs (mirrors the Android `applicationId`).
  The `QRAuthAppTests` target's bundle id is left as the RN-default derived
  value — it doesn't need to match the app.
- Added `QRAuthApp/QRAuthApp.entitlements` with the Sign In with Apple
  capability (`com.apple.developer.applesignin = ["Default"]`) and wired it
  in via `CODE_SIGN_ENTITLEMENTS` on both build configs.
- Added a `CFBundleURLTypes` entry to `Info.plist` for native Google
  Sign-In's reversed-client-id URL scheme — it's a **placeholder**
  (`com.googleusercontent.apps.<IOS_CLIENT_ID>`) until the iOS OAuth client
  is created in Google Cloud Console (see `src/config/auth.ts`).
- Left the `Podfile` exactly as templated. `@react-native-google-signin/google-signin`
  and `@invertase/react-native-apple-authentication` both autolink — no
  manual Podfile entries were needed or added.
- Did **not** add associated-domains / universal-links entitlements —
  intentionally out of scope: the passwordless flow uses email OTP, not
  magic links, so there's no deep-linking requirement to support here.

## What was NOT done (and can't be, from this environment)

- `pod install` was never run — there's no CocoaPods (or macOS) here. The
  first `pod install` a Mac runs will generate the actual `Pods/` project
  and will very likely rewrite/regenerate the `Pods-QRAuthApp*` build-phase
  references already present in the `.pbxproj` (those are template
  placeholders, same as any fresh `react-native init` output pre-`pod
  install` — this is normal, not a sign of breakage).
- The project has never been opened in Xcode. Signing (`Team`), automatic
  provisioning, and the actual App ID / Sign In with Apple capability
  registration in the Apple Developer portal all still need to happen there.
- No build, no simulator run, no device run — none of this has been
  exercised even once.

## What you need to do on a Mac before this is real

1. `cd ios && pod install`
2. Open `QRAuthApp.xcworkspace` (not the `.xcodeproj`) in Xcode.
3. Select the `QRAuthApp` target → Signing & Capabilities → assign your Team.
   Confirm "Sign In with Apple" shows up as a capability (it should, via the
   entitlements file) — if Xcode complains, add it again there and let Xcode
   regenerate the entitlements file (compare against the one already in the
   repo to make sure nothing else got dropped).
4. In the Apple Developer portal, make sure the App ID `com.qrauthapp` has
   the "Sign In with Apple" capability enabled.
5. In Google Cloud Console, create the Android and iOS OAuth clients
   (see the comments in `src/config/auth.ts`), then:
   - fill in `GOOGLE_ANDROID_CLIENT_ID` / `GOOGLE_IOS_CLIENT_ID` in
     `src/config/auth.ts`,
   - replace `<IOS_CLIENT_ID>` in `Info.plist`'s `CFBundleURLTypes` entry
     with the real reversed iOS client ID.
6. Build once for the Simulator to confirm the scaffold actually compiles —
   this has not been verified even once as of this writing.
7. Only after a successful build does it make sense to test Sign In with
   Apple / Google end to end.
