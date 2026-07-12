/**
 * Thin fetch wrapper used by every page.
 *
 * BASE URL RULES
 * - In development (this preview container) the FastAPI backend is reachable
 *   through the same origin thanks to the Kubernetes ingress that forwards
 *   /api/* to port 8001. Vite also proxies /api in `vite.config.ts` so calls
 *   work when running locally without the ingress.
 * - When embedded in a WordPress site the frontend can be on a different
 *   origin from the API. In that case, define `VITE_BACKEND_URL` at build
 *   time (e.g. `https://api.pontiscore.pt`) and it will be used as prefix.
 */
const BASE =
  (import.meta.env.VITE_BACKEND_URL as string | undefined)?.replace(/\/$/, "") ?? "";

export type AnswerValue = "sim" | "grande_parte" | "parcialmente" | "nao";

export type PillarScore = {
  key: string;
  label: string;
  score: number;
  raw: number;
  max_raw: number;
};

export type DiagnosticResult = {
  id: string;
  total_score: number;
  tier: string;
  pillar_scores: PillarScore[];
  strengths: string[];
  weaknesses: string[];
  recommendations: string[];
  created_at: string;
};

export type LeadPayload = {
  name: string;
  company: string;
  email: string;
  phone: string | null;
  diagnostic_id: string;
  privacy_accepted: boolean;
  marketing_accepted: boolean;
};

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
    ...init,
  });
  if (!res.ok) {
    let msg = `Erro ${res.status}`;
    try {
      const data = await res.json();
      if (data?.detail) msg = typeof data.detail === "string" ? data.detail : msg;
    } catch { /* ignore */ }
    throw new Error(msg);
  }
  return (await res.json()) as T;
}

export const api = {
  submitDiagnostic: (answers: { question_id: number; value: AnswerValue }[]) =>
    request<DiagnosticResult>("/api/diagnostic", {
      method: "POST",
      body: JSON.stringify({ answers }),
    }),

  getDiagnostic: (id: string) =>
    request<DiagnosticResult>(`/api/diagnostic/${encodeURIComponent(id)}`),

  submitLead: (payload: LeadPayload) =>
    request<{ id: string; email_sent: boolean }>("/api/lead", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
};
