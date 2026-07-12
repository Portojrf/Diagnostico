# PontiScore — Product Requirements Document (PRD)

## Original Problem Statement
Import the full codebase from GitHub (Portojrf/Pontiscore-diag) and recreate it as a Full Stack Web App (Vite + React + FastAPI) compatible with the Emergent Web pipeline. Preserve everything (landing, questionnaire, dashboard, automatic PDF, MongoDB, Resend, visual identity, components, models, business logic, tests). Do not simplify or rebuild from scratch.

## Canonical Source (IMPORTANT)
The correct, latest version is on branch **`conflict_120726_0155`** (commit `6df6ed9`, 2026-07-12 00:55). The Emergent support team migrated the app there from Expo/React Native to a **Vite + React + TypeScript** web app (the old Expo code is kept under `frontend-expo-backup/` in that repo). This `/app` project mirrors that branch.

## Stack / Architecture
- **Frontend**: Vite + React 19 + TypeScript, `/app/frontend`, supervisor `yarn start` → `vite --port 3000`. API via `src/lib/api.ts` using relative `/api` (same-origin ingress) or `VITE_BACKEND_URL`. Plain CSS (page-level `.css` + `styles/global.css`). Icons: lucide-react. Fonts: Inter.
- **Backend**: FastAPI + MongoDB (`/app/backend/server.py`). Endpoints: `GET /api/questions`, `POST /api/diagnostic`, `GET /api/diagnostic/{id}`, `POST /api/lead`, `GET /api/leads` (paginated). PDF via reportlab (premium 2-page, logo). Emails via Resend.
- Brand palette: navy `#1B3A8B`, green `#16A34A`, orange `#F17E1A`. Language: Portuguese (PT-PT, with accents).

## Routes
`/` Landing · `/diagnostico` Questions · `/resultado/:id` Dashboard · `/obrigado` ThankYou · `/privacidade` Privacy · `/termos` Terms.

## Scoring
Sim=10 / Em grande parte=7 / Parcialmente=4 / Não=0; 10 questions → 0–100. 5 pillars normalized 0-100. Tiers at 80/60/40.

## RGPD
`POST /api/lead` requires `privacy_accepted=true` (422 otherwise); optional `marketing_accepted`; stores `consent_at`. Legal pages: Privacy + Terms.

## Implemented (2026-07-12)
- Imported canonical Vite frontend + upgraded backend from branch `conflict_120726_0155`.
- Old Expo→CRA port replaced entirely. Backend logo + tests copied. Vite deps installed; supervisor runs Vite on 3000.
- Verified: backend full flow incl. RGPD 422 + PDF build (email_sent=false, no Resend key); frontend E2E quiz→dashboard renders via relative /api.

## Backlog / Next
- P1: Provide real `RESEND_API_KEY` (+ verified sender) to enable email/PDF delivery.
- P2: Migrate deprecated `@app.on_event("shutdown")` to lifespan.
- P2: Admin view for `/api/leads`.
