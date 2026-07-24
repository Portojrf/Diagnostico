from fastapi import FastAPI, APIRouter, HTTPException
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
import io
import json
import base64
from pathlib import Path
from pydantic import BaseModel, Field, EmailStr, field_validator
from typing import List, Optional, Dict
import uuid
from datetime import datetime, timezone

from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import cm, mm
from reportlab.lib import colors
from reportlab.lib.enums import TA_LEFT, TA_CENTER
from reportlab.lib.utils import ImageReader
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, PageBreak,
)

import resend

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

mongo_url = os.environ["MONGO_URL"]
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ["DB_NAME"]]

RESEND_API_KEY = os.environ.get("RESEND_API_KEY", "").strip()
RESEND_FROM_EMAIL = os.environ.get("RESEND_FROM_EMAIL", "PontiScore <onboarding@resend.dev>")
ADMIN_EMAIL = os.environ.get("ADMIN_EMAIL", "contacto@pontiscore.pt")

if RESEND_API_KEY:
    resend.api_key = RESEND_API_KEY

app = FastAPI(title="PontiScore API")
api_router = APIRouter(prefix="/api")

logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(levelname)s - %(message)s")
logger = logging.getLogger(__name__)


# ---------- Constants ----------

QUESTIONS = [
    {"id": 1, "text": "Publica conteúdos pelo menos 3 vezes por semana?", "pillar": "frequencia"},
    {"id": 2, "text": "Publica stories diariamente?", "pillar": "frequencia"},
    {"id": 3, "text": "Os seus reels ultrapassam as 2000 visualizações?", "pillar": "alcance"},
    {"id": 4, "text": "Mede quantos clientes chegam através das redes sociais?", "pillar": "planeamento"},
    {"id": 5, "text": "Tem uma estratégia de conteúdos definida?", "pillar": "estrategia"},
    {"id": 6, "text": "Investe em anúncios pagos nas redes sociais?", "pillar": "estrategia"},
    {"id": 7, "text": "A sua identidade visual é consistente em todas as publicações?", "pillar": "identidade"},
    {"id": 8, "text": "As suas publicações têm sempre uma chamada para ação (CTA)?", "pillar": "planeamento"},
    {"id": 9, "text": "Segue um calendário editorial planeado?", "pillar": "planeamento"},
    {"id": 10, "text": "Responde rapidamente às mensagens e comentários?", "pillar": "alcance"},
]

PILLARS = {
    "frequencia": {"label": "Frequência & Consistência", "questions": [1, 2]},
    "alcance": {"label": "Alcance & Performance", "questions": [3, 10]},
    "estrategia": {"label": "Estratégia & Investimento", "questions": [5, 6]},
    "identidade": {"label": "Identidade Visual", "questions": [7]},
    "planeamento": {"label": "Planeamento & Conversão", "questions": [4, 8, 9]},
}

SCORE_MAP = {"sim": 10, "grande_parte": 7, "parcialmente": 4, "nao": 0}

RECOMMENDATIONS = {
    "frequencia": {
        "low": "Crie um calendário semanal com 3 publicações fixas + stories diários para construir consistência.",
        "mid": "Mantenha o ritmo atual e teste um formato novo por semana (carrossel ou reel).",
        "high": "Excelente cadência. Foque agora em elevar a qualidade e o storytelling em cada peça.",
    },
    "alcance": {
        "low": "Publique vídeos curtos com uma introdução apelativa nos primeiros 3 segundos e responda rapidamente aos comentários e mensagens para aumentar o alcance e o envolvimento da audiência.",
        "mid": "Otimize os horários de publicação e teste hashtags e temas de tendência relevantes para o seu nicho.",
        "high": "Alcance saudável. Escale com colaborações e campanhas pagas para amplificar resultados.",
    },
    "estrategia": {
        "low": "Defina objetivos SMART e um funil claro (topo, meio, fundo). Comece a testar anúncios com 5 a 10 euros por dia.",
        "mid": "Já tem base. Estruture uma estratégia trimestral com KPIs e um orçamento dedicado a anúncios.",
        "high": "Estratégia sólida. Escale o investimento com base no ROAS e em testes A/B contínuos.",
    },
    "identidade": {
        "low": "Crie um mini brandbook com a paleta de cores, tipografia, tom de voz e regras de estilo. Aplique esta identidade visual de forma consistente em todos os ecrãs e templates da aplicação.",
        "mid": "Refine os templates e alinhe fotografias e vídeos com a identidade visual definida.",
        "high": "Identidade forte. Considere uma evolução subtil para se destacar da concorrência.",
    },
    "planeamento": {
        "low": "Crie um calendário editorial, adicione parâmetros UTM a todos os links das publicações para medir o desempenho das campanhas e inclua uma chamada para ação (CTA) clara e consistente em cada publicação.",
        "mid": "Adicione medição de conversão por canal e refine as CTAs consoante o objetivo de cada publicação.",
        "high": "Planeamento maduro. Automatize relatórios mensais para escalar decisões com dados.",
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
    # RGPD — obrigatório aceitar a política de privacidade
    privacy_accepted: bool
    # Consentimento opcional para comunicações de marketing
    marketing_accepted: bool = False

    @field_validator("privacy_accepted")
    @classmethod
    def _privacy_must_be_accepted(cls, v: bool) -> bool:
        if v is not True:
            raise ValueError(
                "É obrigatório aceitar a Política de Privacidade para submeter o formulário."
            )
        return v


class LeadResponse(BaseModel):
    id: str
    name: str
    company: str
    email: str
    phone: Optional[str] = None
    diagnostic_id: str
    email_sent: bool
    created_at: str
    privacy_accepted: bool
    marketing_accepted: bool
    consent_at: str


# ---------- Utilities ----------

def _to_plain(data):
    """Convert MongoDB documents into plain, JSON-safe types (str/int/float/bool/list/dict).

    A json dump/load round-trip strips BSON types (ObjectId, datetime, etc.) and,
    crucially, raises immediately on any circular reference — so no cyclic structure
    can ever reach the PDF/report logic and trigger a RecursionError. This runs
    once per request and involves no explicit recursion on our side.
    """
    return json.loads(json.dumps(data, default=str))


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
        tier = "Presença digital de excelência"
    elif total >= 60:
        tier = "Boa presença com espaço para escalar"
    elif total >= 40:
        tier = "Presença em construção"
    else:
        tier = "Presença digital frágil — agir agora"

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
    """
    Premium 2-page PDF report.
    Layout: branded header strip + score hero + pillar bars + strengths/weaknesses
    cards + numbered recommendations + full-width footer with contacts on every page.
    """
    buf = io.BytesIO()

    # ----- Palette (mirrors the new web app tokens: blue + green + orange) -----
    C_BRAND = colors.HexColor("#1B3A8B")        # navy blue (logo, titles)
    C_CTA = colors.HexColor("#16A34A")          # institutional green (positive indicators)
    C_CTA_SOFT = colors.HexColor("#DCFCE7")
    C_ORANGE = colors.HexColor("#F17E1A")       # detail accent
    C_ORANGE_SOFT = colors.HexColor("#FEF3E7")
    C_ERROR = colors.HexColor("#DC2626")
    C_INK = colors.HexColor("#0F172A")
    C_MUTED = colors.HexColor("#475569")
    C_SURFACE_3 = colors.HexColor("#E2E8F0")
    C_BORDER = colors.HexColor("#E2E8F0")

    PAGE_W, PAGE_H = A4
    HEADER_H = 32 * mm
    FOOTER_H = 16 * mm
    LEFT = 1.6 * cm
    RIGHT = 1.6 * cm
    CONTENT_W = PAGE_W - LEFT - RIGHT

    # ----- Logo path -----
    LOGO_PATH = os.path.join(os.path.dirname(__file__), "logo-pontiscore.png")
    _logo_reader = None
    try:
        if os.path.exists(LOGO_PATH):
            _logo_reader = ImageReader(LOGO_PATH)
    except Exception:
        _logo_reader = None

    # ----- Per-page decorations: white header with logo + tagline, discreet footer -----
    def draw_page_chrome(canv, _doc):
        canv.saveState()

        # Logo (left) — sized by width to match landing layout
        if _logo_reader is not None:
            try:
                iw, ih = _logo_reader.getSize()
                target_w = 50 * mm
                target_h = target_w * (ih / iw) if iw else target_w
                # Cap so it fits nicely in the header band
                max_h = HEADER_H - 4 * mm
                if target_h > max_h:
                    target_h = max_h
                    target_w = target_h * (iw / ih) if ih else target_h
                canv.drawImage(
                    _logo_reader,
                    LEFT,
                    PAGE_H - HEADER_H + (HEADER_H - target_h) / 2 - 2,
                    width=target_w,
                    height=target_h,
                    mask="auto",
                    preserveAspectRatio=True,
                )
                # "Marketing Digital" small label under logo
                canv.setFillColor(C_BRAND)
                canv.setFont("Helvetica-Bold", 6.5)
                canv.drawString(
                    LEFT + 2,
                    PAGE_H - HEADER_H + (HEADER_H - target_h) / 2 - 2 - 3.2 * mm,
                    "MARKETING DIGITAL",
                )
            except Exception:
                pass

        # Tagline (right)
        canv.setFillColor(C_BRAND)
        canv.setFont("Helvetica-Bold", 12)
        canv.drawRightString(
            PAGE_W - RIGHT,
            PAGE_H - HEADER_H + HEADER_H / 2 - 4,
            "Diagnóstico Digital",
        )

        # Thin separator under header
        canv.setStrokeColor(C_BORDER)
        canv.setLineWidth(0.6)
        canv.line(LEFT, PAGE_H - HEADER_H, PAGE_W - RIGHT, PAGE_H - HEADER_H)

        # Footer separator + contacts
        canv.setStrokeColor(C_BORDER)
        canv.setLineWidth(0.4)
        canv.line(LEFT, FOOTER_H + 2 * mm, PAGE_W - RIGHT, FOOTER_H + 2 * mm)

        canv.setFillColor(C_MUTED)
        canv.setFont("Helvetica", 8.5)
        canv.drawString(LEFT, FOOTER_H - 3 * mm, "www.pontiscore.pt")
        canv.drawCentredString(PAGE_W / 2, FOOTER_H - 3 * mm, "contacto@pontiscore.pt")
        canv.drawRightString(PAGE_W - RIGHT, FOOTER_H - 3 * mm, "+351 961 472 598")

        canv.setFont("Helvetica", 8)
        canv.setFillColor(C_MUTED)
        canv.drawString(LEFT, FOOTER_H - 7 * mm, "© PontiScore — Todos os direitos reservados")
        canv.drawRightString(PAGE_W - RIGHT, FOOTER_H - 7 * mm, f"Página {canv.getPageNumber()}")

        canv.restoreState()

    doc = SimpleDocTemplate(
        buf,
        pagesize=A4,
        leftMargin=LEFT,
        rightMargin=RIGHT,
        topMargin=HEADER_H + 8 * mm,
        bottomMargin=FOOTER_H + 6 * mm,
        title=f"Relatório PontiScore — {lead.get('company','')}" if lead else "Relatório PontiScore",
        author="PontiScore",
    )

    # ----- Paragraph styles -----
    styles = getSampleStyleSheet()
    S_TITLE = ParagraphStyle("Title", parent=styles["Normal"], fontName="Helvetica-Bold",
                             fontSize=24, textColor=C_BRAND, leading=28, spaceAfter=4)
    S_SUBTITLE = ParagraphStyle("Subtitle", parent=styles["Normal"], fontName="Helvetica",
                                fontSize=11, textColor=C_MUTED, leading=14, spaceAfter=14)
    S_EYEBROW = ParagraphStyle("Eyebrow", parent=styles["Normal"], fontName="Helvetica-Bold",
                               fontSize=8.5, textColor=C_CTA, leading=10,
                               spaceAfter=6, spaceBefore=4)
    S_H2 = ParagraphStyle("H2", parent=styles["Normal"], fontName="Helvetica-Bold",
                          fontSize=14, textColor=C_BRAND, leading=17,
                          spaceBefore=14, spaceAfter=8)
    S_BODY = ParagraphStyle("Body", parent=styles["Normal"], fontName="Helvetica",
                            fontSize=10, textColor=C_MUTED, leading=14)
    S_SCORE_BIG = ParagraphStyle("ScoreBig", parent=styles["Normal"], fontName="Helvetica-Bold",
                                 fontSize=64, textColor=colors.white, leading=70,
                                 alignment=TA_CENTER)
    S_SCORE_UNIT = ParagraphStyle("ScoreUnit", parent=styles["Normal"], fontName="Helvetica",
                                  fontSize=11, textColor=colors.white, alignment=TA_CENTER,
                                  leading=14)
    S_TIER = ParagraphStyle("Tier", parent=styles["Normal"], fontName="Helvetica-Bold",
                            fontSize=13, textColor=colors.white, alignment=TA_CENTER,
                            leading=16, spaceBefore=4)
    S_CARD_TITLE = ParagraphStyle("CardTitle", parent=styles["Normal"], fontName="Helvetica-Bold",
                                  fontSize=11, textColor=C_INK, leading=13, spaceAfter=6)
    S_CARD_ITEM = ParagraphStyle("CardItem", parent=styles["Normal"], fontName="Helvetica",
                                 fontSize=9.5, textColor=C_MUTED, leading=13, spaceAfter=2)
    S_REC_TEXT = ParagraphStyle("RecText", parent=styles["Normal"], fontName="Helvetica",
                                fontSize=10, textColor=C_INK, leading=14)
    S_REC_LABEL = ParagraphStyle("RecLabel", parent=styles["Normal"], fontName="Helvetica-Bold",
                                 fontSize=8.5, textColor=C_BRAND, leading=11, spaceAfter=2)
    S_QUOTE = ParagraphStyle("Quote", parent=styles["Normal"], fontName="Helvetica-Oblique",
                             fontSize=9.5, textColor=C_MUTED, leading=13, spaceBefore=6)

    # ----- Score colour based on value (green=high, orange=mid, red=low) -----
    total = int(result.get("total_score", 0))
    if total >= 80:
        score_color = C_CTA
    elif total >= 60:
        score_color = C_CTA
    elif total >= 40:
        score_color = C_ORANGE
    else:
        score_color = C_ERROR

    # ==================== FLOWABLES ====================
    story: List = []

    # --- Intro block ---
    story.append(Paragraph("Relatório de Diagnóstico Digital", S_TITLE))
    if lead:
        prep = f"Preparado para <b>{lead.get('name','')}</b> — {lead.get('company','')}"
        story.append(Paragraph(prep, S_SUBTITLE))
    now_str = datetime.now(timezone.utc).strftime("%d/%m/%Y")
    story.append(Paragraph(f"Data de emissão: {now_str}", S_BODY))
    story.append(Spacer(1, 12))

    # --- Score hero (dark green panel with big number + tier) ---
    score_inner = Table(
        [
            [Paragraph(f"{total}", S_SCORE_BIG)],
            [Paragraph("de 100 pontos", S_SCORE_UNIT)],
            [Paragraph(result["tier"], S_TIER)],
        ],
        colWidths=[CONTENT_W - 2 * cm],
    )
    score_inner.setStyle(TableStyle([
        ("ALIGN", (0, 0), (-1, -1), "CENTER"),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("TOPPADDING", (0, 0), (-1, -1), 0),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 0),
    ]))

    hero = Table([[score_inner]], colWidths=[CONTENT_W])
    hero.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), score_color),
        ("TOPPADDING", (0, 0), (-1, -1), 18),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 18),
        ("LEFTPADDING", (0, 0), (-1, -1), 20),
        ("RIGHTPADDING", (0, 0), (-1, -1), 20),
        ("ROUNDEDCORNERS", [8, 8, 8, 8]),
    ]))
    story.append(hero)
    story.append(Spacer(1, 16))

    # --- Pillar scores as bar chart rows ---
    story.append(Paragraph("Pontuação por Pilar", S_H2))

    bar_track_w = 8.5 * cm  # width of the bar track
    for p in result["pillar_scores"]:
        pct = max(0, min(100, int(p["score"])))
        fill_w = bar_track_w * (pct / 100.0) if pct > 0 else 0.01
        if pct >= 75:
            bar_color = C_CTA
        elif pct >= 50:
            bar_color = C_CTA
        elif pct >= 25:
            bar_color = C_ORANGE
        else:
            bar_color = C_ERROR

        # Bar visual: a Table with 1 row: [fill | empty]
        bar_row = Table(
            [[""] if fill_w <= 0 else [["", ""]]],
            colWidths=[fill_w, bar_track_w - fill_w] if fill_w > 0 else [bar_track_w],
            rowHeights=[5 * mm],
        )
        if fill_w > 0:
            bar_row = Table(
                [["", ""]],
                colWidths=[fill_w, bar_track_w - fill_w],
                rowHeights=[5 * mm],
            )
            bar_row.setStyle(TableStyle([
                ("BACKGROUND", (0, 0), (0, 0), bar_color),
                ("BACKGROUND", (1, 0), (1, 0), C_SURFACE_3),
                ("LEFTPADDING", (0, 0), (-1, -1), 0),
                ("RIGHTPADDING", (0, 0), (-1, -1), 0),
                ("TOPPADDING", (0, 0), (-1, -1), 0),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 0),
                ("ROUNDEDCORNERS", [3, 3, 3, 3]),
            ]))
        else:
            bar_row = Table([[""]], colWidths=[bar_track_w], rowHeights=[5 * mm])
            bar_row.setStyle(TableStyle([
                ("BACKGROUND", (0, 0), (-1, -1), C_SURFACE_3),
                ("LEFTPADDING", (0, 0), (-1, -1), 0),
                ("RIGHTPADDING", (0, 0), (-1, -1), 0),
                ("ROUNDEDCORNERS", [3, 3, 3, 3]),
            ]))

        label_p = Paragraph(f"<b>{p['label']}</b>", ParagraphStyle(
            "PillarLabel", fontName="Helvetica-Bold", fontSize=10, textColor=C_INK, leading=12,
        ))
        score_p = Paragraph(f"<b>{pct}</b><font size=8 color='#3F4941'> / 100</font>",
                            ParagraphStyle("PillarScore", fontName="Helvetica-Bold",
                                           fontSize=13, textColor=bar_color,
                                           alignment=TA_LEFT, leading=15))

        row = Table(
            [[label_p, score_p], [bar_row, ""]],
            colWidths=[bar_track_w, CONTENT_W - bar_track_w - 4],
        )
        row.setStyle(TableStyle([
            ("SPAN", (0, 1), (1, 1)),
            ("VALIGN", (0, 0), (-1, 0), "BOTTOM"),
            ("VALIGN", (0, 1), (-1, 1), "TOP"),
            ("LEFTPADDING", (0, 0), (-1, -1), 0),
            ("RIGHTPADDING", (0, 0), (-1, -1), 0),
            ("TOPPADDING", (0, 0), (-1, 0), 0),
            ("BOTTOMPADDING", (0, 0), (-1, 0), 3),
            ("TOPPADDING", (0, 1), (-1, 1), 0),
            ("BOTTOMPADDING", (0, 1), (-1, 1), 10),
        ]))
        story.append(row)

    story.append(Spacer(1, 8))

    # --- Strengths + Weaknesses side-by-side cards ---
    strengths = result.get("strengths") or []
    weaknesses = result.get("weaknesses") or []

    def _card(title: str, items: List[str], accent_hex: str, tint, empty_msg: str):
        inner = [
            [Paragraph(f'<font color="{accent_hex}">■</font>  <b>{title}</b>', S_CARD_TITLE)],
        ]
        if items:
            for it in items:
                inner.append([Paragraph(f"• {it}", S_CARD_ITEM)])
        else:
            inner.append([Paragraph(f"<i>{empty_msg}</i>", S_CARD_ITEM)])

        card = Table(inner, colWidths=[(CONTENT_W - 8) / 2])
        card.setStyle(TableStyle([
            ("BACKGROUND", (0, 0), (-1, -1), tint),
            ("VALIGN", (0, 0), (-1, -1), "TOP"),
            ("LEFTPADDING", (0, 0), (-1, -1), 10),
            ("RIGHTPADDING", (0, 0), (-1, -1), 10),
            ("TOPPADDING", (0, 0), (-1, -1), 8),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 8),
            ("ROUNDEDCORNERS", [8, 8, 8, 8]),
        ]))
        return card

    strengths_card = _card(
        "Pontos Fortes", strengths, "#16A34A",
        C_CTA_SOFT, "Ainda sem pontos fortes destacados.",
    )
    weakness_card = _card(
        "Oportunidades de Melhoria", weaknesses, "#F17E1A",
        C_ORANGE_SOFT, "Sem áreas críticas identificadas.",
    )

    sw_row = Table(
        [[strengths_card, weakness_card]],
        colWidths=[(CONTENT_W - 8) / 2, (CONTENT_W - 8) / 2],
    )
    sw_row.setStyle(TableStyle([
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("LEFTPADDING", (0, 0), (0, 0), 0),
        ("RIGHTPADDING", (1, 0), (1, 0), 0),
        ("LEFTPADDING", (1, 0), (1, 0), 4),
        ("RIGHTPADDING", (0, 0), (0, 0), 4),
    ]))
    story.append(sw_row)

    # Force page 2 for recommendations to breathe
    story.append(PageBreak())

    # --- Recommendations (numbered) ---
    story.append(Paragraph("PLANO DE CRESCIMENTO", S_EYEBROW))
    story.append(Paragraph("Recomendações Personalizadas", S_TITLE))
    story.append(Paragraph(
        "Ações prioritárias baseadas no seu diagnóstico, organizadas por pilar.",
        S_SUBTITLE,
    ))

    for i, rec in enumerate(result["recommendations"], start=1):
        if ":" in rec:
            pillar_lbl, rec_text = rec.split(":", 1)
            rec_text = rec_text.strip()
        else:
            pillar_lbl, rec_text = "", rec

        num_cell = Table(
            [[Paragraph(f"<font color='white'><b>{i:02d}</b></font>", ParagraphStyle(
                "num", fontName="Helvetica-Bold", fontSize=13, alignment=TA_CENTER,
                textColor=colors.white, leading=15,
            ))]],
            colWidths=[11 * mm], rowHeights=[11 * mm],
        )
        num_cell.setStyle(TableStyle([
            ("BACKGROUND", (0, 0), (-1, -1), C_CTA),
            ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
            ("ALIGN", (0, 0), (-1, -1), "CENTER"),
            ("LEFTPADDING", (0, 0), (-1, -1), 0),
            ("RIGHTPADDING", (0, 0), (-1, -1), 0),
            ("TOPPADDING", (0, 0), (-1, -1), 0),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 0),
            ("ROUNDEDCORNERS", [22, 22, 22, 22]),
        ]))

        text_parts = []
        if pillar_lbl:
            text_parts.append(Paragraph(pillar_lbl.upper(), S_REC_LABEL))
        text_parts.append(Paragraph(rec_text, S_REC_TEXT))

        rec_table = Table(
            [[num_cell, text_parts]],
            colWidths=[13 * mm, CONTENT_W - 13 * mm],
        )
        rec_table.setStyle(TableStyle([
            ("VALIGN", (0, 0), (0, 0), "TOP"),
            ("VALIGN", (1, 0), (1, 0), "TOP"),
            ("LEFTPADDING", (0, 0), (0, 0), 0),
            ("RIGHTPADDING", (0, 0), (0, 0), 8),
            ("LEFTPADDING", (1, 0), (1, 0), 0),
            ("TOPPADDING", (0, 0), (-1, -1), 0),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 14),
        ]))
        story.append(rec_table)

    # --- CTA block at the end ---
    story.append(Spacer(1, 10))
    cta_inner = [
        [Paragraph("<b>Próximo passo</b>", ParagraphStyle(
            "ctaTitle", fontName="Helvetica-Bold", fontSize=12,
            textColor=colors.white, leading=15,
        ))],
        [Paragraph(
            "Agende uma <b>Sessão Estratégica gratuita</b> com a equipa PontiScore "
            "e receba um plano de crescimento personalizado para a sua empresa.",
            ParagraphStyle(
                "ctaBody", fontName="Helvetica", fontSize=10,
                textColor=colors.white, leading=14,
            ),
        )],
        [Paragraph(
            "Contacto: <b>contacto@pontiscore.pt</b>  •  <b>+351 961 472 598</b>  •  "
            "<b>www.pontiscore.pt</b>",
            ParagraphStyle(
                "ctaCta", fontName="Helvetica", fontSize=9.5,
                textColor=C_CTA_SOFT, leading=13, spaceBefore=6,
            ),
        )],
    ]
    cta_box = Table([[c] for c in cta_inner], colWidths=[CONTENT_W])
    cta_box.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), C_INK),
        ("LEFTPADDING", (0, 0), (-1, -1), 18),
        ("RIGHTPADDING", (0, 0), (-1, -1), 18),
        ("TOPPADDING", (0, 0), (0, 0), 14),
        ("BOTTOMPADDING", (0, -1), (-1, -1), 14),
        ("TOPPADDING", (0, 1), (-1, 1), 2),
        ("TOPPADDING", (0, 2), (-1, 2), 2),
        ("ROUNDEDCORNERS", [10, 10, 10, 10]),
    ]))
    story.append(cta_box)

    story.append(Spacer(1, 12))
    story.append(Paragraph(
        "Este relatório é orientativo e baseia-se nas respostas fornecidas ao "
        "questionário PontiScore. Não substitui uma consultoria personalizada.",
        S_QUOTE,
    ))

    doc.build(story, onFirstPage=draw_page_chrome, onLaterPages=draw_page_chrome)
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
          <h1 style="color:#1B3A8B; margin-bottom:8px;">Olá {lead['name']},</h1>
          <p>Obrigado por completar o seu diagnóstico PontiScore.</p>
          <p>Anexamos o seu <b>Relatório Personalizado</b> com a pontuação por pilar,
          pontos fortes, pontos a melhorar e recomendações.</p>
          <p style="background:#EEF2FA; padding:16px; border-radius:12px;">
            <b>PontiScore total:</b> {result['total_score']}/100<br/>
            <b>Nível:</b> {result['tier']}
          </p>
          <p>A nossa equipa entrará em contacto brevemente para agendar a sua
          <b>Sessão Estratégica gratuita</b> + Plano de Crescimento Personalizado.</p>
          <p style="color:#3F4941; font-size:12px; margin-top:24px;">PontiScore</p>
        </div>
        """
        resend.Emails.send({
            "from": RESEND_FROM_EMAIL,
            "to": [lead["email"]],
            "subject": f"Relatório PontiScore ({result['total_score']}/100)",
            "html": lead_html,
            "attachments": [{
                "filename": "pontiscore-relatorio.pdf",
                "content": pdf_b64,
            }],
        })

        # Admin notification
        admin_html = f"""
        <div style="font-family: -apple-system, Helvetica, Arial, sans-serif; color:#1A1C18;">
          <h2 style="color:#1B3A8B;">Nova lead PontiScore</h2>
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

    # Normalize the Mongo document to plain, JSON-safe types before it enters the
    # report logic. This removes BSON types and guards against circular references.
    diag = _to_plain(diag)

    now_iso = datetime.now(timezone.utc).isoformat()
    lead_doc = {
        "id": str(uuid.uuid4()),
        "name": payload.name.strip(),
        "company": payload.company.strip(),
        "email": payload.email,
        "phone": (payload.phone or "").strip() or None,
        "diagnostic_id": payload.diagnostic_id,
        "created_at": now_iso,
        # RGPD — registo do consentimento (data/hora + escolhas do utilizador)
        "privacy_accepted": bool(payload.privacy_accepted),
        "marketing_accepted": bool(payload.marketing_accepted),
        "consent_at": now_iso,
    }

    # Report generation + email must never crash the API. If anything fails
    # (PDF rendering, Resend, etc.) we still persist the lead and return 200.
    email_sent = False
    try:
        pdf_bytes = build_pdf(diag, _to_plain(lead_doc))
        email_sent = send_lead_emails(lead_doc, diag, pdf_bytes)
    except Exception as e:
        logger.exception("Report/email step failed; lead is saved regardless: %s", e)
        email_sent = False

    lead_doc["email_sent"] = email_sent

    await db.leads.insert_one(lead_doc.copy())
    return LeadResponse(**lead_doc)


@api_router.get("/leads")
async def list_leads(skip: int = 0, limit: int = 50):
    # Bounded pagination — production-safe, no unbounded reads
    limit = max(1, min(int(limit), 200))
    skip = max(0, int(skip))
    cursor = (
        db.leads.find({}, {"_id": 0})
        .sort("created_at", -1)
        .skip(skip)
        .limit(limit)
    )
    leads = await cursor.to_list(limit)
    total = await db.leads.count_documents({})
    return {"leads": leads, "total": total, "skip": skip, "limit": limit}


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
