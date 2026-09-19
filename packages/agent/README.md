# r2flow-agent

Unattended worker that runs on a Windows machine, registers itself with a
[r2flow-cloud](https://github.com/2kurosss/r2flow) orchestrator,
polls it for commands, and executes deployed process bundles (Python code)
in isolated per-process venvs.

## One-line install (Windows)

Regular PowerShell (it self-elevates and installs Python 3.12 via winget if
missing):

```powershell
irm https://raw.githubusercontent.com/2kurosss/r2flow/main/packages/agent/install-agent.ps1 | iex
```

With parameters:

```powershell
& ([scriptblock]::Create((irm https://raw.githubusercontent.com/2kurosss/r2flow/main/packages/agent/install-agent.ps1))) `
    -Orchestrator https://cloud.example.com -Name prod-1 -JoinToken <TOKEN>
```

## Manual install

```bash
pip install r2flow-agent
```


## Quick start (manual, foreground)

```bash
pip install r2flow-agent
r2flow-agent --orchestrator http://orch-host:8000 --name my-agent \
    --url http://this-machine:8001
```

`--url` must be the address at which the **orchestrator** can reach this
machine (the orchestrator pushes commands and files to it).

## Unattended installation (recommended)

UI automation needs an **interactive desktop**, so the agent runs as a
scheduled task inside a user's log-on session — not as a session-0 service.
Use a dedicated local user with auto-logon for production agents.

```bash
# one command: writes config + creates the scheduled task
r2flow-agent-service install \
    --orchestrator http://orch-host:8000 \
    --name prod-1 \
    --join-token <AGENT_JOIN_TOKEN> \
    --user "WORKGROUP\\rpa-bot"     # optional, default: current user

r2flow-agent-service start        # launch now
r2flow-agent-service status       # task state
r2flow-agent-service stop | uninstall
```

What you get:

* task trigger **at log on** of the automation user → agent starts with the
  desktop, no manual steps after reboots;
* Task Scheduler restart policy (up to 999 retries, 1-minute interval) and,
  belt and braces, a crash-restart loop inside the agent with exponential
  backoff (5 s → 60 s, reset after a stable 5-minute run);
* config at `%LOCALAPPDATA%\r2flow_agent\config.json`, rolling log at
  `%LOCALAPPDATA%\r2flow_agent\agent.log`.

Registration honours `AGENT_JOIN_TOKEN` (pre-shared in the orchestrator
settings) or an admin JWT — whichever you pass with `--join-token`.

## Privacy note: failure screenshots

On a failed run the agent (with the [screenshot] extra installed) captures
the **entire virtual screen** — all monitors and every visible window, not
just the automated app — and uploads it to the orchestrator. Keep this in
mind on shared/multi-user machines: anything on screen at the moment of
failure (other apps, browser sessions, passwords) ends up in the cloud.

Deploy with the plain r2flow-agent package if screenshots are unwanted;
the agent runs fine without the extra and simply skips capture.
