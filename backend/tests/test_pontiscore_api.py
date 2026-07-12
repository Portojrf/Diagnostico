import os

import pytest  # noqa: F401
import requests

BASE = (
    os.environ["EXPO_PUBLIC_BACKEND_URL"].rstrip("/")
    if os.environ.get("EXPO_PUBLIC_BACKEND_URL")
    else "https://sme-health-check.preview.emergentagent.com"
)


def _answers(val):
    return {"answers": [{"question_id": i, "value": val} for i in range(1, 11)]}


def test_root():
    r = requests.get(f"{BASE}/api/")
    assert r.status_code == 200
    assert r.json().get("status") == "ok"


def test_questions():
    r = requests.get(f"{BASE}/api/questions")
    assert r.status_code == 200
    d = r.json()
    assert len(d["questions"]) == 10
    assert len(d["pillars"]) == 5


def test_diagnostic_all_sim():
    r = requests.post(f"{BASE}/api/diagnostic", json=_answers("sim"))
    assert r.status_code == 200
    d = r.json()
    assert d["total_score"] == 100
    assert len(d["pillar_scores"]) == 5
    assert all(p["score"] == 100 for p in d["pillar_scores"])


def test_diagnostic_all_nao():
    r = requests.post(f"{BASE}/api/diagnostic", json=_answers("nao"))
    assert r.status_code == 200
    d = r.json()
    assert d["total_score"] == 0


def test_get_diagnostic_persist():
    r = requests.post(f"{BASE}/api/diagnostic", json=_answers("grande_parte"))
    did = r.json()["id"]
    g = requests.get(f"{BASE}/api/diagnostic/{did}")
    assert g.status_code == 200
    assert g.json()["id"] == did
    assert g.json()["total_score"] == 70


def test_lead_and_404():
    d = requests.post(f"{BASE}/api/diagnostic", json=_answers("sim")).json()
    lead = {
        "name": "TEST_John",
        "company": "TEST_Co",
        "email": "test@example.com",
        "diagnostic_id": d["id"],
        "privacy_accepted": True,
        "marketing_accepted": True,
    }
    r = requests.post(f"{BASE}/api/lead", json=lead)
    assert r.status_code == 200
    body = r.json()
    assert body["email_sent"] is False
    assert "id" in body
    assert body["privacy_accepted"] is True
    assert body["marketing_accepted"] is True
    assert "consent_at" in body and body["consent_at"]
    r404 = requests.post(f"{BASE}/api/lead", json={**lead, "diagnostic_id": "bad-id"})
    assert r404.status_code == 404


def test_leads_no_objectid():
    r = requests.get(f"{BASE}/api/leads")
    assert r.status_code == 200
    for lead in r.json().get("leads", []):
        assert "_id" not in lead


def test_diagnostic_not_found():
    r = requests.get(f"{BASE}/api/diagnostic/does-not-exist-xyz")
    assert r.status_code == 404


def test_diagnostic_invalid_answer_value():
    payload = {"answers": [{"question_id": i, "value": "sim"} for i in range(1, 11)]}
    payload["answers"][0]["value"] = "banana"
    r = requests.post(f"{BASE}/api/diagnostic", json=payload)
    # 400 from HTTPException in compute_result
    assert r.status_code == 400


def test_diagnostic_missing_answer():
    # only 9 answers -> should raise 400
    payload = {"answers": [{"question_id": i, "value": "sim"} for i in range(1, 10)]}
    r = requests.post(f"{BASE}/api/diagnostic", json=payload)
    assert r.status_code == 400
