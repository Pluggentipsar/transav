#Requires -Version 5.1
<#
.SYNOPSIS
    Bygger TystText-installer (.exe) med Inno Setup.
.DESCRIPTION
    1. Kör installera.ps1 (om .tysttext saknas) för att bygga runtime-miljön
    2. Paketerar allt med Inno Setup till en enda .exe

    Förutsättningar:
    - Inno Setup 6 installerat (https://jrsoftware.org/isinfo.php)
    - installera.ps1 har körts minst en gång (eller körs automatiskt)
#>
[CmdletBinding()]
param(
    [switch]$SkipBuild,
    [string]$OutputDir = ".\dist"
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$Root = Split-Path -Parent $MyInvocation.MyCommand.Definition
$TystDir = Join-Path $Root '.tysttext'

Write-Host ""
Write-Host "  TystText Installer Builder" -ForegroundColor Cyan
Write-Host "  ==========================" -ForegroundColor Cyan
Write-Host ""

# ── Steg 1: Kontrollera att runtime finns ──────────────────────────────────

if (-not $SkipBuild) {
    $pythonExe = Join-Path $TystDir 'python\python.exe'
    if (-not (Test-Path $pythonExe)) {
        Write-Host "  .tysttext saknas — kör installera.ps1 först..." -ForegroundColor Yellow
        Write-Host ""
        & (Join-Path $Root 'installera.ps1')
        if ($LASTEXITCODE -ne 0) {
            throw "installera.ps1 misslyckades"
        }
    }
    else {
        Write-Host "  .tysttext finns — använder befintlig runtime" -ForegroundColor Green
    }
}

# ── Steg 2: Kontrollera Inno Setup ────────────────────────────────────────

$iscc = $null
$innoPaths = @(
    "${env:ProgramFiles(x86)}\Inno Setup 6\ISCC.exe"
    "$env:ProgramFiles\Inno Setup 6\ISCC.exe"
    "${env:ProgramFiles(x86)}\Inno Setup 5\ISCC.exe"
)
foreach ($p in $innoPaths) {
    if (Test-Path $p) { $iscc = $p; break }
}

if ($null -eq $iscc) {
    Write-Host "  Inno Setup hittades inte!" -ForegroundColor Red
    Write-Host "  Ladda ned gratis: https://jrsoftware.org/isdl.php" -ForegroundColor Yellow
    Write-Host ""
    throw "Inno Setup krävs för att bygga installern."
}

Write-Host "  Inno Setup: $iscc" -ForegroundColor Green

# ── Steg 3: Skapa output-katalog ──────────────────────────────────────────

if (-not (Test-Path $OutputDir)) {
    $null = New-Item -Path $OutputDir -ItemType Directory -Force
}
$OutputDir = (Resolve-Path $OutputDir).Path

# ── Steg 4: Beräkna storlek ──────────────────────────────────────────────

Write-Host ""
Write-Host "  Beräknar paketstorlek..."
$sizeMB = [math]::Round((Get-ChildItem -Path $TystDir -Recurse -File | Measure-Object -Property Length -Sum).Sum / 1MB, 0)
$frontendMB = [math]::Round((Get-ChildItem -Path (Join-Path $Root 'frontend\out') -Recurse -File | Measure-Object -Property Length -Sum).Sum / 1MB, 0)
$backendMB = [math]::Round((Get-ChildItem -Path (Join-Path $Root 'backend') -Recurse -File -Exclude '*.pyc','__pycache__' | Measure-Object -Property Length -Sum).Sum / 1MB, 0)
Write-Host "    Runtime (.tysttext): ${sizeMB} MB"
Write-Host "    Frontend (out):      ${frontendMB} MB"
Write-Host "    Backend:             ${backendMB} MB"
Write-Host "    Totalt:              $($sizeMB + $frontendMB + $backendMB) MB (före komprimering)"

# ── Steg 5: Bygg med Inno Setup ──────────────────────────────────────────

Write-Host ""
Write-Host "  Bygger installer..." -ForegroundColor Cyan

$issPath = Join-Path $Root 'installer.iss'
& $iscc "/O$OutputDir" $issPath

if ($LASTEXITCODE -ne 0) {
    throw "Inno Setup-bygget misslyckades"
}

Write-Host ""
$exeFile = Get-ChildItem -Path $OutputDir -Filter "TystText-Setup-*.exe" | Sort-Object LastWriteTime -Descending | Select-Object -First 1
if ($exeFile) {
    $exeSizeMB = [math]::Round($exeFile.Length / 1MB, 0)
    Write-Host "  Installer skapad: $($exeFile.FullName)" -ForegroundColor Green
    Write-Host "  Storlek: ${exeSizeMB} MB" -ForegroundColor Green
}

Write-Host ""
Write-Host "  Klart!" -ForegroundColor Green
Write-Host ""
