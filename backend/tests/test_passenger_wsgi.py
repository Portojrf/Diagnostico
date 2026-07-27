"""Validate passenger_wsgi.application (cPanel/Passenger entrypoint).

Ensures:
- `from passenger_wsgi import application` imports cleanly.
- It exposes a callable (WSGI callable).
- Invoking it via a raw WSGI environ works for GET /api/, two POST /api/diagnostic
  in sequence (guards against 'attached to a different loop' on motor),
  GET /api/diagnostic/{id}, and POST /api/lead (PDF path exercised).
- Import of server.py itself performs no DB connection / no reportlab / no resend load.
"""
import io
import json
import os
import sys

import pytest

BACKEND_DIR = "/app/backend"
if BACKEND_DIR not in sys.path:
    sys.path.insert(0, BACKEND_DIR)


def _make_environ(method: str, path: str, body: bytes = b"", query: str = ""):
    environ = {
        "REQUEST_METHOD": method,
        "SCRIPT_NAME": "",
        "PATH_INFO": path,
        "QUERY_STRING": query,
        "SERVER_NAME": "localhost",
        "SERVER_PORT": "80",
        "SERVER_PROTOCOL": "HTTP/1.1",
        "HTTP_HOST": "localhost",
        "wsgi.version": (1, 0),
        "wsgi.url_scheme": "http",
        "wsgi.input": io.BytesIO(body),
        "wsgi.errors": sys.stderr,
        "wsgi.multithread": True,
        "wsgi.multiprocess": False,
        "wsgi.run_once": False,
        "CONTENT_LENGTH": str(len(body)),
    }
    if body:
        environ["CONTENT_TYPE"] = "application/json"
    return environ


def _call_wsgi(application, method, path, body_obj=None):
    body = json.dumps(body_obj).encode() if body_obj is not None else b""
    environ = _make_environ(method, path, body=body)
    captured = {}

    def start_response(status, headers, exc_info=None):
        captured["status"] = status
        captured["headers"] = headers

    result = application(environ, start_response)
    chunks = b"".join(result)
    if hasattr(result, "close"):
        result.close()
    status_code = int(captured["status"].split(" ", 1)[0])
    try:
        payload = json.loads(chunks.decode() or "null")
    except Exception:
        payload = chunks
    return status_code, payload


# Import-time safety: importing server must not open DB / load reportlab / resend.
def test_server_import_no_side_effects():
    # Purge any prior imports so this reflects a cold start.
    for mod in ["server", "reportlab", "resend"]:
        sys.modules.pop(mod, None)
        # Also remove submodules
        for k in list(sys.modules):
            if k.startswith(mod + "."):
                sys.modules.pop(k, None)

    import server  # noqa: F401

    assert getattr(server, "_mongo_db", "sentinel") is None, "DB should not be initialized at import time"
    assert getattr(server, "_mongo_client", "sentinel") is None, "Mongo client should not be initialized at import time"
    assert "reportlab" not in sys.modules, "reportlab must be lazily imported"
    assert "resend" not in sys.modules, "resend must be lazily imported"


@pytest.fixture(scope="module")
def application():
    # Import fresh
    sys.modules.pop("passenger_wsgi", None)
    from passenger_wsgi import application as app
    assert callable(app), "passenger_wsgi.application must be callable (WSGI)"
    return app


def test_wsgi_root(application):
    status, data = _call_wsgi(application, "GET", "/api/")
    assert status == 200, data
    assert isinstance(data, dict) and data.get("status") == "ok"


def test_wsgi_diagnostic_twice_same_loop(application):
    """Two sequential POSTs to /api/diagnostic must both succeed under a2wsgi.
    Regression guard for motor 'attached to a different loop' errors."""
    answers = [{"question_id": i, "value": "sim"} for i in range(1, 11)]
    body = {"answers": answers}

    status1, data1 = _call_wsgi(application, "POST", "/api/diagnostic", body_obj=body)
    assert status1 == 200, data1
    assert "id" in data1 and "total_score" in data1
    diag_id_1 = data1["id"]

    status2, data2 = _call_wsgi(application, "POST", "/api/diagnostic", body_obj=body)
    assert status2 == 200, data2
    assert "id" in data2 and "total_score" in data2
    assert data2["id"] != diag_id_1  # new diagnostic

    # GET the first one
    status3, data3 = _call_wsgi(application, "GET", f"/api/diagnostic/{diag_id_1}")
    assert status3 == 200, data3
    assert data3["id"] == diag_id_1

    # Stash for lead test
    pytest.diag_id_for_lead = data2["id"]


def test_wsgi_lead_pdf_path(application):
    diag_id = getattr(pytest, "diag_id_for_lead", None)
    assert diag_id, "diagnostic id from previous test missing"
    payload = {
        "name": "TEST WSGI User",
        "company": "TEST WSGI Co",
        "email": "wsgi@example.com",
        "phone": "+351000000000",
        "diagnostic_id": diag_id,
        "privacy_accepted": True,
        "marketing_accepted": False,
    }
    status, data = _call_wsgi(application, "POST", "/api/lead", body_obj=payload)
    assert status == 200, data
    assert data.get("email_sent") is False
    assert data.get("diagnostic_id") == diag_id
    assert data.get("privacy_accepted") is True
