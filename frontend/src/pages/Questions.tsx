import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Check, ChevronLeft } from "lucide-react";

import { api, type AnswerValue } from "@/lib/api";
import { ANSWER_OPTIONS, QUESTIONS } from "@/data/questions";
import Footer from "@/components/Footer";
import "./Questions.css";

export default function Questions() {
  const navigate = useNavigate();
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<number, AnswerValue>>({});
  const [selected, setSelected] = useState<AnswerValue | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const q = QUESTIONS[index];
  const totalQ = QUESTIONS.length;
  const progressPct = useMemo(
    () => Math.round(((index + 1) / totalQ) * 100),
    [index, totalQ],
  );

  const submit = async (finalAnswers: Record<number, AnswerValue>) => {
    setSubmitting(true);
    setError(null);
    try {
      const data = await api.submitDiagnostic(
        QUESTIONS.map((qq) => ({
          question_id: qq.id,
          value: finalAnswers[qq.id],
        })),
      );
      navigate(`/resultado/${data.id}`, { replace: true });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Erro ao calcular o PontiScore";
      setError(msg);
      setSubmitting(false);
    }
  };

  const onSelect = (val: AnswerValue) => {
    setSelected(val);
    const newAnswers = { ...answers, [q.id]: val };
    setAnswers(newAnswers);
    window.setTimeout(() => {
      if (index < totalQ - 1) {
        setIndex(index + 1);
        setSelected(null);
      } else {
        submit(newAnswers);
      }
    }, 260);
  };

  const goBack = () => {
    if (submitting) return;
    if (index === 0) {
      navigate("/");
      return;
    }
    const newIdx = index - 1;
    setIndex(newIdx);
    setSelected(answers[QUESTIONS[newIdx].id] ?? null);
  };

  return (
    <main className="quiz" data-testid="question-screen">
      <div className="quiz__inner">
        <div className="quiz__header">
          <button
            type="button"
            className="quiz__back"
            onClick={goBack}
            aria-label="Voltar"
            data-testid="question-back-button"
          >
            <ChevronLeft size={22} />
          </button>
          <span className="quiz__step" data-testid="question-progress-label">
            {index + 1} de {totalQ}
          </span>
          <span style={{ width: 40 }} />
        </div>

        <div className="quiz__progress-track">
          <div
            className="quiz__progress-fill"
            style={{ width: `${progressPct}%` }}
          />
        </div>
        <p className="quiz__progress-pct">{progressPct}%</p>

        {submitting ? (
          <div className="quiz__loading" data-testid="question-loading">
            <div className="ps-spinner" aria-hidden />
            <p className="quiz__loading-text">A calcular o PontiScore…</p>
          </div>
        ) : (
          <div key={q.id} className="quiz__content quiz__animate">
            <p className="quiz__pillar">{q.pillar}</p>
            <h2 className="quiz__question" data-testid={`question-text-${q.id}`}>
              {q.text}
            </h2>

            <div className="quiz__options">
              {ANSWER_OPTIONS.map((opt) => {
                const isSelected = selected === opt.value;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    className={`quiz__option${isSelected ? " is-selected" : ""}`}
                    onClick={() => onSelect(opt.value)}
                    data-testid={`question-option-${opt.value}`}
                    aria-pressed={isSelected}
                  >
                    <span className="quiz__radio">
                      {isSelected && <Check size={14} strokeWidth={3} />}
                    </span>
                    <span>{opt.label}</span>
                  </button>
                );
              })}
            </div>

            {error && (
              <p className="quiz__error" data-testid="question-error">
                {error}
              </p>
            )}
          </div>
        )}
      </div>
      <div className="quiz__footer">
        <Footer />
      </div>
    </main>
  );
}
