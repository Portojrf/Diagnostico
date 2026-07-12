import { Facebook, Instagram, Linkedin } from "lucide-react";
import { Link } from "react-router-dom";

import "./Footer.css";

type Props = {
  /** When true renders on a dark background (used on ThankYou hero). */
  variant?: "light" | "dark";
};

const SOCIALS = [
  {
    name: "Instagram",
    href: "https://www.instagram.com/pontiscore/",
    Icon: Instagram,
    testId: "footer-instagram-link",
  },
  {
    name: "Facebook",
    href: "https://facebook.com/pontiscore",
    Icon: Facebook,
    testId: "footer-facebook-link",
  },
  {
    name: "LinkedIn",
    href: "https://www.linkedin.com/in/pontiscore",
    Icon: Linkedin,
    testId: "footer-linkedin-link",
  },
] as const;

/**
 * Discreet legal footer used across every public page.
 * Kept intentionally simple so the same block can be re-used inside a WordPress
 * shortcode/plugin build without extra dependencies.
 *
 * External-link resilience (popup blockers / sandboxed preview iframes) is
 * handled by the global click delegation in `main.tsx`, so anchors here just
 * need the correct `href` + `target="_blank"` + `rel`.
 */
export default function Footer({ variant = "light" }: Props) {
  const year = new Date().getFullYear();
  return (
    <footer className={`footer ${variant === "dark" ? "footer--dark" : ""}`} data-testid="site-footer">
      <div className="footer__inner">
        <ul className="footer__links">
          <li>
            <Link to="/privacidade" className="footer__link" data-testid="footer-privacy-link">
              Política de Privacidade
            </Link>
          </li>
          <li>
            <Link to="/termos" className="footer__link" data-testid="footer-terms-link">
              Termos de Utilização
            </Link>
          </li>
          <li>
            <a
              href="mailto:contacto@pontiscore.pt"
              className="footer__link"
              data-testid="footer-contact-link"
            >
              Contacto
            </a>
          </li>
        </ul>
        <ul className="footer__socials" aria-label="Redes sociais">
          {SOCIALS.map(({ name, href, Icon, testId }) => (
            <li key={name}>
              <a
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                className="footer__social"
                aria-label={name}
                data-testid={testId}
              >
                <Icon size={16} />
              </a>
            </li>
          ))}
        </ul>
        <p className="footer__copy">© {year} PontiScore</p>
      </div>
    </footer>
  );
}
