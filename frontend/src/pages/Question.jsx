import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronLeft, Check } from "lucide-react";
import { ANSWER_OPTIONS, QUESTIONS } from "@/constants/questions";
import { QUESTION } from "@/constants/testIds";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;

export default function Question() {
  const navigate = useNavigate();
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState({});
  const [selected, setSelected] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  const q = QUESTIONS[index];
  const totalQ = QUESTIONS.length;
  const progressPct = useMemo(() => Math.round(((index + 1) / totalQ) * 100), [index, totalQ]);

  const onSelect = (val) => {
    setSelected(val);
    const newAnswers = { ...answers, [q.id]: val };
    setAnswers(newAnswers);
    setTimeout(() => {
      if (index < totalQ - 1) {
        setIndex(index + 1);
        setSelected(null);
      } else {
        submit(newAnswers);
      }
    }, 260);
  };

  const submit = async (finalAnswers) => {
    setSubmitting(true);
    setError(null);
    try {
      const payload = {
        answers: QUESTIONS.map((qq) => ({ question_id: qq.id, value: finalAnswers[qq.id] })),
      };
      const res = await fetch(`${BACKEND_URL}/api/diagnostic`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error("Erro no servidor");
      const data = await res.json();
      navigate(`/dashboard?id=${data.id}`, { replace: true });
    } catch (e) {
      setError(e?.message || "Erro ao calcular o PontiScore");
      setSubmitting(false);
    }
  };

  const goBack = () => {
    if (submitting) return;
    if (index === 0) {
      navigate("/");
      return;
    }
    const newIdx = index - 1;
    setIndex(newIdx);
    setSelected(answers[QUESTIONS[newIdx].id] || null);
  };

  return (
    <div className="q-root" data-testid={QUESTION.screen}>
      <div className="q-inner">
        <div className="q-header">
          <button type="button" className="q-back" onClick={goBack} data-testid={QUESTION.backButton} aria-label="Voltar">
            <ChevronLeft size={24} />
          </button>
          <span className="q-step" data-testid={QUESTION.progressLabel}>{index + 1} de {totalQ}</span>
          <span style={{ width: 24 }} />
        </div>

        <div className="q-progress-track">
          <div className="q-progress-fill" style={{ width: `${progressPct}%` }} />
        </div>
        <p className="q-progress-pct">{progressPct}%</p>

        {submitting ? (
          <div className="q-loading" data-testid={QUESTION.loading}>
            <div className="ps-spinner" />
            <p className="q-loading-text">A calcular o seu PontiScore...</p>
          </div>
        ) : (
          <AnimatePresence mode="wait">
            <motion.div
              key={q.id}
              className="q-content"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.28 }}
            >
              <p className="q-pillar">{q.pillar.toUpperCase()}</p>
              <h2 className="q-question" data-testid={`question-text-${q.id}`}>{q.text}</h2>

              <div className="q-options">
                {ANSWER_OPTIONS.map((opt) => {
                  const isSelected = selected === opt.value;
                  return (
                    <button
                      type="button"
                      key={opt.value}
                      data-testid={`question-option-${opt.value}`}
                      onClick={() => onSelect(opt.value)}
                      className={`q-option${isSelected ? " q-option-selected" : ""}`}
                    >
                      <span className={`q-radio${isSelected ? " q-radio-selected" : ""}`}>
                        {isSelected && <Check size={14} />}
                      </span>
                      <span className={`q-option-label${isSelected ? " q-option-label-selected" : ""}`}>
                        {opt.label}
                      </span>
                    </button>
                  );
                })}
              </div>

              {error && <p className="q-error" data-testid={QUESTION.error}>{error}</p>}
            </motion.div>
          </AnimatePresence>
        )}
      </div>
    </div>
  );
}
