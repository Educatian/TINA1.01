# ============================================================================
# Apply the TINA-styled password-reset email to Supabase (run yourself).
#
#   1. Get a Management API token (sbp_...) from
#      https://supabase.com/dashboard/account/tokens  (or reuse a saved one)
#   2. Run it for this shell, then run this script:
#        $env:SUPABASE_ACCESS_TOKEN = "sbp_xxx"
#        ! powershell -File supabase/apply-email-template.ps1
#      (or point the env var at a saved token file:
#        $env:SUPABASE_ACCESS_TOKEN = (Get-Content path\to\token.txt).Trim() )
#
# It PATCHes the project's auth config so the "Reset Password" email uses the
# branded HTML in supabase/email-templates/reset-password.html.
# ============================================================================
$ErrorActionPreference = 'Stop'
Set-Location (Split-Path $PSScriptRoot -Parent)

$PROJECT_REF = 'qjopomljrjjhukhjiwwm'
$token = $env:SUPABASE_ACCESS_TOKEN
if (-not $token) { Write-Error "Set `$env:SUPABASE_ACCESS_TOKEN to a Supabase Management API token (sbp_...)." }

$html = Get-Content 'supabase/email-templates/reset-password.html' -Raw
$body = @{
    mailer_subjects_recovery         = 'Reset your TINA password 🍌'
    mailer_templates_recovery_content = $html
} | ConvertTo-Json -Depth 5

$resp = Invoke-RestMethod -Method Patch `
    -Uri "https://api.supabase.com/v1/projects/$PROJECT_REF/config/auth" `
    -Headers @{ Authorization = "Bearer $token" } `
    -ContentType 'application/json' `
    -Body $body

Write-Host "Applied. The Reset Password email is now TINA-styled." -ForegroundColor Green
Write-Host "Subject: $($resp.mailer_subjects_recovery)"
