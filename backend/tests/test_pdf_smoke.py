"""Smoke test: build_pdf() must run without exceptions even when Resend is disabled.

We call POST /api/lead which triggers build_pdf() internally, and verify:
  - 200 response
  - email_sent is False (RESEND_API_KEY empty on purpose)
  - build_pdf() executed without ImportError/AttributeError (no 5xx)
Also imports and invokes build_pdf() directly to exercise the reportlab path.
"""
import os
import sys
import requests

sys.path.insert(0, "/app/backend")

BASE = os.environ.get(
    "EXPO_PUBLIC_BACKEND_URL",
    "https://sme-health-check.preview.emergentagent.com",
).rstrip("/")


def _answers(val="sim"):
    return {"answers": [{"question_id": i, "value": val} for i in range(1, 11)]}


def test_build_pdf_direct_no_exception():
    """Import build_pdf and run it in-process. Should return non-empty bytes."""
    from server import build_pdf  # noqa: E402

    result = {
        "id": "diag-smoke-1",
        "total_score": 70,
        "tier": "Boa presença com espaço para escalar",
        "pillar_scores": [
            {"key": "frequencia", "label": "Frequência & Consistência", "score": 70, "raw": 14, "max_raw": 20},
            {"key": "alcance", "label": "Alcance & Performance", "score": 70, "raw": 14, "max_raw": 20},
            {"key": "estrategia", "label": "Estratégia & Investimento", "score": 70, "raw": 14, "max_raw": 20},
            {"key": "identidade", "label": "Identidade Visual", "score": 70, "raw": 7, "max_raw": 10},
            {"key": "planeamento", "label": "Planeamento & Conversão", "score": 70, "raw": 21, "max_raw": 30},
        ],
        "strengths": ["Frequência & Consistência"],
        "weaknesses": [],
        "recommendations": [
            "Frequência & Consistência: manter cadência",
            "Alcance & Performance: testar horários",
        ],
        "created_at": "2026-01-07T00:00:00+00:00",
    }
    lead = {
        "name": "TEST_PDF Smoke",
        "company": "TEST_Co",
        "email": "smoke@example.com",
    }
    pdf_bytes = build_pdf(result, lead)
    assert isinstance(pdf_bytes, (bytes, bytearray))
    assert len(pdf_bytes) > 1000, f"Suspiciously small PDF: {len(pdf_bytes)} bytes"
    # Basic PDF magic
    assert pdf_bytes[:4] == b"%PDF", "Output does not look like a PDF"


def test_lead_endpoint_runs_pdf_and_returns_email_sent_false():
    diag = requests.post(f"{BASE}/api/diagnostic", json=_answers("sim")).json()
    payload = {
        "name": "TEST_PDF Flow",
        "company": "TEST_Co",
        "email": "test_pdf_flow@example.com",
        "diagnostic_id": diag["id"],
        "privacy_accepted": True,
        "marketing_accepted": False,
    }
    r = requests.post(f"{BASE}/api/lead", json=payload)
    assert r.status_code == 200, r.text
    body = r.json()
    # If build_pdf() had thrown, we'd get a 500 here.
    assert body["email_sent"] is False
    assert body["privacy_accepted"] is True
