"""Client tests against a mocked transport (no live server needed)."""

from __future__ import annotations

import httpx
import pytest

from r2flow_cloud_client import R2FlowCloud, R2FlowCloudError


def _mock_app() -> httpx.MockTransport:
    state = {"runs": [], "calls": []}

    def handler(request: httpx.Request) -> httpx.Response:
        state["calls"].append((request.method, request.url.path))
        path = request.url.path
        auth = request.headers.get("authorization", "")
        if not auth.startswith("Bearer r2f_"):
            return httpx.Response(401, json={"detail": "Not authenticated"})
        if path == "/api/processes" and request.method == "POST":
            return httpx.Response(
                201, json={"id": "p1", "name": "hello", "entry_point": "main.py"}
            )
        if path == "/api/agents" and request.method == "GET":
            return httpx.Response(200, json=[{"id": "a1", "name": "ag", "url": "u"}])
        if path.endswith("/deploy"):
            return httpx.Response(201, json={"id": "d1"})
        if path.endswith("/run"):
            return httpx.Response(201, json={"id": "r1", "status": "pending"})
        if path.endswith("/runs") and request.method == "GET":
            return httpx.Response(
                200,
                json=[{"id": "r1", "status": state.get("status", "completed")}],
            )
        if path == "/api/queues/invoices/items" and request.method == "POST":
            return httpx.Response(201, json=[{"id": "q1", "status": "new", "attempts": 0}])
        if path.endswith("/claim") and request.method == "POST":
            return httpx.Response(
                200,
                json={"item": {"id": "q1", "payload": {"file": "a.pdf"}, "attempts": 0}},
            )
        if request.method == "PATCH":
            return httpx.Response(200, json={"id": "q1", "status": "success", "attempts": 1})
        return httpx.Response(404, json={"detail": "Not Found"})

    return httpx.MockTransport(handler)


@pytest.fixture()
def sc() -> R2FlowCloud:
    client = R2FlowCloud("http://test", token="r2f_test")
    client._client = httpx.Client(
        transport=_mock_app(), base_url="http://test", headers={"Authorization": "Bearer r2f_test"}
    )
    return client


def test_full_process_flow(sc: R2FlowCloud) -> None:
    process = sc.create_process("hello", files={"main.py": "print(1)"})
    assert process["id"] == "p1"
    agent = sc.list_agents()[0]
    sc.deploy_process(process["id"], agent["id"])
    run = sc.run_process(process["id"], agent["id"])
    assert run["id"] == "r1"
    finished = sc.wait_run(process["id"], run["id"], timeout_s=2)
    assert finished["status"] == "completed"


def test_queue_flow(sc: R2FlowCloud) -> None:
    items = sc.add_queue_items("invoices", [{"file": "a.pdf"}])
    assert items[0]["id"] == "q1"
    item = sc.claim_queue_item("a1", "invoices", "r1")
    assert item is not None and item["payload"] == {"file": "a.pdf"}
    state = sc.complete_queue_item("a1", item["id"], "r1", status="success")
    assert state["status"] == "success"


def test_error_raises(sc: R2FlowCloud) -> None:
    with pytest.raises(R2FlowCloudError):
        sc.get_process("missing")
