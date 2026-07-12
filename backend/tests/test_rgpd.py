"""RGPD (Portugal) consent regression tests for POST /api/lead and GET /api/leads."""
import os
import re
import requests

BASE = (
    os.environ["EXPO_PUBLIC_BACKEND_URL"].rstrip("/")
    if os.environ.get("EXPO_PUBLIC_BACKEND_URL")
    else "https://sme-health-check.preview.emergentagent.com"
)

ISO_RE = re.compile(r"^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(\+00:00|Z)$")


def _answers(val="sim"):
    return {"answers": [{"question_id": i, "value": val} for i in range(1, 11)]}


def _make_diagnostic():
    r = requests.post(f"{BASE}/api/diagnostic", json=_answers("sim"))
    assert r.status_code == 200
    return r.json()["id"]


# --- Consent enforcement ---
def test_lead_privacy_false_returns_422_with_pt_message():
    did = _make_diagnostic()
    payload = {
        "name": "TEST_RGPD_No",
        "company": "TEST_Co",
        "email": "test_rgpd_no@example.com",
        "diagnostic_id": did,
        "privacy_accepted": False,
        "marketing_accepted": False,
    }
    r = requests.post(f"{BASE}/api/lead", json=payload)
    assert r.status_code == 422, r.text
    body = r.json()
    # Pydantic v2 exposes the ValueError message in detail[0].msg
    detail_str = str(body)
    assert "Política de Privacidade" in detail_str
    assert "obrigatório" in detail_str.lower()


def test_lead_privacy_missing_returns_422():
    did = _make_diagnostic()
    payload = {
        "name": "TEST_RGPD_Missing",
        "company": "TEST_Co",
        "email": "test_rgpd_missing@example.com",
        "diagnostic_id": did,
    }
    r = requests.post(f"{BASE}/api/lead", json=payload)
    assert r.status_code == 422


# --- Persistence & response shape ---
def test_lead_privacy_true_persists_consent_fields():
    did = _make_diagnostic()
    payload = {
        "name": "TEST_RGPD_Yes",
        "company": "TEST_Co",
        "email": "test_rgpd_yes@example.com",
        "diagnostic_id": did,
        "privacy_accepted": True,
        "marketing_accepted": True,
    }
    r = requests.post(f"{BASE}/api/lead", json=payload)
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["privacy_accepted"] is True
    assert body["marketing_accepted"] is True
    assert ISO_RE.match(body["consent_at"]), f"Bad consent_at: {body['consent_at']}"


def test_lead_marketing_defaults_false_when_omitted():
    did = _make_diagnostic()
    payload = {
        "name": "TEST_RGPD_MktOmit",
        "company": "TEST_Co",
        "email": "test_rgpd_mktomit@example.com",
        "diagnostic_id": did,
        "privacy_accepted": True,
        # marketing_accepted omitted -> should default to False
    }
    r = requests.post(f"{BASE}/api/lead", json=payload)
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["privacy_accepted"] is True
    assert body["marketing_accepted"] is False


def test_leads_list_exposes_new_fields():
    # ensure at least one lead exists
    did = _make_diagnostic()
    requests.post(f"{BASE}/api/lead", json={
        "name": "TEST_RGPD_List",
        "company": "TEST_Co",
        "email": "test_rgpd_list@example.com",
        "diagnostic_id": did,
        "privacy_accepted": True,
        "marketing_accepted": False,
    }).raise_for_status()

    r = requests.get(f"{BASE}/api/leads")
    assert r.status_code == 200
    leads = r.json().get("leads", [])
    # find the one we just created
    match = next((ld for ld in leads if ld.get("email") == "test_rgpd_list@example.com"), None)
    assert match is not None, "just-created lead not found in /api/leads"
    assert match["privacy_accepted"] is True
    assert match["marketing_accepted"] is False
    assert "consent_at" in match and match["consent_at"]
    assert "_id" not in match
