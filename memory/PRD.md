# PontiScore — Product Requirements Document (PRD)

## Original Problem Statement
Import the full codebase from GitHub (https://github.com/Portojrf/Pontiscore-diag.git, branch `conflict_110726_2356`) and recreate it as a Full Stack Web App compatible with the Emergent Web pipeline (React + FastAPI + MongoDB). Preserve frontend, backend, landing page, questionnaire, results dashboard, automatic PDF generation, MongoDB integration, Resend integration, visual identity, all components, data models, business logic and tests. Do not simplify or rebuild from scratch.

## Migration Note (Architecture)
The source repo's frontend was an **Expo / React Native** mobile app (expo-router: `app/index.tsx`, `question.tsx`, `dashboard.tsx`, `thankyou.tsx`). It was ported to a **web React (CRA + craco)** app on port 3000 to be compatible with the Emergent Web pipeline, preserving the design (sage/moss `#3A5A40` palette, layout, animations, testIDs) and behavior exactly. The **FastAPI backend was imported as-is** (it was already web-compatible).

## User Flow
1. **Landing** (`/`) — hero + "Comecar Diagnostico" CTA. Desktop split layout; mobile hero + sticky CTA.
2. **Question** (`/question`) — 10 questions, progress bar, 4 options (Sim/Em grande parte/Parcialmente/Nao), auto-advance.
3. **Dashboard** (`/dashboard?id=`) — SVG score gauge, tier, 5 pillar scores, strengths/weaknesses, recommendations + embedded lead form.
4. **ThankYou** (`/thankyou`) — success screen.

## Scoring
- Sim=10 / Em grande parte=7 / Parcialmente=4 / Nao=0; 10 questions → 0–100.
- 5 Pillars: Frequencia&Consistencia (Q1,Q2), Alcance&Performance (Q3,Q10), Estrategia&Investimento (Q5,Q6), Identidade Visual (Q7), Planeamento&Conversao (Q4,Q8,Q9), each normalized 0-100.

## Backend (FastAPI + MongoDB) — /app/backend/server.py
- `GET /api/questions`, `POST /api/diagnostic`, `GET /api/diagnostic/{id}`, `POST /api/lead` (builds PDF via reportlab, sends emails via Resend), `GET /api/leads`.
- Collections: `diagnostics`, `leads`.

## Integrations
- **Resend** — email + PDF attachment. `RESEND_API_KEY` in backend/.env (currently EMPTY → lead saves succeed, `email_sent=false`, no error). Add key to enable delivery.
- **reportlab** — PDF report generation.
- **MongoDB** — local via `MONGO_URL`.

## Implemented (2026-07-11)
- Backend imported and running (health + full flow verified). Added `reportlab`, `resend` to requirements.
- Frontend ported to web React: `src/pages/{Landing,Question,Dashboard,ThankYou}.jsx`, `src/theme.js`, `src/constants/questions.js`, testIds in `src/constants/testIds/pontiscore.js`, styles in `src/App.css`.
- Full E2E tested: backend 100% (11 pytest), frontend 100%.

## Backlog / Next
- P1: Provide a real `RESEND_API_KEY` (+ verified sender domain) to enable email/PDF delivery.
- P2: Migrate deprecated `@app.on_event("shutdown")` to FastAPI lifespan.
- P2: Optional admin view for `/api/leads`.
