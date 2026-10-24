/* 错题证据、显式掌握标记与可纠正的长期错因；不凭单次错误推断能力。 */
(function () {
  const MAX_ATTEMPTS = 3000;
  const PATTERN_LABELS = {
    definition: '概念辨认', scenario: '场景应用', boundary: '边界判断',
    pitfall: '常见误区', mechanism: '流程机制', tradeoff: '方案取舍'
  };
  function state() {
    const mem = window.Mem.state;
    if (!mem.learningMemory || typeof mem.learningMemory !== 'object') mem.learningMemory = {};
    const s = mem.learningMemory;
    s.version = 1;
    if (!Array.isArray(s.attempts)) s.attempts = [];
    if (!s.manual || typeof s.manual !== 'object') s.manual = {};
    if (!Array.isArray(s.legacyWrong)) s.legacyWrong = [];
    if (!s.patterns || typeof s.patterns !== 'object') s.patterns = {};
    return s;
  }
  function term(id) { return (window.TERMS || []).find(function (x) { return x.id === id; }) || null; }
  function dayKey(at) { const d = new Date(at); return d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate(); }
  function key(termId, kind) { return termId + '|' + (PATTERN_LABELS[kind] ? kind : 'scenario'); }
  function buildPatterns(attempts, legacy) {
    const out = {};
    (legacy || []).forEach(function (x) {
      if (!term(x.termId) || !x.count) return;
      const k = key(x.termId, x.variantType);
      const row = out[k] || { key: k, termId: x.termId, kind: x.variantType || 'scenario', wrong: 0,
        legacyWrong: 0, lastWrongAt: 0, evidenceIds: [], reviewDays: [] };
      row.wrong += x.count; row.legacyWrong += x.count; row.lastWrongAt = Math.max(row.lastWrongAt, x.lastAt || 0);
      out[k] = row;
    });
    (attempts || []).slice().sort(function (a, b) { return a.at - b.at; }).forEach(function (a) {
      if (!term(a.termId)) return;
      const k = key(a.termId, a.variantType);
      if (a.correct && !out[k]) return;
      const row = out[k] || { key: k, termId: a.termId, kind: a.variantType || 'scenario', wrong: 0,
        legacyWrong: 0, lastWrongAt: 0, evidenceIds: [], reviewDays: [] };
      if (!a.correct) {
        row.wrong++;
        row.lastWrongAt = Math.max(row.lastWrongAt, a.at || 0);
        row.evidenceIds = row.evidenceIds.concat(a.id).slice(-8);
        row.reviewDays = [];
      }
      out[k] = row;
    });
    const passedByTerm = {};
    (attempts || []).forEach(function (a) {
      if (a.correct && a.source === 'spaced') (passedByTerm[a.termId] || (passedByTerm[a.termId] = [])).push(a.at);
    });
    Object.keys(out).forEach(function (k) {
      const x = out[k];
      x.reviewDays = Array.from(new Set((passedByTerm[x.termId] || []).filter(function (at) { return at > x.lastWrongAt; }).map(dayKey)));
      x.label = PATTERN_LABELS[x.kind] || '场景应用';
      x.state = x.reviewDays.length >= 2 ? '已通过跨日复测' : x.wrong >= 2 ? '重复出现' : '待观察';
    });
    return out;
  }
  function initialize() {
    const s = state();
    if (s.migrated) return s;
    const old = window.Mem.state.quizVariants || {};
    Object.keys(old).forEach(function (termId) {
      const questions = old[termId].answered || {};
      Object.keys(questions).forEach(function (questionId) {
        const rec = questions[questionId] || {};
        if (!(rec.wrong > 0)) return;
        const bank = window.LearningQuiz ? window.LearningQuiz.bank(termId) : [];
        const q = bank.find(function (item) { return item.id === questionId; });
        s.legacyWrong.push({ termId: termId, questionId: questionId, variantType: q ? q.variantType : 'scenario',
          count: rec.wrong, lastAt: rec.lastAt || 0 });
      });
    });
    s.migrated = true;
    s.patterns = buildPatterns(s.attempts, s.legacyWrong);
    window.Mem.save();
    return s;
  }
  function recordAnswer(q, selectedOptionId, correct, source) {
    if (!q || !term(q.termId)) return null;
    const selected = (q.options || []).find(function (x) { return x.id === selectedOptionId; });
    const right = (q.options || []).find(function (x) { return x.id === q.correctOptionId; });
    if (!selected || !right) return null;
    const s = state();
    const at = Date.now();
    const row = { id: 'attempt-' + at + '-' + (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2)),
      termId: q.termId, questionId: q.id, variantType: q.variantType || 'scenario', source: source || 'term',
      prompt: String(q.prompt || '').slice(0, 240), selectedOptionId: selectedOptionId,
      selectedText: String(selected.text || '').slice(0, 200), correctOptionId: q.correctOptionId,
      correctText: String(right.text || '').slice(0, 200), explanation: String(q.explanation || '').slice(0, 400),
      correct: !!correct, at: at };
    s.attempts.push(row);
    if (s.attempts.length > MAX_ATTEMPTS) s.attempts.splice(0, s.attempts.length - MAX_ATTEMPTS);
    s.patterns = buildPatterns(s.attempts, s.legacyWrong);
    return row;
  }
  function mark(termId, value) {
    if (!term(termId) || !['mastered', 'not_yet'].includes(value)) return null;
    const s = state();
    s.manual[termId] = { value: value, at: Date.now() };
    if (value === 'not_yet' && window.SpacedReview && window.SpacedReview.reopen) window.SpacedReview.reopen(termId);
    window.Mem.save();
    return s.manual[termId];
  }
  function status(termId) {
    const s = state(), manual = s.manual[termId];
    const spaced = window.SpacedReview ? window.SpacedReview.status(termId) : null;
    const prior = (window.Mem.state.terms || {})[termId];
    if (manual && manual.value === 'not_yet' && (!spaced || spaced.successStreak < 2)) return { key: 'weak', label: '标记未掌握' };
    if (spaced && spaced.successStreak >= 2) return { key: 'mastered', label: '跨日已掌握' };
    if (manual && manual.value === 'mastered') return { key: 'pending', label: '自评掌握 · 待复测' };
    if (!prior || !prior.seen) return { key: 'new', label: '未学习' };
    if ((prior.wrong || 0) > (prior.right || 0) || (prior.confused || 0) > (prior.cleared || 0)) return { key: 'weak', label: '需要巩固' };
    return { key: 'learning', label: '学习中' };
  }
  function entries() {
    const s = state();
    const byTerm = new Map();
    s.attempts.forEach(function (a) {
      if (!term(a.termId)) return;
      const row = byTerm.get(a.termId) || { termId: a.termId, wrong: 0, recent: [], lastWrongAt: 0, patterns: [] };
      if (!a.correct) { row.wrong++; row.lastWrongAt = Math.max(row.lastWrongAt, a.at); row.recent.push(a); }
      byTerm.set(a.termId, row);
    });
    s.legacyWrong.forEach(function (x) {
      if (!term(x.termId)) return;
      const row = byTerm.get(x.termId) || { termId: x.termId, wrong: 0, recent: [], lastWrongAt: 0, patterns: [] };
      row.wrong += x.count; row.lastWrongAt = Math.max(row.lastWrongAt, x.lastAt || 0);
      byTerm.set(x.termId, row);
    });
    Object.keys(s.patterns).forEach(function (k) {
      const p = s.patterns[k], row = byTerm.get(p.termId);
      if (row) row.patterns.push(p);
    });
    return Array.from(byTerm.values()).filter(function (x) { return x.wrong > 0; }).map(function (x) {
      x.term = term(x.termId);
      x.recent = x.recent.sort(function (a, b) { return b.at - a.at; }).slice(0, 5);
      x.status = status(x.termId);
      x.dueAt = window.SpacedReview && window.SpacedReview.status(x.termId) ? window.SpacedReview.status(x.termId).dueAt : 0;
      return x;
    }).sort(function (a, b) {
      const aActive = a.status.key === 'mastered' ? 0 : 1, bActive = b.status.key === 'mastered' ? 0 : 1;
      return bActive - aActive || b.wrong - a.wrong || b.lastWrongAt - a.lastWrongAt;
    });
  }
  function summary() {
    const rows = entries();
    const s = state();
    return { terms: rows.length, totalWrong: rows.reduce(function (n, x) { return n + x.wrong; }, 0),
      active: rows.filter(function (x) { return x.status.key !== 'mastered'; }).length,
      repeatedPatterns: Object.values(s.patterns).filter(function (x) { return x.wrong >= 2 && x.state !== '已通过跨日复测'; }).length };
  }
  window.LearnerMemory = { state: state, initialize: initialize, recordAnswer: recordAnswer, mark: mark,
    status: status, entries: entries, summary: summary, buildPatterns: buildPatterns, labels: PATTERN_LABELS };
})();
