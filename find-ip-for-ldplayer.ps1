# PowerShell script to find the correct IP address for LDPlayer
# Run this script to find your computer's IP address that LDPlayer can access

Write-Host "Finding IP addresses for LDPlayer configuration..." -ForegroundColor Cyan
Write-Host ""

# Get all network adapters with IPv4 addresses
$adapters = Get-NetIPAddress -AddressFamily IPv4 | Where-Object { $_.IPAddress -notlike "127.*" -and $_.IPAddress -notlike "169.254.*" }

Write-Host "Available IP addresses:" -ForegroundColor Yellow
Write-Host ""

$ipList = @()
foreach ($adapter in $adapters) {
    $interface = Get-NetAdapter | Where-Object { $_.InterfaceIndex -eq $adapter.InterfaceIndex }
    $ip = $adapter.IPAddress
    $status = $interface.Status
    
    Write-Host "  IP: $ip" -ForegroundColor Green
    Write-Host "    Adapter: $($interface.Name)" -ForegroundColor Gray
    Write-Host "    Status: $status" -ForegroundColor Gray
    Write-Host ""
    
    # Add to list (prefer active adapters)
    if ($status -eq "Up") {
        $ipList += $ip
    }
}

Write-Host "Recommended IP addresses (active adapters):" -ForegroundColor Yellow
foreach ($ip in $ipList) {
    Write-Host "  - $ip" -ForegroundColor Green
}

Write-Host ""
Write-Host "Next steps:" -ForegroundColor Cyan
Write-Host "1. Choose one of the IP addresses above (usually 192.168.x.x)" -ForegroundColor White
Write-Host "2. Update app/src/config/api.ts and set HOST_IP to that IP" -ForegroundColor White
Write-Host "3. Rebuild the APK: cd android && ./gradlew assembleDebug" -ForegroundColor White
Write-Host ""

# Test if backend is accessible
Write-Host "Testing backend connectivity..." -ForegroundColor Cyan
$backendRunning = $false
foreach ($ip in $ipList) {
    try {
        $response = Invoke-WebRequest -Uri "http://${ip}:5052" -Method Get -TimeoutSec 2 -ErrorAction SilentlyContinue
        if ($response) {
            Write-Host "✓ Backend is accessible at http://${ip}:5052" -ForegroundColor Green
            $backendRunning = $true
        }
    } catch {
        # Backend might not respond to GET, but that's okay
    }
}

if (-not $backendRunning) {
    Write-Host "⚠ Backend might not be running or not accessible" -ForegroundColor Yellow
    Write-Host "  Make sure backend is running on port 5052" -ForegroundColor Yellow
    Write-Host "  Check with: netstat -ano | findstr :5052" -ForegroundColor Yellow
}

Write-Host ""
