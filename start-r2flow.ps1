#Requires -Version 7.0
<#
.SYNOPSIS
  R2Flow одной командой: Postgres (docker) + R2Flow Cloud :8000 + R2Flow Designer :8756.

.DESCRIPTION
  1. Поднимает Postgres из packages/cloud/docker-compose.yml (только сервис postgres).
  2. Стартует R2Flow Cloud (uvicorn) фоном с dev-настройками для локального запуска.
  3. Стартует R2Flow Designer foreground — открой http://127.0.0.1:8756,
     внутри два таба: «Дизайнер» и «Оркестратор».
  Ctrl+C останавливает оба процесса (Postgres-контейнер остается с данными).

.PARAMETER NoCloud
  Запустить только дизайнер (таб оркестратора покажет подсказку).

.PARAMETER Flow
  Стартовый flow-файл дизайнера (default: flow.json в текущей папке).
#>
param(
  [switch]$NoCloud,
  [string]$Flow = "flow.json",
  [int]$CloudPort = 8000,
  [int]$DesignerPort = 8756
)

$ErrorActionPreference = "Stop"
$RootDir = $PSScriptRoot
$CloudDir = Join-Path $RootDir "packages\cloud"
$DesignerDir = Join-Path $RootDir "packages\designer"

function Test-PortOpen($Host_, $Port) {
  try {
    $c = New-Object Net.Sockets.TcpClient
    $iar = $c.BeginConnect($Host_, $Port, $null, $null)
    $ok = $iar.AsyncWaitHandle.WaitOne(500)
    $c.Close()
    return $ok
  } catch { return $false }
}

if (-not (Test-Path (Join-Path $DesignerDir "designer-web\dist\index.html"))) {
  Write-Warning "Нет packages/designer/designer-web/dist. Собери один раз: cd packages/designer/designer-web; npm install; npm run build"
}

if (-not $NoCloud -and -not (Test-Path (Join-Path $CloudDir "docker-compose.yml"))) {
  Write-Warning "R2Flow Cloud приватный и в этом репозитории его нет — запускаю только дизайнер. Кнопка Publish будет работать против внешнего Cloud через --url."
  $NoCloud = $true
}

$cloudProc = $null
try {
  if (-not $NoCloud) {
    Write-Host "→ postgres (docker)..." -ForegroundColor Cyan
    docker compose --file (Join-Path $CloudDir "docker-compose.yml") up -d postgres | Out-Null
    $tries = 0
    while (-not (Test-PortOpen "127.0.0.1" 5432) -and $tries -lt 30) {
      Start-Sleep -Seconds 1; $tries++
    }
    if (-not (Test-PortOpen "127.0.0.1" 5432)) { throw "Postgres не поднялся на 127.0.0.1:5432" }

    if (Test-PortOpen "127.0.0.1" $CloudPort) {
      # Порт занят — проверяем что это реально наш Cloud, а не зависший процесс.
      $healthy = $false
      try {
        $resp = Invoke-WebRequest -Uri "http://127.0.0.1:$CloudPort/health" -TimeoutSec 5 -UseBasicParsing
        $healthy = $resp.StatusCode -eq 200
      } catch { $healthy = $false }
      if ($healthy) {
        Write-Host "→ :$CloudPort уже запущен и отвечает." -ForegroundColor Yellow
      } else {
        Write-Host "→ :$CloudPort занят, но это НЕ R2Flow Cloud (не отвечает на /health)." -ForegroundColor Red
        Write-Host "  Кто держит порт:" -ForegroundColor Red
        netstat -ano | Select-String ":$CloudPort"
        throw "Освободи порт :$CloudPort (убий зависший процесс: taskkill /PID <номер> /F) и запусти снова."
      }
    } else {
      Write-Host "→ R2Flow Cloud :$CloudPort ..." -ForegroundColor Cyan
      $env:DEV_CREATE_TABLES = "true"
      $env:AUTH_ENABLED = "false"
      $env:CORS_ORIGINS = '["http://127.0.0.1:8756", "http://localhost:8756"]'
      $env:EMBEDDING_ALLOWED_ORIGINS = '["http://127.0.0.1:8756", "http://localhost:8756"]'
      $cloudProc = Start-Process -FilePath "python" -ArgumentList @(
        "-m", "uvicorn", "r2flow_cloud.main:app",
        "--host", "127.0.0.1", "--port", "$CloudPort"
      ) -WorkingDirectory $CloudDir -NoNewWindow -PassThru
      $tries = 0
      while (-not (Test-PortOpen "127.0.0.1" $CloudPort) -and $tries -lt 40) {
        if ($cloudProc.HasExited) { throw "R2Flow Cloud упал на старте (приватный репозиторий). Проверь внешний Cloud." }
        Start-Sleep -Seconds 1; $tries++
      }
      if (-not (Test-PortOpen "127.0.0.1" $CloudPort)) { throw "R2Flow Cloud не ответил на :$CloudPort" }
      Write-Host "→ R2Flow Cloud OK http://127.0.0.1:$CloudPort" -ForegroundColor Green
    }
  }

  Write-Host "→ R2Flow Designer :$DesignerPort ..." -ForegroundColor Cyan
  Write-Host ""
  Write-Host "  Открой http://127.0.0.1:$DesignerPort  — табы «Дизайнер» и «Оркестратор» в одном окне." -ForegroundColor Green
  Write-Host ""
  & python -m r2flow_designer $Flow --port $DesignerPort
}
finally {
  if ($cloudProc -ne $null -and -not $cloudProc.HasExited) {
    Write-Host "Останавливаю R2Flow Cloud..." -ForegroundColor Cyan
    Stop-Process -Id $cloudProc.Id -Force -ErrorAction SilentlyContinue
  }
  Write-Host "Готово. Postgres-контейнер оставлен (данные целы)." -ForegroundColor DarkGray
}
