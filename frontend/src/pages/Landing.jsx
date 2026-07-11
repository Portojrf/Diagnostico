import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Sparkles, ArrowRight, HelpCircle, Gauge, TrendingUp } from "lucide-react";
import { LANDING } from "@/constants/testIds";

const STEPS = [
  { icon: HelpCircle, title: "10 perguntas rapidas", desc: "Sobre publicacoes, estrategia, identidade visual e conversao." },
  { icon: Gauge, title: "PontiScore imediato", desc: "Pontuacao 0-100 com detalhe por pilar da sua presenca digital." },
  { icon: TrendingUp, title: "Plano de crescimento", desc: "Receba pontos fortes, fracos e recomendacoes personalizadas." },
];

const fadeUp = (delay = 0) => ({
  initial: { opacity: 0, y: 24 },
  animate: { opacity: 1, y: 0 },
  transition: { delay, duration: 0.6, ease: "easeOut" },
});

export default function Landing() {
  const navigate = useNavigate();
  const startQuiz = () => navigate("/question");

  const HeroContent = (
    <div>
      <motion.div className="ls-badge" {...fadeUp(0.08)}>
        <Sparkles size={12} color="var(--brand-tertiary)" />
        <span>Diagnostico digital premium</span>
      </motion.div>

      <motion.h1 className="ls-title" data-testid={LANDING.title} {...fadeUp(0.18)}>
        Diagnostique a sua presenca digital em 2 minutos.
      </motion.h1>

      <motion.p className="ls-subtitle" {...fadeUp(0.3)}>
        Descubra o seu PontiScore e receba um plano de crescimento personalizado para a sua empresa.
      </motion.p>

      <motion.div className="ls-cta-desktop" {...fadeUp(0.42)}>
        <button
          type="button"
          data-testid={LANDING.startButtonDesktop}
          onClick={startQuiz}
          className="ls-cta-btn ls-cta-btn-desktop"
        >
          Comecar Diagnostico
          <ArrowRight size={18} />
        </button>
        <p className="ls-cta-hint ls-cta-hint-desktop">Gratuito. Cerca de 2 minutos.</p>
      </motion.div>
    </div>
  );

  const HowItWorks = (
    <>
      <motion.p className="ls-eyebrow" {...fadeUp(0.4)}>COMO FUNCIONA</motion.p>
      {STEPS.map((s, i) => {
        const Icon = s.icon;
        return (
          <motion.div key={s.title} className="ls-step" {...fadeUp(0.5 + i * 0.1)}>
            <div className="ls-step-icon"><Icon size={20} /></div>
            <div style={{ flex: 1 }}>
              <p className="ls-step-title">{s.title}</p>
              <p className="ls-step-desc">{s.desc}</p>
            </div>
          </motion.div>
        );
      })}
      <div className="ls-trust">
        <div className="ls-trust-item">
          <div className="ls-trust-num">10</div>
          <div className="ls-trust-label">perguntas</div>
        </div>
        <div className="ls-trust-divider" />
        <div className="ls-trust-item">
          <div className="ls-trust-num">5</div>
          <div className="ls-trust-label">pilares</div>
        </div>
        <div className="ls-trust-divider" />
        <div className="ls-trust-item">
          <div className="ls-trust-num">~2min</div>
          <div className="ls-trust-label">duracao</div>
        </div>
      </div>
    </>
  );

  return (
    <div data-testid={LANDING.screen}>
      {/* Desktop */}
      <div className="ls-desktop">
        <div className="ls-hero-side">
          <div className="ls-hero-overlay" />
          <div className="ls-hero-side-inner">{HeroContent}</div>
        </div>
        <div className="ls-desktop-right">{HowItWorks}</div>
      </div>

      {/* Mobile / tablet */}
      <div className="ls-mobile ls-root">
        <div className="ls-hero">
          <div className="ls-hero-overlay" />
          <div className="ls-hero-content">{HeroContent}</div>
        </div>
        <div className="ls-body">
          <div className="ls-body-inner">{HowItWorks}</div>
        </div>
        <div className="ls-cta-bar">
          <button type="button" data-testid={LANDING.startButton} onClick={startQuiz} className="ls-cta-btn">
            Comecar Diagnostico
            <ArrowRight size={18} />
          </button>
          <p className="ls-cta-hint">Gratuito. Cerca de 2 minutos.</p>
        </div>
      </div>
    </div>
  );
}
