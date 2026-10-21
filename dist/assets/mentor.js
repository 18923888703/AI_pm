/* 导师记忆：固定标签、可见信号、归纳画像、先修推荐和重讲缓存。
   数据进入现有 Mem/Store；不依赖服务器或新的模型凭证。 */
(function () {
  const DIFFICULTIES = {
    abstract: '概念太抽象', tech: '技术细节不清楚', english: '英文术语难记',
    confuse: '易与相近概念混淆', why: '不清楚为什么需要',
    scale: '成本与数量级不直观', flow: '流程顺序不清楚'
  };
  const STYLES = {
    analogy: '生活类比', example: '产品场景', step: '分步骤讲',
    contrast: '相近概念对比', concrete: '具体数据与格式', short: '先结论后展开'
  };
  const SUMMARY_EVERY = 6;
  const sessionNonce = Math.random().toString(36).slice(2, 8);
  let sequence = 0;
  let summarizing = null;

  function state() {
    const mem = window.Mem.state;
    if (!mem.mentor || typeof mem.mentor !== 'object') mem.mentor = {};
    const m = mem.mentor;
    if (!Array.isArray(m.signals)) m.signals = [];
    if (!m.supplements || typeof m.supplements !== 'object') m.supplements = {};
    if (!m.summary || typeof m.summary !== 'object') m.summary = null;
    return m;
  }

  function validTags(input, choices) {
    const values = Array.isArray(input) ? input : [];
    return Array.from(new Set(values.filter(function (key) { return Object.prototype.hasOwnProperty.call(choices, key); })));
  }

  function cleanSignal(termId, input, source) {
    const term = (window.TERMS || []).find(function (t) { return t.id === termId; });
    if (!term) return null;
    const s = input && typeof input === 'object' ? input : {};
    return {
      id: 'signal-' + sessionNonce + '-' + Date.now() + '-' + (++sequence), termId: termId, at: Date.now(),
      source: source || 'chat', difficulty: validTags(s.difficulty, DIFFICULTIES),
      styleWorked: validTags(s.style_worked || s.styleWorked, STYLES),
      understood: ['yes', 'partly', 'no'].includes(s.understood) ? s.understood : 'partly',
      note: String(s.note || '').trim().slice(0, 120)
    };
  }

  function record(termId, input, source) {
    const s = cleanSignal(termId, input, source);
    if (!s) return null;
    const m = state();
    m.signals.push(s);
    if (m.signals.length > 300) m.signals.splice(0, m.signals.length - 300);
    window.Mem.save();
    void maybeSummarize();
    return s;
  }

  function infer(message, termId) {
    const q = String(message || '');
    const difficulties = [];
    if (/抽象|太笼统|落不了地/.test(q)) difficulties.push('abstract');
    if (/技术|代码|算法|原理|参数/.test(q)) difficulties.push('tech');
    if (/英文|缩写|单词/.test(q)) difficulties.push('english');
    if (/区别|对比|分不清|混淆/.test(q)) difficulties.push('confuse');
    if (/为什么|有什么用|必要|为何/.test(q)) difficulties.push('why');
    if (/成本|数量级|价格|延迟/.test(q)) difficulties.push('scale');
    if (/流程|顺序|步骤|先.*后/.test(q)) difficulties.push('flow');
    const positive = /懂了|明白了|清楚了|理解了|原来如此/.test(q);
    const negative = /不懂|没懂|看不懂|还是不会|没明白/.test(q);
    const style = [];
    if (positive && /例子|场景/.test(q)) style.push('example');
    if (positive && /比喻|类比/.test(q)) style.push('analogy');
    if (positive && /步骤|一步一步/.test(q)) style.push('step');
    if (positive && /对比|区别/.test(q)) style.push('contrast');
    const term = (window.TERMS || []).find(function (t) { return t.id === termId; });
    return {
      difficulty: difficulties, style_worked: style,
      understood: negative ? 'no' : positive ? 'yes' : 'partly',
      note: (term ? term.name + '：' : '') + q.slice(0, 75)
    };
  }

  function recordQuizWrong(termId, prompt, selectedText) {
    return record(termId, {
      difficulty: [], style_worked: [], understood: 'no',
      note: '答错「' + String(prompt || '').slice(0, 38) + '」，选择了「' + String(selectedText || '').slice(0, 28) + '」'
    }, 'quiz');
  }

  function profile() {
    const m = state();
    const now = Date.now();
    const diffs = Object.keys(DIFFICULTIES).map(function (key) { return { key: key, label: DIFFICULTIES[key], score: 0 }; });
    const styles = Object.keys(STYLES).map(function (key) { return { key: key, label: STYLES[key], score: 0 }; });
    m.signals.forEach(function (s) {
      const weight = now - (s.at || 0) < 30 * 86400000 ? 1 : 0.5;
      (s.difficulty || []).forEach(function (key) { const row = diffs.find(function (x) { return x.key === key; }); if (row) row.score += weight; });
      (s.styleWorked || []).forEach(function (key) { const row = styles.find(function (x) { return x.key === key; }); if (row) row.score += weight; });
    });
    diffs.sort(function (a, b) { return b.score - a.score; });
    styles.sort(function (a, b) { return b.score - a.score; });
    const terms = window.Mem.state.terms || {};
    const status = { got: 0, confused: 0, learning: 0 };
    window.TERMS.forEach(function (t) {
      const s = termStatus(t.id);
      if (status[s] !== undefined) status[s]++;
    });
    return {
      signalCount: m.signals.length, difficulty: diffs, style: styles,
      topDifficulty: diffs.filter(function (x) { return x.score > 0; }).slice(0, 3),
      topStyle: styles.filter(function (x) { return x.score > 0; }).slice(0, 2),
      weakCats: window.Mem.weakCats().slice(0, 3),
      recent: m.signals.slice(-12).reverse(), summary: m.summary,
      status: status,
      quizRight: Object.values(terms).reduce(function (n, x) { return n + (x.right || 0); }, 0),
      quizWrong: Object.values(terms).reduce(function (n, x) { return n + (x.wrong || 0); }, 0)
    };
  }

  function termStatus(id) {
    const r = (window.Mem.state.terms || {})[id];
    if (!r || !r.seen) return 'new';
    if (r.mastery >= 3.5) return 'got';
    if ((r.confused || 0) > (r.cleared || 0) || (r.wrong || 0) > (r.right || 0)) return 'confused';
    return 'learning';
  }

  function profileText(p) {
    p = p || profile();
    const lines = [];
    if (p.summary && p.summary.text) lines.push('学习画像：' + p.summary.text);
    if (p.topDifficulty.length) lines.push('常见困难：' + p.topDifficulty.map(function (x) { return x.label; }).join('、'));
    if (p.topStyle.length) lines.push('有效讲法：' + p.topStyle.map(function (x) { return x.label; }).join('、'));
    if (p.weakCats.length) lines.push('薄弱类别：' + p.weakCats.map(function (x) { return x.name; }).join('、'));
    return lines.join('\n');
  }

  function fingerprint(p) {
    p = p || profile();
    const data = p.topDifficulty.map(function (x) { return x.key; }).join(',') + '|' +
      p.topStyle.map(function (x) { return x.key; }).join(',') + '|' +
      p.weakCats.map(function (x) { return x.key; }).join(',') + '|' + (p.summary && p.summary.text || '').slice(0, 120);
    let hash = 2166136261;
    for (let i = 0; i < data.length; i++) hash = Math.imul(hash ^ data.charCodeAt(i), 16777619);
    return (hash >>> 0).toString(36);
  }

  function offlineSummary(p) {
    const parts = [];
    if (p.topDifficulty.length) parts.push('常在' + p.topDifficulty.map(function (x) { return x.label; }).join('、') + '上停顿');
    if (p.topStyle.length) parts.push('使用' + p.topStyle.map(function (x) { return x.label; }).join('、') + '更容易理解');
    if (p.weakCats.length) parts.push('接下来优先巩固' + p.weakCats.map(function (x) { return x.name; }).join('、'));
    return (parts.join('；') || '正在积累学习记录，继续追问和做题后再判断适合的讲法。').slice(0, 120);
  }

  async function maybeSummarize() {
    if (summarizing) return summarizing;
    const m = state();
    const lastIndex = m.summary && m.summary.throughId
      ? m.signals.findIndex(function (s) { return s.id === m.summary.throughId; }) : -1;
    const pending = lastIndex >= 0 ? m.signals.slice(lastIndex + 1)
      : m.signals.filter(function (s) { return s.at > (m.summary ? m.summary.at : 0); });
    if (pending.length < SUMMARY_EVERY) return null;
    const throughId = pending[pending.length - 1].id;
    summarizing = (async function () {
      const p = profile();
      let text = '';
      let mode = 'offline';
      if (window.LLM && window.LLM.getCfg().enabled && window.LLM.getCfg().apiKey) {
        try {
          text = await window.LLM.summarizeLearner(p, m.signals.slice(-20));
          if (text) mode = 'model';
        } catch (e) { /* 保留可用的确定性归纳 */ }
      }
      if (!text) text = offlineSummary(p);
      m.summary = { text: String(text).trim().slice(0, 120), at: Date.now(), mode: mode, throughId: throughId };
      window.Mem.save();
      return m.summary;
    })();
    try { return await summarizing; } finally { summarizing = null; }
  }

  function getSupplement(termId) {
    return state().supplements[termId + '|' + fingerprint()] || null;
  }

  function offlineSupplement(term, p) {
    const style = p.topStyle[0] ? p.topStyle[0].key : 'step';
    const difficulties = p.topDifficulty.map(function (x) { return x.key; });
    let title = '换个角度理解';
    let text = '';
    if (style === 'contrast' && (term.related || []).length) {
      const other = window.TERMS.find(function (x) { return x.id === term.related[0]; });
      if (other) {
        title = '对比着理解';
        text = '先分清两者各管什么：' + term.name + '是「' + term.one + '」；' + other.name + '是「' + other.one + '」。\n\n在产品方案里，先确认当前问题属于哪一层，再决定用哪个能力。';
      }
    }
    if (!text && (style === 'example' || difficulties.includes('abstract'))) {
      title = '放进产品场景';
      text = '先看这件事：' + term.example + '\n\n回到定义：' + term.one + '\n\n做产品判断时，记住：' + term.pm;
    }
    if (!text) {
      title = '分步骤理解';
      text = '先给结论：' + term.one + '\n\n' + (term.steps || []).slice(0, 3).map(function (s, i) { return (i + 1) + '. ' + s; }).join('\n') + '\n\n应用时：' + term.pm;
    }
    return { title: title, text: text, mode: 'offline' };
  }

  async function supplement(termId, force) {
    const term = window.TERMS.find(function (t) { return t.id === termId; });
    if (!term) throw new Error('找不到这个知识点');
    const p = profile();
    const key = termId + '|' + fingerprint(p);
    const m = state();
    if (!force && m.supplements[key]) return Object.assign({ cached: true }, m.supplements[key]);
    let result = null;
    if (window.LLM && window.LLM.getCfg().enabled && window.LLM.getCfg().apiKey) {
      try { result = await window.LLM.reteach(term, p); } catch (e) { /* 断网时仍可用课程材料重讲 */ }
    }
    if (!result || !result.text) result = offlineSupplement(term, p);
    const saved = { title: String(result.title || '换个讲法').slice(0, 24),
      text: String(result.text).slice(0, 2400), mode: result.mode || 'model', at: Date.now(), fingerprint: fingerprint(p) };
    m.supplements[key] = saved;
    const keys = Object.keys(m.supplements).sort(function (a, b) { return (m.supplements[a].at || 0) - (m.supplements[b].at || 0); });
    while (keys.length > 120) delete m.supplements[keys.shift()];
    window.Mem.save();
    return Object.assign({ cached: false }, saved);
  }

  function recommend(n) {
    const p = profile();
    const weak = new Set(p.weakCats.map(function (x) { return x.key; }));
    const records = window.Mem.state.terms || {};
    const recentGot = window.TERMS.filter(function (t) { return termStatus(t.id) === 'got'; })
      .sort(function (a, b) { return (records[b.id].lastAt || 0) - (records[a.id].lastAt || 0); })
      .slice(0, 3).map(function (t) { return t.id; });
    const out = [];
    window.TERMS.forEach(function (t) {
      const status = termStatus(t.id);
      if (status === 'got') return;
      const relation = window.KnowledgeRelations.forTerm(t.id);
      const prerequisite = relation.prerequisite.slice(0, 3).map(function (x) { return x.id; });
      const missing = prerequisite.filter(function (id) { return !window.Mem.graduated(id); });
      let score = status === 'confused' ? 100 : 0;
      const reasons = [];
      if (status === 'confused') reasons.push('上次卡住，先回头巩固');
      if (missing.length) score -= 12 * missing.length;
      else score += 20;
      if (weak.has(t.cat)) { score += 8; reasons.push('这一类是当前薄弱点'); }
      if ((t.related || []).some(function (id) { return recentGot.includes(id); })) {
        score += 5; reasons.push('与刚掌握的知识相连');
      }
      if (status === 'learning') { score += 2; reasons.push('已经接触，继续完成'); }
      if (t.optional && status === 'new') score -= 10;
      score -= t.level * 3;
      out.push({ id: t.id, name: t.name, stage: t.stage, level: t.level, status: status,
        score: score, missing: missing, why: reasons[0] || (missing.length ? '先补齐关联的基础概念' : '按当前基础继续学习') });
    });
    out.sort(function (a, b) { return b.score - a.score || a.level - b.level || a.stage - b.stage; });
    return out.slice(0, n || 6);
  }

  window.Mentor = {
    DIFFICULTIES: DIFFICULTIES, STYLES: STYLES, SUMMARY_EVERY: SUMMARY_EVERY,
    state: state, record: record, infer: infer, recordQuizWrong: recordQuizWrong,
    profile: profile, profileText: profileText, fingerprint: fingerprint,
    maybeSummarize: maybeSummarize, getSupplement: getSupplement, supplement: supplement,
    recommend: recommend, termStatus: termStatus
  };
})();
