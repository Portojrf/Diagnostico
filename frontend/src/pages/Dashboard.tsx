import { useEffect, useState, type FormEvent } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  FileText,
  TrendingUp,
  X,
} from "lucide-react";

import { api, type DiagnosticResult } from "@/lib/api";
import ScoreGauge from "@/components/ScoreGauge";
import Footer from "@/components/Footer";
import "./Dashboard.css";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function Dashboard() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [result, setResult] = useState<DiagnosticResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Lead form
  const [name, setName] = useState("");
  const [company, setCompany] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [privacyAccepted, setPrivacyAccepted] = useState(false);
  const [marketingAccepted, setMarketingAccepted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    if (!id) {
      setLoadError("Diagnóstico não encontrado");
      setLoading(false);
      return;
    }
    (async () => {
      try {
        const data = await api.getDiagnostic(id);
        if (!cancelled) setResult(data);
      } catch (e) {
        if (!cancelled) {
          const raw = e instanceof Error ? e.message : "";
          const isNotFound = /not found/i.test(raw) || /Diagnostic not found/i.test(raw);
          setLoadError(isNotFound ? "Diagnóstico não encontrado" : (raw || "Erro de ligação"));
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id]);

  const validate = (): string | null => {
    if (!name.trim()) return "Introduza o seu nome";
    if (!company.trim()) return "Introduza o nome da empresa";
    if (!EMAIL_RE.test(email.trim())) return "Email inválido";
    if (!privacyAccepted)
      return "Deve aceitar a Política de Privacidade para receber o relatório";
    return null;
  };

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!result) return;
    const v = validate();
    if (v) {
      setFormError(v);
      return;
    }
    setFormError(null);
    setSubmitting(true);
    try {
      await api.submitLead({
        name: name.trim(),
        company: company.trim(),
        email: email.trim(),
        phone: phone.trim() || null,
        diagnostic_id: result.id,
        privacy_accepted: privacyAccepted,
        marketing_accepted: marketingAccepted,
      });
      navigate("/obrigado", { replace: true });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Erro ao submeter formulário";
      setFormError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="dash__loading">
        <div className="ps-spinner" aria-hidden />
        <p>A preparar o seu relatório…</p>
      </div>
    );
  }

  if (loadError || !result) {
    return (
      <div className="dash__error-screen">
        <AlertCircle size={48} color="var(--c-error)" />
        <p className="dash__error-title">{loadError ?? "Erro"}</p>
        <button type="button" className="dash__retry" onClick={() => navigate("/", { replace: true })}>
          Voltar ao início
        </button>
      </div>
    );
  }

  return (
    <main className="dash">
      <div className="dash__inner">
        <header className="dash__header">
          <p className="dash__eyebrow">PONTISCORE</p>
          <button
            type="button"
            className="dash__close"
            aria-label="Voltar ao início"
            onClick={() => navigate("/", { replace: true })}
            data-testid="dashboard-home-button"
          >
            <X size={22} />
          </button>
        </header>

        <section className="dash__gauge ps-anim-in">
          <ScoreGauge score={result.total_score} />
          <p className="dash__tier" data-testid="dashboard-tier">{result.tier}</p>
        </section>

        <section className="ps-anim-in ps-delay-2">
          <h3 className="dash__section-title">Pontuação por Pilar</h3>
          <div className="dash__pillar-list">
            {result.pillar_scores.map((p) => (
              <div key={p.key} className="dash__pillar-row" data-testid={`pillar-${p.key}`}>
                <div style={{ flex: 1 }}>
                  <p className="dash__pillar-label">{p.label}</p>
                  <div className="dash__pillar-bar-track">
                    <div className="dash__pillar-bar-fill" style={{ width: `${p.score}%` }} />
                  </div>
                </div>
                <span className="dash__pillar-score">{p.score}</span>
              </div>
            ))}
          </div>
        </section>

        <section className="dash__sw-row ps-anim-in ps-delay-3">
          <div className="dash__sw-card dash__sw-card--strength">
            <div className="dash__sw-header">
              <TrendingUp size={16} color="var(--c-brand)" />
              Pontos Fortes
            </div>
            {result.strengths.length ? (
              result.strengths.map((s) => <p key={s} className="dash__sw-item">• {s}</p>)
            ) : (
              <p className="dash__sw-empty">Ainda sem pontos fortes destacados.</p>
            )}
          </div>
          <div className="dash__sw-card dash__sw-card--weak">
            <div className="dash__sw-header">
              <AlertCircle size={16} color="var(--c-warning)" />
              Pontos Fracos
            </div>
            {result.weaknesses.length ? (
              result.weaknesses.map((s) => <p key={s} className="dash__sw-item">• {s}</p>)
            ) : (
              <p className="dash__sw-empty">Sem pontos críticos.</p>
            )}
          </div>
        </section>

        <section className="ps-anim-in ps-delay-4">
          <h3 className="dash__section-title">Recomendações Personalizadas</h3>
          <div className="dash__rec-list">
            {result.recommendations.map((r, i) => (
              <div key={i} className="dash__rec-item">
                <div className="dash__rec-num">{i + 1}</div>
                <p className="dash__rec-text">{r}</p>
              </div>
            ))}
          </div>
        </section>

        <div className="dash__report-note ps-anim-in ps-delay-4">
          <FileText size={18} />
          <p>
            Este é o seu relatório automático. Preencha os dados abaixo para receber
            o PDF por email + Sessão Estratégica gratuita.
          </p>
        </div>

        <form className="dash__lead ps-anim-in ps-delay-5" onSubmit={onSubmit} data-testid="lead-form" noValidate>
          <p className="dash__lead-eyebrow">OFERTA GRATUITA</p>
          <h3 className="dash__lead-title">O seu diagnóstico está concluído</h3>
          <p className="dash__lead-subtitle">
            Receba gratuitamente uma Sessão Estratégica + Plano de Crescimento
            Personalizado.
          </p>

          <ul className="dash__benefits" style={{ listStyle: "none", padding: 0, margin: 0 }}>
            {[
              "Prioridades para os próximos 30 dias",
              "Oportunidades de alcance e interação",
              "Estratégia de geração de contactos",
            ].map((b) => (
              <li key={b} className="dash__benefit">
                <CheckCircle2 size={16} color="var(--c-brand-tertiary)" />
                {b}
              </li>
            ))}
          </ul>

          <div className="dash__form-grid">
            <div className="dash__form-group">
              <label htmlFor="lead-name" className="dash__form-label">Nome</label>
              <input
                id="lead-name"
                className="dash__input"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="O seu nome"
                autoCapitalize="words"
                autoComplete="name"
                data-testid="lead-name-input"
              />
            </div>
            <div className="dash__form-group">
              <label htmlFor="lead-company" className="dash__form-label">Empresa</label>
              <input
                id="lead-company"
                className="dash__input"
                value={company}
                onChange={(e) => setCompany(e.target.value)}
                placeholder="Nome da empresa"
                autoComplete="organization"
                data-testid="lead-company-input"
              />
            </div>
            <div className="dash__form-group">
              <label htmlFor="lead-email" className="dash__form-label">Email</label>
              <input
                id="lead-email"
                type="email"
                className="dash__input"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="email@empresa.pt"
                autoComplete="email"
                data-testid="lead-email-input"
              />
            </div>
            <div className="dash__form-group">
              <label htmlFor="lead-phone" className="dash__form-label">Telefone (opcional)</label>
              <input
                id="lead-phone"
                type="tel"
                className="dash__input"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+351 900 000 000"
                autoComplete="tel"
                data-testid="lead-phone-input"
              />
            </div>
          </div>

          <div className="dash__consents">
            <label className="dash__consent" data-testid="lead-privacy-label">
              <input
                type="checkbox"
                className="dash__consent-input"
                checked={privacyAccepted}
                onChange={(e) => setPrivacyAccepted(e.target.checked)}
                data-testid="lead-privacy-checkbox"
                aria-required="true"
                required
              />
              <span className="dash__consent-text">
                Li e aceito a{" "}
                <Link
                  to="/privacidade"
                  target="_blank"
                  rel="noreferrer"
                  className="dash__consent-link"
                  data-testid="lead-privacy-link"
                >
                  Política de Privacidade
                </Link>{" "}
                e autorizo o tratamento dos meus dados para receber o
                relatório PontiScore.
                <span className="dash__required" aria-hidden> *</span>
              </span>
            </label>

            <label className="dash__consent" data-testid="lead-marketing-label">
              <input
                type="checkbox"
                className="dash__consent-input"
                checked={marketingAccepted}
                onChange={(e) => setMarketingAccepted(e.target.checked)}
                data-testid="lead-marketing-checkbox"
              />
              <span className="dash__consent-text">
                Pretendo receber dicas, novidades e conteúdos sobre marketing
                digital da PontiScore.
              </span>
            </label>
          </div>

          {formError && (
            <p className="dash__form-error" data-testid="lead-form-error">{formError}</p>
          )}

          <button
            type="submit"
            className="dash__submit"
            disabled={submitting || !privacyAccepted}
            data-testid="lead-submit-button"
          >
            {submitting ? (
              <span className="ps-spinner on-dark" aria-hidden style={{ width: 22, height: 22, borderWidth: 2 }} />
            ) : (
              <>
                Quero Receber a Minha Sessão Estratégica
                <ArrowRight size={16} />
              </>
            )}
          </button>
          <p className="dash__form-disclaimer" data-testid="lead-disclaimer">
            Os seus dados serão tratados de forma confidencial e utilizados
            apenas para gerar o seu relatório, prestar os serviços da
            PontiScore e, caso autorize, enviar comunicações futuras.
          </p>
          <p className="dash__form-hint">Sem compromisso. Resposta em 24h úteis.</p>
        </form>
      </div>
      <Footer />
    </main>
  );
}
