import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Route, Routes } from "react-router-dom";

import Landing from "@/pages/Landing";
import Questions from "@/pages/Questions";
import Dashboard from "@/pages/Dashboard";
import ThankYou from "@/pages/ThankYou";
import Privacy from "@/pages/Privacy";
import Terms from "@/pages/Terms";
import { openExternal } from "@/lib/external-link";

import "@/styles/global.css";

/**
 * Global click delegation for external anchors (`target="_blank"`).
 *
 * Some embedding contexts (preview iframes with a restrictive `sandbox`, popup
 * blockers, mobile in-app browsers) silently swallow default `_blank`
 * navigation. Intercepting the click and routing through `openExternal` gives
 * us a resilient fallback chain (window.open → window.top.assign → same-tab).
 *
 * Only fires for primary-button clicks without modifier keys, so middle-click /
 * ⌘-click / right-click behaviour remains native.
 */
document.addEventListener("click", (evt) => {
  const target = evt.target as HTMLElement | null;
  if (!target) return;
  const anchor = target.closest<HTMLAnchorElement>('a[target="_blank"]');
  if (!anchor) return;
  const href = anchor.getAttribute("href");
  if (!href) return;
  // Ignore mailto:, tel:, and internal fragments — those work fine natively.
  if (/^(mailto:|tel:|#)/i.test(href)) return;
  const me = evt as MouseEvent;
  if (me.button !== 0 || me.metaKey || me.ctrlKey || me.shiftKey || me.altKey) return;
  evt.preventDefault();
  openExternal(anchor.href);
});

const rootEl = document.getElementById("root");
if (!rootEl) throw new Error("#root not found");

createRoot(rootEl).render(
  <StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/diagnostico" element={<Questions />} />
        <Route path="/resultado/:id" element={<Dashboard />} />
        <Route path="/obrigado" element={<ThankYou />} />
        <Route path="/privacidade" element={<Privacy />} />
        <Route path="/termos" element={<Terms />} />
        <Route path="*" element={<Landing />} />
      </Routes>
    </BrowserRouter>
  </StrictMode>,
);
