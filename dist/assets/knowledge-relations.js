/* ============================================================
   知识点关联引擎
   利用课程顺序、同课概念和 related 字段推导先修 / 协同 / 延伸关系。
   ============================================================ */

(function () {
  function term(id) { return window.TERMS.find(function (x) { return x.id === id; }) || null; }

  function plain(text) {
    return String(text || '').replace(/\*\*/g, '').replace(/`/g, '').replace(/\s+/g, ' ').trim();
  }

  function sentence(text, max) {
    const s = plain(text);
    const hit = s.match(/^.*?[。！？；]/);
    const out = hit ? hit[0] : s;
    return out.length > (max || 120) ? out.slice(0, (max || 120) - 1) + '…' : out;
  }

  function lessonNo(id) { return window.Curriculum.lessonNoOf(id) || 999; }

  function candidateIds(current) {
    const ids = [];
    function add(id) { if (id && id !== current.id && ids.indexOf(id) < 0 && term(id)) ids.push(id); }
    (current.related || []).forEach(add);

    const ownNo = lessonNo(current.id);
    const ownLesson = window.Curriculum.get(ownNo);
    if (ownLesson) (ownLesson.ids || []).forEach(add);
    if (ids.length < 2) {
      [ownNo - 1, ownNo + 1].forEach(function (no) {
        const lesson = window.Curriculum.get(no);
        if (lesson) (lesson.ids || []).forEach(add);
      });
    }
    return ids;
  }

  function classify(current, related) {
    const a = lessonNo(current.id), b = lessonNo(related.id);
    if (a === b) {
      const lesson = window.Curriculum.get(a);
      const ids = lesson ? lesson.ids : [];
      if (ids.indexOf(related.id) < ids.indexOf(current.id)) return 'prerequisite';
      if (ids.indexOf(related.id) > ids.indexOf(current.id)) return 'extension';
    }
    if (b < a) return 'prerequisite';
    if (b > a + 1 || related.stage > current.stage) return 'extension';
    return 'companion';
  }

  function reason(kind, current, related) {
    if (kind === 'prerequisite') return '先理解「' + related.name + '」，会更容易看懂「' + current.name + '」。';
    if (kind === 'extension') return '掌握「' + current.name + '」后，可以继续用「' + related.name + '」解决更复杂的问题。';
    return '「' + related.name + '」常与「' + current.name + '」一起出现，组合起来才是完整方案。';
  }

  function relations(id) {
    const current = term(id);
    const groups = { prerequisite: [], companion: [], extension: [] };
    if (!current) return groups;
    candidateIds(current).forEach(function (rid) {
      const related = term(rid);
      const kind = classify(current, related);
      if (groups[kind].length >= 4) return;
      groups[kind].push({
        id: related.id, name: related.name, en: related.en, one: related.one,
        stage: related.stage, level: related.level, kind: kind,
        reason: reason(kind, current, related)
      });
    });
    return groups;
  }

  function quick(id) {
    const current = term(id);
    if (!current) return null;
    return {
      meaning: current.one,
      useWhen: sentence(current.pm, 128),
      scenario: sentence(current.example, 128)
    };
  }

  window.KnowledgeRelations = { forTerm: relations, quick: quick };
})();
