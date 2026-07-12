import type { AnswerValue } from "@/lib/api";

export type Question = {
  id: number;
  text: string;
  pillar: string;
};

export const ANSWER_OPTIONS: { value: AnswerValue; label: string }[] = [
  { value: "sim", label: "Sim" },
  { value: "grande_parte", label: "Em grande parte" },
  { value: "parcialmente", label: "Parcialmente" },
  { value: "nao", label: "Não" },
];

export const QUESTIONS: Question[] = [
  { id: 1, text: "Publica conteúdos pelo menos 3 vezes por semana?", pillar: "Frequência & Consistência" },
  { id: 2, text: "Publica stories diariamente?", pillar: "Frequência & Consistência" },
  { id: 3, text: "Os seus reels ultrapassam as 2000 visualizações?", pillar: "Alcance & Performance" },
  { id: 4, text: "Mede quantos clientes chegam através das redes sociais?", pillar: "Planeamento & Conversão" },
  { id: 5, text: "Tem uma estratégia de conteúdos definida?", pillar: "Estratégia & Investimento" },
  { id: 6, text: "Investe em anúncios pagos nas redes sociais?", pillar: "Estratégia & Investimento" },
  { id: 7, text: "A sua identidade visual é consistente em todas as publicações?", pillar: "Identidade Visual" },
  { id: 8, text: "As suas publicações têm sempre uma chamada para ação (CTA)?", pillar: "Planeamento & Conversão" },
  { id: 9, text: "Segue um calendário editorial planeado?", pillar: "Planeamento & Conversão" },
  { id: 10, text: "Responde rapidamente às mensagens e comentários?", pillar: "Alcance & Performance" },
];
