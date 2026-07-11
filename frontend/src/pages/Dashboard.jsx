import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { motion } from "framer-motion";
import {
  X, TrendingUp, AlertCircle, FileText, CheckCircle2, ArrowRight,
} from "lucide-react";
import { theme } from "@/theme";
import { DASHBOARD } from "@/constants/testIds";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;

const fadeUp = (delay = 0) => ({
  initial: { opacity: 0, y: 24 },
  animate: { opacity: 1, y: 0 },
  transition: { delay, duration: 0.5, ease: "easeOut" },
});

function ScoreGauge({ score }) {
  const size = 200;
  const strokeWidth = 14;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const arcFraction = 0.75;
  const arcLength = circumference * arcFraction;
  const filled = arcLength * (Math.max(0, Math.min(100, score)) / 100);

  const color =
    score >= 80 ? theme.color.brandPrimary
    : score >= 60 ? theme.color.brandSecondary
    : score >= 40 ? theme.color.warning
    : theme.color.error;

  return (
    <div className="db-gauge">
      <svg width={size} height={size}>
        <g transform={`rotate(135 ${size / 2} ${size / 2})`}>
          <circle
            cx={size / 2} cy={size / 2} r={radius}
            stroke={theme.color.surfaceTertiary} strokeWidth={strokeWidth} fill="none"
            strokeDasharray={`${arcLength} ${circumference}`} strokeLinecap="round"
          />
          <circle
            cx={size / 2} cy={size / 2} r={radius}
            stroke={color} strokeWidth={strokeWidth} fill="none"
            strokeDasharray={`${filled} ${circumference}`} strokeLinecap="round"
            style={{ transition: "stroke-dasharray 0.9s ease" }}
          />
        </g>
      </svg>
      <div className="db-gauge-center">
        <span className="db-gauge-value" data-testid={DASHBOARD.totalScore}>{score}</span>
        <span className="db-gauge-max">/ 100</span>
      </div>
    </div>
  );
}

export default function Dashboard() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const id = params.get("id");

  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);

  const [name, setName] = useState("");
  const [company, setCompany] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState(null);

  useEffect(() => {
    if (!id) {
      setLoadError("Diagnostico nao encontrado");
      setLoading(false);
      return;
    }
    (async () => {
      try {
        const res = await fetch(`${BACKEND_URL}/api/diagnostic/${id}`);
        if (res.ok) {
          setResult(await res.json());
        } else {
          setLoadError("Nao foi possivel carregar o diagnostico");
        }
      } catch {
        setLoadError("Erro de ligacao ao servidor");
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

  const validate = () => {
    if (!name.trim()) return "Introduza o seu nome";
    if (!company.trim()) return "Introduza o nome da empresa";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) return "Email invalido";
    return null;
  };

  const submitLead = async () => {
    if (!result) return;
    const v = validate();
    if (v) { setFormError(v); return; }
    setFormError(null);
    setSubmitting(true);
    try {
      const res = await fetch(`${BACKEND_URL}/api/lead`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          company: company.trim(),
          email: email.trim(),
          phone: phone.trim() || null,
          diagnostic_id: result.id,
        }),
      });
      if (!res.ok) throw new Error("Erro ao submeter");
      navigate("/thankyou", { replace: true });
    } catch (e) {
      setFormError(e?.message || "Erro ao submeter formulario");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="db-root db-centered">
        <div className="ps-spinner" />
        <p style={{ color: theme.color.onSurfaceSecondary }}>A preparar o seu relatorio...</p>
      </div>
    );
  }

  if (loadError || !result) {
    return (
      <div className="db-root db-centered">
        <AlertCircle size={40} color={theme.color.error} />
        <p className="db-error-title">{loadError || "Erro"}</p>
        <button type="button" className="db-retry-btn" onClick={() => navigate("/")}>Voltar ao inicio</button>
      </div>
    );
  }

  return (
    <div className="db-root">
      <div className="db-content">
        <div className="db-header">
          <span className="db-eyebrow">O SEU PONTISCORE</span>
          <button type="button" className="db-close" onClick={() => navigate("/")} data-testid={DASHBOARD.homeButton} aria-label="Fechar">
            <X size={22} />
          </button>
        </div>

        <motion.div className="db-gauge-wrap" {...fadeUp(0)}>
          <ScoreGauge score={result.total_score} />
          <p className="db-tier" data-testid={DASHBOARD.tier}>{result.tier}</p>
        </motion.div>

        <motion.div {...fadeUp(0.15)}>
          <h3 className="db-section-title">Pontuacao por Pilar</h3>
          <div className="db-pillar-list">
            {result.pillar_scores.map((p) => (
              <div key={p.key} className="db-pillar-row" data-testid={`pillar-${p.key}`}>
                <div style={{ flex: 1 }}>
                  <p className="db-pillar-label">{p.label}</p>
                  <div className="db-pillar-track">
                    <div className="db-pillar-fill" style={{ width: `${p.score}%` }} />
                  </div>
                </div>
                <span className="db-pillar-score">{p.score}</span>
              </div>
            ))}
          </div>
        </motion.div>

        <div className="db-sw-row">
          <motion.div className="db-sw-card db-strength" {...fadeUp(0.25)}>
            <div className="db-sw-header">
              <TrendingUp size={16} color={theme.color.brandPrimary} />
              <span className="db-sw-title">Pontos Fortes</span>
            </div>
            {result.strengths.length
              ? result.strengths.map((s) => <p key={s} className="db-sw-item">• {s}</p>)
              : <p className="db-sw-empty">Ainda sem pontos fortes destacados.</p>}
          </motion.div>

          <motion.div className="db-sw-card db-weak" {...fadeUp(0.3)}>
            <div className="db-sw-header">
              <AlertCircle size={16} color={theme.color.warning} />
              <span className="db-sw-title">Pontos Fracos</span>
            </div>
            {result.weaknesses.length
              ? result.weaknesses.map((s) => <p key={s} className="db-sw-item">• {s}</p>)
              : <p className="db-sw-empty">Sem pontos criticos.</p>}
          </motion.div>
        </div>

        <motion.div {...fadeUp(0.36)}>
          <h3 className="db-section-title">Recomendacoes Personalizadas</h3>
          <div className="db-rec-list">
            {result.recommendations.map((r, i) => (
              <div key={i} className="db-rec-item">
                <div className="db-rec-num">{i + 1}</div>
                <p className="db-rec-text">{r}</p>
              </div>
            ))}
          </div>
        </motion.div>

        <motion.div className="db-report-note" {...fadeUp(0.42)}>
          <FileText size={18} color={theme.color.brandPrimary} />
          <p className="db-report-note-text">
            Este e o seu relatorio automatico. Preencha os dados abaixo para receber o PDF por email + Sessao Estrategica gratuita.
          </p>
        </motion.div>

        <motion.div className="db-lead-card" data-testid={DASHBOARD.leadForm} {...fadeUp(0.5)}>
          <span className="db-lead-eyebrow">OFERTA GRATUITA</span>
          <h3 className="db-lead-title">O seu diagnostico esta concluido</h3>
          <p className="db-lead-subtitle">
            Receba gratuitamente uma Sessao Estrategica + Plano de Crescimento Personalizado.
          </p>

          <div className="db-benefits">
            {[
              "Prioridades para os proximos 30 dias",
              "Oportunidades de alcance e engagement",
              "Estrategia de geracao de contactos",
            ].map((b) => (
              <div key={b} className="db-benefit-row">
                <CheckCircle2 size={16} color={theme.color.brandPrimary} />
                <span className="db-benefit-text">{b}</span>
              </div>
            ))}
          </div>

          <div className="db-form-group">
            <label className="db-form-label">Nome</label>
            <input className="db-input" data-testid={DASHBOARD.nameInput} value={name} onChange={(e) => setName(e.target.value)} placeholder="O seu nome" />
          </div>
          <div className="db-form-group">
            <label className="db-form-label">Empresa</label>
            <input className="db-input" data-testid={DASHBOARD.companyInput} value={company} onChange={(e) => setCompany(e.target.value)} placeholder="Nome da empresa" />
          </div>
          <div className="db-form-group">
            <label className="db-form-label">Email</label>
            <input className="db-input" data-testid={DASHBOARD.emailInput} value={email} onChange={(e) => setEmail(e.target.value)} placeholder="email@empresa.pt" type="email" autoCapitalize="none" autoCorrect="off" />
          </div>
          <div className="db-form-group">
            <label className="db-form-label">Telefone (opcional)</label>
            <input className="db-input" data-testid={DASHBOARD.phoneInput} value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+351 900 000 000" type="tel" />
          </div>

          {formError && <p className="db-form-error" data-testid={DASHBOARD.formError}>{formError}</p>}

          <button type="button" className="db-submit" data-testid={DASHBOARD.submitButton} onClick={submitLead} disabled={submitting}>
            {submitting ? (
              <div className="ps-spinner ps-spinner-sm" />
            ) : (
              <>
                Quero Receber a Minha Sessao Estrategica
                <ArrowRight size={16} />
              </>
            )}
          </button>
          <p className="db-form-hint">Sem compromisso. Resposta em 24h uteis.</p>
        </motion.div>
      </div>
    </div>
  );
}
