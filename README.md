# R2Flow

Локальная платформа автоматизации: рисуешь процесс на полотне — он выполняется на твоей машине или на агентах.

**Продукты (один репозиторий, папка `packages/`):**

| Продукт | Пакет | Что это |
|---|---|---|
| R2Flow Engine | `r2flow-engine` | Движок: 30 инструментов Windows/файлы/Excel, flow-раннер, рекордер |
| R2Flow Designer | `r2flow-designer` | Полотно: запись действий, отладка, публикация |
| R2Flow Agent | `r2flow-agent` | Воркер на Windows-машине: забирает задачи у Cloud и выполняет |
| R2Flow Cloud Client | `r2flow-cloud-client` | Библиотека для работы с Cloud API (публичный контракт) |
| R2Flow Cloud CLI | `r2flow-cloud-cli` | Консоль: deploy, processes, agents, run |

> R2Flow Cloud (оркестратор: процессы, агенты, запуски, логи, очереди) — приватный, в этом репозитории его нет. Дизайнер и агент говорят с ним только по HTTP.

## Быстрый старт (Windows)

Нужно один раз: Python 3.11+, Node 18+, запущенный Docker Desktop.

```powershell
cd D:\Alexey\r2flow

# 1. движок и дизайнер (дизайнер сам подтянет движок)
pip install -e packages\engine
pip install -e "packages\designer[record]"

# 2. клиент Cloud API (для кнопки Publish и CLI)
pip install -e packages\cloud-client
pip install -e packages\cloud-cli

# 3. фронт дизайнера (один раз)
cd packages\designer\designer-web
npm install
npm run build
cd ..\..\..

# 4. запуск всего одной командой
.\start-r2flow.ps1
```

Открой **http://127.0.0.1:8756**: полотно «Дизайнер». Кнопка **Publish** отправляет flow в приватный R2Flow Cloud (`--url http://...:8000`).

Остановка — `Ctrl+C` в терминале.

## Первые шаги в дизайнере

1. Кнопка **Recorder** → покликай по окнам, попечатай → **Stop** — шаги упадут на полотно.
2. Кнопка **Tools** — добавить блоки вручную (drag на полотно или клик «+»).
3. Кнопка **Start** — выполнить flow прямо на этой машине, лог — в плавающей **Console** справа.
4. Кнопка **Publish** — отправить flow в R2Flow Cloud (приватный оркестратор), там раздать агентам и запускать.

## Агент на Windows-машине

```powershell
irm https://raw.githubusercontent.com/2kurosss/r2flow/main/packages/agent/install-agent.ps1 | iex
```

## Структура

```
r2flow/
├── start-r2flow.ps1 / start-r2flow.sh   # запуск дизайнера одной командой
└── packages/
    ├── engine/        # r2flow-engine  (+ tests, schemas, examples)
    ├── designer/      # r2flow-designer (+ designer-web React-фронт)
    ├── cloud-client/  # r2flow-cloud-client (публичный контракт Cloud API)
    ├── cloud-cli/     # r2flow-cloud-cli (консоль для Cloud API)
    └── agent/         # r2flow-agent (+ install-agent.ps1)
```

Старые репозитории (`smithy`, `smithy-agent`, `smithy-cloud`, `smithy-designer`) оставлены как архив — новый код живет здесь.
