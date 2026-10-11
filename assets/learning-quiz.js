/* ============================================================
   学习知识点随机测验
   每个知识点至少三种问法；答对后仍会用不同变式做间隔复测。
   ============================================================ */

(function () {
  const active = {};

  function hash(text) {
    let h = 2166136261;
    String(text).split('').forEach(function (c) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); });
    return h >>> 0;
  }

  function shuffled(list) {
    const out = list.slice();
    for (let i = out.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      const tmp = out[i]; out[i] = out[j]; out[j] = tmp;
    }
    return out;
  }

  function peers(term) {
    const same = window.TERMS.filter(function (x) { return x.id !== term.id && x.stage === term.stage && x.cat === term.cat; });
    const stage = window.TERMS.filter(function (x) { return x.id !== term.id && x.stage === term.stage; });
    return same.concat(stage).filter(function (x, i, arr) { return arr.findIndex(function (y) { return y.id === x.id; }) === i; });
  }

  function makeOptions(questionId, correctText, distractorTexts) {
    const count = 3 + (hash(questionId) % 3);
    const seen = new Set([String(correctText)]);
    const usable = distractorTexts.filter(function (text) {
      text = String(text || '').trim();
      if (!text || seen.has(text)) return false;
      seen.add(text); return true;
    }).slice(0, count - 1);
    while (usable.length < count - 1) usable.push('仅凭模型语气判断，不检查实际任务与证据');
    const raw = [{ id: questionId + '-correct', text: correctText, correct: true }]
      .concat(usable.map(function (text, i) { return { id: questionId + '-d' + (i + 1), text: text, correct: false }; }));
    return shuffled(raw);
  }

  function build(term) {
    const out = [];
    (term.quiz || []).forEach(function (q, index) {
      const id = term.id + '-source-' + (index + 1);
      const extra = peers(term).map(function (x) { return x.one; });
      const options = makeOptions(id, q.options[q.a], q.options.filter(function (_, oi) { return oi !== q.a; }).concat(extra));
      out.push({
        id: id, termId: term.id, variantGroup: term.id, variantType: index ? 'boundary' : 'scenario',
        prompt: q.q, options: options, correctOptionId: options.find(function (x) { return x.correct; }).id, explanation: q.why
      });
    });

    const related = peers(term);
    const definitionId = term.id + '-generated-definition';
    const definitionOptions = makeOptions(definitionId, term.one, related.map(function (x) { return x.one; }));
    out.push({
      id: definitionId, termId: term.id, variantGroup: term.id, variantType: 'definition',
      prompt: '下面哪项最准确地描述「' + term.name + '」？', options: definitionOptions,
      correctOptionId: definitionOptions.find(function (x) { return x.correct; }).id,
      explanation: term.one
    });

    const pmId = term.id + '-generated-pm';
    const pmOptions = makeOptions(pmId, term.pm, related.map(function (x) { return x.pm; }));
    out.push({
      id: pmId, termId: term.id, variantGroup: term.id, variantType: 'tradeoff',
      prompt: '从产品经理视角应用「' + term.name + '」时，哪项判断最准确？', options: pmOptions,
      correctOptionId: pmOptions.find(function (x) { return x.correct; }).id,
      explanation: term.pm
    });

    // 少数知识点原本有两道题；统一只保留三种最有区分度的变式。
    const picked = [];
    ['definition', 'scenario', 'boundary', 'tradeoff'].forEach(function (kind) {
      const q = out.find(function (x) { return x.variantType === kind && picked.indexOf(x) < 0; });
      if (q && picked.length < 3) picked.push(q);
    });
    out.forEach(function (q) { if (picked.length < 3 && picked.indexOf(q) < 0) picked.push(q); });
    return picked;
  }

  const BANK = {};
  window.TERMS.forEach(function (term) { BANK[term.id] = build(term); });

  function state() {
    const mem = window.Mem.state;
    if (!mem.quizVariants || typeof mem.quizVariants !== 'object') mem.quizVariants = {};
    return mem.quizVariants;
  }

  function record(termId) {
    const all = state();
    if (!all[termId]) all[termId] = { answered: {}, recentIds: [], correct: 0, wrong: 0 };
    return all[termId];
  }

  function pick(termId) {
    if (active[termId]) return active[termId];
    const rec = record(termId);
    const bank = BANK[termId] || [];
    const recent = new Set((rec.recentIds || []).slice(-2));
    let candidates = bank.filter(function (q) { return !recent.has(q.id); });
    if (!candidates.length) candidates = bank.slice();
    candidates.sort(function (a, b) {
      const aa = rec.answered[a.id] || { attempts: 0, lastAt: 0 };
      const bb = rec.answered[b.id] || { attempts: 0, lastAt: 0 };
      if (aa.attempts !== bb.attempts) return aa.attempts - bb.attempts;
      return aa.lastAt - bb.lastAt;
    });
    const leastAttempts = candidates.length ? (rec.answered[candidates[0].id] || { attempts: 0 }).attempts : 0;
    const pool = candidates.filter(function (q) { return (rec.answered[q.id] || { attempts: 0 }).attempts === leastAttempts; });
    const base = pool[Math.floor(Math.random() * pool.length)] || bank[0];
    if (!base) return null;
    active[termId] = Object.assign({}, base, {
      review: rec.correct > 0,
      options: shuffled(base.options.map(function (o) { return { id: o.id, text: o.text }; }))
    });
    return active[termId];
  }

  function answer(termId, questionId, optionId) {
    const q = (BANK[termId] || []).find(function (x) { return x.id === questionId; });
    if (!q) return null;
    const rec = record(termId);
    const ok = optionId === q.correctOptionId;
    const qr = rec.answered[q.id] || { attempts: 0, correct: 0, wrong: 0, lastAt: 0 };
    qr.attempts++; if (ok) qr.correct++; else qr.wrong++; qr.lastAt = Date.now();
    rec.answered[q.id] = qr;
    if (ok) rec.correct++; else rec.wrong++;
    rec.recentIds = (rec.recentIds || []).concat(q.id).slice(-6);
    delete active[termId];
    window.Mem.save();
    return { correct: ok, correctOptionId: q.correctOptionId, explanation: q.explanation };
  }

  function dayKey() {
    const d = new Date();
    return d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate();
  }

  function startDaily(termIds) {
    const mem = window.Mem.state;
    const today = dayKey();
    const existing = mem.dailyLearning;
    if (existing && existing.date === today && !existing.completedAt) return existing;
    const unique = Array.from(new Set((termIds || []).filter(function (id) { return BANK[id]; })));
    mem.dailyLearning = {
      date: today, startedAt: Date.now(), completedAt: 0, index: 0,
      questions: unique.map(function (termId) {
        const q = pick(termId);
        return { termId: termId, questionId: q.id, review: q.review, optionIds: q.options.map(function (o) { return o.id; }) };
      }),
      responses: [], feedback: null, result: null
    };
    window.Mem.save(); return mem.dailyLearning;
  }

  function daily() {
    const s = window.Mem.state.dailyLearning;
    return s && s.date === dayKey() ? s : null;
  }

  function dailyQuestion() {
    const s = daily();
    if (!s || s.completedAt || !s.questions[s.index]) return null;
    const ref = s.questions[s.index];
    const base = (BANK[ref.termId] || []).find(function (q) { return q.id === ref.questionId; });
    if (!base) return null;
    const byId = {};
    base.options.forEach(function (o) { byId[o.id] = { id: o.id, text: o.text }; });
    return Object.assign({}, base, {
      review: !!ref.review,
      options: (ref.optionIds || base.options.map(function (o) { return o.id; })).map(function (id) { return byId[id]; }).filter(Boolean)
    });
  }

  function answerDaily(optionId) {
    const s = daily();
    const q = dailyQuestion();
    if (!s || !q || s.feedback) return null;
    const result = answer(q.termId, q.id, optionId);
    const term = window.TERMS.find(function (x) { return x.id === q.termId; });
    window.Mem.completeDailyQuiz(q.termId, term.cat, result.correct);
    const response = { termId: q.termId, questionId: q.id, correct: result.correct, at: Date.now() };
    s.responses.push(response);
    s.feedback = { termId: q.termId, correct: result.correct, selectedOptionId: String(optionId), correctOptionId: result.correctOptionId, explanation: result.explanation };
    window.Mem.save(); return s.feedback;
  }

  function nextDaily() {
    const s = daily();
    if (!s || !s.feedback) return s;
    s.feedback = null;
    s.index++;
    if (s.index >= s.questions.length) {
      const correct = s.responses.filter(function (x) { return x.correct; }).length;
      s.completedAt = Date.now();
      s.result = { correct: correct, total: s.responses.length, score: s.responses.length ? Math.round(correct / s.responses.length * 100) : 0, at: Date.now() };
    }
    window.Mem.save(); return s;
  }

  function dailyResult() {
    const s = daily(); return s && s.result ? s.result : null;
  }

  window.LEARNING_QUIZ_BANK = BANK;
  window.LearningQuiz = {
    pick: pick, answer: answer, bank: function (termId) { return (BANK[termId] || []).slice(); },
    startDaily: startDaily, daily: daily, dailyQuestion: dailyQuestion,
    answerDaily: answerDaily, nextDaily: nextDaily, dailyResult: dailyResult
  };
})();
