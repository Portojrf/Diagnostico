"""Editorial PT-PT regression tests for PontiScore backend.

Verifies exact strings requested in review:
- Questions with correct diacritics.
- Pillar labels with diacritics.
- Recommendations (level 'low') for Alcance, Planeamento, Identidade.
- Tier strings for all_sim and all_nao.
"""
import os
import requests

BASE = (
    os.environ["EXPO_PUBLIC_BACKEND_URL"].rstrip("/")
    if os.environ.get("EXPO_PUBLIC_BACKEND_URL")
    else "https://sme-health-check.preview.emergentagent.com"
)


def _answers(val):
    return {"answers": [{"question_id": i, "value": val} for i in range(1, 11)]}


# ---- Questions endpoint diacritics ----
def test_questions_diacritics():
    r = requests.get(f"{BASE}/api/questions")
    assert r.status_code == 200
    qs = {q["id"]: q["text"] for q in r.json()["questions"]}
    assert qs[3] == "Os seus reels ultrapassam as 2000 visualizações?"
    assert qs[5] == "Tem uma estratégia de conteúdos definida?"
    assert qs[8] == "As suas publicações têm sempre uma chamada para ação (CTA)?"
    # spot-check others for diacritics
    assert "conteúdos" in qs[1]
    assert "através" in qs[4]
    assert "anúncios" in qs[6]
    assert "publicações" in qs[7]
    assert "às mensagens" in qs[10]


# ---- Pillar labels ----
def test_pillar_labels_diacritics():
    r = requests.get(f"{BASE}/api/questions")
    labels = {k: v["label"] for k, v in r.json()["pillars"].items()}
    assert labels["frequencia"] == "Frequência & Consistência"
    assert labels["alcance"] == "Alcance & Performance"
    assert labels["estrategia"] == "Estratégia & Investimento"
    assert labels["identidade"] == "Identidade Visual"
    assert labels["planeamento"] == "Planeamento & Conversão"


# ---- All-nao: tier + recommendations low strings ----
EXPECTED_ALCANCE_LOW = (
    "Publique vídeos curtos com uma introdução apelativa nos primeiros 3 segundos "
    "e responda rapidamente aos comentários e mensagens para aumentar o alcance "
    "e o envolvimento da audiência."
)
EXPECTED_PLANEAMENTO_LOW = (
    "Crie um calendário editorial, adicione parâmetros UTM a todos os links das "
    "publicações para medir o desempenho das campanhas e inclua uma chamada para "
    "ação (CTA) clara e consistente em cada publicação."
)
EXPECTED_IDENTIDADE_LOW = (
    "Crie um mini brandbook com a paleta de cores, tipografia, tom de voz e regras "
    "de estilo. Aplique esta identidade visual de forma consistente em todos os "
    "ecrãs e templates da aplicação."
)


def test_all_nao_tier_and_recommendations():
    r = requests.post(f"{BASE}/api/diagnostic", json=_answers("nao"))
    assert r.status_code == 200
    d = r.json()
    assert d["total_score"] == 0
    assert d["tier"] == "Presença digital frágil — agir agora"

    recs = d["recommendations"]
    # Match the exact "<Pillar Label>: <recommendation>" format
    joined = "\n".join(recs)
    assert f"Alcance & Performance: {EXPECTED_ALCANCE_LOW}" in joined
    assert f"Planeamento & Conversão: {EXPECTED_PLANEAMENTO_LOW}" in joined
    assert f"Identidade Visual: {EXPECTED_IDENTIDADE_LOW}" in joined


def test_all_sim_tier():
    r = requests.post(f"{BASE}/api/diagnostic", json=_answers("sim"))
    assert r.status_code == 200
    assert r.json()["tier"] == "Presença digital de excelência"


def test_intermediate_tier_strings():
    """Verify all 4 tier strings exist as expected (grande_parte->70 -> 'Boa presença com espaço para escalar')."""
    r = requests.post(f"{BASE}/api/diagnostic", json=_answers("grande_parte"))
    assert r.status_code == 200
    d = r.json()
    assert d["total_score"] == 70
    assert d["tier"] == "Boa presença com espaço para escalar"


def test_parcialmente_tier():
    r = requests.post(f"{BASE}/api/diagnostic", json=_answers("parcialmente"))
    assert r.status_code == 200
    d = r.json()
    assert d["total_score"] == 40
    assert d["tier"] == "Presença em construção"
