/* 到期复测：当天答对只安排复测；跨日、换题成功后才积累长期掌握。 */
(function () {
  const DAY = 86400000;
  const INTERVALS = [2, 4, 7, 14, 30];

  function dayKey(at) {
    const d = new Date(at);
    return d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate();
  }
  function state() {
    const mem = window.Mem.state;
    if (!mem.spacedReview || typeof mem.spacedReview !== 'object') mem.spacedReview = {};
    return mem.spacedReview;
  }
  function term(id) { return (window.TERMS || []).find(function (x) { return x.id === id; }) || null; }
  function seed(id, at, dueAt) {
    return {
      termId: id, firstAt: at, lastAt: at, dueAt: dueAt,
      lastQuestionId: '', lastVariantType: '', lastReviewedAt: 0,
      successStreak: 0, reviewHistory: []
    };
  }
  function initialize(now) {
    now = now == null ? Date.now() : now;
    const mem = window.Mem.state;
    const records = state();
    const learned = (mem.syllabus && mem.syllabus.learned) || [];
    const quizHistory = mem.quizVariants || {};
    let changed = false;
    window.TERMS.forEach(function (t) {
      if (records[t.id]) return;
      const prior = mem.terms && mem.terms[t.id] || {};
      const quiz = quizHistory[t.id] || {};
      if (learned.indexOf(t.id) < 0 && !((prior.right || 0) + (prior.wrong || 0)) && !((quiz.correct || 0) + (quiz.wrong || 0))) return;
      const quizLastAt = Object.keys(quiz.answered || {}).reduce(function (n, key) {
        return Math.max(n, quiz.answered[key].lastAt || 0);
      }, 0);
      const lastAt = Math.max(prior.lastAt || 0,
        mem.syllabus && mem.syllabus.doneAt && mem.syllabus.doneAt[t.id] || 0, quizLastAt) || now;
      const record = seed(t.id, lastAt, lastAt + DAY);
      record.migrated = true;
      records[t.id] = record;
      changed = true;
    });
    if (changed) window.Mem.save();
    return changed;
  }
  function record(id, questionId, variantType, correct, source, now) {
    if (!term(id)) return null;
    now = now == null ? Date.now() : now;
    const records = state();
    let current = records[id];
    if (!current) {
      current = seed(id, now, now + (correct ? INTERVALS[0] : 1) * DAY);
      records[id] = current;
    } else if (source === 'spaced' && now >= current.dueAt &&
               dayKey(now) !== dayKey(current.lastReviewedAt || current.firstAt)) {
      if (correct) {
        current.successStreak = Math.min(4, (current.successStreak || 0) + 1);
        current.dueAt = now + INTERVALS[current.successStreak] * DAY;
      } else {
        current.successStreak = 0;
        current.dueAt = now + DAY;
      }
      current.lastReviewedAt = now;
      current.reviewHistory = (current.reviewHistory || []).concat([{
        at: now, questionId: questionId, variantType: variantType, correct: !!correct
      }]).slice(-20);
    } else if (!correct) {
      current.successStreak = 0;
      current.dueAt = now + DAY;
    } else if (source === 'spaced' && now >= current.dueAt) {
      // 同一天的立即纠正可以结束本轮，但不能计作一次跨日掌握证据。
      current.dueAt = now + DAY;
    }
    current.lastAt = now;
    current.lastQuestionId = questionId;
    current.lastVariantType = variantType;
    return current;
  }
  function due(now) {
    now = now == null ? Date.now() : now;
    return Object.keys(state()).map(function (id) { return state()[id]; })
      .filter(function (r) { return term(r.termId) && r.dueAt <= now; })
      .sort(function (a, b) { return a.dueAt - b.dueAt; });
  }
  function summary(now) {
    now = now == null ? Date.now() : now;
    const records = Object.keys(state()).map(function (id) { return state()[id]; }).filter(function (r) { return term(r.termId); });
    const mastered = records.filter(function (r) { return (r.successStreak || 0) >= 2; }).length;
    const reviewed = records.filter(function (r) { return (r.reviewHistory || []).length; }).length;
    const next = records.filter(function (r) { return r.dueAt > now; }).sort(function (a, b) { return a.dueAt - b.dueAt; })[0];
    return {
      total: records.length, mastered: mastered, reviewed: reviewed,
      score: reviewed && records.length ? Math.round(mastered / records.length * 100) : null,
      due: due(now).length, nextAt: next ? next.dueAt : 0
    };
  }
  function reopen(id, now) {
    if (!term(id)) return null;
    now = now == null ? Date.now() : now;
    const records = state();
    const current = records[id] || seed(id, now, now);
    current.successStreak = 0;
    current.dueAt = now;
    current.lastAt = now;
    records[id] = current;
    return current;
  }
  window.SpacedReview = { initialize: initialize, record: record, due: due, summary: summary,
    reopen: reopen, status: function (id) { return state()[id] || null; }, dayKey: dayKey };
})();
