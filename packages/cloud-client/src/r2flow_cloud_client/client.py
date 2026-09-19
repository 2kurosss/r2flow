"""Thin Python client for the r2flow-cloud orchestrator REST API.

Works with any r2flow-cloud >= 0.1 install:

    from r2flow_cloud_client import R2FlowCloud

    sc = R2FlowCloud("http://localhost:8000", token="r2f_...")
    process = sc.create_process("hello", files={"main.py": 'print("hi")'})
    agent = sc.list_agents()[0]
    sc.deploy_process(process["id"], agent["id"])
    run = sc.run_process(process["id"], agent["id"])
    sc.wait_run(process["id"], run["id"])  # blocks until terminal

Any HTTP client works too — the API is plain REST; this wrapper only saves
boilerplate. ``httpx`` (sync) is the only dependency.
"""

from __future__ import annotations

import time
from typing import Any

import httpx

__all__ = ["R2FlowCloud", "R2FlowCloudError"]

_TERMINAL_STATUSES = {"completed", "failed", "stopped", "system_failed"}


class R2FlowCloudError(RuntimeError):
    """Non-2xx response from the orchestrator."""

    def __init__(self, status_code: int, detail: str) -> None:
        super().__init__(f"API error {status_code}: {detail}")
        self.status_code = status_code
        self.detail = detail


class R2FlowCloud:
    """Sync client for the r2flow-cloud REST API (v1, paths ``/api/...``)."""

    def __init__(
        self,
        base_url: str = "http://localhost:8000",
        token: str | None = None,
        timeout: float = 30.0,
    ) -> None:
        headers = {"Authorization": f"Bearer {token}"} if token else {}
        self._client = httpx.Client(base_url=base_url.rstrip("/"), headers=headers, timeout=timeout)

    # ------------------------------------------------------------- internals

    def _request(self, method: str, path: str, **kwargs: Any) -> Any:
        res = self._client.request(method, path, **kwargs)
        if res.status_code >= 400:
            detail = res.text
            try:
                detail = res.json().get("detail", res.text)
            except ValueError:
                pass
            raise R2FlowCloudError(res.status_code, detail)
        if res.status_code == 204 or not res.content:
            return None
        return res.json()

    def _get(self, path: str, **kwargs: Any) -> Any:
        return self._request("GET", path, **kwargs)

    def _post(self, path: str, **kwargs: Any) -> Any:
        return self._request("POST", path, **kwargs)

    def _put(self, path: str, **kwargs: Any) -> Any:
        return self._request("PUT", path, **kwargs)

    def _delete(self, path: str) -> None:
        self._request("DELETE", path)

    # ------------------------------------------------------------- processes

    def list_processes(self) -> list[dict[str, Any]]:
        return self._get("/api/processes")

    def create_process(
        self,
        name: str,
        files: dict[str, str],
        entry_point: str = "main.py",
        description: str | None = None,
        requirements: list[str] | None = None,
    ) -> dict[str, Any]:
        payload: dict[str, Any] = {
            "name": name,
            "entry_point": entry_point,
            "files": files,
            "requirements": requirements or [],
        }
        if description:
            payload["description"] = description
        return self._post("/api/processes", json=payload)

    def get_process(self, process_id: str) -> dict[str, Any]:
        return self._get(f"/api/processes/{process_id}")

    def update_process(
        self,
        process_id: str,
        files: dict[str, str] | None = None,
        entry_point: str | None = None,
        requirements: list[str] | None = None,
        description: str | None = None,
    ) -> dict[str, Any]:
        payload: dict[str, Any] = {}
        if files is not None:
            payload["files"] = files
        if entry_point is not None:
            payload["entry_point"] = entry_point
        if requirements is not None:
            payload["requirements"] = requirements
        if description is not None:
            payload["description"] = description
        return self._put(f"/api/processes/{process_id}", json=payload)

    def delete_process(self, process_id: str) -> None:
        self._delete(f"/api/processes/{process_id}")

    def deploy_process(self, process_id: str, agent_id: str) -> dict[str, Any]:
        return self._post(
            f"/api/processes/{process_id}/deploy", json={"agent_id": agent_id}
        )

    def run_process(self, process_id: str, agent_id: str) -> dict[str, Any]:
        return self._post(
            f"/api/processes/{process_id}/run", json={"agent_id": agent_id}
        )

    def stop_run(self, process_id: str, run_id: str) -> dict[str, Any]:
        return self._post(f"/api/processes/{process_id}/stop", json={"run_id": run_id})

    def list_runs(self, process_id: str, limit: int = 50) -> list[dict[str, Any]]:
        return self._get(f"/api/processes/{process_id}/runs", params={"limit": limit})

    def get_logs(self, process_id: str, limit: int = 200) -> list[dict[str, Any]]:
        return self._get(f"/api/processes/{process_id}/logs", params={"limit": limit})

    def wait_run(
        self, process_id: str, run_id: str, timeout_s: float = 300.0, poll_s: float = 1.0
    ) -> dict[str, Any]:
        """Poll the run until it reaches a terminal status (or timeout)."""
        deadline = time.monotonic() + timeout_s
        while time.monotonic() < deadline:
            run = self._get(f"/api/processes/{process_id}/runs", params={"limit": 50})
            for r in run:
                if r["id"] == run_id:
                    if str(r.get("status", "")).lower() in _TERMINAL_STATUSES:
                        return r
                    break
            time.sleep(poll_s)
        raise R2FlowCloudError(408, f"run {run_id} did not finish in {timeout_s}s")

    # ---------------------------------------------------------------- agents

    def list_agents(self) -> list[dict[str, Any]]:
        return self._get("/api/agents")

    def register_agent(
        self, name: str, url: str, join_token: str | None = None
    ) -> dict[str, Any]:
        headers = {"Authorization": f"Bearer {join_token}"} if join_token else None
        return self._post(
            "/api/agents",
            json={"name": name, "url": url},
            headers=headers,
        )

    def delete_agent(self, agent_id: str) -> None:
        self._delete(f"/api/agents/{agent_id}")

    # ---------------------------------------------------------------- queues

    def list_queues(self) -> list[dict[str, Any]]:
        return self._get("/api/queues")

    def create_queue(self, name: str, max_attempts: int = 3) -> dict[str, Any]:
        return self._post("/api/queues", json={"name": name, "max_attempts": max_attempts})

    def delete_queue(self, name: str) -> None:
        self._delete(f"/api/queues/{name}")

    def add_queue_items(
        self, name: str, payloads: list[dict[str, Any]], idempotency_keys: list[str] | None = None
    ) -> list[dict[str, Any]]:
        items = [
            {"payload": p, **({"idempotency_key": k} if k else {})}
            for p, k in zip(payloads, idempotency_keys or [], strict=False)
        ]
        return self._post(f"/api/queues/{name}/items", json={"items": items})

    def claim_queue_item(
        self, agent_id: str, name: str, run_id: str, lease_seconds: int = 300
    ) -> dict[str, Any] | None:
        """Claim one item for a run; returns ``None`` when the queue is empty."""
        res = self._post(
            f"/api/agents/{agent_id}/queues/{name}/claim",
            json={"run_id": run_id, "lease_seconds": lease_seconds},
        )
        return res.get("item")

    def complete_queue_item(
        self,
        agent_id: str,
        item_id: str,
        run_id: str,
        status: str = "success",
        error: str | None = None,
        result: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        """Complete an item; ``system_failed`` requeues it while attempts remain."""
        payload: dict[str, Any] = {"run_id": run_id, "status": status}
        if error:
            payload["error"] = error
        if result is not None:
            payload["result"] = result
        return self._request(
            "PATCH",
            f"/api/agents/{agent_id}/queue-items/{item_id}",
            json=payload,
        )

    # -------------------------------------------------------------- triggers

    def list_triggers(self) -> list[dict[str, Any]]:
        return self._get("/api/triggers")

    def create_trigger(
        self,
        name: str,
        agent_id: str,
        process_id: str,
        run_at: str,
        repeat: str = "once",
        timezone: str = "Europe/Moscow",
    ) -> dict[str, Any]:
        return self._post(
            "/api/triggers",
            json={
                "name": name,
                "agent_id": agent_id,
                "process_id": process_id,
                "run_at": run_at,
                "repeat": repeat,
                "timezone": timezone,
            },
        )

    def delete_trigger(self, trigger_id: str) -> None:
        self._delete(f"/api/triggers/{trigger_id}")

    # ---------------------------------------------------------------- tokens

    def list_tokens(self) -> list[dict[str, Any]]:
        return self._get("/api/tokens")

    def create_token(self, name: str) -> dict[str, Any]:
        return self._post("/api/tokens", json={"name": name})

    def revoke_token(self, token_id: str) -> None:
        self._delete(f"/api/tokens/{token_id}")
