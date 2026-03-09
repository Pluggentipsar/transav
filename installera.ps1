#Requires -Version 5.1
<#
.SYNOPSIS
    TystText installationsscript — kör EN gång.
.DESCRIPTION
    Idempotent: varje steg markeras med en fil i .tysttext/ och hoppas över vid omkörning.
    Laddar ned Python 3.11.9 embedded, pip, PyTorch, backend-beroenden, ffmpeg och KB-BERT NER.
#>
[CmdletBinding()]
param()

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

# ── Kataloger ──────────────────────────────────────────────────────────────────
$Root       = Split-Path -Parent $MyInvocation.MyCommand.Definition
$TystDir    = Join-Path $Root '.tysttext'
$PythonDir  = Join-Path $TystDir 'python'
$FfmpegDir  = Join-Path $TystDir 'ffmpeg'
$DataDir    = Join-Path $TystDir 'data'
$ModelsDir  = Join-Path $DataDir 'models'
$HfHome     = Join-Path $ModelsDir 'huggingface'
$UploadsDir = Join-Path $DataDir 'uploads'

# ── Hjälpfunktioner ───────────────────────────────────────────────────────────

function Write-Step {
    param([string]$Nr, [string]$Text)
    Write-Host ""
    Write-Host "  [$Nr] $Text" -ForegroundColor Cyan
    Write-Host "  $('─' * 60)"
}

function Test-StepDone {
    param([string]$Name)
    return Test-Path (Join-Path $TystDir $Name)
}

function Set-StepDone {
    param([string]$Name)
    $null = New-Item -Path (Join-Path $TystDir $Name) -ItemType File -Force
}

function Invoke-Native {
    <# Kör native exe utan att stderr-utskrifter avbryter scriptet. #>
    param([scriptblock]$Cmd, [switch]$PassThru)
    $prev = $ErrorActionPreference
    $ErrorActionPreference = 'Continue'
    try {
        if ($PassThru) { & $Cmd 2>&1 | ForEach-Object { Write-Host "    $_" } }
        else           { & $Cmd 2>&1 | Out-Null }
    } finally { $ErrorActionPreference = $prev }
    return $LASTEXITCODE
}

function Get-Download {
    <#
    .SYNOPSIS
        Ladda ned fil med WebClient (<50 MB) eller BITS (>50 MB). 3 retries.
    #>
    param(
        [string]$Url,
        [string]$Destination,
        [switch]$UseBits
    )

    $dir = Split-Path -Parent $Destination
    if (-not (Test-Path $dir)) {
        $null = New-Item -Path $dir -ItemType Directory -Force
    }

    if (Test-Path $Destination) {
        Write-Host "    Redan nedladdad: $(Split-Path -Leaf $Destination)"
        return
    }

    $maxRetries = 3
    for ($i = 1; $i -le $maxRetries; $i++) {
        try {
            Write-Host "    Laddar ned $(Split-Path -Leaf $Destination) (forsok $i/$maxRetries)..."
            if ($UseBits) {
                Start-BitsTransfer -Source $Url -Destination $Destination -ErrorAction Stop
            }
            else {
                $wc = New-Object System.Net.WebClient
                $wc.DownloadFile($Url, $Destination)
            }
            return
        }
        catch {
            Write-Host "    Nedladdning misslyckades: $_" -ForegroundColor Yellow
            if ($i -eq $maxRetries) {
                throw "Kunde inte ladda ned $(Split-Path -Leaf $Destination) efter $maxRetries forsok."
            }
            Start-Sleep -Seconds 3
        }
    }
}

# ── Rubrik ─────────────────────────────────────────────────────────────────────

Write-Host ""
Write-Host "  ╔══════════════════════════════════════╗" -ForegroundColor Green
Write-Host "  ║     TystText — Installation          ║" -ForegroundColor Green
Write-Host "  ╚══════════════════════════════════════╝" -ForegroundColor Green
Write-Host ""

# Skapa mappstruktur
foreach ($d in @($TystDir, $PythonDir, $FfmpegDir, $DataDir, $ModelsDir, $HfHome, $UploadsDir)) {
    if (-not (Test-Path $d)) { $null = New-Item -Path $d -ItemType Directory -Force }
}

# ══════════════════════════════════════════════════════════════════════════════
# STEG 1: Diskutrymme
# ══════════════════════════════════════════════════════════════════════════════
Write-Step '1/7' 'Kontrollerar diskutrymme'

$drive = (Resolve-Path $Root).Drive
if ($null -eq $drive) {
    $driveLetter = (Resolve-Path $Root).Path.Substring(0, 1)
    $freeGB = [math]::Round((Get-PSDrive $driveLetter).Free / 1GB, 1)
}
else {
    $freeGB = [math]::Round($drive.Free / 1GB, 1)
}

Write-Host "    Ledigt utrymme: $freeGB GB"
if ($freeGB -lt 4) {
    Write-Host "    VARNING: Mindre an 4 GB ledigt. Installationen kan misslyckas." -ForegroundColor Red
    $ans = Read-Host "    Fortsatt anda? (J/N)"
    if ($ans -notmatch '^[jJyY]') {
        Write-Host "    Avbryter."
        exit 1
    }
}
else {
    Write-Host "    OK" -ForegroundColor Green
}

# ══════════════════════════════════════════════════════════════════════════════
# STEG 2: GPU-val
# ══════════════════════════════════════════════════════════════════════════════
Write-Step '2/7' 'GPU-val'

$gpuChoiceFile = Join-Path $TystDir '.gpu-choice'
if (Test-Path $gpuChoiceFile) {
    $GpuChoice = Get-Content $gpuChoiceFile -Raw
    $GpuChoice = $GpuChoice.Trim()
    Write-Host "    Tidigare val: $GpuChoice"
}
else {
    Write-Host ""
    Write-Host "    Har du ett NVIDIA-grafikkort med minst 4 GB VRAM?" -ForegroundColor Yellow
    Write-Host "    CUDA ger snabbare transkription men tar mer diskutrymme (~2.5 GB extra)."
    Write-Host ""
    $ans = Read-Host "    NVIDIA GPU? (J/N)"
    if ($ans -match '^[jJyY]') {
        $GpuChoice = 'cuda'
    }
    else {
        $GpuChoice = 'cpu'
    }
    Set-Content -Path $gpuChoiceFile -Value $GpuChoice
    Write-Host "    Valt: $GpuChoice" -ForegroundColor Green
}

# ══════════════════════════════════════════════════════════════════════════════
# STEG 3: Python 3.11.9 embedded
# ══════════════════════════════════════════════════════════════════════════════
Write-Step '3/7' 'Python 3.11.9 (embedded)'

if (Test-StepDone '.step-python-installed') {
    Write-Host "    Redan installerat — hoppar over"
}
else {
    $pyVer    = '3.11.9'
    $pyUrl    = "https://www.python.org/ftp/python/$pyVer/python-$pyVer-embed-amd64.zip"
    $pyZip    = Join-Path $TystDir "python-$pyVer-embed-amd64.zip"
    $pipUrl   = 'https://bootstrap.pypa.io/get-pip.py'
    $getPip   = Join-Path $TystDir 'get-pip.py'

    # Ladda ned Python
    Get-Download -Url $pyUrl -Destination $pyZip

    # Packa upp
    Write-Host "    Packar upp Python..."
    Expand-Archive -Path $pyZip -DestinationPath $PythonDir -Force

    # Fix python311._pth — uncomment "import site" och lägg till Lib\site-packages
    $pthFile = Join-Path $PythonDir 'python311._pth'
    if (Test-Path $pthFile) {
        $pthContent = Get-Content $pthFile
        $newContent = @()
        foreach ($line in $pthContent) {
            if ($line -match '^\s*#\s*import site') {
                $newContent += 'import site'
            }
            else {
                $newContent += $line
            }
        }
        # Lägg till Lib\site-packages om det inte finns
        if ($newContent -notcontains 'Lib\site-packages') {
            $newContent += 'Lib\site-packages'
        }
        Set-Content -Path $pthFile -Value $newContent
        Write-Host "    Fixat python311._pth"
    }

    # Installera pip
    Get-Download -Url $pipUrl -Destination $getPip
    Write-Host "    Installerar pip..."
    $rc = Invoke-Native { & (Join-Path $PythonDir 'python.exe') $getPip --no-warn-script-location }
    if ($rc -ne 0) { throw "pip-installationen misslyckades." }

    # Skapa Lib\site-packages om det saknas
    $sitePackages = Join-Path $PythonDir 'Lib\site-packages'
    if (-not (Test-Path $sitePackages)) {
        $null = New-Item -Path $sitePackages -ItemType Directory -Force
    }

    # Rensa zip
    Remove-Item -Path $pyZip -Force -ErrorAction SilentlyContinue

    Set-StepDone '.step-python-installed'
    Write-Host "    Python $pyVer installerat" -ForegroundColor Green
}

$PythonExe = Join-Path $PythonDir 'python.exe'
$PipExe    = Join-Path $PythonDir 'Scripts\pip.exe'

# ══════════════════════════════════════════════════════════════════════════════
# STEG 4: Beroenden (PyTorch + backend)
# ══════════════════════════════════════════════════════════════════════════════
Write-Step '4/7' "Installerar beroenden ($GpuChoice)"

$depsMarker = ".step-deps-$GpuChoice"
if (Test-StepDone $depsMarker) {
    Write-Host "    Redan installerat — hoppar over"
}
else {
    # PyTorch
    Write-Host "    Installerar PyTorch ($GpuChoice)..."
    if ($GpuChoice -eq 'cuda') {
        $rc = Invoke-Native -PassThru { & $PipExe install torch --index-url https://download.pytorch.org/whl/cu121 --no-warn-script-location }
    }
    else {
        $rc = Invoke-Native -PassThru { & $PipExe install torch --index-url https://download.pytorch.org/whl/cpu --no-warn-script-location }
    }
    if ($rc -ne 0) { throw "PyTorch-installationen misslyckades." }

    # Backend-beroenden (launcher.py lagger till backend/ i sys.path, ingen editable install behovs)
    Write-Host "    Installerar backend-beroenden..."
    $rc = Invoke-Native -PassThru {
        & $PipExe install --no-warn-script-location `
            "fastapi>=0.109.0" `
            "uvicorn[standard]>=0.27.0" `
            "pydantic>=2.5.0" `
            "pydantic-settings>=2.1.0" `
            "sqlalchemy>=2.0.0" `
            "aiosqlite>=0.19.0" `
            "faster-whisper>=1.0.0" `
            "python-multipart>=0.0.6" `
            "aiofiles>=23.2.0" `
            "python-dotenv>=1.0.0" `
            "huggingface-hub>=0.20.0" `
            "transformers"
    }
    if ($rc -ne 0) { throw "Backend-installationen misslyckades." }

    Set-StepDone $depsMarker
    Write-Host "    Beroenden installerade" -ForegroundColor Green
}

# ══════════════════════════════════════════════════════════════════════════════
# STEG 5: ffmpeg
# ══════════════════════════════════════════════════════════════════════════════
Write-Step '5/7' 'ffmpeg'

if (Test-StepDone '.step-ffmpeg-installed') {
    Write-Host "    Redan installerat — hoppar over"
}
else {
    $ffUrl  = 'https://github.com/BtbN/FFmpeg-Builds/releases/download/latest/ffmpeg-master-latest-win64-gpl.zip'
    $ffZip  = Join-Path $TystDir 'ffmpeg.zip'

    Get-Download -Url $ffUrl -Destination $ffZip -UseBits

    Write-Host "    Packar upp ffmpeg..."
    $ffTmp = Join-Path $TystDir 'ffmpeg-tmp'
    Expand-Archive -Path $ffZip -DestinationPath $ffTmp -Force

    # Hitta bin-mappen i den uppackade strukturen
    $binDir = Get-ChildItem -Path $ffTmp -Recurse -Directory -Filter 'bin' | Select-Object -First 1
    if ($null -ne $binDir) {
        Copy-Item -Path (Join-Path $binDir.FullName 'ffmpeg.exe')  -Destination $FfmpegDir -Force
        Copy-Item -Path (Join-Path $binDir.FullName 'ffprobe.exe') -Destination $FfmpegDir -Force
    }
    else {
        throw "Kunde inte hitta ffmpeg bin-mapp i nedladdningen."
    }

    # Rensa
    Remove-Item -Path $ffZip -Force -ErrorAction SilentlyContinue
    Remove-Item -Path $ffTmp -Recurse -Force -ErrorAction SilentlyContinue

    Set-StepDone '.step-ffmpeg-installed'
    Write-Host "    ffmpeg installerat" -ForegroundColor Green
}

# ══════════════════════════════════════════════════════════════════════════════
# STEG 6: KB-BERT NER-modell
# ══════════════════════════════════════════════════════════════════════════════
Write-Step '6/7' 'KB-BERT NER-modell'

if (Test-StepDone '.step-ner-model') {
    Write-Host "    Redan nedladdad — hoppar over"
}
else {
    Write-Host "    Laddar ned KB-BERT NER (kan ta nagra minuter)..."

    # Sätt HF_HOME så modellen hamnar rätt
    $env:HF_HOME = $HfHome
    $env:TRANSFORMERS_CACHE = $HfHome

    $nerLines = @(
        "import os"
        "os.environ['HF_HOME'] = r'" + $HfHome + "'"
        "os.environ['TRANSFORMERS_CACHE'] = r'" + $HfHome + "'"
        "from transformers import pipeline"
        "print('  Laddar modell...')"
        "p = pipeline('ner', model='KB/bert-base-swedish-cased-ner', aggregation_strategy='simple')"
        "print('  Testar modell...')"
        "result = p('Stockholm ar Sveriges huvudstad.')"
        "print('  Test OK - hittade ' + str(len(result)) + ' entiteter')"
    )
    $nerScriptFile = Join-Path $TystDir '_download_ner.py'
    Set-Content -Path $nerScriptFile -Value ($nerLines -join "`n") -Encoding UTF8

    $rc = Invoke-Native -PassThru { & $PythonExe $nerScriptFile }
    if ($rc -ne 0) { throw "KB-BERT NER nedladdningen misslyckades." }

    Remove-Item -Path $nerScriptFile -Force -ErrorAction SilentlyContinue

    Set-StepDone '.step-ner-model'
    Write-Host "    KB-BERT NER redo" -ForegroundColor Green
}

# ══════════════════════════════════════════════════════════════════════════════
# STEG 7: Frontend (valfritt)
# ══════════════════════════════════════════════════════════════════════════════
Write-Step '7/7' 'Frontend (valfritt)'

$frontendOut = Join-Path $Root 'frontend\out'
if (Test-Path $frontendOut) {
    Write-Host "    Frontend redan byggt — hoppar over"
}
else {
    $npmPath = Get-Command npm -ErrorAction SilentlyContinue
    if ($null -ne $npmPath) {
        Write-Host "    Node.js hittad — bygger frontend..."
        $frontendDir = Join-Path $Root 'frontend'
        Push-Location $frontendDir
        try {
            $env:NEXT_PUBLIC_APP_MODE = 'local'
            $null = Invoke-Native -PassThru { & npm install }
            $null = Invoke-Native -PassThru { & npm run build }
            Write-Host "    Frontend byggt" -ForegroundColor Green
        }
        catch {
            Write-Host "    Frontend-bygget misslyckades: $_" -ForegroundColor Yellow
            Write-Host "    Du kan bygga manuellt: cd frontend && npm install && npm run build"
        }
        finally {
            Pop-Location
        }
    }
    else {
        Write-Host "    Node.js saknas — hoppar over frontend-bygge" -ForegroundColor Yellow
        Write-Host "    Installera Node.js och kor: cd frontend && npm install && npm run build"
    }
}

# ══════════════════════════════════════════════════════════════════════════════
# Klart!
# ══════════════════════════════════════════════════════════════════════════════
Write-Host ""
Write-Host "  ╔══════════════════════════════════════╗" -ForegroundColor Green
Write-Host "  ║     Installation klar!               ║" -ForegroundColor Green
Write-Host "  ╚══════════════════════════════════════╝" -ForegroundColor Green
Write-Host ""
Write-Host "  Starta TystText genom att dubbelklicka: starta.bat" -ForegroundColor Cyan
Write-Host ""
