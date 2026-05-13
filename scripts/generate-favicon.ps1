# Generate Favicon from Logo (PowerShell)
# This script converts logo_resized.png to various favicon formats using online tools

Write-Host "🎨 Generating favicons from logo..." -ForegroundColor Cyan

$scriptPath = Split-Path -Parent $MyInvocation.MyCommand.Path
$publicPath = Join-Path (Split-Path -Parent $scriptPath) "public"
$logoPath = Join-Path $publicPath "logo_resized.png"

if (-not (Test-Path $logoPath)) {
    Write-Host "❌ Logo file not found: $logoPath" -ForegroundColor Red
    exit 1
}

Write-Host "📁 Source: $logoPath" -ForegroundColor Green

# Check if we have the logo
if (Test-Path $logoPath) {
    Write-Host ""
    Write-Host "📋 Manual Steps Required:" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "Since ImageMagick is not easily available on Windows, please use one of these online tools:" -ForegroundColor White
    Write-Host ""
    Write-Host "Option 1 - favicon.io (Recommended):" -ForegroundColor Cyan
    Write-Host "  1. Go to: https://favicon.io/favicon-converter/" -ForegroundColor White
    Write-Host "  2. Upload: $logoPath" -ForegroundColor White
    Write-Host "  3. Download the generated files" -ForegroundColor White
    Write-Host "  4. Extract and copy to: $publicPath" -ForegroundColor White
    Write-Host ""
    Write-Host "Option 2 - realfavicongenerator.net:" -ForegroundColor Cyan
    Write-Host "  1. Go to: https://realfavicongenerator.net/" -ForegroundColor White
    Write-Host "  2. Upload: $logoPath" -ForegroundColor White
    Write-Host "  3. Generate and download" -ForegroundColor White
    Write-Host "  4. Extract and copy to: $publicPath" -ForegroundColor White
    Write-Host ""
    Write-Host "Files needed:" -ForegroundColor Yellow
    Write-Host "  • favicon.ico" -ForegroundColor White
    Write-Host "  • icon-192.png" -ForegroundColor White
    Write-Host "  • icon-512.png" -ForegroundColor White
    Write-Host "  • apple-touch-icon.png (optional)" -ForegroundColor White
    Write-Host ""
    
    # Try to open the logo in default image viewer
    Write-Host "Opening logo file..." -ForegroundColor Green
    Start-Process $logoPath
    
    # Try to open favicon.io in browser
    Write-Host "Opening favicon.io in browser..." -ForegroundColor Green
    Start-Process "https://favicon.io/favicon-converter/"
}
else {
    Write-Host "❌ Logo file not found!" -ForegroundColor Red
}
