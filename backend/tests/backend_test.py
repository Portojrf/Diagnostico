"""PontiScore backend API tests"""
import os
import pytest
import requests

BASE_URL = os.environ["REACT_APP_BACKEND_URL"].rstrip("/") if os.environ.get("REACT_APP_BACKEND_URL") else None

# Read from frontend env if not set in shell
if not BASE_URL:
    with open("/app/frontend/.env") as f:
        for line in f:
            if line.startswith("REACT_APP_BACKEND_URL="):
                BASE_URL = line.split("=", 1)[1].strip().rstrip("/")


@pytest.fixture(scope="module")
def api():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


@pytest.fixture(scope="module")
def diagnostic_id(api):
    answers = [{"question_id": i, "value": "sim" if i % 2 == 0 else "parcialmente"} for i in range(1, 11)]
    r = api.post(f"{BASE_URL}/api/diagnostic", json={"answers": answers})
    assert r.status_code == 200, r.text
    data = r.json()
    return data["id"]


def test_root(api):
    r = api.get(f"{BASE_URL}/api/")
    assert r.status_code == 200
    d = r.json()
    assert d["status"] == "ok"


def test_questions(api):
    r = api.get(f"{BASE_URL}/api/questions")
    assert r.status_code == 200
    d = r.json()
    assert len(d["questions"]) == 10
    assert len(d["pillars"]) == 5


def test_diagnostic_full(api):
    answers = [{"question_id": i, "value": "sim"} for i in range(1, 11)]
    r = api.post(f"{BASE_URL}/api/diagnostic", json={"answers": answers})
    assert r.status_code == 200
    d = r.json()
    assert d["total_score"] == 100
    assert d["tier"] == "Presença digital de excelência"
    assert len(d["pillar_scores"]) == 5
    assert "id" in d


def test_diagnostic_low(api):
    answers = [{"question_id": i, "value": "nao"} for i in range(1, 11)]
    r = api.post(f"{BASE_URL}/api/diagnostic", json={"answers": answers})
    assert r.status_code == 200
    d = r.json()
    assert d["total_score"] == 0
    assert "frágil" in d["tier"].lower()


def test_diagnostic_invalid_value(api):
    answers = [{"question_id": i, "value": "wrong"} for i in range(1, 11)]
    r = api.post(f"{BASE_URL}/api/diagnostic", json={"answers": answers})
    assert r.status_code == 400


def test_diagnostic_missing(api):
    answers = [{"question_id": i, "value": "sim"} for i in range(1, 6)]
    r = api.post(f"{BASE_URL}/api/diagnostic", json={"answers": answers})
    assert r.status_code == 400


def test_get_diagnostic(api, diagnostic_id):
    r = api.get(f"{BASE_URL}/api/diagnostic/{diagnostic_id}")
    assert r.status_code == 200
    d = r.json()
    assert d["id"] == diagnostic_id
    assert len(d["pillar_scores"]) == 5


def test_get_diagnostic_404(api):
    r = api.get(f"{BASE_URL}/api/diagnostic/nonexistent-id-xyz")
    assert r.status_code == 404


def test_lead_create(api, diagnostic_id):
    payload = {
        "name": "TEST User",
        "company": "TEST Company",
        "email": "test@example.com",
        "phone": "+351999999999",
        "diagnostic_id": diagnostic_id,
        "privacy_accepted": True,
        "marketing_accepted": False,
    }
    r = api.post(f"{BASE_URL}/api/lead", json=payload)
    assert r.status_code == 200, r.text
    d = r.json()
    assert d["email_sent"] is False  # RESEND_API_KEY empty
    assert d["diagnostic_id"] == diagnostic_id
    assert d["name"] == "TEST User"
    assert d["privacy_accepted"] is True
    assert d["marketing_accepted"] is False
    assert d.get("consent_at")


def test_lead_privacy_rejected(api, diagnostic_id):
    r = api.post(f"{BASE_URL}/api/lead", json={
        "name": "TEST", "company": "TEST", "email": "a@b.com",
        "diagnostic_id": diagnostic_id, "privacy_accepted": False,
    })
    assert r.status_code == 422


def test_lead_bad_diagnostic(api):
    r = api.post(f"{BASE_URL}/api/lead", json={
        "name": "X", "company": "Y", "email": "a@b.com", "diagnostic_id": "nope",
        "privacy_accepted": True,
    })
    assert r.status_code == 404


def test_leads_list(api):
    r = api.get(f"{BASE_URL}/api/leads")
    assert r.status_code == 200
    d = r.json()
    assert isinstance(d["leads"], list)
