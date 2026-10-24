/* ============================================================
   Store · 持久化 + 跨设备同步层
   ------------------------------------------------------------
   三层保险：
   1. localStorage        —— 立即可写的热存储 + 最近 3 份快照（防写坏）
   2. 本地文件（可选）    —— FileSystem Access API 写到用户指定的文件，
                            放进 iCloud / OneDrive / 坚果云即可跨设备同步
   3. 导出 / 导入 JSON    —— 兜底

   设计原则：永远先写本地（不丢），再异步写文件；读的时候取
   「本地 vs 文件」合并后的结果，事件流取并集。
   ============================================================ */

(function () {
  const HOT = 'aipm.memory.v1';
  const SNAP_PREFIX = 'aipm.snapshot.';
  const IDB_NAME = 'aipm.store';
  const IDB_STORE = 'kv';
  const FILE_HANDLE_KEY = 'fileHandle';

  /* ---------- 极简 IndexedDB（存文件句柄用） ---------- */
  const IDB = {
    open() {
      return new Promise(function (res, rej) {
        if (!window.indexedDB) return rej(new Error('no-idb'));
        const r = indexedDB.open(IDB_NAME, 1);
        r.onupgradeneeded = function () {
          const db = r.result;
          if (!db.objectStoreNames.contains(IDB_STORE)) db.createObjectStore(IDB_STORE);
        };
        r.onsuccess = function () { res(r.result); };
        r.onerror = function () { rej(r.error); };
      });
    },
    async get(k) {
      const db = await IDB.open();
      return new Promise(function (res, rej) {
        const tx = db.transaction(IDB_STORE, 'readonly');
        const rq = tx.objectStore(IDB_STORE).get(k);
        rq.onsuccess = function () { res(rq.result); };
        rq.onerror = function () { rej(rq.error); };
      });
    },
    async set(k, v) {
      const db = await IDB.open();
      return new Promise(function (res, rej) {
        const tx = db.transaction(IDB_STORE, 'readwrite');
        tx.objectStore(IDB_STORE).put(v, k);
        tx.oncomplete = function () { res(true); };
        tx.onerror = function () { rej(tx.error); };
      });
    },
    async del(k) {
      try {
        const db = await IDB.open();
        await new Promise(function (res, rej) {
          const tx = db.transaction(IDB_STORE, 'readwrite');
          tx.objectStore(IDB_STORE).delete(k);
          tx.oncomplete = function () { res(); };
          tx.onerror = function () { rej(tx.error); };
        });
      } catch (e) { /* ignore */ }
    }
  };

  /* ---------- 环境能力检测 ---------- */
  function support() {
    const picker = !!(window.showOpenFilePicker || window.showSaveFilePicker);
    const secure = window.isSecureContext;
    const fileOrigin = location.protocol === 'file:';
    return {
      picker: picker,
      secure: secure,
      fileOrigin: fileOrigin,
      // Chrome 在 file:// 下禁用 IndexedDB（opaque origin），必须用 http(s)
      usable: picker && secure && !fileOrigin,
      reason: !picker ? '当前浏览器不支持文件系统访问 API（建议用 Chrome / Edge）'
        : fileOrigin ? '请通过本地服务器打开（http://127.0.0.1:端口），file:// 下浏览器禁用了文件读写'
          : !secure ? '非安全上下文，浏览器禁用了文件读写' : ''
    };
  }

  function notify() {
    if (Store.onChange) { try { Store.onChange(Store); } catch (e) { console.warn(e); } }
  }

  async function ensurePerm(h) {
    if (!h.queryPermission) return true;
    const q = await h.queryPermission({ mode: 'readwrite' });
    if (q === 'granted') return true;
    const r = await h.requestPermission({ mode: 'readwrite' });
    return r === 'granted';
  }

  async function readFileJSON(h) {
    try {
      const f = await h.getFile();
      const t = await f.text();
      if (!t || !t.trim()) return null;
      const o = JSON.parse(t);
      return (o && typeof o === 'object') ? o : null;
    } catch (e) { return null; }
  }

  function readHot() {
    try {
      const raw = localStorage.getItem(HOT);
      return raw ? JSON.parse(raw) : null;
    } catch (e) { return null; }
  }
  function writeHot(o) {
    try { localStorage.setItem(HOT, JSON.stringify(o)); } catch (e) { console.warn('写本地失败', e); }
  }

  /** 保留最近 3 份快照，用于数据损坏时回滚 */
  function snapshot(state) {
    try {
      localStorage.setItem(SNAP_PREFIX + Date.now(), JSON.stringify(state));
      let all = Object.keys(localStorage).filter(function (k) { return k.indexOf(SNAP_PREFIX) === 0; }).sort();
      while (all.length > 3) {
        localStorage.removeItem(all.shift());
        all = Object.keys(localStorage).filter(function (k) { return k.indexOf(SNAP_PREFIX) === 0; }).sort();
      }
    } catch (e) { /* 配额满就算了 */ }
  }

  function unionBy(arr, keyFn) {
    const m = new Map();
    arr.forEach(function (x) { m.set(keyFn(x), x); });
    return Array.from(m.values());
  }

  function mergeNum(a, b, arrays) {
    const out = {};
    a = a || {}; b = b || {};
    Object.keys(a).concat(Object.keys(b)).forEach(function (k) {
      const x = a[k], y = b[k];
      if (arrays.indexOf(k) >= 0 && (Array.isArray(x) || Array.isArray(y))) {
        const xa = Array.isArray(x) ? x : [], ya = Array.isArray(y) ? y : [];
        const n = Math.max(xa.length, ya.length);
        const arr = [];
        for (let i = 0; i < n; i++) arr.push(Math.max(Number(xa[i]) || 0, Number(ya[i]) || 0));
        out[k] = arr;
      } else if (Array.isArray(x) || Array.isArray(y)) {
        out[k] = (x || []).length >= (y || []).length ? x : y;
      } else if (x && typeof x === 'object') {
        out[k] = mergeNum(x, (y && typeof y === 'object') ? y : {}, arrays);
      } else if (y && typeof y === 'object') {
        out[k] = mergeNum(x || {}, y, arrays);
      } else {
        out[k] = Math.max(Number(x) || 0, Number(y) || 0);
      }
    });
    return out;
  }

  const COUNT_FIELDS = ['seen', 'views', 'dwell', 'right', 'wrong', 'confused', 'cleared'];

  function chooseSession(a, b) {
    if (!a) return b || null;
    if (!b) return a;
    if (a.date && b.date && a.date !== b.date) return a.date > b.date ? a : b;
    const progress = function (x) {
      return (x.completedAt ? 1000000 : 0) + ((x.responses || x.answers || []).length * 1000) + (x.index || 0);
    };
    return progress(a) > progress(b) ? a : progress(b) > progress(a) ? b :
      (a.completedAt || a.startedAt || 0) >= (b.completedAt || b.startedAt || 0) ? a : b;
  }
  function mergePlan(a, b) {
    if (!a) return b || null;
    if (!b) return a;
    if (a.date !== b.date) return String(a.date || '') > String(b.date || '') ? a : b;
    const done = function (x) { return (x.items || []).filter(function (item) { return item.done; }).length; };
    const base = done(a) >= done(b) ? a : b;
    const other = base === a ? b : a;
    const out = JSON.parse(JSON.stringify(base));
    const key = function (item) { return (item.termId || item.title || '') + '|' + item.type + '|' + item.lessonNo; };
    (other.items || []).forEach(function (item) {
      const current = (out.items || []).find(function (x) { return key(x) === key(item); });
      if (!current) { out.items.push(item); return; }
      current.done = !!(current.done || item.done);
      current.doneAt = Math.max(current.doneAt || 0, item.doneAt || 0);
      if (current.prog || item.prog) {
        const x = current.prog || {}, y = item.prog || {};
        current.prog = { ms: Math.max(x.ms || 0, y.ms || 0), read: !!(x.read || y.read),
          act: !!(x.act || y.act), quiz: !!(x.quiz || y.quiz) };
      }
    });
    return out;
  }

  /* ---------- 合并策略 ----------
     · 整体：取 updatedAt 更新的一方
     · 事件流：按 t+type+termId+source 去重取并集（不丢另一台设备的学习记录）
     · 对话：按 t+role 去重取并集
     · 计数类（terms / cats / habits / meta）：逐字段取较大值
  ------------------------------------ */
  function mergeDoc(a, b) {
    const base = (a.updatedAt || 0) >= (b.updatedAt || 0) ? a : b;
    const newest = base === a ? a : b;
    const out = JSON.parse(JSON.stringify(base));

    out.events = unionBy(
      [].concat(a.events || [], b.events || []),
      function (e) { return e.id || e.t + '|' + e.type + '|' + (e.termId || '') + '|' + (e.source || ''); }
    ).sort(function (x, y) { return y.t - x.t; }).slice(0, 600);

    out.chat = unionBy(
      [].concat(a.chat || [], b.chat || []),
      function (c) { return c.id || c.t + '|' + c.role + '|' + (c.content || ''); }
    ).sort(function (x, y) { return x.t - y.t; }).slice(-120);

    const mentorA = a.mentor || {}, mentorB = b.mentor || {};
    const summaries = [mentorA.summary, mentorB.summary].filter(Boolean).sort(function (x, y) { return (y.at || 0) - (x.at || 0); });
    const supplements = Object.assign({}, mentorA.supplements || {});
    Object.keys(mentorB.supplements || {}).forEach(function (key) {
      const incoming = mentorB.supplements[key];
      if (!supplements[key] || (incoming.at || 0) >= (supplements[key].at || 0)) supplements[key] = incoming;
    });
    out.mentor = {
      signals: unionBy([].concat(mentorA.signals || [], mentorB.signals || []), function (s) { return s.id; })
        .sort(function (x, y) { return x.at - y.at; }).slice(-300),
      summary: summaries[0] || null,
      supplements: supplements
    };

    const mergedTerms = JSON.parse(JSON.stringify(a.terms || {}));
    Object.keys(b.terms || {}).forEach(function (id) {
      const x = b.terms[id];
      const cur = mergedTerms[id];
      if (!cur) { mergedTerms[id] = JSON.parse(JSON.stringify(x)); return; }
      COUNT_FIELDS.forEach(function (f) { cur[f] = Math.max(cur[f] || 0, x[f] || 0); });
      cur.lastAt = Math.max(cur.lastAt || 0, x.lastAt || 0);
      cur.mastery = Math.max(cur.mastery || 0, x.mastery || 0);
    });
    out.terms = mergedTerms;

    const mergedCats = JSON.parse(JSON.stringify(a.cats || {}));
    Object.keys(b.cats || {}).forEach(function (id) {
      const x = b.cats[id] || {};
      const cur = mergedCats[id] || { right: 0, wrong: 0, confused: 0, cleared: 0, touch: 0 };
      mergedCats[id] = {
        right: Math.max(cur.right || 0, x.right || 0),
        wrong: Math.max(cur.wrong || 0, x.wrong || 0),
        confused: Math.max(cur.confused || 0, x.confused || 0),
        cleared: Math.max(cur.cleared || 0, x.cleared || 0),
        touch: Math.max(cur.touch || 0, x.touch || 0)
      };
    });
    out.cats = mergedCats;

    if (a.habits || b.habits) {
      out.habits = mergeNum(a.habits || {}, b.habits || {}, ['hourHist', 'dayHist']);
      out.habits.lastDay = String((a.habits || {}).lastDay || '') > String((b.habits || {}).lastDay || '')
        ? (a.habits || {}).lastDay : (b.habits || {}).lastDay || '';
    }
    if (a.meta || b.meta) out.meta = mergeNum(a.meta || {}, b.meta || {}, []);
    out.sessions = unionBy([].concat(a.sessions || [], b.sessions || []), function (s) { return String(s.start); })
      .sort(function (x, y) { return x.start - y.start; }).slice(-400);
    out.level = {
      history: unionBy(
        [].concat((a.level || {}).history || [], (b.level || {}).history || []),
        function (h) { return dayKey(h.t); }
      ).sort(function (x, y) { return x.t - y.t; }).slice(-200)
    };
    const sylA = a.syllabus || {}, sylB = b.syllabus || {};
    const doneAt = Object.assign({}, sylA.doneAt || {});
    Object.keys(sylB.doneAt || {}).forEach(function (id) { doneAt[id] = Math.max(doneAt[id] || 0, sylB.doneAt[id] || 0); });
    out.syllabus = { startedAt: Math.min(sylA.startedAt || Date.now(), sylB.startedAt || Date.now()),
      learned: Array.from(new Set([].concat(sylA.learned || [], sylB.learned || []))), doneAt: doneAt };
    out.planLog = Object.assign({}, a.planLog || {});
    Object.keys(b.planLog || {}).forEach(function (day) {
      const incoming = b.planLog[day], current = out.planLog[day];
      if (!current || (incoming.done || 0) >= (current.done || 0)) out.planLog[day] = incoming;
    });
    out.dailyLearning = chooseSession(a.dailyLearning, b.dailyLearning);

    const mergedQuiz = JSON.parse(JSON.stringify(a.quizVariants || {}));
    Object.keys(b.quizVariants || {}).forEach(function (termId) {
      const x = b.quizVariants[termId] || {};
      const cur = mergedQuiz[termId] || { answered: {}, recentIds: [], correct: 0, wrong: 0 };
      cur.answered = cur.answered || {};
      Object.keys(x.answered || {}).forEach(function (qid) {
        const qa = cur.answered[qid] || {};
        const qb = x.answered[qid] || {};
        cur.answered[qid] = {
          attempts: Math.max(qa.attempts || 0, qb.attempts || 0),
          correct: Math.max(qa.correct || 0, qb.correct || 0),
          wrong: Math.max(qa.wrong || 0, qb.wrong || 0),
          lastAt: Math.max(qa.lastAt || 0, qb.lastAt || 0)
        };
      });
      cur.correct = Math.max(cur.correct || 0, x.correct || 0);
      cur.wrong = Math.max(cur.wrong || 0, x.wrong || 0);
      cur.recentIds = unionBy([].concat(cur.recentIds || [], x.recentIds || []), function (id) { return id; }).slice(-6);
      mergedQuiz[termId] = cur;
    });
    out.quizVariants = mergedQuiz;

    const labA = a.lab || {}, labB = b.lab || {};
    if (a.lab || b.lab) {
      out.lab = JSON.parse(JSON.stringify(newest.lab || (base === a ? labB : labA)));
      out.lab.practices = Object.assign({}, labA.practices || {});
      Object.keys(labB.practices || {}).forEach(function (id) {
        const incoming = labB.practices[id];
        const current = out.lab.practices[id];
        if (!current || (incoming.updatedAt || 0) >= (current.updatedAt || 0)) out.lab.practices[id] = incoming;
      });
      const ia = labA.interview || {}, ib = labB.interview || {};
      out.lab.interview = out.lab.interview || {};
      out.lab.interview.history = unionBy([].concat(ia.history || [], ib.history || []), function (x) {
        return x.at || x.score + '|' + (x.questionIds || []).join(',');
      }).sort(function (x, y) { return (x.at || 0) - (y.at || 0); }).slice(-20);
      const mergedStats = Object.assign({}, ia.questionStats || {});
      Object.keys(ib.questionStats || {}).forEach(function (id) {
        const x = ib.questionStats[id], current = mergedStats[id];
        if (!current) mergedStats[id] = x;
        else mergedStats[id] = { attempts: Math.max(current.attempts || 0, x.attempts || 0),
          correct: Math.max(current.correct || 0, x.correct || 0), wrong: Math.max(current.wrong || 0, x.wrong || 0),
          lastAt: Math.max(current.lastAt || 0, x.lastAt || 0),
          lastQuestionId: (x.lastAt || 0) >= (current.lastAt || 0) ? x.lastQuestionId : current.lastQuestionId };
      });
      out.lab.interview.questionStats = mergedStats;
      out.lab.interview.recentSessions = unionBy([].concat(ia.recentSessions || [], ib.recentSessions || []), function (x) {
        return (x || []).join('|');
      }).slice(-2);
      if (!out.lab.interview.startedAt && (!out.lab.interview.result || (ib.completedAt || 0) > (ia.completedAt || 0))) {
        const completed = (ia.completedAt || 0) >= (ib.completedAt || 0) ? ia : ib;
        if (completed.result) {
          out.lab.interview.result = completed.result;
          out.lab.interview.completedAt = completed.completedAt;
        }
      }
      out.lab.plan = newest.lab && newest.lab.plan || labA.plan || labB.plan || null;
    }

    out.learningPractice = chooseSession(a.learningPractice, b.learningPractice);
    out.practiceRounds = unionBy([].concat(a.practiceRounds || [], b.practiceRounds || []), function (round) {
      return round.id || String(round.startedAt);
    }).sort(function (x, y) { return (x.completedAt || 0) - (y.completedAt || 0); }).slice(-100);
    out.spacedSession = chooseSession(a.spacedSession, b.spacedSession);
    const mergedSpaced = JSON.parse(JSON.stringify(a.spacedReview || {}));
    Object.keys(b.spacedReview || {}).forEach(function (id) {
      const other = b.spacedReview[id];
      const current = mergedSpaced[id];
      if (!current) { mergedSpaced[id] = JSON.parse(JSON.stringify(other)); return; }
      const later = (other.lastAt || 0) >= (current.lastAt || 0) ? other : current;
      const histories = unionBy([].concat(current.reviewHistory || [], other.reviewHistory || []), function (h) {
        return h.at + '|' + h.questionId;
      }).sort(function (x, y) { return x.at - y.at; }).slice(-20);
      mergedSpaced[id] = Object.assign({}, later, { reviewHistory: histories });
    });
    out.spacedReview = mergedSpaced;

    const learnA = a.learningMemory || {}, learnB = b.learningMemory || {};
    const attempts = unionBy([].concat(learnA.attempts || [], learnB.attempts || []), function (x) { return x.id; })
      .sort(function (x, y) { return (x.at || 0) - (y.at || 0); }).slice(-3000);
    const legacyMap = new Map();
    [].concat(learnA.legacyWrong || [], learnB.legacyWrong || []).forEach(function (x) {
      const key = x.termId + '|' + x.questionId;
      const old = legacyMap.get(key);
      if (!old || (x.count || 0) > (old.count || 0)) legacyMap.set(key, x);
    });
    const manual = Object.assign({}, learnA.manual || {});
    Object.keys(learnB.manual || {}).forEach(function (id) {
      const incoming = learnB.manual[id];
      if (!manual[id] || (incoming.at || 0) >= (manual[id].at || 0)) manual[id] = incoming;
    });
    const legacyWrong = Array.from(legacyMap.values());
    out.learningMemory = { version: 1, migrated: !!(learnA.migrated || learnB.migrated), attempts: attempts,
      legacyWrong: legacyWrong, manual: manual,
      patterns: window.LearnerMemory ? window.LearnerMemory.buildPatterns(attempts, legacyWrong)
        : Object.assign({}, learnA.patterns || {}, learnB.patterns || {}) };

    out.prefs = newest.prefs || base.prefs;
    const profileA = a.learnerProfile || {}, profileB = b.learnerProfile || {};
    out.learnerProfile = (profileA.updatedAt || 0) >= (profileB.updatedAt || 0) ? profileA : profileB;
    out.plan = mergePlan(a.plan, b.plan);
    out.updatedAt = Math.max(a.updatedAt || 0, b.updatedAt || 0);
    out.createdAt = Math.min(a.createdAt || Date.now(), b.createdAt || Date.now());
    return out;
  }

  function dayKey(ts) {
    const d = new Date(ts);
    return d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate();
  }

  /* ---------- Store ---------- */
  const Store = {
    build: 'store-2',
    handle: null,
    fileName: '',
    status: 'local',       // local | syncing | synced | error
    lastSync: 0,
    lastError: '',
    onChange: null,
    _timer: null,
    _writing: false,
    support: support,
    dayKey: dayKey,
    mergeDoc: mergeDoc,
    readHot: readHot,
    applyRemote(remote) {
      if (!remote || typeof remote !== 'object') return null;
      const local = readHot();
      const merged = local ? mergeDoc(local, remote) : remote;
      writeHot(merged);
      snapshot(merged);
      if (window.Mem && window.Mem.reload) window.Mem.reload();
      notify();
      return merged;
    },

    async init() {
      const s = support();
      if (!s.usable) { Store.status = 'local'; Store.lastError = s.reason; return Store; }
      try {
        const h = await IDB.get(FILE_HANDLE_KEY);
        if (h) {
          Store.handle = h;
          Store.fileName = h.name || 'AI_PM_学习记忆.json';
          Store.status = 'syncing';
          await Store.pull();
        }
      } catch (e) {
        Store.status = 'local';
        Store.lastError = String((e && e.message) || e);
      }
      return Store;
    },

    /** 让用户选一个文件作为同步载体 */
    async link(create) {
      const s = support();
      if (!s.usable) throw new Error(s.reason || '不支持');
      let h;
      try {
        if (create && window.showSaveFilePicker) {
          h = await window.showSaveFilePicker({
            suggestedName: 'AI_PM_学习记忆.json',
            types: [{ description: 'JSON 记忆文件', accept: { 'application/json': ['.json'] } }]
          });
        } else {
          const arr = await window.showOpenFilePicker({
            types: [{ description: 'JSON 记忆文件', accept: { 'application/json': ['.json'] } }],
            multiple: false
          });
          h = arr[0];
        }
      } catch (e) {
        if (e && e.name === 'AbortError') return null;
        throw e;
      }
      const perm = await ensurePerm(h);
      if (!perm) throw new Error('没有获得文件读写权限');
      Store.handle = h;
      Store.fileName = h.name;
      try { await IDB.set(FILE_HANDLE_KEY, h); } catch (e) { /* 句柄存不下则本次会话内仍可用 */ }
      Store.status = 'syncing';
      notify();
      const applied = await Store.pull();
      if (!applied) await Store.push(true);
      return h;
    },

    async unlink() {
      Store.handle = null;
      Store.fileName = '';
      Store.status = 'local';
      Store.lastError = '';
      await IDB.del(FILE_HANDLE_KEY);
      notify();
    },

    /** 读远端（文件），与本地合并 */
    async pull() {
      if (!Store.handle) return false;
      try {
        const perm = await ensurePerm(Store.handle);
        if (!perm) {
          Store.status = 'error';
          Store.lastError = '文件权限已失效，请重新连接';
          notify();
          return false;
        }
        const remote = await readFileJSON(Store.handle);
        if (!remote) return false;
        const local = readHot();
        if (!local) {
          Store.applyRemote(remote);
          Store.lastSync = Date.now();
          Store.status = 'synced';
          notify();
          return true;
        }
        Store.applyRemote(remote);
        Store.lastSync = Date.now();
        Store.status = 'synced';
        Store.lastError = '';
        notify();
        return true;
      } catch (e) {
        Store.status = 'error';
        Store.lastError = String((e && e.message) || e);
        notify();
        return false;
      }
    },

    /** 写本地（同步）+ 延迟写文件 */
    write(state) {
      writeHot(state);
      snapshot(state);
      if (window.CloudSync) window.CloudSync.schedule();
      if (!Store.handle) return;
      clearTimeout(Store._timer);
      Store._timer = setTimeout(function () { Store.push(); }, 1200);
    },

    /** 立刻推到文件 */
    async push(force) {
      if (!Store.handle) return false;
      if (Store._writing) return false;
      Store._writing = true;
      Store.status = 'syncing';
      notify();
      try {
        const perm = await ensurePerm(Store.handle);
        if (!perm) throw new Error('文件权限已失效，请重新连接');
        const local = readHot();
        const remote = force ? null : await readFileJSON(Store.handle);
        // 远端比本地新 → 先合并再写回，避免覆盖另一台设备的进度
        let out = local;
        if (remote && remote.updatedAt > local.updatedAt) out = mergeDoc(local, remote);
        const w = await Store.handle.createWritable();
        await w.write(JSON.stringify(out, null, 2));
        await w.close();
        if (out !== local) Store.applyRemote(out);
        Store.lastSync = Date.now();
        Store.status = 'synced';
        Store.lastError = '';
        notify();
        return true;
      } catch (e) {
        Store.status = 'error';
        Store.lastError = String((e && e.message) || e);
        notify();
        return false;
      } finally {
        Store._writing = false;
      }
    },

    listSnapshots() {
      return Object.keys(localStorage)
        .filter(function (k) { return k.indexOf(SNAP_PREFIX) === 0; })
        .sort().reverse()
        .map(function (k) {
          let n = 0, u = 0;
          try {
            const o = JSON.parse(localStorage.getItem(k));
            n = (o.events || []).length;
            u = o.updatedAt;
          } catch (e) { /* ignore */ }
          return { key: k, ts: +k.slice(SNAP_PREFIX.length), events: n, updatedAt: u };
        });
    },

    restoreSnapshot(key) {
      const raw = localStorage.getItem(key);
      if (!raw) return false;
      writeHot(JSON.parse(raw));
      return true;
    }
  };

  window.Store = Store;
})();
