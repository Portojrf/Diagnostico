import { useNavigate } from "react-router-dom";
import { Check, Mail } from "lucide-react";

import Footer from "@/components/Footer";
import "./ThankYou.css";

export default function ThankYou() {
  const navigate = useNavigate();

  return (
    <main className="ty" data-testid="thankyou-screen">
      <div className="ty__content">
        <div className="ty__icon">
          <Check size={44} strokeWidth={3} />
        </div>
        <h1 className="ty__title">Obrigado!</h1>
        <p className="ty__subtitle">
          Entraremos em contacto brevemente para agendar a sua Sessão
          Estratégica gratuita + Plano de Crescimento Personalizado.
        </p>

        <div className="ty__info">
          <Mail size={18} color="var(--c-brand)" />
          <p>Verifique o seu email — o relatório detalhado em PDF está a caminho.</p>
        </div>

        <button
          type="button"
          className="ty__home"
          onClick={() => navigate("/", { replace: true })}
          data-testid="thankyou-home-button"
        >
          Voltar ao início
        </button>
      </div>
      <Footer />
    </main>
  );
}
