import { useNavigate } from "react-router-dom";
import { ArrowRight, HelpCircle, Gauge, TrendingUp } from "lucide-react";

import { useResponsive } from "@/hooks/useResponsive";
import Footer from "@/components/Footer";
import "./Landing.css";

const STEPS = [
  {
    Icon: HelpCircle,
    title: "10 perguntas rápidas",
    desc: "Sobre publicações, estratégia, identidade visual e conversão.",
  },
  {
    Icon: Gauge,
    title: "Resultado imediato",
    desc: "Receba uma pontuação de 0 a 100 com uma análise detalhada de cada pilar da sua presença digital.",
  },
  {
    Icon: TrendingUp,
    title: "Plano de crescimento",
    desc: "Descubra os pontos fortes da sua empresa, as oportunidades de melhoria e receba recomendações personalizadas.",
  },
];

export default function Landing() {
  const navigate = useNavigate();
  const { isDesktop } = useResponsive();

  const startQuiz = () => navigate("/diagnostico");

  return (
    <main className="landing" data-testid="landing-screen">
      {/* --- Top bar: logo left, tagline right --- */}
      <header className="landing__topbar">
        <div className="landing__topbar-inner">
          <div className="landing__brand">
            <img
              src="/logo-pontiscore.png"
              alt="PontiScore"
              className="landing__brand-logo"
              data-testid="landing-brand-logo"
            />
            <p className="landing__brand-sub">Marketing Digital</p>
          </div>
          <p className="landing__tagline">Diagnóstico Digital</p>
        </div>
      </header>

      {/* --- Hero + side panel --- */}
      <section className="landing__section">
        <div className="landing__container">
          <div className={`landing__grid ${isDesktop ? "is-desktop" : "is-stack"}`}>
            <div className="landing__hero">
              <h1
                className="landing__title ps-anim-in"
                data-testid="landing-title"
              >
                Descubra o potencial da sua presença digital em apenas{" "}
                <span className="landing__title-accent">2 minutos</span>.
              </h1>
              <p className="landing__subtitle ps-anim-in ps-delay-1">
                Descubra como está a presença digital da sua empresa e receba
                um plano de ação personalizado para fortalecer a sua marca,
                atrair mais clientes e impulsionar o crescimento do seu negócio.
              </p>

              {isDesktop && (
                <div className="landing__cta-wrap ps-anim-in ps-delay-2">
                  <button
                    type="button"
                    className="landing__cta"
                    onClick={startQuiz}
                    data-testid="landing-start-button-desktop"
                  >
                    Começar Diagnóstico Gratuito
                    <ArrowRight size={18} strokeWidth={2.4} />
                  </button>
                  <p className="landing__cta-hint">
                    Gratuito • Cerca de 2 minutos • Sem cartão de crédito
                  </p>
                </div>
              )}
            </div>

            <aside className="landing__aside">
              <p className="landing__eyebrow">COMO FUNCIONA</p>
              <ol className="landing__steps">
                {STEPS.map(({ Icon, title, desc }, i) => (
                  <li key={title} className={`step ps-anim-in ps-delay-${i + 2}`}>
                    <div className="step__icon">
                      <Icon size={20} strokeWidth={2.2} />
                    </div>
                    <div className="step__body">
                      <p className="step__title">{title}</p>
                      <p className="step__desc">{desc}</p>
                    </div>
                  </li>
                ))}
              </ol>

              <div className="landing__trust">
                <div className="landing__trust-item">
                  <span className="landing__trust-num">10</span>
                  <span className="landing__trust-label">perguntas</span>
                </div>
                <span className="landing__trust-divider" />
                <div className="landing__trust-item">
                  <span className="landing__trust-num">5</span>
                  <span className="landing__trust-label">pilares</span>
                </div>
                <span className="landing__trust-divider" />
                <div className="landing__trust-item">
                  <span className="landing__trust-num">~2min</span>
                  <span className="landing__trust-label">duração</span>
                </div>
              </div>
            </aside>
          </div>
        </div>
      </section>

      {/* --- Sticky CTA (mobile/tablet only) --- */}
      {!isDesktop && (
        <div className="landing__sticky-cta">
          <button
            type="button"
            className="landing__cta"
            onClick={startQuiz}
            data-testid="landing-start-button"
          >
            Começar Diagnóstico Gratuito
            <ArrowRight size={18} strokeWidth={2.4} />
          </button>
          <p className="landing__sticky-hint">Gratuito • Cerca de 2 minutos</p>
        </div>
      )}

      <Footer />
    </main>
  );
}
