/* PontiScore — vanilla SPA logic (HTML/CSS/JS + PHP backend) */
(function () {
  "use strict";

  var API = "api/"; // PHP endpoints live in ./api/ (same folder as index.html)

  var ANSWER_OPTIONS = [
    { value: "sim", label: "Sim" },
    { value: "grande_parte", label: "Em grande parte" },
    { value: "parcialmente", label: "Parcialmente" },
    { value: "nao", label: "Não" },
  ];

  var QUESTIONS = [
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

  // ---- helpers ----
  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function refreshIcons() { if (window.lucide) window.lucide.createIcons(); }

  var views = {
    landing: document.getElementById("view-landing"),
    quiz: document.getElementById("view-quiz"),
    dash: document.getElementById("view-dash"),
    ty: document.getElementById("view-ty"),
  };

  function show(name) {
    Object.keys(views).forEach(function (k) {
      views[k].classList.toggle("is-active", k === name);
    });
    window.scrollTo(0, 0);
    refreshIcons();
  }

  // ---- state ----
  var state = { index: 0, answers: {}, selected: null, submitting: false, error: null, result: null };

  // ================= QUIZ =================
  function renderQuiz() {
    var q = QUESTIONS[state.index];
    var total = QUESTIONS.length;
    var pct = Math.round(((state.index + 1) / total) * 100);
    var el = views.quiz;

    if (state.submitting) {
      el.innerHTML =
        '<div class="quiz__inner">' +
          quizHeader(total) + progress(pct) +
          '<div class="quiz__loading" data-testid="question-loading">' +
            '<div class="ps-spinner" aria-hidden></div>' +
            '<p class="quiz__loading-text">A calcular o PontiScore…</p>' +
          "</div>" +
        "</div>";
      refreshIcons();
      return;
    }

    var opts = ANSWER_OPTIONS.map(function (opt) {
      var sel = state.selected === opt.value;
      return (
        '<button type="button" class="quiz__option' + (sel ? " is-selected" : "") + '"' +
        ' data-answer="' + opt.value + '" data-testid="question-option-' + opt.value + '" aria-pressed="' + sel + '">' +
          '<span class="quiz__radio">' + (sel ? '<i data-lucide="check"></i>' : "") + "</span>" +
          "<span>" + esc(opt.label) + "</span>" +
        "</button>"
      );
    }).join("");

    el.innerHTML =
      '<div class="quiz__inner">' +
        quizHeader(total) + progress(pct) +
        '<div class="quiz__content quiz__animate">' +
          '<p class="quiz__pillar">' + esc(q.pillar) + "</p>" +
          '<h2 class="quiz__question" data-testid="question-text-' + q.id + '">' + esc(q.text) + "</h2>" +
          '<div class="quiz__options">' + opts + "</div>" +
          (state.error ? '<p class="quiz__error" data-testid="question-error">' + esc(state.error) + "</p>" : "") +
        "</div>" +
      "</div>";

    el.querySelector(".quiz__back").addEventListener("click", goBack);
    Array.prototype.forEach.call(el.querySelectorAll("[data-answer]"), function (b) {
      b.addEventListener("click", function () { onSelect(b.getAttribute("data-answer")); });
    });
    refreshIcons();
  }

  function quizHeader(total) {
    return (
      '<div class="quiz__header">' +
        '<button type="button" class="quiz__back" aria-label="Voltar" data-testid="question-back-button"><i data-lucide="chevron-left"></i></button>' +
        '<span class="quiz__step" data-testid="question-progress-label">' + (state.index + 1) + " de " + total + "</span>" +
        '<span style="width:40px"></span>' +
      "</div>"
    );
  }
  function progress(pct) {
    return (
      '<div class="quiz__progress-track"><div class="quiz__progress-fill" style="width:' + pct + '%"></div></div>' +
      '<p class="quiz__progress-pct">' + pct + "%</p>"
    );
  }

  function onSelect(val) {
    state.selected = val;
    state.answers[QUESTIONS[state.index].id] = val;
    renderQuiz();
    window.setTimeout(function () {
      if (state.index < QUESTIONS.length - 1) {
        state.index += 1;
        state.selected = null;
        renderQuiz();
      } else {
        submitDiagnostic();
      }
    }, 260);
  }

  function goBack() {
    if (state.submitting) return;
    if (state.index === 0) { show("landing"); return; }
    state.index -= 1;
    state.selected = state.answers[QUESTIONS[state.index].id] || null;
    renderQuiz();
  }

  function submitDiagnostic() {
    state.submitting = true;
    state.error = null;
    renderQuiz();
    var payload = {
      answers: QUESTIONS.map(function (q) { return { question_id: q.id, value: state.answers[q.id] }; }),
    };
    fetch(API + "diagnostic.php", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    })
      .then(function (r) { return r.json().then(function (d) { return { ok: r.ok, d: d }; }); })
      .then(function (res) {
        if (!res.ok) throw new Error((res.d && res.d.error) || "Erro ao calcular o PontiScore");
        state.result = res.d;
        state.submitting = false;
        renderDashboard();
        show("dash");
      })
      .catch(function (e) {
        state.submitting = false;
        state.error = e.message || "Erro ao calcular o PontiScore";
        renderQuiz();
      });
  }

  function startQuiz() {
    state = { index: 0, answers: {}, selected: null, submitting: false, error: null, result: null };
    renderQuiz();
    show("quiz");
  }

  // ================= DASHBOARD =================
  function gaugeSvg(score) {
    var size = 220, sw = 16, r = (size - sw) / 2;
    var circ = 2 * Math.PI * r;
    var arc = circ * 0.75;
    var filled = arc * (Math.max(0, Math.min(100, score)) / 100);
    var color = score >= 80 ? "var(--c-brand)" : score >= 60 ? "var(--c-brand-secondary)" : score >= 40 ? "var(--c-warning)" : "var(--c-error)";
    return (
      '<div style="position:relative;width:' + size + "px;height:" + size + 'px;display:flex;align-items:center;justify-content:center">' +
        '<svg width="' + size + '" height="' + size + '" viewBox="0 0 ' + size + " " + size + '" aria-hidden="true">' +
          '<g transform="rotate(135 ' + size / 2 + " " + size / 2 + ')">' +
            '<circle cx="' + size / 2 + '" cy="' + size / 2 + '" r="' + r + '" stroke="var(--c-surface-tertiary)" stroke-width="' + sw + '" fill="none" stroke-dasharray="' + arc + " " + circ + '" stroke-linecap="round"></circle>' +
            '<circle cx="' + size / 2 + '" cy="' + size / 2 + '" r="' + r + '" stroke="' + color + '" stroke-width="' + sw + '" fill="none" stroke-dasharray="' + filled + " " + circ + '" stroke-linecap="round" style="transition:stroke-dasharray 900ms cubic-bezier(0.2,0.8,0.2,1)"></circle>' +
          "</g>" +
        "</svg>" +
        '<div style="position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center">' +
          '<span style="font-size:60px;font-weight:800;line-height:1;color:var(--c-on-surface)">' + Math.round(score) + "</span>" +
          '<span style="font-size:13px;color:var(--c-on-surface-secondary);margin-top:4px;font-weight:500">/ 100</span>' +
        "</div>" +
      "</div>"
    );
  }

  function renderDashboard() {
    var res = state.result;
    var pillars = res.pillar_scores.map(function (p) {
      return (
        '<div class="dash__pillar-row" data-testid="pillar-' + esc(p.key) + '">' +
          '<div style="flex:1">' +
            '<p class="dash__pillar-label">' + esc(p.label) + "</p>" +
            '<div class="dash__pillar-bar-track"><div class="dash__pillar-bar-fill" style="width:' + p.score + '%"></div></div>' +
          "</div>" +
          '<span class="dash__pillar-score">' + p.score + "</span>" +
        "</div>"
      );
    }).join("");

    var strengths = res.strengths.length
      ? res.strengths.map(function (s) { return '<p class="dash__sw-item">• ' + esc(s) + "</p>"; }).join("")
      : '<p class="dash__sw-empty">Ainda sem pontos fortes destacados.</p>';
    var weaknesses = res.weaknesses.length
      ? res.weaknesses.map(function (s) { return '<p class="dash__sw-item">• ' + esc(s) + "</p>"; }).join("")
      : '<p class="dash__sw-empty">Sem pontos críticos.</p>';

    var recs = res.recommendations.map(function (r, i) {
      return '<div class="dash__rec-item"><div class="dash__rec-num">' + (i + 1) + '</div><p class="dash__rec-text">' + esc(r) + "</p></div>";
    }).join("");

    var benefits = ["Prioridades para os próximos 30 dias", "Oportunidades de alcance e interação", "Estratégia de geração de contactos"]
      .map(function (b) { return '<li class="dash__benefit"><i data-lucide="check-circle-2"></i>' + esc(b) + "</li>"; }).join("");

    views.dash.className = "dash view is-active";
    views.dash.innerHTML =
      '<div class="dash__inner">' +
        '<header class="dash__header"><p class="dash__eyebrow">PONTISCORE</p>' +
          '<button type="button" class="dash__close" aria-label="Voltar ao início" data-nav="landing" data-testid="dashboard-home-button"><i data-lucide="x"></i></button>' +
        "</header>" +
        '<section class="dash__gauge ps-anim-in">' + gaugeSvg(res.total_score) +
          '<p class="dash__tier" data-testid="dashboard-tier">' + esc(res.tier) + "</p></section>" +
        '<section class="ps-anim-in ps-delay-2"><h3 class="dash__section-title">Pontuação por Pilar</h3>' +
          '<div class="dash__pillar-list">' + pillars + "</div></section>" +
        '<section class="dash__sw-row ps-anim-in ps-delay-3">' +
          '<div class="dash__sw-card dash__sw-card--strength"><div class="dash__sw-header"><i data-lucide="trending-up"></i>Pontos Fortes</div>' + strengths + "</div>" +
          '<div class="dash__sw-card dash__sw-card--weak"><div class="dash__sw-header"><i data-lucide="alert-circle"></i>Pontos Fracos</div>' + weaknesses + "</div>" +
        "</section>" +
        '<section class="ps-anim-in ps-delay-4"><h3 class="dash__section-title">Recomendações Personalizadas</h3>' +
          '<div class="dash__rec-list">' + recs + "</div></section>" +
        '<div class="dash__report-note ps-anim-in ps-delay-4"><i data-lucide="file-text"></i>' +
          "<p>Este é o seu relatório automático. Preencha os dados abaixo para receber o relatório completo por email + Sessão Estratégica gratuita.</p></div>" +
        leadFormHtml(benefits) +
      "</div>" +
      footerHtml();

    // wire events
    Array.prototype.forEach.call(views.dash.querySelectorAll("[data-nav]"), function (b) {
      b.addEventListener("click", function () { show(b.getAttribute("data-nav")); });
    });
    var form = views.dash.querySelector("#lead-form");
    var submitBtn = views.dash.querySelector('[data-testid="lead-submit-button"]');
    var privacy = views.dash.querySelector('[data-testid="lead-privacy-checkbox"]');
    privacy.addEventListener("change", function () { submitBtn.disabled = !privacy.checked; });
    form.addEventListener("submit", onLeadSubmit);
    refreshIcons();
  }

  function leadFormHtml(benefits) {
    return (
      '<form class="dash__lead ps-anim-in ps-delay-5" id="lead-form" data-testid="lead-form" novalidate>' +
        '<p class="dash__lead-eyebrow">OFERTA GRATUITA</p>' +
        '<h3 class="dash__lead-title">O seu diagnóstico está concluído</h3>' +
        '<p class="dash__lead-subtitle">Receba gratuitamente uma Sessão Estratégica + Plano de Crescimento Personalizado.</p>' +
        '<ul class="dash__benefits" style="list-style:none;padding:0;margin:0">' + benefits + "</ul>" +
        '<div class="dash__form-grid">' +
          formGroup("lead-name", "Nome", "O seu nome", "text", "lead-name-input") +
          formGroup("lead-company", "Empresa", "Nome da empresa", "text", "lead-company-input") +
          formGroup("lead-email", "Email", "email@empresa.pt", "email", "lead-email-input") +
          formGroup("lead-phone", "Telefone (opcional)", "+351 900 000 000", "tel", "lead-phone-input") +
        "</div>" +
        '<div class="dash__consents">' +
          '<label class="dash__consent" data-testid="lead-privacy-label">' +
            '<input type="checkbox" class="dash__consent-input" data-testid="lead-privacy-checkbox" aria-required="true" required />' +
            '<span class="dash__consent-text">Li e aceito a <a href="privacidade.html" target="_blank" rel="noreferrer" class="dash__consent-link" data-testid="lead-privacy-link">Política de Privacidade</a> e autorizo o tratamento dos meus dados para receber o relatório PontiScore.<span class="dash__required" aria-hidden> *</span></span>' +
          "</label>" +
          '<label class="dash__consent" data-testid="lead-marketing-label">' +
            '<input type="checkbox" class="dash__consent-input" data-testid="lead-marketing-checkbox" />' +
            '<span class="dash__consent-text">Pretendo receber dicas, novidades e conteúdos sobre marketing digital da PontiScore.</span>' +
          "</label>" +
        "</div>" +
        '<p class="dash__form-error" data-testid="lead-form-error" style="display:none"></p>' +
        '<button type="submit" class="dash__submit" data-testid="lead-submit-button" disabled>' +
          '<span class="dash__submit-label">Quero Receber a Minha Sessão Estratégica</span> <i data-lucide="arrow-right"></i>' +
        "</button>" +
        '<p class="dash__form-disclaimer" data-testid="lead-disclaimer">Os seus dados serão tratados de forma confidencial e utilizados apenas para gerar o seu relatório, prestar os serviços da PontiScore e, caso autorize, enviar comunicações futuras.</p>' +
        '<p class="dash__form-hint">Sem compromisso. Resposta em 24h úteis.</p>' +
      "</form>"
    );
  }

  function formGroup(id, label, placeholder, type, testid) {
    return (
      '<div class="dash__form-group">' +
        '<label for="' + id + '" class="dash__form-label">' + esc(label) + "</label>" +
        '<input id="' + id + '" type="' + type + '" class="dash__input" placeholder="' + esc(placeholder) + '" data-testid="' + testid + '" />' +
      "</div>"
    );
  }

  function onLeadSubmit(e) {
    e.preventDefault();
    var res = state.result;
    if (!res) return;
    var root = views.dash;
    var name = root.querySelector("#lead-name").value.trim();
    var company = root.querySelector("#lead-company").value.trim();
    var email = root.querySelector("#lead-email").value.trim();
    var phone = root.querySelector("#lead-phone").value.trim();
    var privacy = root.querySelector('[data-testid="lead-privacy-checkbox"]').checked;
    var marketing = root.querySelector('[data-testid="lead-marketing-checkbox"]').checked;
    var errEl = root.querySelector('[data-testid="lead-form-error"]');
    var btn = root.querySelector('[data-testid="lead-submit-button"]');

    function err(m) { errEl.textContent = m; errEl.style.display = "block"; }
    errEl.style.display = "none";

    if (!name) return err("Introduza o seu nome");
    if (!company) return err("Introduza o nome da empresa");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return err("Email inválido");
    if (!privacy) return err("Deve aceitar a Política de Privacidade para receber o relatório");

    btn.disabled = true;
    btn.innerHTML = '<span class="ps-spinner on-dark" aria-hidden style="width:22px;height:22px;border-width:2px"></span>';

    fetch(API + "lead.php", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: name, company: company, email: email, phone: phone || null,
        diagnostic_id: res.id, privacy_accepted: privacy, marketing_accepted: marketing,
      }),
    })
      .then(function (r) { return r.json().then(function (d) { return { ok: r.ok, d: d }; }); })
      .then(function (out) {
        if (!out.ok) throw new Error((out.d && out.d.error) || "Erro ao submeter formulário");
        show("ty");
      })
      .catch(function (ex) {
        btn.disabled = false;
        btn.innerHTML = '<span class="dash__submit-label">Quero Receber a Minha Sessão Estratégica</span> <i data-lucide="arrow-right"></i>';
        refreshIcons();
        err(ex.message || "Erro ao submeter formulário");
      });
  }

  function footerHtml() {
    return (
      '<footer class="footer"><div class="footer__inner">' +
        '<ul class="footer__links">' +
          '<li><a href="privacidade.html" class="footer__link">Política de Privacidade</a></li>' +
          '<li><a href="termos.html" class="footer__link">Termos de Utilização</a></li>' +
          '<li><a href="mailto:contacto@pontiscore.pt" class="footer__link">Contacto</a></li>' +
        "</ul>" +
        '<p class="footer__copy">© ' + new Date().getFullYear() + " PontiScore</p>" +
      "</div></footer>"
    );
  }

  // ================= boot =================
  document.addEventListener("click", function (e) {
    var t = e.target.closest ? e.target.closest("[data-nav]") : null;
    if (!t) return;
    var nav = t.getAttribute("data-nav");
    if (nav === "diagnostico") { startQuiz(); }
    else { show(nav); }
  });

  Array.prototype.forEach.call(document.querySelectorAll("[data-year]"), function (el) {
    el.textContent = new Date().getFullYear();
  });

  refreshIcons();
})();
