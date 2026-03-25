# Enable Internet on Android Emulator

## Problem
The Android emulator has no internet connectivity, so it cannot reach the VPS backend.

## Solution: Enable Internet on Emulator

### Method 1: Cold Boot (Recommended)
1. **Close the emulator completely**
2. Open **Android Studio**
3. Go to **Tools > Device Manager** (or **View > Tool Windows > Device Manager**)
4. Find your emulator in the list
5. Click the **▼** (dropdown arrow) next to the emulator
6. Select **Cold Boot Now**
7. Wait for emulator to fully start
8. **Test internet**: Open browser in emulator → Visit `google.com`

### Method 2: Check Network Settings
1. In the emulator, open **Settings**
2. Go to **Network & Internet**
3. Tap **Wi-Fi**
4. Make sure Wi-Fi is **ON** and connected
5. If not connected, tap to connect

### Method 3: Restart with Internet Enabled
1. Close emulator
2. In Android Studio Device Manager, click **▶** (Play button) to start
3. During boot, internet should be enabled by default

### Method 4: Use Physical Device (Alternative)
If emulator internet issues persist:
1. Transfer APK to a physical Android device
2. Enable "Install from Unknown Sources"
3. Install the APK
4. Device must have Wi-Fi or mobile data
5. App will connect to VPS directly

## Verify Internet is Working

### Test from Emulator:
```powershell
# Test internet connectivity
adb shell "ping -c 3 8.8.8.8"

# Test VPS connectivity  
adb shell "ping -c 3 82.165.217.122"
```

### Test from App:
1. Open the app
2. Check Metro bundler console
3. Should see: `API_BASE_URL: http://82.165.217.122:5052/`
4. Try login - should connect to VPS

## Current App Configuration

The app is configured to use VPS backend:
- **API URL**: `http://82.165.217.122:5052/`
- **Requires**: Internet connectivity on emulator/device

## If Still Not Working

1. **Check VPS is accessible**:
   ```powershell
   # From your computer (not emulator)
   curl http://82.165.217.122:5052/user/login -X POST -H "Content-Type: application/json" -d '{"name":"test","password":"test"}'
   ```

2. **Check emulator network**:
   - Open browser in emulator
   - Try visiting: `http://82.165.217.122:5052`
   - Should see backend response or error (not "network error")

3. **Use LDPlayer instead**:
   - LDPlayer often has better network support
   - Install APK on LDPlayer
   - Should work with VPS directly
