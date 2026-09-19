# r2flow-cloud-cli

CLI for deploying and managing processes on the R2Flow Cloud orchestrator.

## Install

```bash
cd cli
pip install -e .
```

## Configuration

Set the orchestrator URL via the `--orchestrator` flag or the `R2FLOW_CLOUD_URL` environment variable (default: `http://localhost:8000`).

## Usage

### Deploy a project

Pack a local directory and upload it as a new process:

```bash
r2flow-cloud deploy ./my-process --name "Data Pipeline" --description "Nightly ETL" --entry main.py
```

### List processes

```bash
r2flow-cloud processes
```

### List agents

```bash
r2flow-cloud agents
```

### Run a process on an agent

```bash
r2flow-cloud run <process_id> <agent_id>
```

### Custom orchestrator URL

```bash
r2flow-cloud --orchestrator http://remote-host:8000 deploy ./my-process --name "Pipeline"
```

Or via environment variable:

```bash
export R2FLOW_CLOUD_URL=http://remote-host:8000
r2flow-cloud deploy ./my-process --name "Pipeline"
```
