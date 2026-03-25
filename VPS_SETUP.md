# Using VPS Backend with Mobile App

## Current Configuration

The app is now configured to use the VPS backend: `http://82.165.217.122:5052/`

## Requirements

### For Android Emulator:
The emulator **MUST have internet connectivity** to reach the VPS.

### For Physical Device:
The device **MUST have internet connectivity** (Wi-Fi or mobile data).

## Enabling Internet on Android Emulator

### Method 1: Restart Emulator
1. Close the Android emulator
2. Open Android Studio
3. Go to **Tools > Device Manager**
4. Click the **▼** dropdown next to your emulator
5. Select **Cold Boot Now**
6. Wait for emulator to start
7. Check internet: Open browser in emulator and visit google.com

### Method 2: Check Network Settings
1. Open **Settings** in emulator
2. Go to **Network & Internet**
3. Enable **Wi-Fi** (should be enabled by default)
4. Check if connected

### Method 3: Command Line
```powershell
# Disable airplane mode
adb shell "settings put global airplane_mode_on 0"
adb shell "am broadcast -a android.intent.action.AIRPLANE_MODE --ez state false"

# Test connectivity
adb shell "ping -c 3 8.8.8.8"
```

## Testing VPS Connectivity

### From Emulator:
```powershell
adb shell "ping -c 3 82.165.217.122"
```

### From App:
1. Open the app
2. Check Metro bundler console
3. Look for: `API_BASE_URL: http://82.165.217.122:5052/`
4. Try login - should connect to VPS

## Switching Between Local and VPS

Edit `app/src/config/api.ts`:

```typescript
// Use local backend (for testing without internet)
const USE_LOCAL_BACKEND = true;  // Uses 10.0.2.2

// Use VPS backend (requires internet)
const USE_LOCAL_BACKEND = false; // Uses 82.165.217.122
```

After changing, rebuild the app:
```powershell
cd app/android
.\gradlew assembleDebug
```

## Troubleshooting

### "Network request failed"
- **Cause**: Emulator/device has no internet
- **Solution**: Enable internet on emulator (see above)

### "Connection refused"
- **Cause**: Backend not running on VPS
- **Solution**: Check VPS backend is running on port 5052

### "Timeout"
- **Cause**: Firewall blocking or network issue
- **Solution**: Check VPS firewall allows port 5052

## Alternative: Use Physical Device

If emulator internet issues persist:
1. Install APK on a physical Android device
2. Device must have Wi-Fi or mobile data
3. App will connect to VPS directly
