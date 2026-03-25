# Monitor React Native app API calls
# This script will show all React Native JS logs including API calls

Write-Host "=== React Native API Call Monitor ===" -ForegroundColor Cyan
Write-Host "Watching for API calls to: http://82.165.217.122:5052" -ForegroundColor Yellow
Write-Host "Press Ctrl+C to stop monitoring" -ForegroundColor Yellow
Write-Host ""

# Clear previous logs
adb logcat -c

Write-Host "Starting log monitoring..." -ForegroundColor Green
Write-Host "Try logging in/registering in the app now..." -ForegroundColor Yellow
Write-Host ""

# Filter for React Native JS logs and API-related logs
adb logcat *:S ReactNativeJS:V ReactNative:V | Select-String -Pattern "API|login|register|user/login|user/register|82.165.217.122|fetch|error|Error" -CaseSensitive:$false
