from fastapi import FastAPI, APIRouter, HTTPException
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
import io
import base64
from pathlib import Path
from pydantic import BaseModel, Field, EmailStr
from typing import List, Optional, Dict
import uuid
from datetime import datetime, timezone

from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import cm
from reportlab.lib import colors
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, PageBreak
)

import resend

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

mongo_url = os.environ["MONGO_URL"]
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ["DB_NAME"]]

RESEND_API_KEY = os.environ.get("RESEND_API_KEY", "").strip()
RESEND_FROM_EMAIL = os.environ.get("RESEND_FROM_EMAIL", "PontiScore <onboarding@resend.dev>")
ADMIN_EMAIL = os.environ.get("ADMIN_EMAIL", "Pontiscore@gmail.com")

if RESEND_API_KEY:
    resend.api_key = RESEND_API_KEY

app = FastAPI(title="PontiScore API")
api_router = APIRouter(prefix="/api")

logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(levelname)s - %(message)s")
logger = logging.getLogger(__name__)


# ---------- Constants ----------

QUESTIONS = [
    {"id": 1, "text": "Publica conteudos pelo menos 3 vezes por semana?", "pillar": "frequencia"},
    {"id": 2, "text": "Publica stories diariamente?", "pillar": "frequencia"},
    {"id": 3, "text": "Os seus reels ultrapassam as 2000 visualizacoes?", "pillar": "alcance"},
    {"id": 4, "text": "Mede quantos clientes chegam atraves das redes sociais?", "pillar": "planeamento"},
    {"id": 5, "text": "Tem uma estrategia de conteudos definida?", "pillar": "estrategia"},
    {"id": 6, "text": "Investe em anuncios pagos nas redes sociais?", "pillar": "estrategia"},
    {"id": 7, "text": "A sua identidade visual e consistente em todas as publicacoes?", "pillar": "identidade"},
    {"id": 8, "text": "As suas publicacoes tem sempre uma chamada para acao (CTA)?", "pillar": "planeamento"},
    {"id": 9, "text": "Segue um calendario editorial planeado?", "pillar": "planeamento"},
    {"id": 10, "text": "Responde rapidamente as mensagens e comentarios?", "pillar": "alcance"},
]

PILLARS = {
    "frequencia": {"label": "Frequencia & Consistencia", "questions": [1, 2]},
    "alcance": {"label": "Alcance & Performance", "questions": [3, 10]},
    "estrategia": {"label": "Estrategia & Investimento", "questions": [5, 6]},
    "identidade": {"label": "Identidade Visual", "questions": [7]},
    "planeamento": {"label": "Planeamento & Conversao", "questions": [4, 8, 9]},
}

SCORE_MAP = {"sim": 10, "grande_parte": 7, "parcialmente": 4, "nao": 0}

RECOMMENDATIONS = {
    "frequencia": {
        "low": "Crie um calendario semanal com 3 posts fixos + stories diarios para construir consistencia.",
        "mid": "Mantenha o ritmo atual e teste um formato novo por semana (carrossel ou reel).",
        "high": "Excelente cadencia. Foque agora em elevar a qualidade e o storytelling em cada peca.",
    },
    "alcance": {
        "low": "Aposte em reels curtos com hook nos primeiros 3 segundos e responda rapido para acelerar o alcance.",
        "mid": "Otimize horarios de publicacao e teste hashtags/temas de tendencia relevantes ao seu nicho.",
        "high": "Alcance saudavel. Escale com colaboracoes e campanhas pagas para amplificar resultados.",
    },
    "estrategia": {
        "low": "Defina objetivos SMART e um funil claro (topo, meio, fundo). Comece a testar anuncios com 5-10eur/dia.",
        "mid": "Ja tem base. Estruture uma estrategia trimestral com KPIs e um budget dedicado a anuncios.",
        "high": "Estrategia solida. Escale investimento com base em ROAS e testes A/B continuos.",
    },
    "identidade": {
        "low": "Crie um mini brandbook (paleta, tipografia, tom de voz) e aplique-o a todos os templates.",
        "mid": "Refine templates e alinhe fotografias/videos com a identidade visual definida.",
        "high": "Identidade forte. Considere evolucao subtil para se destacar da concorrencia.",
    },
    "planeamento": {
        "low": "Implemente calendario editorial + UTM tracking + CTA claro em cada publicacao.",
        "mid": "Adicione medicao de conversao por canal e refine CTAs consoante o objetivo do post.",
        "high": "Planeamento maduro. Automatize relatorios mensais para escalar decisoes com dados.",
    },
}


# ---------- Models ----------

class Answer(BaseModel):
    question_id: int
    value: str  # sim | grande_parte | parcialmente | nao


class DiagnosticRequest(BaseModel):
    answers: List[Answer]


class PillarScore(BaseModel):
    key: str
    label: str
    score: int  # 0-100 normalized
    raw: int
    max_raw: int


class DiagnosticResult(BaseModel):
    id: str
    total_score: int
    tier: str
    pillar_scores: List[PillarScore]
    strengths: List[str]
    weaknesses: List[str]
    recommendations: List[str]
    created_at: str


class LeadCreate(BaseModel):
    name: str
    company: str
    email: EmailStr
    phone: Optional[str] = None
    diagnostic_id: str


class LeadResponse(BaseModel):
    id: str
    name: str
    company: str
    email: str
    phone: Optional[str] = None
    diagnostic_id: str
    email_sent: bool
    created_at: str


# ---------- Utilities ----------

def compute_result(answers: List[Answer]) -> DiagnosticResult:
    answer_map: Dict[int, int] = {}
    for a in answers:
        if a.value not in SCORE_MAP:
            raise HTTPException(status_code=400, detail=f"Invalid answer value: {a.value}")
        answer_map[a.question_id] = SCORE_MAP[a.value]

    for q in QUESTIONS:
        if q["id"] not in answer_map:
            raise HTTPException(status_code=400, detail=f"Missing answer for question {q['id']}")

    total = sum(answer_map.values())  # 0-100 (10 questions x 10)

    pillar_scores: List[PillarScore] = []
    for key, meta in PILLARS.items():
        qs = meta["questions"]
        raw = sum(answer_map[qid] for qid in qs)
        max_raw = len(qs) * 10
        norm = int(round(raw / max_raw * 100)) if max_raw else 0
        pillar_scores.append(
            PillarScore(key=key, label=meta["label"], score=norm, raw=raw, max_raw=max_raw)
        )

    if total >= 80:
        tier = "Presenca digital de excelencia"
    elif total >= 60:
        tier = "Boa presenca com espaco para escalar"
    elif total >= 40:
        tier = "Presenca em construcao"
    else:
        tier = "Presenca digital fragil - agir agora"

    strengths = [p.label for p in pillar_scores if p.score >= 70]
    weaknesses = [p.label for p in pillar_scores if p.score < 50]

    recommendations: List[str] = []
    for p in pillar_scores:
        if p.score < 50:
            level = "low"
        elif p.score < 75:
            level = "mid"
        else:
            level = "high"
        recommendations.append(f"{p.label}: {RECOMMENDATIONS[p.key][level]}")

    return DiagnosticResult(
        id=str(uuid.uuid4()),
        total_score=total,
        tier=tier,
        pillar_scores=pillar_scores,
        strengths=strengths,
        weaknesses=weaknesses,
        recommendations=recommendations,
        created_at=datetime.now(timezone.utc).isoformat(),
    )


def build_pdf(result: dict, lead: Optional[dict] = None) -> bytes:
    buf = io.BytesIO()
    doc = SimpleDocTemplate(buf, pagesize=A4, topMargin=2 * cm, bottomMargin=2 * cm)
    styles = getSampleStyleSheet()

    brand = colors.HexColor("#3A5A40")
    ink = colors.HexColor("#1A1C18")
    muted = colors.HexColor("#3F4941")

    styles.add(ParagraphStyle(name="H1", fontName="Helvetica-Bold", fontSize=24, textColor=brand, spaceAfter=12))
    styles.add(ParagraphStyle(name="H2", fontName="Helvetica-Bold", fontSize=16, textColor=ink, spaceBefore=14, spaceAfter=8))
    styles.add(ParagraphStyle(name="Body", fontName="Helvetica", fontSize=11, textColor=muted, leading=16))
    styles.add(ParagraphStyle(name="Score", fontName="Helvetica-Bold", fontSize=48, textColor=brand, alignment=1))
    styles.add(ParagraphStyle(name="Tier", fontName="Helvetica", fontSize=12, textColor=muted, alignment=1, spaceAfter=16))

    story = []
    story.append(Paragraph("Relatorio PontiScore", styles["H1"]))
    if lead:
        story.append(Paragraph(f"Preparado para <b>{lead.get('name','')}</b> — {lead.get('company','')}", styles["Body"]))
    story.append(Spacer(1, 12))

    story.append(Paragraph(f"{result['total_score']} / 100", styles["Score"]))
    story.append(Paragraph(result["tier"], styles["Tier"]))

    story.append(Paragraph("Pontuacao por Pilar", styles["H2"]))
    data = [["Pilar", "Pontuacao"]]
    for p in result["pillar_scores"]:
        data.append([p["label"], f"{p['score']}/100"])
    tbl = Table(data, colWidths=[11 * cm, 4 * cm])
    tbl.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), brand),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
        ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
        ("FONTNAME", (0, 1), (-1, -1), "Helvetica"),
        ("FONTSIZE", (0, 0), (-1, -1), 11),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 8),
        ("TOPPADDING", (0, 0), (-1, -1), 8),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.HexColor("#F2F4F1"), colors.white]),
        ("GRID", (0, 0), (-1, -1), 0.25, colors.HexColor("#E1E3DF")),
    ]))
    story.append(tbl)
    story.append(Spacer(1, 16))

    if result["strengths"]:
        story.append(Paragraph("Pontos Fortes", styles["H2"]))
        for s in result["strengths"]:
            story.append(Paragraph(f"• {s}", styles["Body"]))
        story.append(Spacer(1, 8))

    if result["weaknesses"]:
        story.append(Paragraph("Pontos a Melhorar", styles["H2"]))
        for w in result["weaknesses"]:
            story.append(Paragraph(f"• {w}", styles["Body"]))
        story.append(Spacer(1, 8))

    story.append(Paragraph("Recomendacoes Personalizadas", styles["H2"]))
    for rec in result["recommendations"]:
        story.append(Paragraph(f"• {rec}", styles["Body"]))
        story.append(Spacer(1, 4))

    story.append(Spacer(1, 20))
    story.append(Paragraph(
        "Este relatorio foi gerado automaticamente pelo PontiScore. "
        "Para uma sessao estrategica gratuita, responda ao email de confirmacao.",
        styles["Body"]
    ))

    doc.build(story)
    return buf.getvalue()


def send_lead_emails(lead: dict, result: dict, pdf_bytes: bytes) -> bool:
    if not RESEND_API_KEY:
        logger.warning("RESEND_API_KEY missing. Skipping email send.")
        return False

    try:
        pdf_b64 = base64.b64encode(pdf_bytes).decode("utf-8")

        # Email to lead
        lead_html = f"""
        <div style="font-family: -apple-system, Helvetica, Arial, sans-serif; color:#1A1C18; max-width:560px; margin:0 auto;">
          <h1 style="color:#3A5A40; margin-bottom:8px;">Ola {lead['name']},</h1>
          <p>Obrigado por completar o seu diagnostico PontiScore.</p>
          <p>Anexamos o seu <b>Relatorio Personalizado</b> com a pontuacao por pilar,
          pontos fortes, pontos a melhorar e recomendacoes.</p>
          <p style="background:#F2F4F1; padding:16px; border-radius:12px;">
            <b>PontiScore total:</b> {result['total_score']}/100<br/>
            <b>Nivel:</b> {result['tier']}
          </p>
          <p>A nossa equipa entrara em contacto brevemente para agendar a sua
          <b>Sessao Estrategica gratuita</b> + Plano de Crescimento Personalizado.</p>
          <p style="color:#3F4941; font-size:12px; margin-top:24px;">PontiScore</p>
        </div>
        """
        resend.Emails.send({
            "from": RESEND_FROM_EMAIL,
            "to": [lead["email"]],
            "subject": f"O seu Relatorio PontiScore ({result['total_score']}/100)",
            "html": lead_html,
            "attachments": [{
                "filename": "pontiscore-relatorio.pdf",
                "content": pdf_b64,
            }],
        })

        # Admin notification
        admin_html = f"""
        <div style="font-family: -apple-system, Helvetica, Arial, sans-serif; color:#1A1C18;">
          <h2 style="color:#3A5A40;">Nova lead PontiScore</h2>
          <ul>
            <li><b>Nome:</b> {lead['name']}</li>
            <li><b>Empresa:</b> {lead['company']}</li>
            <li><b>Email:</b> {lead['email']}</li>
            <li><b>Telefone:</b> {lead.get('phone') or '-'}</li>
            <li><b>PontiScore:</b> {result['total_score']}/100 ({result['tier']})</li>
          </ul>
        </div>
        """
        resend.Emails.send({
            "from": RESEND_FROM_EMAIL,
            "to": [ADMIN_EMAIL],
            "subject": f"Nova lead PontiScore: {lead['company']} ({result['total_score']}/100)",
            "html": admin_html,
            "attachments": [{
                "filename": "pontiscore-relatorio.pdf",
                "content": pdf_b64,
            }],
        })
        return True
    except Exception as e:
        logger.exception("Failed to send lead emails: %s", e)
        return False


# ---------- Endpoints ----------

@api_router.get("/")
async def root():
    return {"service": "PontiScore API", "status": "ok"}


@api_router.get("/questions")
async def get_questions():
    return {"questions": QUESTIONS, "pillars": PILLARS}


@api_router.post("/diagnostic", response_model=DiagnosticResult)
async def create_diagnostic(payload: DiagnosticRequest):
    result = compute_result(payload.answers)
    doc = result.model_dump()
    doc["answers"] = [a.model_dump() for a in payload.answers]
    await db.diagnostics.insert_one(doc.copy())
    return result


@api_router.get("/diagnostic/{diagnostic_id}", response_model=DiagnosticResult)
async def get_diagnostic(diagnostic_id: str):
    doc = await db.diagnostics.find_one({"id": diagnostic_id}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Diagnostic not found")
    return DiagnosticResult(
        id=doc["id"],
        total_score=doc["total_score"],
        tier=doc["tier"],
        pillar_scores=[PillarScore(**p) for p in doc["pillar_scores"]],
        strengths=doc["strengths"],
        weaknesses=doc["weaknesses"],
        recommendations=doc["recommendations"],
        created_at=doc["created_at"],
    )


@api_router.post("/lead", response_model=LeadResponse)
async def create_lead(payload: LeadCreate):
    diag = await db.diagnostics.find_one(
        {"id": payload.diagnostic_id}, {"_id": 0}
    )
    if not diag:
        raise HTTPException(status_code=404, detail="Diagnostic not found")

    lead_doc = {
        "id": str(uuid.uuid4()),
        "name": payload.name.strip(),
        "company": payload.company.strip(),
        "email": payload.email,
        "phone": (payload.phone or "").strip() or None,
        "diagnostic_id": payload.diagnostic_id,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }

    pdf_bytes = build_pdf(diag, lead_doc)
    email_sent = send_lead_emails(lead_doc, diag, pdf_bytes)
    lead_doc["email_sent"] = email_sent

    await db.leads.insert_one(lead_doc.copy())
    return LeadResponse(**lead_doc)


@api_router.get("/leads")
async def list_leads():
    leads = await db.leads.find({}, {"_id": 0}).sort("created_at", -1).to_list(1000)
    return {"leads": leads}


app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
