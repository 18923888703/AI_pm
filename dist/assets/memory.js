/* ============================================================
   长期记忆引擎 v2 (Learner Memory Engine)
   ------------------------------------------------------------
   职责：
   1. 记录学习行为 —— 浏览 / 测验 / 反馈 / 追问 / 停留 / 会话
   2. 建立习惯画像 —— 活跃时段、单次时长、连续天数、追问偏好、完成度
   3. 建立水平模型 —— 综合分数、等级、四类能力、趋势曲线
   4. 输出自适应 —— 今日计划、讲解深度、注意力预算、AI 记忆摘要
   5. 持久化     —— 经 Store 层落 localStorage + 可选同步文件

   核心设计：事件流是地基，习惯与水平都是从事件里算出来的。
   ============================================================ */

(function () {
  let S = null;
  let curSession = null;
  let lastTick = Date.now();
  let beatTimer = null;

  const EMPTY = function () {
    return {
      version: 2,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      terms: {},        // id -> { seen, views, dwell, right, wrong, confused, cleared, lastAt, mastery }
      cats: {},         // cat -> { right, wrong, confused, cleared, touch }
      events: [],       // 行为流水（最近 600 条）
      prefs: { style: 'auto', mode: 'auto', autoSimple: true },
      chat: [],         // 追问对话历史（最近 120 条）
      meta: { totalQuiz: 0, totalRight: 0, sessions: 0, entitiesViewed: 0 },
      /* --- v2 新增 --- */
      sessions: [],     // [{start,end,dur,views,quiz,asks,terms:[]}]
      habits: {
        totalMin: 0,
        hourHist: new Array(24).fill(0),
        dayHist: new Array(7).fill(0),
        streak: 0,
        lastDay: '',
        askTypes: { example: 0, why: 0, how: 0, simpler: 0, other: 0 },
        quizDone: 0,
        viewTotal: 0
      },
      level: { history: [] },   // [{t, score, grade}]
      /* --- 学习计划（持久化的大纲进度 + 当天冻结的清单） --- */
      syllabus: { startedAt: Date.now(), learned: [], doneAt: {} },  // learned: 已完成的概念 id
      plan: null,       // 今天这份清单：{date, items:[...]}
      planLog: {},      // date -> {total, done, min, lessonNo}
      quizVariants: {}, // termId -> 变式题历史
      dailyLearning: null,
      learningPractice: null,
      spacedReview: {},
      spacedSession: null
    };
  };

  function migrate(o) {
    const base = EMPTY();
    const filled = Object.assign(base, o || {});
    filled.version = 2;
    filled.habits = Object.assign(base.habits, o && o.habits || {});
    if (!Array.isArray(filled.habits.hourHist) || filled.habits.hourHist.length !== 24) filled.habits.hourHist = new Array(24).fill(0);
    if (!Array.isArray(filled.habits.dayHist) || filled.habits.dayHist.length !== 7) filled.habits.dayHist = new Array(7).fill(0);
    filled.habits.askTypes = Object.assign({ example: 0, why: 0, how: 0, simpler: 0, other: 0 }, o && o.habits && o.habits.askTypes || {});
    filled.level = Object.assign({ history: [] }, o && o.level || {});
    filled.sessions = Array.isArray(filled.sessions) ? filled.sessions : [];
    filled.meta = Object.assign(base.meta, o && o.meta || {});
    filled.prefs = Object.assign(base.prefs, o && o.prefs || {});
    /* 学习计划 */
    filled.syllabus = Object.assign({ startedAt: Date.now(), learned: [], doneAt: {} }, o && o.syllabus || {});
    if (!Array.isArray(filled.syllabus.learned)) filled.syllabus.learned = [];
    if (!filled.syllabus.doneAt || typeof filled.syllabus.doneAt !== 'object') filled.syllabus.doneAt = {};
    filled.planLog = (o && o.planLog && typeof o.planLog === 'object') ? o.planLog : {};
    filled.plan = (o && o.plan && Array.isArray(o.plan.items)) ? o.plan : null;
    filled.quizVariants = (o && o.quizVariants && typeof o.quizVariants === 'object') ? o.quizVariants : {};
    filled.dailyLearning = (o && o.dailyLearning && typeof o.dailyLearning === 'object') ? o.dailyLearning : null;
    filled.learningPractice = (o && o.learningPractice && typeof o.learningPractice === 'object') ? o.learningPractice : null;
    filled.spacedReview = (o && o.spacedReview && typeof o.spacedReview === 'object') ? o.spacedReview : {};
    filled.spacedSession = (o && o.spacedSession && typeof o.spacedSession === 'object') ? o.spacedSession : null;
    return filled;
  }

  function load() {
    if (S) return S;
    try {
      const raw = localStorage.getItem('aipm.memory.v1');
      S = raw ? migrate(JSON.parse(raw)) : EMPTY();
    } catch (e) {
      S = EMPTY();
    }
    return S;
  }

  function save() {
    S.updatedAt = Date.now();
    if (window.Store) window.Store.write(S);
    else { try { localStorage.setItem('aipm.memory.v1', JSON.stringify(S)); } catch (e) { /* ignore */ } }
  }

  function termRec(id) {
    const t = load().terms;
    if (!t[id]) t[id] = { seen: 0, views: 0, dwell: 0, right: 0, wrong: 0, confused: 0, cleared: 0, lastAt: 0, mastery: 0 };
    return t[id];
  }
  function catRec(cat) {
    const c = load().cats;
    if (!c[cat]) c[cat] = { right: 0, wrong: 0, confused: 0, cleared: 0, touch: 0 };
    return c[cat];
  }
  function log(type, termId, extra) {
    const e = load().events;
    e.unshift(Object.assign({ t: Date.now(), type: type, termId: termId || null }, extra || {}));
    if (e.length > 600) e.length = 600;
  }
  function touchCat(cat, field, n) {
    const c = catRec(cat);
    c[field] = (c[field] || 0) + (n || 1);
    if (field !== 'touch') c.touch += (n || 1);
  }

  function recompute(id) {
    const r = termRec(id);
    const raw = r.right * 1.2 - r.wrong * 1.4 - r.confused * 2 + r.cleared * 1.6;
    const seenBonus = r.views > 0 ? 0.4 : 0;
    r.mastery = Math.max(0, Math.min(5, +(raw + seenBonus).toFixed(2)));
    return r.mastery;
  }

  function levelOf(m) {
    if (m >= 3.5) return { k: 'mastered', label: '已掌握', color: '#0f7b6c' };
    if (m >= 2.0) return { k: 'fuzzy', label: '有点模糊', color: '#d9730d' };
    if (m > 0) return { k: 'weak', label: '还没懂', color: '#e03e3e' };
    return { k: 'new', label: '未学习', color: '#91918e' };
  }

  function dayKey(ts) { const d = new Date(ts || Date.now()); return d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate(); }

  /* ============================================================
     会话 / 习惯采集（心跳式，浏览器崩了也不丢太久）
     ============================================================ */
  function touchSession() {
    const arr = load().sessions;
    const now = Date.now();
    const last = arr[arr.length - 1];
    if (!last || now - (last.end || 0) > 30 * 60 * 1000) {
      curSession = { start: now, end: now, dur: 0, views: 0, quiz: 0, asks: 0, terms: [] };
      arr.push(curSession);
      if (arr.length > 400) arr.shift();
      load().meta.sessions = (load().meta.sessions || 0) + 1;
    } else {
      curSession = last;
    }
    curSession.end = now;
    curSession.dur = now - curSession.start;
    return curSession;
  }

  let firstTouch = true;

  function tick(force) {
    const now = Date.now();
    let dm = (now - lastTick) / 60000;
    if (!force && dm <= 0) return;
    dm = Math.min(Math.max(dm, 0), 1.2);   // 长时间后台不计入，避免污染画像
    lastTick = now;

    const h = load().habits;
    const d = new Date(now);
    h.totalMin = +(h.totalMin + dm).toFixed(2);
    h.hourHist[d.getHours()] = +(h.hourHist[d.getHours()] + dm).toFixed(2);
    h.dayHist[d.getDay()] = +(h.dayHist[d.getDay()] + dm).toFixed(2);

    const today = dayKey(now);
    if (h.lastDay !== today) {
      const y = new Date(now - 86400000);
      const yKey = dayKey(y.getTime());
      h.streak = (h.lastDay === yKey) ? (h.streak || 0) + 1 : 1;
      h.lastDay = today;
    }
    touchSession();
    // 每天记录一次水平快照
    const hist = load().level.history;
    const lastSnap = hist[hist.length - 1];
    if (!lastSnap || dayKey(lastSnap.t) !== today) {
      const lv = computeLevel();
      hist.push({ t: now, score: lv.score, grade: lv.grade });
      if (hist.length > 200) hist.shift();
    }
    save();
  }

  /* ============================================================
     水平模型
     ============================================================ */
  const GRADES = [
    { key: 'start', name: '起步', min: 0, color: '#91918e', desc: '刚开始建立直觉，先把词认全' },
    { key: 'beginner', name: '入门', min: 10, color: '#0f7b6c', desc: '能听懂团队在说什么，开始能自己判断方案' },
    { key: 'intermediate', name: '进阶', min: 28, color: '#2383e2', desc: '能设计 Agent 方案并预判它的坑' },
    { key: 'advanced', name: '实战', min: 50, color: '#6940a5', desc: '能把评测、成本和护栏一起考虑进去' }
  ];

  function computeLevel() {
    const p = progressRaw();
    const parts = [];

    if (p.total) parts.push({ key: 'mastery', label: '概念掌握', v: Math.round(p.mastered / p.total * 100), w: 0.40, note: p.mastered + '/' + p.total + ' 个已掌握' });
    if (p.quizAcc !== null) parts.push({ key: 'quiz', label: '测验正确率', v: p.quizAcc, w: 0.25, note: p.quizAcc + '%' });

    const touched = window.TERMS.filter(function (t) { const r = S.terms[t.id]; return r && r.seen; });
    if (touched.length) {
      const avg = touched.reduce(function (a, t) { return a + t.level; }, 0) / touched.length;
      const v = Math.max(0, Math.min(100, Math.round((avg - 1) / 4 * 100)));
      parts.push({ key: 'depth', label: '接触难度', v: v, w: 0.20, note: '平均难度 ' + avg.toFixed(1) + '/5' });
    }
    const stageAvg = Math.round(p.stageStat.reduce(function (a, s) { return a + s.pct; }, 0) / p.stageStat.length);
    if (stageAvg > 0) parts.push({ key: 'stage', label: '阶段推进', v: stageAvg, w: 0.15, note: '各阶段平均完成 ' + stageAvg + '%' });

    const tw = parts.reduce(function (a, x) { return a + x.w; }, 0);
    const score = parts.length ? Math.round(parts.reduce(function (a, x) { return a + x.v * x.w; }, 0) / tw) : 0;

    let gi = 0;
    GRADES.forEach(function (g, i) { if (score >= g.min) gi = i; });
    const grade = GRADES[gi];
    const next = GRADES[gi + 1] || null;

    return {
      score: score,
      grade: grade,
      gi: gi,
      next: next,
      toNext: next ? Math.max(0, next.min - score) : 0,
      parts: parts,
      trend: trendOf(score)
    };
  }

  function trendOf(score) {
    const hist = (S.level && S.level.history) || [];
    if (hist.length < 2) return { dir: 'new', delta: 0, label: '数据积累中' };
    const now = Date.now();
    const base = hist.filter(function (h) { return now - h.t > 3 * 86400000; }).slice(-1)[0] || hist[0];
    const delta = score - base.score;
    if (Math.abs(delta) < 1.5) return { dir: 'flat', delta: delta, label: '保持平稳' };
    return delta > 0
      ? { dir: 'up', delta: delta, label: '较 3 天前 +' + delta }
      : { dir: 'down', delta: delta, label: '较 3 天前 ' + delta };
  }

  function progressRaw() {
    const t = S.terms;
    let started = 0, mastered = 0;
    window.TERMS.forEach(function (x) {
      const r = t[x.id];
      if (r && r.seen) started++;
      if (r && r.mastery >= 3.5) mastered++;
    });
    const stageStat = window.STAGES.map(function (s) {
      const list = window.TERMS.filter(function (x) { return x.stage === s.id; });
      const pct = list.length ? Math.round(list.filter(function (x) {
        const r = t[x.id]; return r && r.mastery >= 3.5;
      }).length / list.length * 100) : 0;
      return { stage: s, total: list.length, pct: pct };
    });
    return {
      total: window.TERMS.length, started: started, mastered: mastered,
      pct: Math.round(mastered / window.TERMS.length * 100),
      quizAcc: S.meta.totalQuiz ? Math.round(S.meta.totalRight / S.meta.totalQuiz * 100) : null,
      stageStat: stageStat
    };
  }

  /* ============================================================
     习惯画像
     ============================================================ */
  function habitProfile() {
    const h = S.habits;
    const s = S.sessions || [];
    const recent = s.slice(-20);
    const avgSessionMin = recent.length
      ? Math.round(recent.reduce(function (a, x) { return a + (x.dur || 0); }, 0) / recent.length / 60000)
      : 0;

    // 高峰时段（取分钟数最多的 3 个小时）
    const peaks = h.hourHist.map(function (v, i) { return { h: i, v: v }; })
      .sort(function (a, b) { return b.v - a.v; }).slice(0, 3)
      .filter(function (x) { return x.v > 0.5; });

    // 追问偏好
    const at = h.askTypes || {};
    const atTotal = Object.keys(at).reduce(function (a, k) { return a + (at[k] || 0); }, 0);
    let askPref = null;
    if (atTotal >= 3) {
      const label = { example: '喜欢要例子', why: '总先问「为什么需要它」', how: '关心怎么做出来', simpler: '常说「讲简单点」', other: '偏自由提问' };
      const top = Object.keys(at).sort(function (a, b) { return at[b] - at[a]; })[0];
      askPref = { key: top, label: label[top], pct: Math.round(at[top] / atTotal * 100) };
    }

    // 完成度：看过的概念里，有多少留下了有效反馈
    let engaged = 0, viewed = 0;
    Object.keys(S.terms).forEach(function (id) {
      const r = S.terms[id];
      if (!r || !r.seen) return;
      viewed++;
      if (r.right + r.wrong + r.confused + r.cleared > 0) engaged++;
    });
    const completion = viewed ? Math.round(engaged / viewed * 100) : 0;

    // 今天学了吗
    const activeToday = h.lastDay === dayKey(Date.now());

    return {
      totalMin: Math.round(h.totalMin),
      avgSessionMin: avgSessionMin,
      sessions: s.length,
      streak: h.streak || 0,
      activeToday: activeToday,
      peaks: peaks,
      askPref: askPref,
      askTotal: atTotal,
      viewed: viewed,
      engaged: engaged,
      completion: completion,
      dayHist: h.dayHist,
      hourHist: h.hourHist
    };
  }

  /** 注意力预算：根据习惯和当前时刻，估算这会儿适合学多久 */
  function attention() {
    const hp = habitProfile();
    const hr = new Date().getHours();
    const lateNight = hr >= 23 || hr < 6;
    // 习惯数据太少时不下结论，避免「第一次来就被判定为只能学 1 分钟」
    const enoughData = hp.sessions >= 3 && hp.totalMin >= 10;
    const shortRun = enoughData && hp.avgSessionMin > 0 && hp.avgSessionMin < 9;
    const longRun = enoughData && hp.avgSessionMin >= 20;

    let key = 'medium', min = 15, reason = '';
    if (lateNight) {
      key = 'short'; min = 6;
      reason = '现在是深夜，记忆留存差 —— 给你安排轻量复习而不是啃新概念';
    } else if (shortRun) {
      key = 'short'; min = 8;
      reason = '你习惯碎片时间学（平均一次 ' + hp.avgSessionMin + ' 分钟）—— 按 8 分钟一份拆给你';
    } else if (longRun) {
      key = 'long'; min = 30;
      reason = '你通常一次能学 ' + hp.avgSessionMin + ' 分钟 —— 今天给一份完整的长内容';
    } else if (enoughData) {
      reason = '按你一贯的节奏（单次约 ' + hp.avgSessionMin + ' 分钟），今天安排约 15 分钟';
    } else {
      reason = '刚起步，先按 15 分钟安排；等积累几次学习后我会按你的真实节奏调整';
    }
    return { key: key, min: min, reason: reason, hour: hr, enoughData: enoughData };
  }

  /* ============================================================
     学习计划（持久化，不是每次现算的推荐）
     ------------------------------------------------------------
     和「今日推荐」的四点本质区别：
       1. 大纲固定 —— Curriculum 里排好课程顺序，按你的真实进度往前走
       2. 当天冻结 —— 今天这份清单生成后就钉住，做完就是做完，不会刷新变样
       3. 真实判定 —— 点开不算，「读够了 + 留下痕迹（答题 / 表态）」才算完成
       4. 滚动补做 —— 昨天没完成的排到今天最前面先补上
     ============================================================ */
  const READ_MS = 25 * 1000;          // 累计读满 25 秒才算「读过」
  const MAX_CARRY = 3;                // 昨天最多顺延 3 项

  /** 这个概念算不算「学过了」：大纲据此决定要不要继续往前走 */
  function graduated(id) {
    if (S.syllabus.learned.indexOf(id) >= 0) return true;
    const r = S.terms[id];
    return !!(r && r.seen && r.mastery >= 2);
  }

  /** 当前应该推进到第几课；返回 0 表示全部结业 */
  function curLessonNo() {
    const C = window.Curriculum;
    if (!C) return 1;
    for (let i = 0; i < C.lessons.length; i++) {
      if (!C.lessons[i].ids.every(graduated)) return C.lessons[i].no;
    }
    return 0;
  }

  /** 今天能推进多少个新概念：由注意力预算 + 历史单次时长共同决定 */
  function paceToday() {
    const att = attention();
    if (att.key === 'short') return 1;
    if (att.enoughData) {
      const avg = habitProfile().avgSessionMin;
      if (avg >= 25) return 3;
      if (avg < 9) return 1;
    }
    return att.key === 'long' ? 3 : 2;
  }

  function ensurePlan() {
    if (!S) load();
    if (!S.syllabus) S.syllabus = { startedAt: Date.now(), learned: [], doneAt: {} };
    if (!S.planLog || typeof S.planLog !== 'object') S.planLog = {};
    const today = dayKey(Date.now());
    if (S.plan && S.plan.date === today) return S.plan;

    // 归档昨天：留一条「昨天完成了几项」的记录
    if (S.plan && S.plan.date !== today) {
      const p = S.plan;
      S.planLog[p.date] = {
        total: p.items.length,
        done: p.items.filter(function (i) { return i.done; }).length,
        min: p.items.reduce(function (a, i) { return a + i.min; }, 0),
        lessonNo: p.lessonNo
      };
      const keys = Object.keys(S.planLog).sort();
      if (keys.length > 90) delete S.planLog[keys[0]];
    }
    S.plan = genPlan(today);
    save();
    return S.plan;
  }

  function genPlan(today) {
    const C = window.Curriculum;
    const att = attention();
    const no = curLessonNo();
    const cur = no ? C.get(no) : null;
    const prev = S.plan;
    const seq = [];
    const taken = {};
    let k = 0;
    const newId = function () { return today.replace(/-/g, '') + '_' + (k++).toString(36); };
    const keyOf = function (i) { return i.termId || ('x' + i.type + i.lessonNo); };

    function add(o) {
      const it = Object.assign({
        id: newId(), type: 'review', termId: null, termIds: null, lessonNo: no,
        title: '', min: 2, why: '', carried: false, fromDate: null, done: false, doneAt: 0
      }, o);
      it.prog = { ms: 0, read: false, act: false, quiz: false };
      it.need = it.need || { read: true, act: true };
      seq.push(it);
      taken[keyOf(it)] = 1;
      return it;
    }

    /* 1) 昨天没做完的，今天排最前面先补 */
    let carried = 0;
    if (prev && prev.date !== today && Array.isArray(prev.items)) {
      prev.items.forEach(function (i) {
        if (i.done || carried >= MAX_CARRY) return;
        if (taken[keyOf(i)]) return;
        carried++;
        add({
          type: i.type, termId: i.termId, termIds: i.termIds || null, lessonNo: i.lessonNo,
          title: i.title, min: i.min, need: i.need,
          why: '昨天这项没完成，今天先把它做完', carried: true, fromDate: prev.date
        });
      });
    }

    /* 2) 热身复习：复习队列里优先级最高的 */
    const nReview = att.key === 'short' ? 2 : 3;
    reviewQueueRaw(99).forEach(function (x) {
      if (seq.filter(function (i) { return i.type !== 'checkpoint'; }).length >= nReview + carried) return;
      if (taken[x.term.id]) return;
      add({
        type: 'review', termId: x.term.id, min: 2,
        why: x.rec.confused > 0
          ? '你标记过「还是不懂」，趁还没忘干净收一下'
          : '复习队列里优先级最高：不熟 + 有一阵没看了'
      });
    });

    /* 3) 今天的正式内容 */
    const pace = paceToday();
    if (cur) {
      if (cur.kind === 'checkpoint') {
        // 阶段检查：不学新东西，把本阶段最弱的几个重做一遍 + 一次综合测验
        const slowest = cur.ids.slice().sort(function (a, b) {
          return (masteryOf(a) - masteryOf(b));
        });
        slowest.slice(0, Math.max(2, pace)).forEach(function (id) {
          if (taken[id]) return;
          add({
            type: 'review', termId: id, lessonNo: cur.no, min: 2,
            why: '阶段检查：『' + cur.title.replace('阶段检查 · ', '') + '』里你最不熟的一环'
          });
        });
        add({
          type: 'checkpoint', termId: slowest.filter(function (id) { return !taken[id]; })[0] || slowest[0],
          termIds: cur.ids, lessonNo: cur.no, min: Math.max(4, Math.round(cur.ids.length * 0.8)),
          title: cur.title, why: cur.goal,
          need: { read: false, act: true }
        });
      } else {
        const fresh = cur.ids.filter(function (id) { return !graduated(id) && !taken[id]; });
        fresh.slice(0, pace).forEach(function (id) {
          const t = window.TERMS.find(function (x) { return x.id === id; });
          add({
            type: 'new', termId: id, lessonNo: cur.no,
            min: t ? Math.max(3, Math.min(9, 2 + t.level)) : 4,
            why: cur.goal
          });
        });
      }
    }

    /* 4) 收尾测验：对着今天最后一个要搞清楚的概念出 */
    const anchor = seq.filter(function (i) { return i.type === 'new' || i.type === 'review'; }).pop();
    if (anchor && anchor.termId) {
      const t = window.TERMS.find(function (x) { return x.id === anchor.termId; });
      if (t && t.quiz && t.quiz.length) {
        add({
          type: 'quiz', termId: t.id, lessonNo: anchor.lessonNo, min: 2,
          why: '做道题检验一下 —— 比再看一遍有用', need: { read: true, quiz: true }
        });
      }
    }

    return {
      date: today, genAt: Date.now(),
      lessonNo: cur ? cur.no : 0,
      lessonTitle: cur ? cur.title : '全部课程已学完',
      lessonGoal: cur ? cur.goal : '',
      lessonKind: cur ? cur.kind : 'done',
      budgetMin: att.min,
      carriedCount: carried,
      items: seq
    };
  }

  function masteryOf(id) {
    const r = S.terms[id];
    return r ? (r.mastery || 0) : -1;
  }

  /** 判断一项是否真的达成了它要求的那些动作 */
  function itemSatisfied(it) {
    const p = it.prog || {};
    const n = it.need || {};
    return (!n.read || !!p.read) && (!n.act || !!p.act) && (!n.quiz || !!p.quiz);
  }

  /** 记录一次学习动作，并重算今天各项的完成态 */
  function noteAction(termId, kind, ms) {
    const p = ensurePlan();
    if (!p.items.length) return null;
    let changed = null;
    p.items.forEach(function (it) {
      const hit = it.termId === termId || (it.termIds && it.termIds.indexOf(termId) >= 0);
      if (!hit || it.done) return;
      const pr = it.prog;
      if (kind === 'read') pr.ms = (pr.ms || 0) + (ms || 0);
      if (kind === 'read' && pr.ms >= READ_MS) pr.read = true;
      if (kind === 'quiz') { pr.quiz = true; pr.act = true; }
      if (kind === 'fb') pr.act = true;
      if (!it.done && itemSatisfied(it)) {
        it.done = true; it.doneAt = Date.now();
        if (it.type === 'new' && it.termId && S.syllabus.learned.indexOf(it.termId) < 0) {
          S.syllabus.learned.push(it.termId);
        }
        changed = it;
      }
    });
    if (changed) save();
    return changed;
  }

  /** 整份计划的进度概览 */
  function planState() {
    const p = ensurePlan();
    const done = p.items.filter(function (i) { return i.done; });
    const remain = p.items.filter(function (i) { return !i.done; });
    return {
      date: p.date,
      lessonNo: p.lessonNo, lessonTitle: p.lessonTitle, lessonGoal: p.lessonGoal, lessonKind: p.lessonKind,
      budgetMin: p.budgetMin, carriedCount: p.carriedCount,
      items: p.items,
      total: p.items.length,
      doneCount: done.length,
      remainCount: remain.length,
      remainMin: remain.reduce(function (a, i) { return a + i.min; }, 0),
      totalMin: p.items.reduce(function (a, i) { return a + i.min; }, 0),
      pct: p.items.length ? Math.round(done.length / p.items.length * 100) : 0,
      allDone: p.items.length > 0 && done.length === p.items.length
    };
  }

  /** 大纲总览：课表 + 当前位置 + 剩余预测 */
  function syllabusState() {
    if (!S) load();
    const C = window.Curriculum;
    const no = curLessonNo();
    const list = C.lessons.map(function (l) {
      const got = l.ids.filter(graduated).length;
      return {
        lesson: l, kind: l.kind, stage: l.stage, no: l.no,
        title: l.title, goal: l.goal, ids: l.ids, min: l.min,
        total: l.ids.length, got: got,
        pct: Math.round(got / l.ids.length * 100),
        done: got >= l.ids.length,
        current: l.no === no
      };
    });
    const real = list.filter(function (l) { return l.kind === 'lesson'; });
    const realDone = real.filter(function (l) { return l.done; }).length;
    const learnedCount = window.TERMS.filter(function (t) { return graduated(t.id); }).length;
    const remainTerms = window.TERMS.length - learnedCount;
    const pace = paceToday();
    const etaDays = remainTerms === 0 ? 0 : Math.max(1, Math.ceil(remainTerms / Math.max(1, pace)));

    const byStage = window.STAGES.map(function (s) {
      const ls = list.filter(function (l) { return l.stage === s.id; });
      const terms = window.TERMS.filter(function (t) { return t.stage === s.id; });
      return {
        stage: s, lessons: ls,
        totalTerms: terms.length,
        gotTerms: terms.filter(function (t) { return graduated(t.id); }).length,
        doneLessons: ls.filter(function (l) { return l.done; }).length,
        totalLessons: ls.length,
        done: ls.every(function (l) { return l.done; })
      };
    });

    // 最近 7 天的完成情况
    const week = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(Date.now() - i * 86400000);
      const k = dayKey(d.getTime());
      const log = S.planLog[k];
      week.push({
        date: k, wd: '日一二三四五六'[d.getDay()],
        isToday: i === 0,
        total: log ? log.total : 0,
        done: log ? log.done : 0,
        min: log ? log.min : 0
      });
    }

    return {
      lessons: list, curNo: no, cur: no ? C.get(no) : null,
      realTotal: real.length, realDone: realDone,
      realNo: Math.min(realDone + 1, real.length),
      totalTerms: window.TERMS.length, learnedCount: learnedCount, remainTerms: remainTerms,
      totalMin: C.lessons.reduce(function (a, l) { return a + l.min; }, 0),
      pace: pace, etaDays: etaDays,
      byStage: byStage, week: week,
      finished: no === 0
    };
  }

  function reviewQueueRaw(limit) {
    const now = Date.now();
    const arr = window.TERMS.map(function (t) {
      const r = S.terms[t.id] || null;
      if (!r || !r.seen) return null;
      if (r.mastery >= 3.5) return null;
      const days = (now - (r.lastAt || now)) / 86400000;
      const pr = (5 - r.mastery) * 2 + Math.min(days, 14) * 0.4 + (r.confused || 0) * 1.5;
      return { term: t, rec: r, days: days, pr: +pr.toFixed(2) };
    }).filter(Boolean);
    arr.sort(function (a, b) { return b.pr - a.pr; });
    return arr.slice(0, limit || 8);
  }

  /* ============================================================
     自适应：为一个术语算出「该怎么讲」
     ============================================================ */
  function adaptFor(term) {
    const weak = weakCats();
    const catIsWeak = weak.some(function (c) { return c.key === term.cat; });
    const r = termRec(term.id);
    const selfWeak = r.mastery < 2 && (r.wrong + r.confused) >= 1;
    const lv = computeLevel();
    const hp = habitProfile();
    const att = attention();
    const prefs = S.prefs;

    const simple = (catIsWeak || selfWeak || lv.gi === 0) && prefs.autoSimple;
    const depth = lv.gi === 0 ? 'shallow' : (lv.gi >= 2 ? 'deep' : 'normal');

    let style = prefs.style;
    if (style === 'auto') {
      if (hp.askPref) style = { example: 'example', why: 'why', how: 'steps', simpler: 'analogy', other: 'standard' }[hp.askPref.key];
      else style = simple ? 'analogy' : 'standard';
    }

    const reasons = [];
    if (catIsWeak) reasons.push('你在「' + window.CATS[term.cat].name + '」这类内容上多次卡住');
    if (selfWeak) reasons.push('这个概念你自己卡过');
    if (lv.gi === 0) reasons.push('你目前处于「' + GRADES[0].name + '」阶段');
    if (att.key === 'short') reasons.push('现在是你的碎片/深夜时段');

    return {
      simple: simple,
      depth: depth,
      style: style,
      attention: att,
      weakCats: weak,
      show: {
        analogy: true,
        steps: att.key !== 'short',
        pm: lv.gi >= 1 || window.CATS[term.cat].key !== 'concept',
        pitfalls: lv.gi >= 2,
        quiz: att.key !== 'short'
      },
      reason: reasons.length ? reasons.join('，') : '',
      prefix: prefixFor(term)
    };
  }

  /** 找出当前术语的先修知识（更基础、还没掌握的关联概念） */
  function prefixFor(term) {
    return term.related.map(function (id) {
      return window.TERMS.find(function (t) { return t.id === id; });
    }).filter(function (t) {
      if (!t) return false;
      const r = S.terms[t.id];
      return t.level < term.level && !(r && r.mastery >= 3.5);
    });
  }

  function catProfile() {
    const out = [];
    Object.keys(window.CATS).forEach(function (k) {
      const c = S.cats[k] || { right: 0, wrong: 0, confused: 0, cleared: 0, touch: 0 };
      const neg = c.wrong * 1.4 + c.confused * 2;
      const pos = c.right * 1.2 + c.cleared * 1.6;
      const attempts = c.wrong + c.right + c.confused + c.cleared;
      const score = attempts === 0 ? null : Math.max(0, Math.min(100, Math.round((pos / (pos + neg || 1)) * 100)));
      out.push({
        key: k, name: window.CATS[k].name, hint: window.CATS[k].hint, color: window.CATS[k].color,
        score: score, attempts: attempts, wrong: c.wrong, confused: c.confused, right: c.right, cleared: c.cleared,
        weak: attempts >= 2 && score !== null && score < 55
      });
    });
    return out;
  }

  function weakCats() {
    return catProfile().filter(function (c) { return c.weak; }).sort(function (a, b) { return a.score - b.score; });
  }

  function struggleTerms() {
    const arr = [];
    Object.keys(S.terms).forEach(function (id) {
      const r = S.terms[id];
      const pain = r.wrong * 1.4 + r.confused * 2 - r.cleared * 1.6;
      if (pain > 0.5) arr.push({ id: id, pain: +pain.toFixed(2), mastery: r.mastery, rec: r });
    });
    return arr.sort(function (a, b) { return b.pain - a.pain; });
  }

  /* ============================================================
     对外 API
     ============================================================ */
  const api = {
    get state() { return load(); },
    GRADES: GRADES,

    init() {
      load();
      touchSession();
      firstTouch = false;
      tick(true);
      if (!beatTimer) beatTimer = setInterval(function () { tick(); }, 30000);
      const onLeave = function () { touchSession(); tick(true); save(); };
      window.addEventListener('pagehide', onLeave);
      window.addEventListener('beforeunload', onLeave);
      document.addEventListener('visibilitychange', function () {
        if (document.visibilityState === 'hidden') onLeave();
        else { lastTick = Date.now(); touchSession(); }
      });
      return api;
    },

    viewTerm(id, cat) {
      const r = termRec(id);
      r.views++; r.seen = 1; r.lastAt = Date.now();
      touchCat(cat, 'touch', 0);
      log('view', id, { cat: cat });
      S.habits.viewTotal = (S.habits.viewTotal || 0) + 1;
      touchSession();
      if (curSession) {
        curSession.views++;
        if (curSession.terms.indexOf(id) < 0) curSession.terms.push(id);
      }
      save();
    },

    dwell(id, ms) {
      const r = termRec(id);
      const v = Math.min(ms, 20 * 60 * 1000);
      r.dwell = (r.dwell || 0) + v;
      noteAction(id, 'read', v);   // 累计读够 25 秒才算计划里的「读过」
      save();
    },

    /** 记录用户「读到哪走掉了」 —— 完成度信号 */
    finish(id, deep) {
      log(deep ? 'finish' : 'leave', id, {});
      save();
    },

    quiz(id, cat, ok) {
      const r = termRec(id);
      if (ok) { r.right++; touchCat(cat, 'right'); } else { r.wrong++; touchCat(cat, 'wrong'); }
      S.meta.totalQuiz++; if (ok) S.meta.totalRight++;
      S.habits.quizDone = (S.habits.quizDone || 0) + 1;
      log(ok ? 'quiz_right' : 'quiz_wrong', id, { cat: cat });
      if (curSession) curSession.quiz++;
      recompute(id);
      noteAction(id, 'quiz');
      save();
    },

    /** 今日学习采用“一题一屏”时，答完即完成当天这个知识点；答错会进入复习队列。 */
    completeDailyQuiz(id, cat, ok) {
      const r = termRec(id);
      if (!r.seen) { r.seen = 1; r.views = Math.max(1, r.views || 0); r.lastAt = Date.now(); }
      api.quiz(id, cat, ok);
      const p = ensurePlan();
      p.items.forEach(function (it) {
        const hit = it.termId === id || (it.termIds && it.termIds.indexOf(id) >= 0);
        if (!hit || it.done) return;
        it.prog = it.prog || {};
        it.prog.read = true; it.prog.act = true; it.prog.quiz = true; it.prog.ms = Math.max(READ_MS, it.prog.ms || 0);
        it.done = true; it.doneAt = Date.now();
        if (it.type === 'new' && S.syllabus.learned.indexOf(id) < 0) {
          S.syllabus.learned.push(id); S.syllabus.doneAt[id] = Date.now();
        }
      });
      save(); return planState();
    },

    confused(id, cat, source) {
      termRec(id).confused++;
      touchCat(cat, 'confused');
      log('confused', id, { cat: cat, source: source || 'button' });
      recompute(id);
      noteAction(id, 'fb');
      save();
    },

    cleared(id, cat, source) {
      termRec(id).cleared++;
      touchCat(cat, 'cleared');
      log('cleared', id, { cat: cat, source: source || 'button' });
      recompute(id); save();
    },

    /** 记录一次追问，并归类到追问偏好 */
    logAsk(text) {
      const s = String(text || '');
      const bucket = /例子|举个|举个例|场景|怎么用|实战/.test(s) ? 'example'
        : /为什么|凭什么|有什么用|干嘛|意义|必要/.test(s) ? 'why'
          : /怎么做|怎么实现|如何做|怎么搭|步骤|流程|原理/.test(s) ? 'how'
            : /简单|不懂|没懂|再说一遍|比喻|通俗|抽象|小白/.test(s) ? 'simpler'
              : 'other';
      S.habits.askTypes[bucket] = (S.habits.askTypes[bucket] || 0) + 1;
      if (curSession) curSession.asks++;
      save();
      return bucket;
    },

    level: computeLevel,
    habits: habitProfile,
    attention: attention,
    plan: planState,
    syllabus: syllabusState,
    adaptFor: adaptFor,
    catProfile: catProfile,
    weakCats: weakCats,
    struggleTerms: struggleTerms,
    levelOf: levelOf,

    recommend() {
      const out = [];
      const plan = planState();
      plan.items.filter(function (i) { return !i.done; }).slice(0, 3).forEach(function (it) {
        const t = window.TERMS.find(function (x) { return x.id === it.termId; });
        if (!t) return;
        out.push({
          term: t,
          why: it.why,
          tag: it.type === 'review' ? '今天该复习' : (it.type === 'quiz' ? '做个题' :
            (it.type === 'checkpoint' ? '阶段检查' : '今天新学'))
        });
      });
      const weak = weakCats();
      weak.forEach(function (c) {
        const next = window.TERMS.filter(function (t) {
          return t.cat === c.key && !(S.terms[t.id] && S.terms[t.id].seen);
        }).sort(function (a, b) { return a.level - b.level || a.stage - b.stage; })[0];
        if (next) out.push({ term: next, why: '「' + c.name + '」是你最吃力的类型，从最基础的一个补起', tag: '补短板' });
      });
      const seenMap = {}, res = [];
      out.forEach(function (x) { if (!seenMap[x.term.id]) { seenMap[x.term.id] = 1; res.push(x); } });
      return res.slice(0, 4);
    },

    reviewQueue: function (l) { return reviewQueueRaw(l); },

    /* ---------- 学习计划的读写 ---------- */

    /** 今天这份计划里，和某个概念相关的项（术语页用） */
    planItemsFor(termId) {
      const p = ensurePlan();
      return p.items.filter(function (i) {
        return i.termId === termId || (i.termIds && i.termIds.indexOf(termId) >= 0);
      });
    },

    /** 计划里的上一项 / 下一项，用于术语页底部导航 */
    planNeighbors(termId) {
      const p = ensurePlan();
      const idx = p.items.findIndex(function (i) { return i.termId === termId; });
      if (idx < 0) return { prev: null, next: null, index: -1, total: p.items.length };
      const prev = p.items.slice(0, idx).reverse().find(function (i) { return i.termId; });
      const next = p.items.slice(idx + 1).find(function (i) { return i.termId && i.termId !== termId; });
      return {
        prev: prev ? { termId: prev.termId, title: prev.title, type: prev.type } : null,
        next: next ? { termId: next.termId, title: next.title, type: next.type } : null,
        index: idx, total: p.items.length
      };
    },

    /** 手动勾选 / 取消勾选某项（用户自己确认学过了） */
    togglePlanItem(id) {
      const p = ensurePlan();
      const it = p.items.find(function (i) { return i.id === id; });
      if (!it) return null;
      it.done = !it.done;
      it.doneAt = it.done ? Date.now() : 0;
      it.manual = it.done;
      if (it.done && it.type === 'new' && it.termId && S.syllabus.learned.indexOf(it.termId) < 0) {
        S.syllabus.learned.push(it.termId);
      }
      save();
      return it;
    },

    /** 强制重排今天（比如用户明确点了「今天换个内容」） */
    regenPlan() {
      S.plan = null;
      const p = genPlan(dayKey(Date.now()));
      S.plan = p; save();
      return planState();
    },

    /** 已完成该浏览量、还未满足条件的项，刷新一次完成态 */
    refreshPlan() { ensurePlan(); return planState(); },

    graduated: function (id) { return graduated(id); },

    progress: function () {
      const p = progressRaw();
      p.stageStat.forEach(function (s) {
        const list = window.TERMS.filter(function (x) { return x.stage === s.stage.id; });
        s.seen = list.filter(function (x) { const r = S.terms[x.id]; return r && r.seen; }).length;
        s.done = Math.round(list.filter(function (x) { const r = S.terms[x.id]; return r && r.mastery >= 3.5; }).length);
      });
      return p;
    },

    /** 生成给 LLM 的记忆摘要（注入 system prompt） */
    memoryBrief(currentTerm) {
      const lv = computeLevel();
      const hp = habitProfile();
      const p = progressRaw();
      const weak = weakCats();
      const strug = struggleTerms().slice(0, 5);
      const att = attention();
      const nm = function (id) { const x = window.TERMS.find(function (t) { return t.id === id; }); return x ? x.name : id; };

      const L = [];
      L.push('【学习者水平】');
      L.push('- 综合水平：' + lv.grade.name + '（' + lv.score + ' 分）' + (lv.trend.dir === 'new' ? '' : '，' + lv.trend.label));
      lv.parts.forEach(function (x) { L.push('  · ' + x.label + '：' + x.v + ' 分（' + x.note + '）'); });
      L.push('- 进度：' + p.mastered + '/' + p.total + ' 个概念已掌握，测验正确率 ' + (p.quizAcc === null ? '暂无' : p.quizAcc + '%'));

      L.push('');
      L.push('【学习习惯】');
      L.push('- 累计学习 ' + Math.round(hp.totalMin) + ' 分钟，共 ' + hp.sessions + ' 次会话，单次平均 ' + hp.avgSessionMin + ' 分钟');
      L.push('- 连续学习 ' + hp.streak + ' 天');
      if (hp.peaks.length) L.push('- 常在这些时段学：' + hp.peaks.map(function (x) { return x.h + ' 点'; }).join('、'));
      if (hp.askPref) L.push('- 追问习惯：' + hp.askPref.label + '（占 ' + hp.askPref.pct + '%）→ 优先用这种讲法开场');
      L.push('- 完成度 ' + hp.completion + '%（看过的概念里 ' + hp.engaged + '/' + hp.viewed + ' 个留下了反馈）');
      L.push('- 当下注意力预算：' + att.min + ' 分钟（' + att.key + '）');

      // 学习计划：让 AI 也知道「今天该学什么、走到第几课」
      const C = window.Curriculum;
      if (C) {
        const syx = syllabusState();
        const plan = planState();
        const course = syx.cur;
        const nmOf = function (i) {
          const t = window.TERMS.find(function (x) { return x.id === i.termId; });
          return t ? t.name : i.title;
        };
        L.push('');
        L.push('【学习计划】');
        L.push('- 课表进度：第 ' + syx.realNo + ' / ' + syx.realTotal + ' 课' +
          (course ? '，当前课程「' + course.title + '」（目标：' + course.goal + '）' : '，已全部结业'));
        L.push('- 今日清单 ' + plan.doneCount + '/' + plan.total + ' 项已完成，还剩 ' + plan.remainMin + ' 分钟' +
          (plan.items.length ? '：' + plan.items.filter(function (i) { return !i.done; }).slice(0, 5)
            .map(function (i) { return nmOf(i) + '（' + i.type + '）'; }).join('、') : ''));
        const doneToday = plan.items.filter(function (i) { return i.done; });
        if (doneToday.length) L.push('- 今天已经完成的：' + doneToday.map(nmOf).join('、'));
        L.push('- 用户问到还没学到的东西时可以直接讲，但要提醒他「这在课表第 N 课，现在看会有点跳」。');
      }

      L.push('');
      L.push('【理解难点】');
      if (weak.length) {
        L.push('- 吃力的内容类型：' + weak.map(function (w) { return w.name + '（健康度 ' + w.score + '%）'; }).join('、'));
        L.push('- 遇到这类内容：先用生活类比，句子更短，先讲「为什么需要它」再讲「它是什么」，讲完主动给一个例子。');
      } else {
        L.push('- 暂无明显薄弱类型。');
      }
      if (strug.length) {
        L.push('- 反复卡住的概念：' + strug.map(function (s) {
          return nm(s.id) + '（不懂 ' + s.rec.confused + ' 次 / 答错 ' + s.rec.wrong + ' 次）';
        }).join('、'));
        L.push('- 用户再问到这些概念时，换一个完全不同角度的类比，不要重复上一次的讲法。');
      }
      const interview = S.lab && S.lab.interview && S.lab.interview.result;
      if (interview) {
        const dims = window.INTERVIEW_DIMS || {};
        const weakDims = Object.keys(interview.dims || {}).sort(function (a, b) {
          return interview.dims[a].score - interview.dims[b].score;
        }).slice(0, 3);
        L.push('');
        L.push('【AI PM 面试测评】');
        L.push('- 最近得分：' + interview.score + '/100（' + interview.label + '）');
        if (weakDims.length) L.push('- 优先补强：' + weakDims.map(function (k) {
          return (dims[k] ? dims[k].name : k) + ' ' + interview.dims[k].score + ' 分';
        }).join('、'));
        L.push('- 回答面试相关问题时，优先追问判断依据，并针对最低分维度指出缺失的产品决策。');
      }
      if (currentTerm) {
        const r = S.terms[currentTerm.id];
        L.push('');
        L.push('【当前概念】' + currentTerm.name + '（' + currentTerm.en + '）');
        L.push(r
          ? '历史：浏览 ' + r.views + ' 次、停留 ' + Math.round((r.dwell || 0) / 1000) + ' 秒、答对 ' + r.right + ' 次、答错 ' + r.wrong + ' 次、标记不懂 ' + r.confused + ' 次'
          : '首次接触');
      }
      return L.join('\n');
    },

    pushChat(role, content, termId) {
      const c = S.chat;
      c.push({ role: role, content: content, termId: termId || null, t: Date.now() });
      if (c.length > 120) c.splice(0, c.length - 120);
      save();
    },
    chatHistory(termId) {
      return S.chat.filter(function (m) { return !termId || m.termId === termId; }).slice(-12);
    },
    clearChat() { S.chat = []; save(); },

    detectSignal(text, termId) {
      if (!termId) return null;
      const s = String(text || '').toLowerCase();
      const neg = ['不懂', '没懂', '不明白', '听不懂', '看不懂', '太难', '复杂', '再说一遍', '重新解释', '还是不会', 'confused', '难理解', '抽象'];
      const pos = ['懂了', '明白了', '清楚了', 'get 到了', '理解了', '原来如此', '知道了', '学会'];
      const term = window.TERMS.find(function (t) { return t.id === termId; });
      let hit = null;
      neg.forEach(function (k) { if (s.indexOf(k) >= 0) hit = 'confused'; });
      if (!hit) pos.forEach(function (k) { if (s.indexOf(k) >= 0) hit = 'cleared'; });
      if (!hit || !term) return null;
      const key = hit === 'confused' ? 'confused' : 'cleared';
      const before = S.terms[termId] ? (S.terms[termId][key] || 0) : 0;
      if (hit === 'confused') api.confused(termId, term.cat, 'chat'); else api.cleared(termId, term.cat, 'chat');
      return S.terms[termId][key] > before ? hit : null;
    },

    setPref(k, v) { S.prefs[k] = v; save(); },

    exportJSON() { return JSON.stringify(load(), null, 2); },
    importJSON(txt) {
      try {
        const o = JSON.parse(txt);
        if (!o || typeof o !== 'object') throw new Error('bad');
        S = migrate(o); save(); return true;
      } catch (e) { return false; }
    },
    reset() { S = EMPTY(); save(); },
    save: save
  };

  window.Mem = api;
})();
