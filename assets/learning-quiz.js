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
    const byId = new Map(window.TERMS.map(function (x) { return [x.id, x]; }));
    const related = (term.related || []).map(function (id) { return byId.get(id); }).filter(Boolean);
    const same = window.TERMS.filter(function (x) { return x.stage === term.stage && x.cat === term.cat; });
    const category = window.TERMS.filter(function (x) { return x.cat === term.cat; });
    const stage = window.TERMS.filter(function (x) { return x.stage === term.stage; });
    return related.concat(same, category, stage).filter(function (x, i, arr) {
      return x.id !== term.id && arr.findIndex(function (y) { return y.id === x.id; }) === i;
    });
  }

  function makeOptions(questionId, correctText, distractorTexts) {
    const count = Math.min(3 + (hash(questionId) % 3), distractorTexts.length + 1);
    const seen = new Set([String(correctText)]);
    const usable = distractorTexts.filter(function (text) {
      text = String(text || '').trim();
      if (!text || seen.has(text)) return false;
      seen.add(text); return true;
    }).slice(0, count - 1);
    if (usable.length < 2) throw new Error('题目缺少足够的专属干扰项：' + questionId);
    const raw = [{ id: questionId + '-correct', text: correctText, correct: true }]
      .concat(usable.map(function (text, i) { return { id: questionId + '-d' + (i + 1), text: text, correct: false }; }));
    return shuffled(raw);
  }

  function build(term) {
    const out = [];
    (term.quiz || []).forEach(function (q, index) {
      const id = term.id + '-source-' + (index + 1);
      // 原题只使用针对本题写过的选项，不拼接其他知识点的定义凑数量。
      const sourceOptions = q.options.length >= 3 ? q.options : q.options.concat(
        term.id === 'model' ? ['不会，因为上线后的模型不能再读取外部资料'] : []);
      const options = Array.isArray(q.reasons) ? sourceOptions.map(function (text, oi) {
        return { id: id + '-o' + (oi + 1), text: text, correct: oi === q.a, reason: q.reasons[oi] || q.why };
      }) : makeOptions(id, sourceOptions[q.a], sourceOptions.filter(function (_, oi) { return oi !== q.a; }));
      out.push({
        id: id, termId: term.id, variantGroup: term.id, variantType: q.variantType || (index ? 'boundary' : 'scenario'),
        prompt: q.q, options: options, correctOptionId: options.find(function (x) { return x.correct; }).id, explanation: q.why
      });
    });

    const related = peers(term);
    const short = window.TERM_QUIZ_SHORT || {};
    const display = function (item, field, fallback) {
      return short[item.id] && short[item.id][field] || fallback;
    };
    const definitionId = term.id + '-generated-definition';
    const definitionOptions = makeOptions(definitionId, term.one, related.map(function (x) { return x.one; }));
    out.push({
      id: definitionId, termId: term.id, variantGroup: term.id, variantType: 'definition',
      prompt: '下面哪项最准确地描述「' + term.name + '」？', options: definitionOptions,
      correctOptionId: definitionOptions.find(function (x) { return x.correct; }).id,
      explanation: term.one
    });

    const pmId = term.id + '-generated-pm';
    const pmOptions = makeOptions(pmId, display(term, 'pm', term.pm), related.map(function (x) { return display(x, 'pm', x.pm); }));
    out.push({
      id: pmId, termId: term.id, variantGroup: term.id, variantType: 'tradeoff',
      prompt: '从产品经理视角应用「' + term.name + '」时，哪项判断最准确？', options: pmOptions,
      correctOptionId: pmOptions.find(function (x) { return x.correct; }).id,
      explanation: term.pm
    });

    const mechanismId = term.id + '-generated-mechanism';
    const mechanism = term.steps && term.steps[0] ? term.steps[0] : term.one;
    const mechanismOptions = makeOptions(mechanismId, display(term, 'mechanism', mechanism), related.map(function (x) {
      return display(x, 'mechanism', x.steps && x.steps[0] || x.one);
    }));
    out.push({
      id: mechanismId, termId: term.id, variantGroup: term.id, variantType: 'mechanism',
      prompt: '下面哪项更准确地说明「' + term.name + '」如何工作？', options: mechanismOptions,
      correctOptionId: mechanismOptions.find(function (x) { return x.correct; }).id,
      explanation: mechanism
    });

    const boundaryId = term.id + '-generated-pitfall';
    const pitfall = term.pitfalls && term.pitfalls[0] ? term.pitfalls[0] : term.pm;
    const boundaryOptions = makeOptions(boundaryId, pitfall, related.map(function (x) { return x.pitfalls && x.pitfalls[0] || x.pm; }));
    out.push({
      id: boundaryId, termId: term.id, variantGroup: term.id, variantType: 'pitfall',
      prompt: '应用「' + term.name + '」时，哪种误区最需要警惕？', options: boundaryOptions,
      correctOptionId: boundaryOptions.find(function (x) { return x.correct; }).id,
      explanation: pitfall
    });

    // 保留旧题 ID 和历史；核心 50 题的场景题进入同一知识点随机池。
    const picked = [];
    ['definition', 'scenario', 'boundary', 'tradeoff', 'mechanism', 'pitfall'].forEach(function (kind) {
      const q = out.find(function (x) { return x.variantType === kind && picked.indexOf(x) < 0; });
      if (q && picked.length < 5) picked.push(q);
    });
    out.forEach(function (q) { if (picked.length < 5 && picked.indexOf(q) < 0) picked.push(q); });
    return picked.concat((window.CORE50_DAILY || []).filter(function (q) { return q.termId === term.id; }));
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
      options: shuffled(base.options.map(function (o) { return { id: o.id, text: o.text, reason: o.reason || '' }; }))
    });
    return active[termId];
  }

  function answer(termId, questionId, optionId, source) {
    const q = (BANK[termId] || []).find(function (x) { return x.id === questionId; });
    if (!q) return null;
    const term = window.TERMS.find(function (x) { return x.id === termId; });
    const selectedOption = (q.options || []).find(function (x) { return x.id === optionId; });
    const correctOption = (q.options || []).find(function (x) { return x.id === q.correctOptionId; });
    if (!selectedOption) return null;
    const rec = record(termId);
    const ok = optionId === q.correctOptionId;
    const qr = rec.answered[q.id] || { attempts: 0, correct: 0, wrong: 0, lastAt: 0 };
    qr.attempts++; if (ok) qr.correct++; else qr.wrong++; qr.lastAt = Date.now();
    rec.answered[q.id] = qr;
    if (ok) rec.correct++; else rec.wrong++;
    rec.recentIds = (rec.recentIds || []).concat(q.id).slice(-6);
    delete active[termId];
    if (window.SpacedReview) window.SpacedReview.record(termId, q.id, q.variantType, ok, source || 'term');
    if (window.LearnerMemory) window.LearnerMemory.recordAnswer(q, optionId, ok, source || 'term');
    if (!ok && window.Mentor) window.Mentor.recordQuizWrong(termId, q.prompt, selectedOption.text);
    window.Mem.save();
    return Object.assign({
      correct: ok, correctOptionId: q.correctOptionId,
      selectedOptionText: selectedOption ? selectedOption.text : '',
      correctOptionText: correctOption ? correctOption.text : '',
      explanation: q.explanation,
      conceptName: term ? term.name : termId,
      conceptSummary: term ? term.one : '',
      pmView: term ? term.pm : '',
      pitfall: term && term.pitfalls && term.pitfalls.length ? term.pitfalls[0] : ''
    }, window.Explanations ? window.Explanations.learning(q, term, optionId) : {});
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
    if (!s || s.date !== dayKey()) return null;
    if (!s.completedAt && s.feedback && s.responses.length === s.questions.length) {
      finishSession(s);
      window.Mem.save();
    }
    return s;
  }

  function dailyQuestion() {
    const s = daily();
    if (!s || (s.completedAt && !s.feedback) || !s.questions[s.index]) return null;
    return resolveQuestion(s.questions[s.index]);
  }

  function finishSession(s) {
    if (!s || s.completedAt || !s.questions.length || s.responses.length !== s.questions.length) return s;
    const correct = s.responses.filter(function (x) { return x.correct; }).length;
    s.completedAt = Date.now();
    s.result = { correct: correct, total: s.responses.length,
      score: Math.round(correct / s.responses.length * 100), at: s.completedAt };
    return s;
  }

  function resolveQuestion(ref) {
    if (!ref) return null;
    const base = (BANK[ref.termId] || []).find(function (q) { return q.id === ref.questionId; });
    if (!base) return null;
    const byId = {};
    base.options.forEach(function (o) { byId[o.id] = { id: o.id, text: o.text, reason: o.reason || '' }; });
    return Object.assign({}, base, {
      review: !!ref.review,
      options: (ref.optionIds || base.options.map(function (o) { return o.id; })).map(function (id) { return byId[id]; }).filter(Boolean)
    });
  }

  function answerDaily(optionId) {
    const s = daily();
    const q = dailyQuestion();
    if (!s || !q || s.feedback) return null;
    const result = answer(q.termId, q.id, optionId, 'daily');
    if (!result) return null;
    const term = window.TERMS.find(function (x) { return x.id === q.termId; });
    window.Mem.completeDailyQuiz(q.termId, term.cat, result.correct);
    const response = { termId: q.termId, questionId: q.id, selectedOptionId: String(optionId), correct: result.correct, at: Date.now() };
    s.responses.push(response);
    s.feedback = Object.assign({
      termId: q.termId, questionId: q.id, selectedOptionId: String(optionId)
    }, result);
    finishSession(s);
    window.Mem.save(); return s.feedback;
  }

  function nextDaily() {
    const s = daily();
    if (!s || !s.feedback) return s;
    s.feedback = null;
    if (s.completedAt) { window.Mem.save(); return s; }
    s.index++;
    finishSession(s);
    window.Mem.save(); return s;
  }

  function dailyResult() {
    const s = daily(); return s && s.result ? s.result : null;
  }

  function practice() {
    const s = window.Mem.state.learningPractice || null;
    if (s && !s.completedAt && s.feedback && s.responses.length === s.questions.length) {
      finishSession(s);
      window.Mem.save();
    }
    if (s && s.completedAt && s.result) recordPracticeRound(s);
    return s;
  }

  function recordPracticeRound(s) {
    const mem = window.Mem.state;
    if (!Array.isArray(mem.practiceRounds)) mem.practiceRounds = [];
    const id = s.id || ('legacy-' + s.startedAt);
    if (mem.practiceRounds.some(function (round) { return round.id === id; })) return;
    const round = {
      id: id, date: s.date, sourceDailyDate: s.sourceDailyDate || '',
      startedAt: s.startedAt, completedAt: s.completedAt,
      focusIds: (s.focusIds || []).slice(),
      responses: (s.responses || []).map(function (r) { return {
        termId: r.termId, questionId: r.questionId, selectedOptionId: r.selectedOptionId || '',
        correct: !!r.correct, at: r.at
      }; }),
      result: { correct: s.result.correct, total: s.result.total, score: s.result.score }
    };
    mem.practiceRounds.push(round);
    mem.practiceRounds = mem.practiceRounds.slice(-100);
    window.Mem.save();
  }

  function startPractice(termIds, options) {
    const unique = Array.from(new Set((termIds || []).filter(function (id) { return BANK[id]; })));
    if (!unique.length) return null;
    options = options || {};
    const existing = practice();
    if (existing && !existing.completedAt && existing.date === dayKey() &&
        existing.focusIds.length === unique.length &&
        existing.focusIds.every(function (id) { return unique.indexOf(id) >= 0; })) return existing;
    const questions = [];
    unique.forEach(function (termId) {
      const rec = record(termId);
      const recent = new Set((rec.recentIds || []).slice(-2));
      const bank = BANK[termId];
      const ranked = shuffled(bank).sort(function (a, b) {
        const aa = rec.answered[a.id] || { attempts: 0, lastAt: 0 };
        const bb = rec.answered[b.id] || { attempts: 0, lastAt: 0 };
        return (recent.has(a.id) - recent.has(b.id)) || aa.attempts - bb.attempts || aa.lastAt - bb.lastAt;
      });
      const first = ranked[0];
      const second = ranked.find(function (q) { return q.id !== first.id && q.variantType !== first.variantType; }) || ranked[1];
      [first, second].filter(Boolean).forEach(function (q) {
        questions.push({ termId: termId, questionId: q.id, review: true, optionIds: shuffled(q.options.map(function (o) { return o.id; })) });
      });
    });
    window.Mem.state.learningPractice = {
      id: 'practice-' + Date.now() + '-' + Math.floor(Math.random() * 1000000),
      date: dayKey(), sourceDailyDate: options.sourceDailyDate || '', startedAt: Date.now(), completedAt: 0, index: 0,
      focusIds: unique, questions: shuffled(questions), responses: [], feedback: null, result: null
    };
    window.Mem.save(); return practice();
  }

  function practiceQuestion() {
    const s = practice();
    return s && (!s.completedAt || s.feedback) ? resolveQuestion(s.questions[s.index]) : null;
  }

  function answerPractice(optionId) {
    const s = practice(), q = practiceQuestion();
    if (!s || !q || s.feedback) return null;
    const result = answer(q.termId, q.id, optionId, 'practice');
    if (!result) return null;
    const term = window.TERMS.find(function (x) { return x.id === q.termId; });
    if (window.Mem.quiz && term) window.Mem.quiz(q.termId, term.cat, result.correct);
    s.responses.push({ termId: q.termId, questionId: q.id, selectedOptionId: String(optionId), correct: result.correct, at: Date.now() });
    s.feedback = Object.assign({ termId: q.termId, questionId: q.id, selectedOptionId: String(optionId) }, result);
    finishSession(s);
    if (s.completedAt) recordPracticeRound(s);
    window.Mem.save(); return s.feedback;
  }

  function nextPractice() {
    const s = practice();
    if (!s || !s.feedback) return s;
    s.feedback = null;
    if (s.completedAt) { window.Mem.save(); return s; }
    s.index++;
    finishSession(s);
    if (s.completedAt) recordPracticeRound(s);
    window.Mem.save(); return s;
  }

  function reinforcementProgress() {
    const today = daily();
    if (!today || !today.result) return null;
    practice(); // 旧版停在最后一题解析时补记已完成轮次。
    const wrongIds = Array.from(new Set((today.responses || []).filter(function (r) { return !r.correct; }).map(function (r) { return r.termId; })));
    const rounds = (window.Mem.state.practiceRounds || []).filter(function (round) {
      if (round.date !== today.date || !round.completedAt) return false;
      if (round.sourceDailyDate === today.date) return true;
      // 兼容升级前已完成、且刚好针对当天全部错题的巩固记录。
      return !round.sourceDailyDate && String(round.id || '').indexOf('legacy-') === 0 && wrongIds.length > 0 &&
        round.focusIds && round.focusIds.length === wrongIds.length &&
        round.focusIds.every(function (id) { return wrongIds.indexOf(id) >= 0; });
    });
    const perTerm = wrongIds.map(function (id) {
      const attempts = rounds.map(function (round) {
        const answers = (round.responses || []).filter(function (r) { return r.termId === id; });
        return answers.length ? { correct: answers.filter(function (r) { return r.correct; }).length, total: answers.length, at: round.completedAt } : null;
      }).filter(Boolean);
      const correct = attempts.reduce(function (n, x) { return n + x.correct; }, 0);
      const total = attempts.reduce(function (n, x) { return n + x.total; }, 0);
      return { termId: id, rounds: attempts.length, correct: correct, total: total,
        score: total ? Math.round(correct / total * 100) : null,
        lastRoundCorrect: attempts.length ? attempts[attempts.length - 1].correct === attempts[attempts.length - 1].total : false };
    });
    const completedRounds = perTerm.length ? Math.min.apply(null, perTerm.map(function (x) { return x.rounds; })) : 0;
    const correct = perTerm.reduce(function (n, x) { return n + x.correct; }, 0);
    const total = perTerm.reduce(function (n, x) { return n + x.total; }, 0);
    return { wrongIds: wrongIds, perTerm: perTerm, completedRounds: completedRounds,
      verified: !!perTerm.length && perTerm.every(function (x) { return x.rounds >= 2; }),
      score: total ? Math.round(correct / total * 100) : null,
      needsWork: perTerm.filter(function (x) { return x.rounds < 2 || !x.lastRoundCorrect || x.score < 80; }).map(function (x) { return x.termId; }),
      latestRound: rounds.slice().sort(function (a, b) { return b.completedAt - a.completedAt; })[0] || null };
  }

  function spaced() { return window.Mem.state.spacedSession || null; }

  function pickSpaced(id) {
    const bank = BANK[id] || [];
    const rec = record(id);
    const status = window.SpacedReview.status(id) || {};
    const recent = new Set((rec.recentIds || []).slice(-2));
    let candidates = bank.filter(function (q) { return q.id !== status.lastQuestionId && !recent.has(q.id); });
    if (!candidates.length) candidates = bank.filter(function (q) { return q.id !== status.lastQuestionId; });
    if (!candidates.length) candidates = bank.slice();
    const differentType = candidates.filter(function (q) { return q.variantType !== status.lastVariantType; });
    if (differentType.length) candidates = differentType;
    candidates = shuffled(candidates).sort(function (a, b) {
      const aa = rec.answered[a.id] || { attempts: 0, lastAt: 0 };
      const bb = rec.answered[b.id] || { attempts: 0, lastAt: 0 };
      return aa.attempts - bb.attempts || aa.lastAt - bb.lastAt;
    });
    return candidates[0] || null;
  }

  function startSpaced() {
    const existing = spaced();
    if (existing && !existing.completedAt) return existing;
    const due = window.SpacedReview.due().slice(0, 6);
    if (!due.length) return null;
    const questions = due.map(function (item) {
      const q = pickSpaced(item.termId);
      return { termId: item.termId, questionId: q.id, review: true,
        optionIds: shuffled(q.options.map(function (o) { return o.id; })) };
    });
    window.Mem.state.spacedSession = {
      startedAt: Date.now(), completedAt: 0, index: 0,
      questions: questions, responses: [], feedback: null, result: null
    };
    window.Mem.save(); return spaced();
  }

  function spacedQuestion() {
    const s = spaced();
    return s && (!s.completedAt || s.feedback) ? resolveQuestion(s.questions[s.index]) : null;
  }

  function answerSpaced(optionId) {
    const s = spaced(), q = spacedQuestion();
    if (!s || !q || s.feedback) return null;
    const result = answer(q.termId, q.id, optionId, 'spaced');
    if (!result) return null;
    const term = window.TERMS.find(function (x) { return x.id === q.termId; });
    if (window.Mem.quiz && term) window.Mem.quiz(q.termId, term.cat, result.correct);
    s.responses.push({ termId: q.termId, questionId: q.id, correct: result.correct, at: Date.now() });
    s.feedback = Object.assign({ termId: q.termId, questionId: q.id, selectedOptionId: String(optionId) }, result);
    finishSession(s);
    window.Mem.save(); return s.feedback;
  }

  function nextSpaced() {
    const s = spaced();
    if (!s || !s.feedback) return s;
    s.feedback = null;
    if (s.completedAt) { window.Mem.save(); return s; }
    s.index++;
    finishSession(s);
    window.Mem.save(); return s;
  }

  window.LEARNING_QUIZ_BANK = BANK;
  window.LearningQuiz = {
    pick: pick, answer: answer, bank: function (termId) { return (BANK[termId] || []).slice(); },
    startDaily: startDaily, daily: daily, dailyQuestion: dailyQuestion,
    answerDaily: answerDaily, nextDaily: nextDaily, dailyResult: dailyResult,
    startPractice: startPractice, practice: practice, practiceQuestion: practiceQuestion,
    answerPractice: answerPractice, nextPractice: nextPractice,
    reinforcementProgress: reinforcementProgress,
    startSpaced: startSpaced, spaced: spaced, spacedQuestion: spacedQuestion,
    answerSpaced: answerSpaced, nextSpaced: nextSpaced
  };
})();
