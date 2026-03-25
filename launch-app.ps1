# PowerShell script to launch the React Native app on Android emulator
# This ensures the app launches automatically after builds

Write-Host "Launching QRAuthApp on Android emulator..." -ForegroundColor Cyan

# Check if emulator is connected
$devices = adb devices | Select-String "device$"
if (-not $devices) {
    Write-Host "No Android device/emulator found!" -ForegroundColor Red
    Write-Host "Please start Android emulator first." -ForegroundColor Yellow
    exit 1
}

# Launch the app
Write-Host "Starting app..." -ForegroundColor Yellow
adb shell am start -n com.qrauthapp/.MainActivity

# Check if Metro bundler is running
$metro = netstat -ano | Select-String ":8081.*LISTENING"
if (-not $metro) {
    Write-Host "`nMetro bundler is not running!" -ForegroundColor Yellow
    Write-Host "Start it with: npm start" -ForegroundColor Cyan
} else {
    Write-Host "`nMetro bundler is running on port 8081" -ForegroundColor Green
}

Write-Host "`nApp launched! Press R twice in Metro terminal to reload." -ForegroundColor Green
