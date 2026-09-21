"""Tests for the persistent orchestrator connection (r2flow_designer.cloud)."""

from __future__ import annotations

import json
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from r2flow_designer import cloud as cloud_mod
from r2flow_designer import web as web_mod


@pytest.fixture()
def home(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> Path:
    monkeypatch.setenv("R2FLOW_HOME", str(tmp_path))
    return tmp_path


def test_save_load_roundtrip(home: Path) -> None:
    cloud_mod.save_connection("https://cloud.example.com/", "r2f_abc")
    conn = cloud_mod.load_connection()
    assert conn is not None
    assert conn.url == "https://cloud.example.com"
    assert conn.token == "r2f_abc"
    assert (home / "cloud.json").is_file()


def test_load_malformed_returns_none(home: Path) -> None:
    (home / "cloud.json").write_text("not json", encoding="utf-8")
    assert cloud_mod.load_connection() is None
    (home / "cloud.json").write_text(json.dumps({"url": "x"}), encoding="utf-8")
    assert cloud_mod.load_connection() is None


def test_clear_connection(home: Path) -> None:
    assert cloud_mod.clear_connection() is False
    cloud_mod.save_connection("https://cloud.example.com", "r2f_abc")
    assert cloud_mod.clear_connection() is True
    assert cloud_mod.load_connection() is None


@pytest.mark.parametrize(
    ("raw", "expected"),
    [
        ("https://cloud.r2flow.ru", "https://cloud.r2flow.ru"),
        ("https://cloud.r2flow.ru/", "https://cloud.r2flow.ru"),
        ("http://127.0.0.1:8000", "http://127.0.0.1:8000"),
    ],
)
def test_check_url_valid(raw: str, expected: str) -> None:
    assert cloud_mod.check_url(raw) == expected


@pytest.mark.parametrize("raw", ["", "not-a-url", "ftp://host", "cloud.r2flow.ru"])
def test_check_url_invalid(raw: str) -> None:
    with pytest.raises(ValueError):
        cloud_mod.check_url(raw)


def _client(tmp_path: Path) -> TestClient:
    flow = tmp_path / "flow.json"
    flow.write_text('{"version": 2, "nodes": [], "edges": []}', encoding="utf-8")
    return TestClient(web_mod.create_app(flow))


def test_cloud_endpoints_connect_disconnect(
    home: Path, tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setattr(web_mod, "verify_connection", lambda url, token: {"email": "admin@x.ru"})
    client = _client(tmp_path)
    assert client.get("/api/cloud").json() == {"connected": False, "url": None}

    resp = client.post("/api/cloud", json={"url": "https://cloud.example.com", "token": "r2f_x"})
    assert resp.status_code == 200, resp.text
    assert resp.json()["url"] == "https://cloud.example.com"

    status = client.get("/api/cloud").json()
    assert status == {"connected": True, "url": "https://cloud.example.com"}

    resp = client.delete("/api/cloud")
    assert resp.json() == {"connected": False, "url": None}


def test_cloud_connect_rejects_bad_token(
    home: Path, tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    def _boom(url: str, token: str) -> dict:
        raise ValueError("nope")

    monkeypatch.setattr(web_mod, "verify_connection", _boom)
    client = _client(tmp_path)
    resp = client.post("/api/cloud", json={"url": "https://cloud.example.com", "token": "bad"})
    assert resp.status_code == 401
    assert client.get("/api/cloud").json()["connected"] is False


def test_cloud_connect_rejects_cleartext_http(
    home: Path, tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    def _must_not_run(url: str, token: str) -> dict:
        raise AssertionError("verify must not run for cleartext http")

    monkeypatch.setattr(web_mod, "verify_connection", _must_not_run)
    client = _client(tmp_path)
    resp = client.post("/api/cloud", json={"url": "http://192.168.1.10:8000", "token": "r2f_x"})
    assert resp.status_code == 400, resp.text
    assert client.get("/api/cloud").json()["connected"] is False


def test_cloud_connect_allows_http_loopback(
    home: Path, tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setattr(web_mod, "verify_connection", lambda url, token: {"email": None})
    client = _client(tmp_path)
    resp = client.post("/api/cloud", json={"url": "http://127.0.0.1:8000", "token": "r2f_x"})
    assert resp.status_code == 200, resp.text
