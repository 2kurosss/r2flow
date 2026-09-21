#Requires -Version 5.1
<#
.SYNOPSIS
  Установка R2Flow (движок + дизайнер + cloud-клиент) одной командой.

.DESCRIPTION
  1. Проверяет Python 3.11+ (через py-launcher), при отсутствии ставит
     Python 3.12 через winget.
  2. Создаёт venv в %LOCALAPPDATA%\R2Flow\venv (переиспользует существующий).
  3. Ставит пакеты: сначала пробует PyPI, при неудаче — из исходников
     ./packages (если скрипт запущен из checkout репозитория).
  4. Если дизайнер поставлен из исходников без собранного фронта —
     собирает его (нужен Node 18+), иначе предупреждает.
  5. Добавляет venv\Scripts в пользовательский PATH и кладёт ярлык
     «R2Flow Designer» в меню «Пуск».

.EXAMPLE
  irm https://raw.githubusercontent.com/2kurosss/r2flow/main/install.ps1 | iex
  .\install.ps1 -FromSource   # из checkout, без обращения к PyPI
#>
param(
  [switch]$FromSource,
  [string]$InstallDir = (Join-Path $env:LOCALAPPDATA "R2Flow")
)

$ErrorActionPreference = "Stop"
$RootDir = $PSScriptRoot
$HasSource = Test-Path (Join-Path $RootDir "packages\engine\pyproject.toml")
$VenvDir = Join-Path $InstallDir "venv"
$VenvPython = Join-Path $VenvDir "Scripts\python.exe"
$VenvPip = Join-Path $VenvDir "Scripts\pip.exe"

function Find-Python {
  # py-launcher, свежий подходящий Python 3.11+
  try {
    $v = & py -3 --version 2>$null
    if ($v -match "Python 3\.(\d+)") {
      if ([int]$Matches[1] -ge 11) { return "py -3" }
    }
  } catch { }
  foreach ($cmd in @("python", "python3")) {
    try {
      $v = & $cmd --version 2>$null
      if ($v -match "Python 3\.(\d+)") {
        if ([int]$Matches[1] -ge 11) { return $cmd }
      }
    } catch { }
  }
  return $null
}

function Install-PythonViaWinget {
  $winget = Get-Command winget -ErrorAction SilentlyContinue
  if (-not $winget) {
    throw "Не найден Python 3.11+ и нет winget. Поставь Python вручную с https://www.python.org/downloads/ (галочка 'Add to PATH'), затем запусти снова."
  }
  Write-Host "→ ставлю Python 3.12 через winget..." -ForegroundColor Cyan
  winget install --id Python.Python.3.12 -e --silent --accept-source-agreements --accept-package-agreements
  # обновить PATH текущей сессии
  $env:Path = [Environment]::GetEnvironmentVariable("Path", "Machine") + ";" + [Environment]::GetEnvironmentVariable("Path", "User")
}

$py = Find-Python
if (-not $py) {
  Install-PythonViaWinget
  $py = Find-Python
  if (-not $py) { throw "Python так и не найден. Переоткрой терминал и запусти снова." }
}
Write-Host "→ Python: $(Invoke-Expression "$py --version")" -ForegroundColor Green

if (-not (Test-Path $VenvPython)) {
  Write-Host "→ создаю venv: $VenvDir ..." -ForegroundColor Cyan
  New-Item -ItemType Directory -Path $InstallDir -Force | Out-Null
  Invoke-Expression "$py -m venv `"$VenvDir`""
}
& $VenvPython -m pip install --upgrade pip | Out-Null

$PypiPackages = @("r2flow-engine", "r2flow-designer[record]", "r2flow-cloud-client", "r2flow-cloud-cli")
$installed = $false
if (-not $FromSource) {
  Write-Host "→ пробую PyPI..." -ForegroundColor Cyan
  & $VenvPip install $PypiPackages 2>$null | Out-Null
  if ($LASTEXITCODE -eq 0) {
    $installed = $true
    Write-Host "→ пакеты поставлены с PyPI" -ForegroundColor Green
  } else {
    Write-Host "  PyPI не отдал пакеты (ещё не опубликованы) — ставлю из исходников." -ForegroundColor Yellow
  }
}
if (-not $installed) {
  if (-not $HasSource) {
    throw "Нет ни PyPI-пакетов, ни исходников рядом. Запусти из checkout репозитория или дождись публикации на PyPI."
  }
  Write-Host "→ ставлю из исходников: $RootDir\packages ..." -ForegroundColor Cyan
  & $VenvPip install (Join-Path $RootDir "packages\engine") | Out-Null
  if ($LASTEXITCODE -ne 0) { throw "Не поставился engine" }
  & $VenvPip install ((Join-Path $RootDir "packages\designer") + "[record]") | Out-Null
  if ($LASTEXITCODE -ne 0) { throw "Не поставился designer" }
  & $VenvPip install (Join-Path $RootDir "packages\cloud-client") | Out-Null
  & $VenvPip install (Join-Path $RootDir "packages\cloud-cli") | Out-Null
  Write-Host "→ пакеты поставлены из исходников" -ForegroundColor Green

  # Фронт дизайнера: нужен собранный dist (в git его нет).
  $dist = Join-Path $RootDir "packages\designer\designer-web\dist\index.html"
  if (-not (Test-Path $dist)) {
    $node = Get-Command node -ErrorAction SilentlyContinue
    if ($node) {
      Write-Host "→ собираю фронт дизайнера (npm)..." -ForegroundColor Cyan
      Push-Location (Join-Path $RootDir "packages\designer\designer-web")
      try {
        npm install 2>&1 | Out-Null
        if ($LASTEXITCODE -ne 0) { throw "npm install упал" }
        npm run build 2>&1 | Out-Null
        if ($LASTEXITCODE -ne 0) { throw "npm run build упал" }
      } finally {
        Pop-Location
      }
      Write-Host "→ фронт собран" -ForegroundColor Green
    } else {
      Write-Warning "Нет Node.js — фронт не собран. Поставь Node 18+ (winget install OpenJS.NodeJS.LTS), затем: cd packages\designer\designer-web; npm install; npm run build"
    }
  }
}

# PATH: venv\Scripts пользователя
$ScriptsDir = Join-Path $VenvDir "Scripts"
$userPath = [Environment]::GetEnvironmentVariable("Path", "User")
if ($userPath -notlike "*$ScriptsDir*") {
  [Environment]::SetEnvironmentVariable("Path", "$userPath;$ScriptsDir", "User")
  $env:Path = "$env:Path;$ScriptsDir"
  Write-Host "→ $ScriptsDir добавлен в пользовательский PATH" -ForegroundColor Green
}

# Ярлык в Пуск: запуск дизайнера
try {
  $startMenu = Join-Path ([Environment]::GetFolderPath("Programs")) "R2Flow"
  New-Item -ItemType Directory -Path $startMenu -Force | Out-Null
  $shell = New-Object -ComObject WScript.Shell
  $lnk = $shell.CreateShortcut((Join-Path $startMenu "R2Flow Designer.lnk"))
  if ($HasSource) {
    $lnk.TargetPath = "powershell.exe"
    $lnk.Arguments = "-NoExit -File `"$RootDir\start-r2flow.ps1`""
    $lnk.WorkingDirectory = $RootDir
  } else {
    $lnk.TargetPath = Join-Path $ScriptsDir "r2flow-designer.exe"
    $lnk.Arguments = "flow.json --port 8756"
    $lnk.WorkingDirectory = [Environment]::GetFolderPath("MyDocuments")
  }
  $lnk.Save()
  Write-Host "→ ярлык «R2Flow Designer» в меню Пуск" -ForegroundColor Green
} catch {
  Write-Warning "Не создал ярлык: $($_.Exception.Message)"
}

Write-Host ""
Write-Host "Готово. Дальше:" -ForegroundColor Green
Write-Host "  1. Дизайнер: меню Пуск → R2Flow Designer (или r2flow-designer в новом терминале)"
if ($HasSource) {
  Write-Host "     либо из checkout: .\start-r2flow.ps1"
}
Write-Host "  2. Агент на машину: см. packages\agent\install-agent.ps1"
Write-Host "     (или: irm https://raw.githubusercontent.com/2kurosss/r2flow/main/packages/agent/install-agent.ps1 | iex)"
Write-Host "  3. Cloud-оркестратор: приватный, URL и токен — от нас"
