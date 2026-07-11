import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Check, Mail } from "lucide-react";
import { theme } from "@/theme";
import { THANKYOU } from "@/constants/testIds";

export default function ThankYou() {
  const navigate = useNavigate();

  return (
    <div className="ty-root" data-testid={THANKYOU.screen}>
      <div className="ty-overlay" />
      <div className="ty-content">
        <motion.div
          className="ty-icon"
          initial={{ opacity: 0, scale: 0.4 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5, ease: "easeOut" }}
        >
          <Check size={44} />
        </motion.div>

        <motion.h1
          className="ty-title"
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2, duration: 0.5 }}
        >
          Obrigado!
        </motion.h1>

        <motion.p
          className="ty-subtitle"
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3, duration: 0.5 }}
        >
          Entraremos em contacto brevemente para agendar a sua Sessao Estrategica gratuita + Plano de Crescimento Personalizado.
        </motion.p>

        <motion.div
          className="ty-info-card"
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.45, duration: 0.5 }}
        >
          <Mail size={18} color={theme.color.brandTertiary} />
          <p className="ty-info-text">
            Verifique o seu email — o relatorio detalhado em PDF esta a caminho.
          </p>
        </motion.div>

        <motion.div
          style={{ width: "100%" }}
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6, duration: 0.5 }}
        >
          <button type="button" className="ty-home-btn" data-testid={THANKYOU.homeButton} onClick={() => navigate("/")}>
            Voltar ao inicio
          </button>
        </motion.div>
      </div>
    </div>
  );
}
