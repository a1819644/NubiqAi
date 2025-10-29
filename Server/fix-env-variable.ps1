# Fix System Environment Variable (Run as Administrator)

# Permanently update system environment variable to correct project ID
[System.Environment]::SetEnvironmentVariable('GOOGLE_CLOUD_PROJECT', 'vectorslabai-16a5b', 'User')

Write-Host "✅ Updated GOOGLE_CLOUD_PROJECT to: vectorslabai-16a5b" -ForegroundColor Green
Write-Host ""
Write-Host "⚠️  IMPORTANT: You must restart PowerShell/Terminal for the change to take effect!" -ForegroundColor Yellow
Write-Host ""
Write-Host "After restarting, verify with:" -ForegroundColor Cyan
Write-Host "  echo `$env:GOOGLE_CLOUD_PROJECT" -ForegroundColor Gray
