# PowerShell script to monitor React Native app logs
# Run this while testing the app to see API calls

Write-Host "Monitoring React Native app logs..." -ForegroundColor Cyan
Write-Host "Press Ctrl+C to stop" -ForegroundColor Yellow
Write-Host ""

# Clear logcat buffer
adb logcat -c

# Monitor logs for React Native JS, API calls, and network errors
adb logcat | Select-String -Pattern "ReactNativeJS|API|login|register|fetch|network|error|82.165.217.122" -CaseSensitive:$false
