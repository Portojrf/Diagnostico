import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { ChevronLeft } from "lucide-react";

import Footer from "@/components/Footer";
import "./LegalPage.css";

type Props = {
  title: string;
  updatedAt: string; // Ex.: "Fevereiro de 2026"
  eyebrow: string; // Ex.: "POLÍTICA DE PRIVACIDADE"
  children: ReactNode;
};

/**
 * Shared layout for Privacy & Terms pages. Keeps the visual identity of the app
 * (colours, spacing, typography) while presenting long-form legal content in a
 * WordPress-friendly, semantic HTML structure so the same content can be
 * ported to a WP page later with zero changes.
 */
export default function LegalPage({ title, updatedAt, eyebrow, children }: Props) {
  return (
    <main className="legal" data-testid="legal-page">
      <header className="legal__header">
        <div className="legal__header-inner">
          <Link
            to="/"
            className="legal__back"
            aria-label="Voltar ao início"
            data-testid="legal-back-link"
          >
            <ChevronLeft size={22} />
          </Link>
          <p className="legal__eyebrow">{eyebrow}</p>
        </div>
      </header>

      <section className="legal__body">
        <div className="legal__container">
          <h1 className="legal__title">{title}</h1>
          <p className="legal__updated">Última atualização: {updatedAt}</p>
          {children}
        </div>
      </section>

      <Footer />
    </main>
  );
}
