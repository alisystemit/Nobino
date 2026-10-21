# ─────────────────────────────────────────────────────────────────────
#  راه‌اندازی PostgreSQL قابل‌حمل (embedded) برای توسعه محلی.
#
#  روش: ابتدا initdb با رمزنگاری UTF8 ساخته می‌شود (مهم برای فارسی)،
#  سپس سرور روی پورت 5433 بالا می‌آید، دیتابیس «nobino» ساخته می‌شود
#  و در پایان `prisma db push` + `seed` اجرا می‌شود.
#
#  اجرا:  powershell -ExecutionPolicy Bypass -File scripts/setup-local-db.ps1
# ─────────────────────────────────────────────────────────────────────

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
Set-Location $root

$bin = Join-Path $root "node_modules\@embedded-postgres\windows-x64\native\bin"
$initdb = Join-Path $bin "initdb.exe"
$pgCtl = Join-Path $bin "pg_ctl.exe"
$data = Join-Path $root ".pgdata"
$port = 5433
$db = "nobino"
$conn = "postgresql://postgres:postgres@localhost:$port/$db?schema=public"

if (-not (Test-Path (Join-Path $data "PG_VERSION"))) {
  Write-Host "[1/4] مقداردهی اولیه خوشه (UTF8) ..."
  & $initdb -D $data -E UTF8 --locale=C -U postgres | Out-Null
} else {
  Write-Host "[1/4] خوشه از قبل وجود دارد."
}

if (-not (Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue)) {
  Write-Host "[2/4] بالا آوردن سرور روی پورت $port ..."
  Start-Process -FilePath $pgCtl -ArgumentList @('-D', $data, '-l', "$data\server.log", '-o', "`"-p $port`"", 'start') -WindowStyle Hidden
  Start-Sleep -Seconds 8
} else {
  Write-Host "[2/4] سرور از قبل در حال اجراست."
}

Write-Host "[3/4] اطمینان از وجود دیتابیس «$db» ..."
$env:DATABASE_URL = $conn
node -e "const{Client}=require('pg');(async()=>{const c=new Client({host:'localhost',port:$port,user:'postgres'});await c.connect();await c.query('CREATE DATABASE \"$db\"').catch(()=>{});await c.end();console.log('  دیتابیس آماده است')})()"

Write-Host "[4/4] اجرای prisma db push + seed ..."
& (Join-Path $root "node_modules\.bin\prisma.cmd") db push --skip-generate | Out-Null
node prisma/seed.mjs

Write-Host ""
Write-Host "✅ دیتابیس محلی آماده است:"
Write-Host "   DATABASE_URL=$conn"
Write-Host "   حالا اجرا کنید:  npm run dev"
