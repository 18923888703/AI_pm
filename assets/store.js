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
      function (e) { return e.t + '|' + e.type + '|' + (e.termId || '') + '|' + (e.source || ''); }
    ).sort(function (x, y) { return y.t - x.t; }).slice(0, 600);

    out.chat = unionBy(
      [].concat(a.chat || [], b.chat || []),
      function (c) { return c.t + '|' + c.role; }
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

    if (a.habits || b.habits) out.habits = mergeNum(a.habits || {}, b.habits || {}, ['hourHist', 'dayHist']);
    if (a.meta || b.meta) out.meta = mergeNum(a.meta || {}, b.meta || {}, []);
    out.sessions = unionBy([].concat(a.sessions || [], b.sessions || []), function (s) { return String(s.start); })
      .sort(function (x, y) { return x.start - y.start; }).slice(-400);
    out.level = {
      history: unionBy(
        [].concat((a.level || {}).history || [], (b.level || {}).history || []),
        function (h) { return dayKey(h.t); }
      ).sort(function (x, y) { return x.t - y.t; }).slice(-200)
    };

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
    }

    out.learningPractice = newest.learningPractice || (base === a ? b.learningPractice : a.learningPractice) || null;
    out.practiceRounds = unionBy([].concat(a.practiceRounds || [], b.practiceRounds || []), function (round) {
      return round.id || String(round.startedAt);
    }).sort(function (x, y) { return (x.completedAt || 0) - (y.completedAt || 0); }).slice(-100);
    out.spacedSession = newest.spacedSession || (base === a ? b.spacedSession : a.spacedSession) || null;
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

    out.prefs = newest.prefs || base.prefs;
    out.plan = newest.plan || base.plan;
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
          writeHot(remote);
          Store.lastSync = Date.now();
          Store.status = 'synced';
          notify();
          return true;
        }
        writeHot(mergeDoc(local, remote));
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
        if (out !== local) writeHot(out);
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
