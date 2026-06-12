# ============================================================================
# TINA — one-command Cloudflare deploy (run yourself: it needs YOUR account)
#
#   ! powershell -File cloudflare/deploy.ps1
#
# Prerequisites (the parts only you can authorize):
#   1. wrangler login            # authenticate YOUR Cloudflare account
#   2. Set FRESH AI keys (rotate the old exposed ones) for this shell:
#        $env:GEMINI_API_KEY = "AIza..."
#        $env:HF_API_KEY     = "hf_..."
#
# This script then does everything else: create D1, wire its id into
# wrangler.toml, apply the schema, set secrets, build, and deploy.
# ============================================================================
$ErrorActionPreference = 'Stop'
Set-Location (Split-Path $PSScriptRoot -Parent)

if (-not $env:GEMINI_API_KEY -or -not $env:HF_API_KEY) {
    Write-Error "Set `$env:GEMINI_API_KEY and `$env:HF_API_KEY (fresh, rotated keys) before running."
}

Write-Host "== 1/6  D1 database ==" -ForegroundColor Cyan
$list = wrangler d1 list --json | ConvertFrom-Json
$db = $list | Where-Object { $_.name -eq 'tina-db' }
if (-not $db) {
    wrangler d1 create tina-db | Out-Null
    $db = (wrangler d1 list --json | ConvertFrom-Json) | Where-Object { $_.name -eq 'tina-db' }
}
$dbid = $db.uuid
Write-Host "   tina-db = $dbid"
(Get-Content wrangler.toml) -replace 'REPLACE_WITH_D1_DATABASE_ID', $dbid | Set-Content wrangler.toml -Encoding utf8

Write-Host "== 2/6  schema ==" -ForegroundColor Cyan
wrangler d1 execute tina-db --file=cloudflare/schema.sql --remote

Write-Host "== 3/6  build (client + worker) ==" -ForegroundColor Cyan
npm run build

Write-Host "== 4/6  Pages project ==" -ForegroundColor Cyan
try { wrangler pages project create tina --production-branch main 2>$null } catch { Write-Host "   (project already exists)" }

Write-Host "== 5/6  secrets ==" -ForegroundColor Cyan
$jwt = -join ((48..57) + (65..90) + (97..122) | Get-Random -Count 48 | ForEach-Object { [char]$_ })
$jwt        | wrangler pages secret put JWT_SECRET     --project-name tina
$env:GEMINI_API_KEY | wrangler pages secret put GEMINI_API_KEY --project-name tina
$env:HF_API_KEY     | wrangler pages secret put HF_API_KEY     --project-name tina

Write-Host "== 6/6  deploy ==" -ForegroundColor Cyan
wrangler pages deploy dist --project-name tina

Write-Host "`nDone. Open the printed *.pages.dev URL, sign up, run a reflection." -ForegroundColor Green
Write-Host "Existing Supabase students must re-signup (password hashes cannot be migrated)."
