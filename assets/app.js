/* ============================================================
   App · 路由 / 渲染 / 交互
   ============================================================ */

(function () {
  const $ = function (s) { return document.querySelector(s); };
  const content = $('#content');
  const crumb = $('#crumb');

  let currentTerm = null;      // 当前正在看的术语
  let termEnterAt = 0;
  let searchQuery = '';
  let abortCtl = null;

  const T = function (id) { return window.TERMS.find(function (t) { return t.id === id; }); };
  const STAGE_ICONS = ['🌱', '🔧', '🔄', '🚀', '⚡', '🎯'];
  const stageIcon = function (id) { return STAGE_ICONS[id] || '•'; };

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  /** 极简 Markdown：加粗 / 行内代码 / 引用 / 分割线 / 换行 */
  function md(s) {
    let h = esc(s);
    h = h.replace(/`([^`]+)`/g, '<code>$1</code>');
    h = h.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
    h = h.split('\n').map(function (line) {
      if (/^\s*---\s*$/.test(line)) return '<hr>';
      if (/^\s*>\s?/.test(line)) return '<blockquote>' + line.replace(/^\s*>\s?/, '') + '</blockquote>';
      if (/^\s*·\s?/.test(line)) return '<div style="padding-left:2px">· ' + line.replace(/^\s*·\s?/, '') + '</div>';
      return line;
    }).join('<br>');
    return h;
  }

  function toast(msg) {
    const t = $('#toast');
    t.textContent = msg; t.classList.add('show');
    clearTimeout(toast._t);
    toast._t = setTimeout(function () { t.classList.remove('show'); }, 2200);
  }

  function levelPips(n) {
    let s = '';
    for (let i = 1; i <= 5; i++) s += '<span class="pip' + (i <= n ? ' on' : '') + '"></span>';
    return '<span class="lv">' + s + '</span>';
  }

  function masteryDot(id) {
    const r = window.Mem.state.terms[id];
    const m = r ? r.mastery : 0;
    const k = !r || !r.seen ? 'new' : (m >= 3.5 ? 'mastered' : (m >= 2 ? 'fuzzy' : 'weak'));
    return '<span class="dot ' + k + '" title="' + masteryLabel(id).label + '"></span>';
  }

  function masteryLabel(id) {
    const r = window.Mem.state.terms[id];
    const m = r ? r.mastery : 0;
    const o = { k: 'new', label: '未学习', color: '#91918e' };
    if (!r || !r.seen) return o;
    if (m >= 3.5) return { label: '已掌握', color: '#0f7b6c' };
    if (m >= 2) return { label: '有点模糊', color: '#d9730d' };
    return { label: '还没懂', color: '#e03e3e' };
  }

  /* ============================================================
     学习计划·渲染小件
     ============================================================ */
  const PLAN_TYPE = {
    new: { tag: '新学', cls: 'green' },
    review: { tag: '复习', cls: 'orange' },
    quiz: { tag: '测验', cls: 'purple' },
    checkpoint: { tag: '阶段检查', cls: 'blue' }
  };

  function planItemName(it) {
    if (it.type === 'checkpoint') return it.title || '阶段检查';
    const t = T(it.termId);
    return t ? t.name : (it.title || it.termId || '—');
  }

  /** 这项「还差什么才算出完成」 */
  function planNeedText(it) {
    const n = it.need || {}, p = it.prog || {};
    const out = [];
    if (n.read) out.push(p.read ? '✓ 读过了' : '读一遍');
    if (n.quiz) out.push(p.quiz ? '✓ 答过了' : '做道题');
    if (n.act && !n.quiz) out.push(p.act ? '✓ 表态了' : '答题或表态');
    return out.join(' · ');
  }

  function planItemRow(it, opts) {
    opts = opts || {};
    const meta = PLAN_TYPE[it.type] || PLAN_TYPE.review;
    return '<div class="plan-item' + (it.done ? ' done' : '') + '"' +
      (it.termId ? ' data-goto="term:' + it.termId + '"' : '') + '>' +
      '<span class="plan-check' + (it.done ? ' on' : '') + '" aria-hidden="true">' + (it.done ? '✓' : '') + '</span>' +
      '<div style="flex:1;min-width:0">' +
      '<div class="plan-nm">' + esc(planItemName(it)) +
      ' <span class="tag ' + meta.cls + '">' + meta.tag + '</span>' +
      (it.carried ? '<span class="tag red">昨天顺延</span>' : '') + '</div>' +
      (it.type === 'new' ? '' : '<div class="tiny">' + esc(it.why) + '</div>') +
      (it.done ? '<div class="plan-need ok">已完成</div>' : '<div class="plan-need">' + esc(planNeedText(it)) + '</div>') +
      '</div>' +
      '<span class="tiny" style="flex:0 0 auto">' + it.min + ' 分钟</span>' +
      (opts.nav ? '<span class="plan-go">开始 →</span>' : '') +
      '</div>';
  }

  /** 术语页顶部的「今天这份计划里它是第几项」条带 */
  function planStripHTML(t) {
    const myPlan = window.Mem.planItemsFor(t.id);
    if (!myPlan.length) return '';
    const it = myPlan[0];
    const meta = PLAN_TYPE[it.type] || PLAN_TYPE.review;
    const nb = window.Mem.planNeighbors(t.id);
    return '<div class="plan-strip' + (it.done ? ' done' : '') + '" id="planStrip" data-id="' + it.id + '">' +
      '<span class="ps-i">' + (it.done ? '✓' : (it.carried ? '↩' : '▸')) + '</span>' +
      '<div style="flex:1;min-width:0">' +
      '<div class="ps-top"><b>今日计划 · 第 ' + (nb.index + 1) + ' / ' + nb.total + ' 项</b>' +
      ' <span class="tag ' + meta.cls + '">' + meta.tag + '</span>' +
      (it.carried ? '<span class="tag red">昨天顺延</span>' : '') +
      (it.done ? '<span class="tag green">已完成</span>' : '') + '</div>' +
      '<div class="ps-need tiny">' + (it.done ? '这项已经完成了，可以直接去下一项。' : '还差：' + esc(planNeedText(it))) + '</div>' +
      '</div></div>';
  }

  /** 术语页底部：沿着今天这份计划前后走 */
  function planNavHTML(t) {
    const nb = window.Mem.planNeighbors(t.id);
    if (nb.index < 0) return '';
    const nm = function (x) {
      const tt = T(x.termId); return tt ? tt.name : (x.title || x.termId || '');
    };
    return '<div class="plan-nav">' +
      (nb.prev
        ? '<button class="btn sm ghost" data-goto="term:' + nb.prev.termId + '">← 上一项：' + esc(nm(nb.prev)) + '</button>'
        : '<span class="tiny">这是今天计划里的第一项</span>') +
      (nb.next
        ? '<button class="btn sm primary" data-goto="term:' + nb.next.termId + '">下一项：' + esc(nm(nb.next)) + ' →</button>'
        : '<span class="tiny">这是今天计划里的最后一项</span>') +
      '</div>';
  }

  /** 计划状态变化时，只局部刷新计划相关的 UI，不打断正在做的测验 */
  let lastStripKey = '';
  function updatePlanUI() {
    renderSidebar();
    lastStripKey = '';
    if (!currentTerm) { render(); return; }
    const strip = document.querySelector('#planStrip');
    const sh = planStripHTML(currentTerm);
    if (strip) { if (sh) strip.outerHTML = sh; else strip.remove(); }
    else if (sh) {
      const head = document.querySelector('.term-head');
      if (head) head.insertAdjacentHTML('afterend', sh);
    }
    const nav = document.querySelector('.plan-nav');
    const nh = planNavHTML(currentTerm);
    if (nav) { if (nh) nav.outerHTML = nh; else nav.remove(); }
    else if (nh) {
      const fb = document.querySelector('.feedback');
      if (fb) fb.insertAdjacentHTML('afterend', nh);
    }
    a11yPass();
  }

  /** 心跳：把阅读时长记进去，并让条带上的「还差什么」实时更新 */
  function syncStripText() {
    const strip = document.querySelector('#planStrip');
    if (!strip || !currentTerm) return;
    const items = window.Mem.planItemsFor(currentTerm.id);
    if (!items.length) return;
    const it = items[0];
    const key = it.id + '|' + it.done + '|' + planNeedText(it);
    if (key === lastStripKey) return;
    lastStripKey = key;
    if (it.done) { updatePlanUI(); return; }
    const n = strip.querySelector('.ps-need');
    if (n) n.textContent = '还差：' + planNeedText(it);
  }

  /** 刚做完某项时给一句反馈 */
  function checkPlanDone(termId) {
    const items = window.Mem.planItemsFor(termId);
    const just = items.filter(function (i) { return i.done && i.doneAt && Date.now() - i.doneAt < 4000; });
    if (!just.length) return false;
    const p = window.Mem.plan();
    toast(p.allDone
      ? '🎉 今天的计划全部完成了'
      : '今日计划 ' + p.doneCount + '/' + p.total + ' 项完成 · 还剩 ' + p.remainMin + ' 分钟');
    return true;
  }

  /* ============================================================
     侧栏
     ============================================================ */
  function renderSidebar() {
    const lv = window.Mem.level();
    // 阶段树
    const tree = $('#stageTree');
    tree.innerHTML = window.STAGES.map(function (s) {
      const items = window.TERMS.filter(function (t) { return t.stage === s.id; });
      return '<div class="nav-item" data-stage="' + s.id + '">' +
        '<span class="nav-ico">' + stageIcon(s.id) + '</span>' +
        s.name +
        '<span class="nav-count">' + items.filter(function (t) {
          const r = window.Mem.state.terms[t.id]; return r && r.mastery >= 3.5;
        }).length + '/' + items.length + '</span></div>';
    }).join('');

    // 复习数
    const rq = window.Mem.reviewQueue(99);
    const rc = $('#reviewCount');
    rc.textContent = rq.length;
    rc.className = 'nav-count' + (rq.length ? ' hot' : '');

    // 今日待办数
    const pd = window.Mem.plan();
    const pc = $('#planCount');
    if (pc) {
      pc.textContent = pd.remainCount ? String(pd.remainCount) : '✓';
      pc.className = 'nav-count' + (pd.remainCount ? ' hot' : '');
    }

    const practice = window.Lab.practiceProgress();
    const practiceCount = $('#practiceCount');
    if (practiceCount) practiceCount.textContent = practice.done + '/' + practice.total;
    const interviewScore = $('#interviewScore');
    const interview = window.Lab.interview();
    if (interviewScore) interviewScore.textContent = interview.result ? interview.result.score :
      (interview.startedAt && !interview.completedAt ? '测评中' : '未测');

    // 进度环
    const p = window.Mem.progress();
    const C = 2 * Math.PI * 15;
    $('#ring').innerHTML =
      '<svg width="34" height="34" viewBox="0 0 34 34">' +
      '<circle cx="17" cy="17" r="15" fill="none" stroke="#e9e9e7" stroke-width="3"/>' +
      '<circle cx="17" cy="17" r="15" fill="none" stroke="' + lv.grade.color + '" stroke-width="3" stroke-linecap="round" ' +
      'stroke-dasharray="' + C + '" stroke-dashoffset="' + (C * (1 - p.pct / 100)) + '"/></svg>';
    $('#progPct').textContent = p.pct + '%';
    $('#progSub').textContent = '共 ' + p.mastered + ' / ' + p.total + ' 个概念';

    // 等级 + 同步状态
    const g = $('#gradeTag');
    g.textContent = lv.grade.name + ' · ' + lv.score;
    g.style.background = lv.grade.color + '14';
    g.style.color = lv.grade.color;
    $('#syncLine').innerHTML = syncLabel();

    const pp = window.Mem.habits();
    $('#memPeek').textContent = '🧠 ' + pp.totalMin + ' 分钟 · 连续 ' + pp.streak + ' 天 · ' + (window.Mem.state.events || []).length + ' 条记录';
  }

  function syncLabel() {
    const st = window.Store;
    if (!st.handle) return st.support().usable ? '本地存储 · 未同步' : '本地存储';
    const map = { syncing: '同步中…', synced: '已同步 · ' + timeAgo(st.lastSync), error: '同步失败' };
    return '<span style="color:' + (st.status === 'error' ? 'var(--red)' : 'var(--green)') + '">' +
      (map[st.status] || '本地存储') + '</span>';
  }

  /* ============================================================
     视图：学习计划（完整课表）
     ============================================================ */
  function viewPlan() {
    const sy = window.Mem.syllabus();
    const pd = window.Mem.plan();
    const cpCount = sy.lessons.filter(function (l) { return l.kind === 'checkpoint'; }).length;

    let html = '<div class="page"><h1>学习计划</h1>' +
      '<p class="lead">这是一份<b>有顺序的课表</b>：' + sy.realTotal + ' 节课 + ' + cpCount +
      ' 个阶段检查点，覆盖 ' + sy.totalTerms + ' 个概念。<br>' +
      '它决定你每天往前学什么；已经学过但还没掌握的，交给复习队列回头补 —— 两条线互不干扰。</p>';

    html += interviewPlanHTML(true);

    /* ---------- 总览 ---------- */
    html += '<div class="syl-top">' +
      '<div class="syl-card"><div class="l">当前进度</div>' +
      '<div class="n">' + sy.realNo + '<span>/' + sy.realTotal + '</span></div>' +
      '<div class="s">' + (sy.finished ? '已全部结业' : esc(sy.cur ? sy.cur.title : '')) + '</div></div>' +
      '<div class="syl-card"><div class="l">已学概念</div>' +
      '<div class="n">' + sy.learnedCount + '<span>/' + sy.totalTerms + '</span></div>' +
      '<div class="s">还剩 ' + sy.remainTerms + ' 个</div></div>' +
      '<div class="syl-card"><div class="l">按你的节奏</div>' +
      '<div class="n">' + sy.etaDays + '<span>天</span></div>' +
      '<div class="s">每天约 ' + sy.pace + ' 个概念 · 课程合计 ' + sy.totalMin + ' 分钟</div></div>' +
      '<div class="syl-card"><div class="l">今日清单</div>' +
      '<div class="n">' + pd.doneCount + '<span>/' + pd.total + '</span></div>' +
      '<div class="s">' + (pd.allDone ? '已完成 ✅' : '还剩 ' + pd.remainMin + ' 分钟') + '</div></div>' +
      '</div>';

    html += '<div class="bar" style="height:8px;margin:4px 0 2px"><i style="width:' +
      Math.round(sy.learnedCount / sy.totalTerms * 100) + '%;background:#0f7b6c"></i></div>' +
      '<div class="tiny" style="margin-bottom:22px">整体完成 ' +
      Math.round(sy.learnedCount / sy.totalTerms * 100) + '%</div>';

    /* ---------- 最近 7 天 ---------- */
    html += '<h2>最近 7 天</h2><div class="week-strip">';
    sy.week.forEach(function (d) {
      const full = d.total > 0 && d.done >= d.total;
      const none = d.total === 0;
      html += '<div class="week-day' + (d.isToday ? ' today' : '') + (full ? ' full' : '') + (none ? ' none' : '') + '">' +
        '<div class="wd">' + d.wd + '</div>' +
        '<div class="wn">' + (none ? '—' : d.done + '/' + d.total) + '</div>' +
        (d.isToday ? '<div class="wt">今天</div>' : '') +
        '</div>';
    });
    html += '</div>';
    const done7 = sy.week.reduce(function (a, d) { return a + d.done; }, 0);
    const tot7 = sy.week.reduce(function (a, d) { return a + d.total; }, 0);
    html += '<div class="tiny" style="margin-top:-8px">近 7 天完成 ' + done7 + ' / ' + tot7 +
      ' 项' + (tot7 ? '（完成率 ' + Math.round(done7 / tot7 * 100) + '%）' : '') + '</div>';

    /* ---------- 课表 ---------- */
    sy.byStage.forEach(function (sg) {
      html += '<div class="divider"></div><h2>' +
        '<span class="nav-ico">' + stageIcon(sg.stage.id) + '</span> ' +
        '阶段 ' + (sg.stage.id + 1) + ' · ' + esc(sg.stage.name) +
        ' <span class="tag' + (sg.done ? ' green' : '') + '">' + sg.gotTerms + '/' + sg.totalTerms + ' 概念</span></h2>' +
        '<p class="lead" style="margin-top:-6px">' + esc(sg.stage.desc) + '</p>';

      html += '<div class="lesson-list">';
      sg.lessons.forEach(function (l) {
        const nextId = l.ids.find(function (id) { return !window.Mem.graduated(id); });
        const target = nextId || l.ids[0];
        const isCp = l.kind === 'checkpoint';
        html += '<div class="lesson' + (l.done ? ' done' : '') + (l.current ? ' cur' : '') + '" data-goto="term:' + target + '">' +
          '<div class="lesson-no">' + (isCp ? '🏁' : l.no) + '</div>' +
          '<div style="flex:1;min-width:0">' +
          '<div class="lesson-t">' + esc(l.title) +
          (l.current ? '<span class="tag green">正在学</span>' : (l.done ? '<span class="tag">已完成</span>' : '')) +
          (isCp ? '<span class="tag blue">检查点</span>' : '') + '</div>' +
          '<div class="tiny">' + esc(l.goal) + '</div>' +
          '<div class="lesson-terms">' + l.ids.map(function (id) {
            const t = T(id); if (!t) return '';
            return '<span class="lt' + (window.Mem.graduated(id) ? ' ok' : '') + '">' + masteryDot(id) + esc(t.name) + '</span>';
          }).join('') + '</div>' +
          '</div>' +
          '<div style="flex:0 0 92px;text-align:right">' +
          '<div class="bar" style="margin-bottom:4px"><i style="width:' + l.pct + '%;background:' +
          (l.done ? '#0f7b6c' : l.current ? '#2383e2' : '#d9d9d7') + '"></i></div>' +
          '<div class="tiny">' + l.got + '/' + l.total + ' · 约 ' + l.min + ' 分钟</div>' +
          '</div></div>';
      });
      html += '</div>';
    });

    html += '<div class="divider"></div>' +
      '<div class="callout"><span class="emo">🧭</span><div class="ct"><b>这份计划是怎么跟着你变的</b><br>' +
      '· 每天推进几个概念，取决于你的<b>单次学习时长</b>习惯（现在是 ' + sy.pace + ' 个/天）<br>' +
      '· 某类概念连续卡住 → 自动切到<b>小白模式</b>并在这份课表里插补先修项<br>' +
      '· 一天没做完 → 没完成的项目会自动排到明天的<b>最前面</b><br>' +
      '· 计划按天冻结保存，可以随时在「设置与记忆」里导出、或在另一台设备同步回来</div></div>';

    return html + '</div>';
  }

  /* ============================================================
     视图：今日学习
     ============================================================ */
  function viewHome() {
    const lv = window.Mem.level();
    const hp = window.Mem.habits();
    const pd = window.Mem.plan();
    const sy = window.Mem.syllabus();
    const weak = window.Mem.weakCats();
    const strug = window.Mem.struggleTerms().slice(0, 3);

    let html = '<div class="page hero">' +
      '<h1>' + (pd.allDone ? '今天学完了' : '今天学 ' + pd.remainMin + ' 分钟') + '</h1>' +
      '<p class="lead">第 <b>' + sy.realNo + ' / ' + sy.realTotal + '</b> 课 · ' + esc(pd.lessonTitle) +
      '。按顺序完成下面 ' + pd.total + ' 项，进度会自动记录。</p>';

    /* ---------- 今日计划（持久化：今天生成后固定，做完就是做完） ---------- */
    html += '<div class="plan-card">';
    if (pd.allDone) {
      html += '<div class="plan-done-banner">🎉 今天的计划全部完成了 —— 还剩 ' + sy.remainTerms + ' 个概念没学，明天继续。</div>';
    }

    html += '<div class="plan-top">' +
      '<div style="min-width:0">' +
      '<div class="plan-title"><span class="tag">' + (pd.lessonKind === 'checkpoint' ? '阶段检查' : '第 ' + sy.realNo + ' 课') + '</span>' +
      ' <span class="tag">连续 ' + Math.max(1, hp.streak) + ' 天</span></div>' +
      '<div class="plan-lesson">' + esc(pd.lessonTitle) + '</div>' +
      '<div class="tiny">' + esc(pd.lessonGoal) + '</div>' +
      '</div>' +
      '<div class="plan-budget"><b>' + (pd.allDone ? '✓' : pd.remainMin) + '</b><span>' + (pd.allDone ? '已完成' : '分钟剩余') + '</span></div>' +
      '</div>';

    // 进度条
    html += '<div class="plan-bar"><i style="width:' + pd.pct + '%"></i></div>' +
      '<div class="plan-prog"><span>' + pd.doneCount + ' / ' + pd.total + ' 项已完成</span>' +
      '<span>按你的学习节奏安排</span></div>';

    if (pd.carriedCount) {
      html += '<div class="plan-carry">↩️ 昨天有 ' + pd.carriedCount + ' 项没做完，已经排到今天最前面</div>';
    }

    html += '<div class="plan-list">';
    pd.items.forEach(function (it) {
      html += planItemRow(it, { nav: true });
    });
    html += '</div>';

    const firstUndone = pd.items.find(function (i) { return !i.done && i.termId; });
    const noPlan = pd.items.length === 0;
    html += '<div class="plan-foot">' +
      (noPlan
        ? '<span class="tiny">' + (sy.finished ? '整份课表都学完了，接下来靠复习队列维持。' : '暂时没有可排的内容。') + '</span>'
        : '<span class="tiny">完成方式：阅读 25 秒，再做一道题或选择「懂了 / 还没懂」。</span>') +
      '<div style="display:flex;gap:8px;flex:0 0 auto">' +
      (firstUndone ? '<button class="btn primary sm" data-goto="term:' + firstUndone.termId + '">' +
        (pd.doneCount ? '继续：' + esc(planItemName(firstUndone)) : '开始今天的学习') + ' →</button>' : '') +
      '</div></div></div>';

    html += interviewPlanHTML(true);

    html += '<details class="home-progress"><summary><span>查看学习进展</span>' +
      '<span class="home-progress-meta">' + esc(lv.grade.name) + ' · 已掌握 ' + sy.learnedCount + '/' + sy.totalTerms +
      ' · 累计 ' + hp.totalMin + ' 分钟</span></summary><div class="home-progress-body">';

    /* ---------- 水平画像 ---------- */
    html += '<h2>我的水平</h2><div class="prof">' +
      '<div class="prof-main">' +
      '<div class="prof-grade" style="color:' + lv.grade.color + '">' + lv.grade.name + '</div>' +
      '<div class="prof-score"><b>' + lv.score + '</b><span>/100</span></div>' +
      '<div class="prof-trend ' + lv.trend.dir + '">' +
      (lv.trend.dir === 'up' ? '↗' : lv.trend.dir === 'down' ? '↘' : '→') + ' ' + esc(lv.trend.label) + '</div>' +
      (lv.next
        ? '<div class="tiny" style="margin-top:6px">距离「' + lv.next.name + '」还差 ' + lv.toNext + ' 分</div>'
        : '<div class="tiny" style="margin-top:6px">已达最高等级</div>') +
      '</div><div class="prof-parts">';
    lv.parts.forEach(function (x) {
      html += '<div class="pp"><div class="pp-top"><span>' + x.label + '</span><b>' + x.v + '</b></div>' +
        '<div class="bar"><i style="width:' + x.v + '%;background:' + lv.grade.color + '"></i></div>' +
        '<div class="tiny">' + esc(x.note) + '</div></div>';
    });
    html += '</div></div>';

    /* ---------- 习惯 ---------- */
    html += '<div class="habit-row">' +
      statBox(hp.totalMin, '分钟', '累计学习') +
      statBox(hp.avgSessionMin, '分钟', '单次平均') +
      statBox(hp.sessions, '次', '学习会话') +
      statBox(hp.completion + '%', '', '有效完成度') +
      (hp.askPref ? statBox(hp.askPref.pct + '%', '', hp.askPref.label) : '') +
      statBox(hp.peaks.length ? hp.peaks.map(function (x) { return x.h + '点'; }).join(' ') : '—', '', '常学时段') +
      '</div>';

    /* ---------- 自适应说明 ---------- */
    const adaptLines = [];
    if (weak.length) adaptLines.push('· 「' + weak.map(function (w) { return w.name; }).join('」「') + '」类内容已自动切到<b>小白模式</b>（更多类比、更少术语、先补先修知识）');
    if (lv.gi === 0) adaptLines.push('· 你还在起步阶段，术语页默认<b>收起难的部分</b>，先把故事听懂');
    if (lv.gi >= 2) adaptLines.push('· 你已进入「' + lv.grade.name + '」术语页会额外展开<b>容易踩的坑</b>');
    if (pd.budgetMin <= 8) adaptLines.push('· 当前时段不适合啃新东西，今天只排了 <b>' + pd.totalMin + ' 分钟</b> 的轻量任务');
    if (hp.askPref) adaptLines.push('· 你' + hp.askPref.label + '，AI 回答时会<b>优先用这种讲法</b>开场');
    adaptLines.push('· 以上都已写进 AI 的记忆摘要，追问时它知道你卡在哪、习惯怎么听');
    html += '<div class="callout yellow" style="margin-top:18px"><span class="emo">🧭</span><div class="ct">' +
      '<b>我已经据此做了这些调整</b><br>' + adaptLines.join('<br>') + '</div></div>';

    html += '<div class="divider"></div><h2>为你定制</h2><div class="rec-grid">';
    window.Mem.recommend().forEach(function (r) {
      html += '<div class="rec" data-goto="term:' + r.term.id + '">' +
        '<div class="t">' + esc(r.term.name) + ' <span class="tag">' + r.tag + '</span></div>' +
        '<div class="w">' + esc(r.why) + '</div></div>';
    });
    html += '</div>';

    if (strug.length) {
      html += '<h2>你反复卡住的地方</h2><div class="term-list">';
      strug.forEach(function (s) {
        const t = T(s.id); if (!t) return;
        html += '<div class="term-row" data-goto="term:' + t.id + '">' + masteryDot(t.id) +
          '<div style="flex:0 0 150px"><div class="nm">' + esc(t.name) + '</div><div class="en">' + esc(t.en) + '</div></div>' +
          '<div class="one">标记不懂 ' + s.rec.confused + ' 次 · 答错 ' + s.rec.wrong + ' 次</div></div>';
      });
      html += '</div>';
    }

    html += '<div class="divider"></div><h2>学习路径总览</h2>';
    window.Mem.progress().stageStat.forEach(function (s) {
      html += '<div class="term-row" data-route="path" style="margin-bottom:8px">' +
        '<span class="nav-ico">' + stageIcon(s.stage.id) + '</span>' +
        '<div style="flex:0 0 210px"><div class="nm">阶段 ' + (s.stage.id + 1) + ' · ' + esc(s.stage.name) + '</div>' +
        '<div class="en">' + esc(s.stage.sub) + '</div></div>' +
        '<div class="one">已掌握 ' + s.done + ' / ' + s.total + '</div>' +
        '<div style="flex:0 0 80px"><div class="bar"><i style="width:' + s.pct + '%;background:#0f7b6c"></i></div></div></div>';
    });

    html += '</div></details>';

    return html + '</div>';
  }

  function statBox(n, unit, label) {
    return '<div class="habit-box"><div class="hb-n">' + n + '<span>' + unit + '</span></div>' +
      '<div class="tiny">' + label + '</div></div>';
  }

  function greeting() {
    const h = new Date().getHours();
    if (h < 6) return '还没睡？';
    if (h < 11) return '早上好';
    if (h < 14) return '中午好';
    if (h < 18) return '下午好';
    return '晚上好';
  }

  /* ============================================================
     视图：学习路径
     ============================================================ */
  function viewPath() {
    const sy = window.Mem.syllabus();
    const currentStage = sy.cur ? sy.cur.stage : 0;
    let html = '<div class="page"><h1>学习路径</h1>' +
      '<p class="lead"><b>' + window.TERMS.length + ' 个概念，' + window.STAGES.length + ' 个阶段</b>，' +
      '从「AI 到底是什么」一路走到「独立交付一份能上线、可评测、可回滚的 AI 产品方案」。' +
      '建议按顺序学；已经有基础，也可以直接挑工作里卡住的概念。</p>';

    window.STAGES.forEach(function (s) {
      const items = window.TERMS.filter(function (t) { return t.stage === s.id; });
      const done = items.filter(function (t) { return window.Mem.graduated(t.id); }).length;
      html += '<details class="stage-block" id="stage-' + s.id + '"' + (s.id === currentStage ? ' open' : '') + '>' +
        '<summary><span class="stage-index">阶段 ' + (s.id + 1) + '</span>' +
        '<span class="stage-name">' + esc(s.name) + '</span>' +
        '<span class="stage-progress">' + done + ' / ' + items.length + '</span></summary>' +
        '<div class="stage-body"><div class="stage-sub">' + esc(s.desc) + '</div><div class="term-list">';
      items.forEach(function (t) {
        const lv = masteryLabel(t.id);
        html += '<div class="term-row" data-goto="term:' + t.id + '">' + masteryDot(t.id) +
          '<div style="flex:0 0 160px"><div class="nm">' + esc(t.name) + '</div><div class="en">' + esc(t.en) + '</div></div>' +
          '<div class="one">' + esc(t.one) + '</div>' +
          '<span class="tag" style="background:rgba(55,53,47,.05);color:' + lv.color + '">' + lv.label + '</span>' +
          levelPips(t.level) + '</div>';
      });
      html += '</div></div></details>';
    });
    return html + '</div>';
  }

  /* ============================================================
     视图：术语词典
     ============================================================ */
  function viewDict() {
    const q = searchQuery.trim().toLowerCase();
    const list = window.TERMS.filter(function (t) {
      if (!q) return true;
      return (t.name + t.en + t.one + t.analogy + t.cat).toLowerCase().indexOf(q) >= 0;
    }).sort(function (a, b) { return a.stage - b.stage || a.level - b.level; });

    let html = '<div class="page"><h1>术语词典</h1>' +
      '<p class="lead">开会听到听不懂的词，直接在这里搜。<b>' + window.TERMS.length + '</b> 个词条' +
      (q ? '，匹配到 <b>' + list.length + '</b> 个' : '') + '。</p>';

    html += '<div class="dict-search"><div class="search-box" style="max-width:340px">' +
      '<span class="ico">🔍</span><input id="dictSearch" placeholder="搜索术语、英文或含义…" value="' + esc(searchQuery) + '"></div></div>';

    html += '<div class="dict-head"><div>术语</div><div>一句话</div><div style="width:80px">掌握度</div></div>';
    if (!list.length) {
      html += '<div class="empty">没有匹配的术语，换个词试试</div>';
    } else {
      list.forEach(function (t) {
        const r = window.Mem.state.terms[t.id];
        const m = r ? r.mastery : 0;
        const lv = masteryLabel(t.id);
        html += '<div class="dict-row" data-goto="term:' + t.id + '">' +
          '<div class="d-nm">' + esc(t.name) + '<div class="tiny">' + esc(t.en) + '</div></div>' +
          '<div class="d-one">' + esc(t.one) + '</div>' +
          '<div style="width:80px"><div class="bar" style="margin:0"><i style="width:' + Math.round(m / 5 * 100) + '%;background:' + lv.color + '"></i></div>' +
          '<div class="tiny">' + lv.label + '</div></div></div>';
      });
    }
    return html + '</div>';
  }

  /* ============================================================
     视图：实战练习
     ============================================================ */
  function practiceStatus(id) {
    const r = window.Lab.practiceRec(id);
    if (window.Lab.practiceDone(id)) return { label: '已完成', cls: 'green' };
    if ((r.answer || '').trim() || r.decision != null || r.rating != null) return { label: '进行中', cls: 'orange' };
    return { label: '未开始', cls: '' };
  }

  function viewPractice() {
    const pg = window.Lab.practiceProgress();
    const tracks = [];
    window.PRACTICES.forEach(function (p) { if (tracks.indexOf(p.track) < 0) tracks.push(p.track); });
    let html = '<div class="page"><h1>实战练习</h1>' +
      '<p class="lead">把课件里的方法变成可以真正动手的任务。每题都要求你写方案、做关键判断，再按检查表自评。</p>' +
      '<div class="practice-overview"><div><b>' + pg.done + ' / ' + pg.total + '</b><span>已完成</span></div>' +
      '<div class="practice-overview-bar"><i style="width:' + pg.pct + '%"></i></div>' +
      '<button class="btn sm" data-route="interview">去做面试测评 →</button></div>';

    tracks.forEach(function (track) {
      html += '<h2 class="practice-track-title">' + esc(track) + '</h2><div class="practice-list">';
      window.PRACTICES.filter(function (p) { return p.track === track; }).forEach(function (p) {
        const st = practiceStatus(p.id);
        html += '<div class="practice-row" data-goto="practice/' + p.id + '">' +
          '<div class="practice-row-main"><div class="practice-row-title">' + esc(p.title) +
          ' <span class="tag ' + st.cls + '">' + st.label + '</span></div>' +
          '<div class="practice-row-desc">' + esc(p.scenario) + '</div>' +
          '<div class="tiny">' + esc(p.source) + '</div></div>' +
          '<div class="practice-row-meta"><b>' + p.min + '</b><span>分钟</span></div><span class="practice-arrow">›</span></div>';
      });
      html += '</div>';
    });
    return html + '</div>';
  }

  function viewPracticeDetail(id) {
    const p = window.Lab.exercise(id);
    if (!p) return '<div class="page"><div class="empty">找不到这个练习<br><br><button class="btn" data-route="practice">返回练习列表</button></div></div>';
    const r = window.Lab.practiceRec(id);
    let html = '<div class="page practice-page"><div class="practice-head">' +
      '<div><h1>' + esc(p.title) + '</h1><p class="lead">' + esc(p.source) + ' · 约 ' + p.min + ' 分钟</p></div>' +
      '<button class="btn sm ghost" data-route="practice">返回练习列表</button></div>' +
      '<div class="case-block"><b>场景</b><p>' + esc(p.scenario) + '</p></div>' +
      '<div class="practice-task"><h2>你的任务</h2><p>' + esc(p.task) + '</p></div>' +
      '<label class="practice-label" for="practiceAnswer">写下你的方案</label>' +
      '<textarea id="practiceAnswer" class="practice-answer" placeholder="先独立作答，再查看参考拆解。建议写出判断依据，不只写结论。">' + esc(r.answer || '') + '</textarea>' +
      '<div class="practice-save-row"><span class="tiny">答案只保存在当前浏览器。</span>' +
      '<button class="btn primary" data-practice-save="' + p.id + '">保存答案</button></div>' +
      '<h2>交付前检查</h2><div class="check-list">' + p.checkpoints.map(function (x) {
        return '<div><span>□</span>' + esc(x) + '</div>';
      }).join('') + '</div>' +
      '<h2>关键判断</h2><div class="practice-decision" data-id="' + p.id + '"><div class="practice-question">' + esc(p.decision.q) + '</div>';

    p.decision.options.forEach(function (o, i) {
      let cls = '';
      if (r.decision != null) {
        if (i === p.decision.a) cls = ' correct';
        else if (i === r.decision) cls = ' wrong';
      }
      html += '<button class="practice-option' + cls + '" data-practice-choice="' + i + '" data-practice-id="' + p.id + '"' +
        (r.decision != null ? ' disabled' : '') + '><span>' + 'ABCD'[i] + '</span>' + esc(o) + '</button>';
    });
    if (r.decision != null) html += '<div class="practice-explain">' + (r.correct ? '判断正确。' : '这一步需要再想想。') + esc(p.decision.why) + '</div>';
    html += '</div><details class="reference-answer"><summary>查看参考拆解</summary><div>' +
      p.reference.map(function (x) { return '<p>· ' + esc(x) + '</p>'; }).join('') + '</div></details>' +
      '<h2>完成后自评</h2><p class="muted small">不是给内容打分，而是判断你能否独立完成同类任务。</p>' +
      '<div class="self-rating">' + [
        ['0', '还不会', '离开参考答案无法开始'],
        ['1', '能跟做', '看着检查表可以完成'],
        ['2', '能独立做', '能自己产出可用方案'],
        ['3', '能解释取舍', '能说明为什么这样设计']
      ].map(function (x) {
        return '<button data-practice-rate="' + x[0] + '" data-practice-id="' + p.id + '" class="rating-btn' +
          (Number(r.rating) === Number(x[0]) ? ' active' : '') + '"><b>' + x[1] + '</b><span>' + x[2] + '</span></button>';
      }).join('') + '</div>' +
      '<div class="related-practice"><span class="tiny">相关知识：</span>' + p.related.map(function (id) {
        const t = T(id); return t ? '<button class="chip" data-goto="term:' + id + '">' + esc(t.name) + '</button>' : '';
      }).join('') + '</div>';
    return html + '</div>';
  }

  /* ============================================================
     视图：AI PM 面试测评
     ============================================================ */
  function scoreTone(score) {
    if (score >= 85) return 'var(--green)';
    if (score >= 60) return 'var(--blue)';
    if (score >= 40) return 'var(--orange)';
    return 'var(--red)';
  }

  function interviewPlanHTML(compact) {
    const plan = window.Lab.plan();
    if (!plan) return '';
    const undone = plan.days.filter(function (d) { return !d.done; });
    if (compact) {
      const next = undone[0];
      return '<div class="interview-plan-strip"><div><b>面试训练计划</b><span>' +
        (next ? '第 ' + next.day + ' 天 · ' + esc(next.title) : '计划已完成，可以复测了') + '</span></div>' +
        '<button class="btn sm" data-route="interview">查看计划 →</button></div>';
    }
    let html = '<div class="interview-plan"><div class="interview-plan-head"><div><h2>评分生成的学习计划</h2>' +
      '<p>' + esc(plan.strategy || '优先补最低分的三个维度，完成后重新测评。') + '</p></div><span class="tag blue">' +
      plan.days.length + ' 天</span></div><div class="interview-plan-days">';
    plan.days.forEach(function (d) {
      const dim = window.INTERVIEW_DIMS[d.dim];
      html += '<div class="plan-day' + (d.done ? ' done' : '') + '">' +
        '<button class="plan-day-check" data-plan-day="' + d.day + '" aria-label="切换第 ' + d.day + ' 天完成状态">' + (d.done ? '✓' : d.day) + '</button>' +
        '<div class="plan-day-main"><div><b>' + esc(d.title) + '</b><span class="tag">' + esc(dim.name) + '</span></div>' +
        '<span class="tiny">约 ' + d.min + ' 分钟</span>';
      if (d.kind === 'terms') {
        html += '<div class="plan-day-links">' + d.termIds.map(function (id) {
          const t = T(id); return t ? '<button data-goto="term:' + id + '">' + esc(t.name) + '</button>' : '';
        }).join('') + '</div>';
      } else if (d.kind === 'practice') {
        html += '<div class="plan-day-links"><button data-goto="practice/' + d.practiceId + '">打开实战练习 →</button></div>';
      } else {
        html += '<div class="plan-day-links"><button data-assess-start="1">重新测评 →</button></div>';
      }
      html += '</div></div>';
    });
    return html + '</div></div>';
  }

  function viewInterviewResult(iv) {
    const result = iv.result;
    const wrong = window.INTERVIEW_QUESTIONS.map(function (q, i) { return { q: q, answer: iv.answers[i] }; })
      .filter(function (x) { return x.answer !== x.q.a; });
    let html = '<div class="page"><div class="result-head"><div class="score-disc" style="--score:' + result.score + ';--score-color:' + scoreTone(result.score) + '"><b>' + result.score + '</b><span>/100</span></div>' +
      '<div><h1>' + esc(result.label) + '</h1><p class="lead">答对 ' + result.correct + ' / ' + result.total + ' 题。分数只反映这套题覆盖的能力，不代表招聘结论。</p>' +
      '<button class="btn" data-assess-start="1">重新测评</button></div></div>' +
      '<h2>六维能力诊断</h2><div class="dimension-list">';
    Object.keys(window.INTERVIEW_DIMS).forEach(function (k) {
      const d = window.INTERVIEW_DIMS[k], s = result.dims[k].score;
      html += '<div class="dimension-row"><div class="dimension-copy"><b>' + esc(d.name) + '</b><span>' + esc(d.desc) + '</span></div>' +
        '<div class="dimension-bar"><i style="width:' + s + '%;background:' + scoreTone(s) + '"></i></div><strong>' + s + '</strong></div>';
    });
    html += '</div>' + interviewPlanHTML(false);
    if (wrong.length) {
      html += '<h2>本次错题</h2><div class="wrong-list">' + wrong.map(function (x) {
        return '<details><summary>' + esc(x.q.q) + '</summary><p><b>正确答案：</b>' + esc(x.q.options[x.q.a]) + '</p><p>' + esc(x.q.why) + '</p></details>';
      }).join('') + '</div>';
    }
    return html + '</div>';
  }

  function viewInterview() {
    const iv = window.Lab.interview();
    if (iv.completedAt && iv.result) return viewInterviewResult(iv);
    if (iv.startedAt) {
      const idx = iv.answers.length;
      const q = window.INTERVIEW_QUESTIONS[idx];
      if (!q) return '<div class="page"><div class="empty">测评状态异常，请重新开始。<br><br><button class="btn" data-assess-start="1">重新开始</button></div></div>';
      const dim = window.INTERVIEW_DIMS[q.dim];
      return '<div class="page assessment-page"><div class="assessment-top"><div><span>第 ' + (idx + 1) + ' / ' + window.INTERVIEW_QUESTIONS.length + ' 题</span><b>' + esc(dim.name) + '</b></div>' +
        '<div class="assessment-progress"><i style="width:' + Math.round(idx / window.INTERVIEW_QUESTIONS.length * 100) + '%"></i></div></div>' +
        '<div class="assessment-card"><h1>' + esc(q.q) + '</h1><div class="assessment-options">' + q.options.map(function (o, i) {
          return '<button data-assess-answer="' + i + '"><span>' + 'ABCD'[i] + '</span>' + esc(o) + '</button>';
        }).join('') + '</div></div><p class="assessment-note">答题过程中不显示正误，避免后面的题被提示影响。</p></div>';
    }

    const last = (iv.history || []).slice(-1)[0];
    let html = '<div class="page interview-intro"><h1>AI PM 面试测评</h1>' +
      '<p class="lead">' + window.INTERVIEW_QUESTIONS.length + ' 道情境题，覆盖 AI 基础、需求判断、方案架构、Prompt 与工作流、产品化验证、交付风险六个维度。完成后自动生成补弱学习计划。</p>' +
      '<div class="assessment-facts"><div><b>' + window.INTERVIEW_QUESTIONS.length + '</b><span>道题</span></div><div><b>' + Object.keys(window.INTERVIEW_DIMS).length + '</b><span>能力维度</span></div><div><b>15</b><span>分钟左右</span></div></div>' +
      '<div class="dimension-preview">';
    Object.keys(window.INTERVIEW_DIMS).forEach(function (k) {
      const d = window.INTERVIEW_DIMS[k];
      html += '<div><b>' + esc(d.name) + '</b><span>' + esc(d.desc) + '</span></div>';
    });
    html += '</div>' + (last ? '<div class="last-score">上次得分 <b>' + last.score + '</b> / 100</div>' : '') +
      '<button class="btn primary assessment-start" data-assess-start="1">开始测评</button>' +
      '<p class="tiny">评分依据是固定题目和答案，不使用模型临场判断；结果保存在当前浏览器。</p></div>';
    return html;
  }

  /* ============================================================
     视图：复习队列
     ============================================================ */
  function viewReview() {
    const q = window.Mem.reviewQueue(99);
    let html = '<div class="page"><h1>复习队列</h1>' +
      '<p class="lead">掌握度不到「已掌握」、且越久没看的排在越前面。这是你的记忆在替你排优先级。</p>';

    if (!q.length) {
      html += '<div class="empty">🎉 暂时没有需要复习的内容<br><br>' +
        '<button class="btn" data-route="path">去学习路径看看</button></div>';
      return html + '</div>';
    }
    html += '<div class="term-list">';
    q.forEach(function (x) {
      const lv = masteryLabel(x.term.id);
      const days = x.days < 1 ? '今天' : Math.floor(x.days) + ' 天前';
      html += '<div class="term-row" data-goto="term:' + x.term.id + '">' + masteryDot(x.term.id) +
        '<div style="flex:0 0 150px"><div class="nm">' + esc(x.term.name) + '</div><div class="en">' + esc(x.term.en) + '</div></div>' +
        '<div class="one">' + esc(x.term.one) + '</div>' +
        '<span class="tag">' + lv.label + '</span>' +
        '<span class="tiny">' + days + '</span></div>';
    });
    return html + '</div></div>';
  }

  /* ============================================================
     视图：掌握度
     ============================================================ */
  function viewMastery() {
    const prof = window.Mem.catProfile();
    const hp = window.Mem.habits();
    const lv = window.Mem.level();
    let html = '<div class="page"><h1>我的掌握度</h1>' +
      '<p class="lead">这里是我对你的长期记忆。它会跨会话保留，并决定我怎么给你讲新东西。</p>';

    /* 学习习惯 */
    html += '<h2>学习习惯</h2><div class="card">' +
      '<div class="habit-row" style="margin-bottom:14px">' +
      statBox(hp.totalMin, '分钟', '累计学习') +
      statBox(hp.avgSessionMin, '分钟', '单次平均') +
      statBox(hp.sessions, '次', '学习会话') +
      statBox(hp.streak, '天', '连续学习') +
      statBox(hp.completion + '%', '', '有效完成度') +
      (hp.askPref ? statBox(hp.askPref.pct + '%', '', hp.askPref.label) : statBox(hp.askTotal, '次', '累计追问')) +
      '</div>' +
      hourChart(hp.hourHist) +
      '</div>';

    /* 水平构成 */
    html += '<h2>水平构成</h2><div class="card">' +
      '<div style="display:flex;align-items:baseline;gap:10px;margin-bottom:12px">' +
      '<span style="font-size:20px;font-weight:700;color:' + lv.grade.color + '">' + lv.grade.name + '</span>' +
      '<span class="muted">' + lv.score + ' / 100</span>' +
      '<span class="tiny ' + lv.trend.dir + '">' + esc(lv.trend.label) + '</span></div>';
    lv.parts.forEach(function (x) {
      html += '<div style="margin-bottom:12px"><div class="pp-top"><span>' + x.label + '</span><b>' + x.v + '</b></div>' +
        '<div class="bar"><i style="width:' + x.v + '%;background:' + lv.grade.color + '"></i></div>' +
        '<div class="tiny">' + esc(x.note) + '</div></div>';
    });
    (function () {
      const hist = (window.Mem.state.level || {}).history || [];
      if (hist.length >= 2) {
        const recent = hist.slice(-14);
        const max = Math.max.apply(null, recent.map(function (h) { return h.score; })) || 1;
        html += '<div class="tiny" style="margin-top:14px;margin-bottom:6px">水平走势（近 ' + recent.length + ' 天）</div>' +
          '<div class="spark">' + recent.map(function (h) {
            return '<i style="height:' + Math.max(4, Math.round(h.score / max * 100)) + '%;background:' + lv.grade.color +
              '" title="' + h.score + ' 分"></i>';
          }).join('') + '</div>';
      }
    })();
    html += '</div>';

    html += '<h2>四类内容 · 健康度</h2><div class="grid2">';
    prof.forEach(function (c) {
      const s = c.score === null ? 0 : c.score;
      html += '<div class="cat-card' + (c.weak ? ' weak' : '') + '">' +
        '<div class="cat-top"><span class="cat-name">' + c.name + '</span>' +
        (c.weak ? '<span class="tag red">理解吃力</span>' : (c.attempts === 0 ? '<span class="tag">未开始</span>' : '<span class="tag green">正常</span>')) + '</div>' +
        '<div class="tiny">' + c.hint + '</div>' +
        '<div class="bar"><i style="width:' + s + '%;background:' + (c.weak ? '#e03e3e' : c.color) + '"></i></div>' +
        '<div class="cat-nums"><span>答对 ' + c.right + '</span><span>答错 ' + c.wrong + '</span>' +
        '<span>标记不懂 ' + c.confused + '</span><span>懂了 ' + c.cleared + '</span></div></div>';
    });
    html += '</div>';

    html += '<h2>全部概念</h2><div class="heat">';
    window.TERMS.forEach(function (t) {
      const r = window.Mem.state.terms[t.id];
      const m = r ? r.mastery : 0;
      const lv = masteryLabel(t.id);
      html += '<div class="heat-cell" data-goto="term:' + t.id + '">' +
        '<div class="hn">' + esc(t.name) + '</div>' +
        '<div class="tiny">' + lv.label + '</div>' +
        '<div class="hb"><i style="width:' + Math.round(m / 5 * 100) + '%;background:' + lv.color + '"></i></div></div>';
    });
    html += '</div>';

    // 最近行为
    const ev = (window.Mem.state.events || []).slice(0, 14);
    if (ev.length) {
      html += '<h2>最近的学习行为</h2><div class="card">';
      ev.forEach(function (e) {
        const t = e.termId ? T(e.termId) : null;
        const map = {
          view: '浏览了', quiz_right: '答对了', quiz_wrong: '答错了',
          confused: '标记「还是不懂」', cleared: '标记「我懂了」'
        };
        html += '<div style="display:flex;gap:8px;padding:5px 0;border-bottom:1px solid var(--border);font-size:13px">' +
          '<span class="tiny" style="flex:0 0 96px">' + timeAgo(e.t) + '</span>' +
          '<span>' + (map[e.type] || e.type) + '</span>' +
          (t ? '<b style="font-weight:500">' + esc(t.name) + '</b>' : '') +
          (e.source === 'chat' ? '<span class="tag purple">来自对话</span>' : '') + '</div>';
      });
      html += '</div>';
    }

    html += '<div class="divider"></div>' +
      '<div class="callout"><span class="emo">🧠</span><div class="ct"><b>记忆是怎么影响你的体验的</b><br>' +
      '· 某类内容健康度低于 55% → 打开该类术语时自动进入<b>小白模式</b><br>' +
      '· 标记不懂 / 答错 → 该术语进入复习队列顶部<br>' +
      '· 在 AI 追问里说「没懂」→ 我会自动记一笔，并调整之后的讲法<br>' +
      '· 这些数据只存在你自己的浏览器里，可以在「设置与记忆」里导出或清空。</div></div>';

    return html + '</div>';
  }

  function hourChart(hist) {
    hist = hist || new Array(24).fill(0);
    const max = Math.max.apply(null, hist) || 1;
    let s = '<div class="tiny" style="margin-bottom:6px">活跃时段分布</div><div class="hours">';
    for (let i = 0; i < 24; i++) {
      const h = Math.round(hist[i] / max * 100);
      s += '<i style="height:' + Math.max(2, h) + '%' + (hist[i] > 0.5 ? ';background:#2383e2' : '') +
        '" title="' + i + ' 点 · ' + Math.round(hist[i]) + ' 分钟"></i>';
    }
    return s + '</div><div class="hours-x"><span>0</span><span>6</span><span>12</span><span>18</span><span>23</span></div>';
  }

  function timeAgo(ts) {
    const d = (Date.now() - ts) / 1000;
    if (d < 60) return '刚刚';
    if (d < 3600) return Math.floor(d / 60) + ' 分钟前';
    if (d < 86400) return Math.floor(d / 3600) + ' 小时前';
    return Math.floor(d / 86400) + ' 天前';
  }

  /* ============================================================
     视图：术语详情
     ============================================================ */
  function viewTerm(id) {
    const t = T(id);
    if (!t) return '<div class="page"><div class="empty">找不到这个术语</div></div>';
    const adapt = window.Mem.adaptFor(t);
    const cat = window.CATS[t.cat];

    let html = '<div class="page">';

    // 自适应横幅：说清楚「为什么这页长这样」
    const adaptWhy = [];
    if (adapt.simple && adapt.reason) {
      adaptWhy.push('处在<b>小白模式</b>：' + esc(adapt.reason) + '。下面会先讲「为什么需要它」，再讲「它是什么」。');
    }
    if (adapt.depth === 'shallow') adaptWhy.push('你还在起步阶段，<b>暂时收起了「容易踩的坑」</b>，先把故事听懂。');
    if (adapt.depth === 'deep') adaptWhy.push('你已经到「' + window.Mem.level().grade.name + '」水平，这一页会额外展开<b>容易踩的坑</b>。');
    if (adapt.attention.key === 'short') adaptWhy.push('当前是碎片/深夜时段，内容做了<b>精简</b>。');
    if (adaptWhy.length) {
      html += '<div class="simple-banner"><span class="emo">🎛️</span><div>' + adaptWhy.join('<br>') + '</div></div>';
    }

    html += '<div class="term-head">' +
      '<h1 class="term-title">' + esc(t.name) + '</h1>' +
      '<div class="term-en">' + esc(t.en) + '</div>' +
      '<div class="term-meta">' +
      '<span class="tag" style="background:' + cat.color + '14;color:' + cat.color + '">' + cat.name + '</span>' +
      '<span class="tag">第 ' + (window.Curriculum.lessonNoOf(t.id) || '?') + ' 课 · ' + esc(window.STAGES[t.stage].name) + '</span>' +
      '<span class="tag">难度 ' + '●'.repeat(t.level) + '○'.repeat(5 - t.level) + '</span>' +
      '</div></div>';

    /* ---------- 如果它在今天的计划里：说清楚这是第几项、要做到什么才算完成 ---------- */
    html += planStripHTML(t);

    // 一句话
    html += '<div class="callout blue"><span class="emo">💡</span><div class="ct"><b>一句话</b><br>' + esc(t.one) + '</div></div>';

    // 类比
    html += '<div class="sec"><div class="sec-h"><span class="ico">🥕</span>打个比方</div>' +
      '<div class="callout yellow"><span class="emo">🗣️</span><div class="ct">' + esc(t.analogy) + '</div></div></div>';

    // 小白模式：先修知识
    if (adapt.simple && adapt.prefix.length) {
      html += '<div class="sec simple-only"><div class="sec-h"><span class="ico">🧩</span>先看这个会更好懂</div>' +
        '<div class="related-chips">' + adapt.prefix.map(function (x) {
          return '<span class="chip" data-goto="term:' + x.id + '">' + masteryDot(x.id) + esc(x.name) +
            ' <span class="tiny">还没掌握</span></span>';
        }).join('') + '</div></div>';
    }

    // 详解（碎片/深夜时段精简为 2 条）
    html += '<div class="sec"><div class="sec-h"><span class="ico">📖</span>展开说说</div>';
    const steps = (adapt.show.steps || forceExpand) ? t.steps : t.steps.slice(0, 2);
    steps.forEach(function (s, i) {
      html += '<div class="steps-li"><span class="n">' + (i + 1) + '</span>' + esc(s) + '</div>';
    });
    const collapsed = !adapt.show.steps && !forceExpand && t.steps.length > 2;
    if (collapsed) {
      html += '<div class="tiny">其余 ' + (t.steps.length - 2) + ' 条已收起（现在是你的碎片时段）。' +
        '<span class="chip-inline" id="expandAll">全部展开</span></div>';
    }
    html += '</div>';

    // 例子
    html += '<div class="sec"><div class="sec-h"><span class="ico">🎬</span>举个例子</div>' +
      '<div class="callout"><span class="emo">📌</span><div class="ct">' + md(t.example) + '</div></div></div>';

    // PM 视角（起步阶段折叠）
    if (adapt.show.pm) {
      html += '<div class="sec"><div class="sec-h"><span class="ico">🧭</span>产品经理视角</div>' +
        '<div class="callout green"><span class="emo">💼</span><div class="ct">' + esc(t.pm) + '</div></div></div>';
    }

    // 易踩坑（进阶以上才展开）
    if (t.pitfalls && t.pitfalls.length && adapt.show.pitfalls) {
      html += '<div class="sec"><div class="sec-h"><span class="ico">⚠️</span>容易踩的坑</div><ul>' +
        t.pitfalls.map(function (p) { return '<li>' + esc(p) + '</li>'; }).join('') + '</ul></div>';
    }

    // 测验
    html += '<div class="divider"></div><h2>小测验</h2>' +
      '<p class="tiny" style="margin-top:-4px">答错没关系，答错了我会记住这个概念，之后主动提醒你复习。</p>';
    t.quiz.forEach(function (q, qi) {
      html += '<div class="quiz" data-q="' + qi + '"><div class="quiz-q">' + (qi + 1) + '. ' + esc(q.q) + '</div>' +
        q.options.map(function (o, oi) {
          return '<button type="button" class="opt" data-opt="' + oi + '"><span class="k">' + 'ABCD'[oi] + '</span><span>' + esc(o) + '</span></button>';
        }).join('') +
        '<div class="explain" style="display:none"></div></div>';
    });

    // 反馈
    html += '<div class="feedback"><span class="lbl">这个概念现在懂了吗？</span>' +
      '<button class="btn sm" data-fb="cleared">😄 我懂了</button>' +
      '<button class="btn sm" data-fb="confused">😵 还是不懂</button>' +
      '<button class="btn sm ghost" data-ask="1">💬 让 AI 再讲一遍</button></div>';

    // 今日计划内的上一项 / 下一项
    html += planNavHTML(t);

    // 相关
    html += '<div class="divider"></div><div class="sec-h"><span class="ico">🔗</span>相关概念</div>' +
      '<div class="related-chips">' + t.related.map(function (rid) {
        const r = T(rid); if (!r) return '';
        return '<span class="chip" data-goto="term:' + r.id + '">' + masteryDot(r.id) + esc(r.name) +
          ' <span class="tiny">' + esc(window.CATS[r.cat].name) + '</span></span>';
      }).join('') + '</div>';

    html += '<div style="height:40px"></div></div>';
    return html;
  }

  /* ============================================================
     视图：设置
     ============================================================ */
  function viewSettings() {
    const cfg = window.LLM.getCfg();
    const pr = window.Mem.state.prefs;
    const ev = (window.Mem.state.events || []).length;

    let html = '<div class="page"><h1>设置与记忆</h1>' +
      '<p class="lead">你的学习记忆会自动保存在本机，并可以按你的设置同步到自己的网盘。</p>';

    /* ---------- 记忆存储与同步（新增） ---------- */
    const st = window.Store;
    const sup = st.support();
    const snaps = st.listSnapshots();
    html += '<h2>记忆存储与同步</h2><div class="card">' +
      '<div class="sync-state">' +
      '<span class="sync-dot ' + (st.handle ? st.status : 'local') + '"></span>' +
      '<div style="flex:1;min-width:0">' +
      '<div style="font-size:13.5px;font-weight:500">' +
      (st.handle
        ? (st.status === 'error' ? '同步失败' : st.status === 'syncing' ? '正在同步…' : '已连接同步文件')
        : '仅保存在本机浏览器') + '</div>' +
      '<div class="tiny">' + (st.handle
        ? esc(st.fileName) + (st.lastSync ? ' · 上次同步 ' + timeAgo(st.lastSync) : '') +
        (st.lastError ? ' · <span style="color:var(--red)">' + esc(st.lastError) + '</span>' : '')
        : (sup.usable ? '连接一个文件后可跨设备同步' : esc(sup.reason || '当前环境不支持文件同步'))) + '</div>' +
      '</div></div>';

    html += '<div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:12px">';
    if (sup.usable) {
      html += '<button class="btn primary sm" id="syncLink">' + (st.handle ? '更换同步文件' : '创建同步文件') + '</button>' +
        '<button class="btn sm" id="syncOpen">选择已有文件</button>';
      if (st.handle) {
        html += '<button class="btn sm" id="syncPull">从文件恢复</button>' +
          '<button class="btn sm" id="syncPush">立即上传</button>' +
          '<button class="btn sm" id="syncUnlink">断开同步</button>';
      }
    }
    html += '</div>';

    html += '<div class="hint-box">' +
      '<b>这样就能跨设备了：</b>点「创建同步文件」，把它存进 <b>iCloud Drive / OneDrive / 坚果云 / Dropbox</b> 的文件夹。' +
      '之后每次学习都会自动写回这个文件；在另一台设备等网盘同步完成后打开本页，会自动把两边的记录合并起来。<br>' +
      '<span class="tiny">合并规则：事件流取并集、各项计数取较大值 —— 不会互相覆盖丢进度。</span>' +
      '</div></div>';

    /* ---------- 快照与恢复 ---------- */
    html += '<h2>数据保护</h2><div class="card">' +
      '<div class="tiny" style="margin-bottom:8px">系统自动保留最近 ' + snaps.length + ' 份本地快照，写坏可回滚：</div>';
    if (!snaps.length) {
      html += '<div class="tiny">还没有快照，学一会儿就有了。</div>';
    } else {
      snaps.forEach(function (s) {
        html += '<div class="snap-row"><span>' + new Date(s.ts).toLocaleString('zh-CN') + '</span>' +
          '<span class="tiny">' + s.events + ' 条记录</span>' +
          '<button class="btn sm ghost" data-snap="' + esc(s.key) + '" style="margin-left:auto">回滚到这版</button></div>';
      });
    }
    html += '</div>';

    // LLM
    html += '<h2>大模型接入</h2>' +
      '<div class="card"><div class="field">' +
      '<div class="switch' + (cfg.enabled ? ' on' : '') + '" id="swEnable"><div class="track"><i></i></div>' +
      '<div><div style="font-size:13.5px;font-weight:500">启用在线大模型</div>' +
      '<div class="desc">不开启也能用——会用内置知识库离线讲解。开启后支持真正的自由追问。</div></div></div></div>' +
      '<div class="field"><label>API Base URL</label>' +
      '<input type="text" id="cfgUrl" value="' + esc(cfg.baseUrl) + '" placeholder="https://api.openai.com/v1">' +
      '<div class="desc">任意 OpenAI 兼容端点。例如 DeepSeek: https://api.deepseek.com/v1 ；Moonshot: https://api.moonshot.cn/v1 ；本地 Ollama: http://localhost:11434/v1</div></div>' +
      '<div class="field"><label>API Key</label><input type="password" id="cfgKey" value="' + esc(cfg.apiKey) + '" placeholder="sk-..."></div>' +
      '<div class="field"><label>模型名</label><input type="text" id="cfgModel" value="' + esc(cfg.model) + '" placeholder="gpt-4o-mini"></div>' +
      '<div style="display:flex;gap:8px;align-items:center">' +
      '<button class="btn primary sm" id="testConn">测试连接</button>' +
      '<button class="btn sm" id="saveCfg">保存</button>' +
      '<span class="tiny" id="cfgMsg"></span></div></div>';

    // 讲解偏好
    html += '<h2>讲解偏好</h2><div class="card">' +
      '<div class="field"><label>讲解风格</label><select id="prefStyle">' +
      opt('auto', '自动（由记忆决定）', pr.style) +
      opt('analogy', '类比优先', pr.style) +
      opt('example', '例子优先', pr.style) +
      opt('steps', '步骤拆解优先', pr.style) +
      '</select><div class="desc">这个偏好会写进 AI 的系统提示词里。</div></div>' +
      '<div class="field"><div class="switch' + (pr.autoSimple ? ' on' : '') + '" id="swAuto"><div class="track"><i></i></div>' +
      '<div><div style="font-size:13.5px;font-weight:500">自动小白模式</div>' +
      '<div class="desc">当检测到你在某类内容上反复卡住时，自动简化讲法。</div></div></div></div>' +
      '<button class="btn sm" id="savePref">保存偏好</button></div>';

    // 学习计划（课表进度 + 今天这份冻结的清单）
    const syS = window.Mem.syllabus();
    const plS = window.Mem.plan();
    const hist = Object.keys(window.Mem.state.planLog || {}).sort().reverse().slice(0, 7);
    html += '<h2>学习计划</h2><div class="card">' +
      '<div class="cat-nums" style="margin-bottom:12px;font-size:13px">' +
      '<span>课表进度 <b>' + syS.realNo + '/' + syS.realTotal + '</b> 课</span>' +
      '<span>计划覆盖 <b>' + syS.totalTerms + '</b> 个概念</span>' +
      '<span>预计还需 <b>' + syS.etaDays + '</b> 天</span>' +
      '<span>今日 <b>' + plS.doneCount + '/' + plS.total + '</b> 项</span></div>' +
      '<div class="tiny" style="margin-bottom:10px">' +
      '今天这份清单生成于 ' + (plS.items.length ? timeAgo(window.Mem.state.plan.genAt) : '—') +
      '，按天冻结保存 —— 第二天打开时，没做完的项目会自动顺延到新清单的最前面。' +
      '课表进度也一并写进记忆，换设备同步后会接着走，不用重学。</div>' +
      (hist.length
        ? '<div class="plan-hist">' + hist.map(function (d) {
          const l = window.Mem.state.planLog[d];
          const full = l.total > 0 && l.done >= l.total;
          return '<div class="ph-day' + (full ? ' full' : '') + '"><b>' + d + '</b><span>' +
            l.done + '/' + l.total + ' 项</span></div>';
        }).join('') + '</div>'
        : '') +
      '<div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:10px">' +
      '<button class="btn sm" data-route="plan">打开学习计划</button>' +
      '<button class="btn sm ghost" data-regen="1">按当前状态重排今天</button>' +
      '</div></div>';

    // 记忆
    const hp = window.Mem.habits();
    html += '<h2>记忆档案</h2><div class="card">' +
      '<div class="cat-nums" style="margin-bottom:12px;font-size:13px">' +
      '<span>学习记录 <b>' + ev + '</b> 条</span>' +
      '<span>累计时长 <b>' + hp.totalMin + '</b> 分钟</span>' +
      '<span>连续 <b>' + hp.streak + '</b> 天</span>' +
      '<span>已接触概念 <b>' + window.Mem.progress().started + '</b> 个</span>' +
      '<span>对话消息 <b>' + (window.Mem.state.chat || []).length + '</b> 条</span></div>' +
      '<div style="display:flex;gap:8px;flex-wrap:wrap">' +
      '<button class="btn sm" id="expMem">导出 JSON</button>' +
      '<button class="btn sm" id="impMem">导入 JSON</button>' +
      '<button class="btn sm" id="clearChat">清空对话</button>' +
      '<button class="btn sm" id="resetMem" style="color:var(--red);border-color:rgba(224,62,62,.35)">清空全部记忆</button>' +
      '</div>' +
      '<div class="field" style="margin-top:12px"><textarea id="memBox" rows="4" placeholder="导出的内容会显示在这里，也可以把 JSON 粘贴进来后点导入" style="font-size:12px"></textarea></div>' +
      '</div>';

    html += '<div class="divider"></div>' +
      '<div class="callout"><span class="emo">🔒</span><div class="ct"><b>关于隐私</b><br>' +
      '· 学习记录、练习答案、面试分数、对话历史、API Key 全部存在本机，不上传给任何第三方。<br>' +
      '· 启用文件同步时，数据只写进你自己选的那个文件 —— 放哪个网盘由你决定。<br>' +
      '· 启用在线模型后，你发送的问题和当前概念的讲解材料才会发给你配置的模型厂商。<br>' +
      '· 随时可以导出、回滚、清空。</div></div>';

    return html + '</div>';
  }

  function opt(v, label, cur) {
    return '<option value="' + v + '"' + (cur === v ? ' selected' : '') + '>' + label + '</option>';
  }

  /* ============================================================
     路由
     ============================================================ */
  function parseHash() {
    const h = (location.hash || '').replace(/^#\/?/, '');
    if (!h) return { route: 'home' };
    // term/xxx 与 term:xxx 都认（按钮上写的是冒号写法）
    const m = h.match(/^term[:\/](.+)$/);
    if (m) return { route: 'term', id: decodeURIComponent(m[1]) };
    const p = h.match(/^practice[:\/](.+)$/);
    if (p) return { route: 'practice-detail', id: decodeURIComponent(p[1]) };
    if (h.indexOf('dict') === 0) {
      const q = h.split('?q=')[1];
      return { route: 'dict', q: q ? decodeURIComponent(q) : '' };
    }
    return { route: h };
  }

  function render() {
    const r = parseHash();
    // 记录上一个术语的停留时长
    if (currentTerm) {
      window.Mem.dwell(currentTerm.id, Date.now() - termEnterAt);
    }

    if (r.route === 'term') {
      currentTerm = T(r.id) || null;
      termEnterAt = Date.now();
      if (currentTerm) window.Mem.viewTerm(currentTerm.id, currentTerm.cat);
    } else {
      currentTerm = null;
    }

    let html = '';
    const titles = {
      home: '今日学习', plan: '学习计划', path: '学习路径', dict: '术语词典',
      practice: '实战练习', 'practice-detail': '实战练习', interview: '面试测评',
      review: '复习队列', mastery: '我的掌握度', settings: '设置与记忆'
    };
    try {
      if (r.route === 'term') html = viewTerm(r.id);
      else if (r.route === 'plan') html = viewPlan();
      else if (r.route === 'path') html = viewPath();
      else if (r.route === 'dict') { searchQuery = r.q || ''; html = viewDict(); }
      else if (r.route === 'practice') html = viewPractice();
      else if (r.route === 'practice-detail') html = viewPracticeDetail(r.id);
      else if (r.route === 'interview') html = viewInterview();
      else if (r.route === 'review') html = viewReview();
      else if (r.route === 'mastery') html = viewMastery();
      else if (r.route === 'settings') html = viewSettings();
      else html = viewHome();
    } catch (err) {
      console.error('渲染失败', err);
      html = '<div class="page"><h1>这一页出了点问题</h1>' +
        '<p class="lead">你的学习记忆没有受影响，数据仍安全保存在本机。</p>' +
        '<div class="callout red"><span class="emo">⚠️</span><div class="ct">' + esc(String(err && err.message || err)) + '</div></div>' +
        '<button class="btn" data-route="home">回到首页</button></div>';
    }

    content.innerHTML = html;
    content.scrollTop = 0;

    // 面包屑
    if (r.route === 'term' && currentTerm) {
      crumb.innerHTML = '<span>术语词典</span><span class="sep">/</span><b>' + esc(currentTerm.name) + '</b>';
    } else if (r.route === 'practice-detail') {
      const p = window.Lab.exercise(r.id);
      crumb.innerHTML = '<span>实战练习</span><span class="sep">/</span><b>' + esc(p ? p.title : '练习') + '</b>';
    } else {
      crumb.innerHTML = '<b>' + (titles[r.route] || '今日学习') + '</b>';
    }

    // 侧栏高亮
    document.querySelectorAll('.nav-item').forEach(function (el) {
      el.classList.toggle('active', el.dataset.route === r.route ||
        (r.route === 'term' && el.dataset.route === 'dict') ||
        (r.route === 'practice-detail' && el.dataset.route === 'practice'));
    });
    document.querySelectorAll('.mobile-nav [data-route]').forEach(function (el) {
      el.classList.toggle('active', el.dataset.route === r.route ||
        (r.route === 'practice-detail' && el.dataset.route === 'practice'));
    });
    document.querySelectorAll('.tree-item').forEach(function (el) {
      el.classList.toggle('active', r.route === 'term' && el.dataset.goto === 'term:' + r.id);
    });

    // 小白模式 body class
    if (r.route === 'term' && currentTerm) {
      const a = window.Mem.adaptFor(currentTerm);
      document.body.classList.toggle('simple-mode', !!a.simple);
    } else {
      document.body.classList.remove('simple-mode');
    }

    renderSidebar();
    updateChatCtx();
    a11yPass();
    if (r.route === 'dict') {
      const inp = $('#dictSearch');
      if (inp) { inp.focus(); inp.setSelectionRange(inp.value.length, inp.value.length); }
    }
    if (r.route === 'settings') bindSettings();
  }

  /** 统一跳转：把 term:xxx 规范成 term/xxx；目标没变时也要刷一次（否则点了像没反应） */
  function go(hash) {
    if (!hash) return;
    let h = String(hash).replace(/^#\/?/, '');
    h = h.replace(/^term:/, 'term/');
    const target = '#' + h;
    if (location.hash === target) { render(); return; }
    location.hash = h;
  }

  /** 让可点击的 div 也能被键盘访问 */
  function a11yPass() {
    document.querySelectorAll('.nav-item,[data-goto],[data-ask],.chip,.rec,.term-row,.dict-row,.heat-cell').forEach(function (el) {
      if (el.tagName === 'BUTTON' || el.tagName === 'A') return;
      el.setAttribute('role', 'button');
      el.setAttribute('tabindex', '0');
    });
  }
  document.addEventListener('keydown', function (e) {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    const el = e.target.closest && e.target.closest('[role=button]');
    if (!el || el.tagName === 'BUTTON' || el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') return;
    e.preventDefault();
    el.click();
  });

  /* ============================================================
     交互（事件委托）
     ============================================================ */
  document.addEventListener('click', function (e) {
    const el = e.target.closest('[data-goto],[data-route],[data-fb],[data-ask],[data-opt],[data-stage],[data-regen],' +
      '[data-practice-save],[data-practice-choice],[data-practice-rate],[data-assess-start],[data-assess-answer],[data-plan-day]');
    if (!el) return;

    if (el.dataset.practiceSave) {
      const answer = $('#practiceAnswer');
      window.Lab.savePractice(el.dataset.practiceSave, answer ? answer.value : '');
      renderSidebar();
      toast('练习答案已保存在当前浏览器');
      return;
    }
    if (el.dataset.practiceChoice !== undefined) {
      window.Lab.answerPractice(el.dataset.practiceId, Number(el.dataset.practiceChoice));
      render();
      return;
    }
    if (el.dataset.practiceRate !== undefined) {
      window.Lab.ratePractice(el.dataset.practiceId, Number(el.dataset.practiceRate));
      render();
      toast('自评已记录');
      return;
    }
    if (el.dataset.assessStart) {
      window.Lab.startInterview();
      go('interview');
      return;
    }
    if (el.dataset.assessAnswer !== undefined) {
      window.Lab.answerInterview(Number(el.dataset.assessAnswer));
      render();
      return;
    }
    if (el.dataset.planDay) {
      window.Lab.togglePlanDay(Number(el.dataset.planDay));
      render();
      return;
    }
    if (el.dataset.regen) {
      window.Mem.regenPlan();
      render();
      toast('已按当前状态重新安排今天的清单');
      return;
    }

    if (el.dataset.route) { go(el.dataset.route); return; }
    if (el.dataset.goto) { go(el.dataset.goto); return; }
    if (el.dataset.stage) { go('path'); setTimeout(function () {
      const n = document.getElementById('stage-' + el.dataset.stage);
      if (n) { n.open = true; n.scrollIntoView({ behavior: 'smooth', block: 'start' }); }
    }, 60); return; }

    if (el.dataset.fb && currentTerm) {
      const kind = el.dataset.fb;
      if (kind === 'cleared') { window.Mem.cleared(currentTerm.id, currentTerm.cat, 'button'); toast('已记录：' + currentTerm.name + ' 已掌握 ✅'); }
      else { window.Mem.confused(currentTerm.id, currentTerm.cat, 'button'); toast('已记录：你对这个概念还有困难，我会多提醒你复习 📌'); }
      checkPlanDone(currentTerm.id);
      updatePlanUI();
      return;
    }

    if (el.dataset.ask) { openChat(); if (currentTerm) askQuick('我还没完全懂，换一种更简单的方式再讲一遍'); return; }

    if (el.dataset.opt !== undefined && currentTerm) {
      const quizEl = el.closest('.quiz');
      if (quizEl.dataset.done) return;
      const qi = +quizEl.dataset.q;
      const oi = +el.dataset.opt;
      const q = currentTerm.quiz[qi];
      const ok = oi === q.a;
      quizEl.dataset.done = '1';
      quizEl.querySelectorAll('.opt').forEach(function (o, i) {
        o.classList.add('disabled');
        if (i === q.a) o.classList.add('correct');
        else if (i === oi) o.classList.add('wrong');
      });
      const ex = quizEl.querySelector('.explain');
      ex.style.display = 'block';
      ex.innerHTML = (ok ? '✅ 对了。' : '❌ 再想想。') + esc(q.why);
      window.Mem.quiz(currentTerm.id, currentTerm.cat, ok);
      checkPlanDone(currentTerm.id);
      updatePlanUI();
    }
  });

  /* ---------- 全局搜索 ---------- */
  $('#globalSearch').addEventListener('input', function (e) {
    const v = e.target.value;
    if (location.hash.indexOf('#dict') !== 0) go('dict?q=' + encodeURIComponent(v));
    else { searchQuery = v; const pos = content.scrollTop; content.innerHTML = viewDict(); content.scrollTop = pos;
      const inp = $('#dictSearch'); if (inp) { inp.focus(); inp.setSelectionRange(v.length, v.length); } }
  });
  document.addEventListener('input', function (e) {
    if (e.target.id === 'dictSearch') {
      searchQuery = e.target.value;
      const pos = content.scrollTop;
      content.innerHTML = viewDict();
      content.scrollTop = pos;
      const inp = $('#dictSearch');
      if (inp) { inp.focus(); inp.setSelectionRange(inp.value.length, inp.value.length); }
      $('#globalSearch').value = searchQuery;
    }
  });

  /* ---------- 设置页绑定 ---------- */
  function bindSettings() {
    const sw = $('#swEnable');
    sw.onclick = function () { sw.classList.toggle('on'); };
    const swA = $('#swAuto');
    swA.onclick = function () { swA.classList.toggle('on'); };

    /* ---- 记忆存储与同步 ---- */
    const bind = function (id, fn) { const el = document.getElementById(id); if (el) el.onclick = fn; };

    bind('syncLink', async function () {
      try {
        await window.Store.link(true);
        toast('已连接同步文件：' + window.Store.fileName);
        render();
      } catch (e) { toast('连接失败：' + (e.message || e)); }
    });
    bind('syncOpen', async function () {
      try {
        await window.Store.link(false);
        toast('已连接到已有文件：' + window.Store.fileName);
        render();
      } catch (e) { toast('连接失败：' + (e.message || e)); }
    });
    bind('syncPull', async function () {
      const ok = await window.Store.pull();
      toast(ok ? '已从文件合并最新记录' : '文件里没有可合并的数据');
      render();
    });
    bind('syncPush', async function () {
      const ok = await window.Store.push(true);
      toast(ok ? '已上传' : '上传失败：' + window.Store.lastError);
      render();
    });
    bind('syncUnlink', async function () {
      await window.Store.unlink();
      toast('已断开同步，数据仍保留在本机');
      render();
    });
    document.querySelectorAll('[data-snap]').forEach(function (b) {
      b.onclick = function () {
        if (!confirm('回滚到这份快照？当前的进度会被覆盖。')) return;
        if (window.Store.restoreSnapshot(b.dataset.snap)) { window.Mem.save(); render(); toast('已回滚'); }
      };
    });

    $('#savePref').onclick = function () {
      window.Mem.setPref('style', $('#prefStyle').value);
      window.Mem.setPref('autoSimple', swA.classList.contains('on'));
      toast('讲解偏好已保存');
    };

    $('#saveCfg').onclick = function () {
      window.LLM.setCfg({
        enabled: sw.classList.contains('on'),
        baseUrl: $('#cfgUrl').value.trim(),
        apiKey: $('#cfgKey').value.trim(),
        model: $('#cfgModel').value.trim()
      });
      $('#cfgMsg').textContent = '已保存';
      updateModePill();
      toast('配置已保存到本地');
    };

    $('#testConn').onclick = async function () {
      const msg = $('#cfgMsg');
      msg.textContent = '测试中…';
      window.LLM.setCfg({
        enabled: true,
        baseUrl: $('#cfgUrl').value.trim(),
        apiKey: $('#cfgKey').value.trim(),
        model: $('#cfgModel').value.trim()
      });
      const cfg = window.LLM.getCfg();
      try {
        const resp = await fetch(cfg.baseUrl.replace(/\/+$/, '') + '/chat/completions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + cfg.apiKey },
          body: JSON.stringify({ model: cfg.model, messages: [{ role: 'user', content: 'hi' }], max_tokens: 5 })
        });
        msg.textContent = resp.ok ? '✅ 连接成功' : '❌ HTTP ' + resp.status;
      } catch (err) {
        msg.textContent = '❌ ' + (err.message || '连接失败');
      }
    };

    $('#expMem').onclick = function () { $('#memBox').value = window.Mem.exportJSON(); toast('已导出到下方文本框'); };
    $('#impMem').onclick = function () {
      if (window.Mem.importJSON($('#memBox').value)) { toast('导入成功'); renderSidebar(); render(); }
      else toast('导入失败：不是有效的 JSON');
    };
    $('#clearChat').onclick = function () { window.Mem.clearChat(); $('#chatBody').innerHTML = ''; toast('对话已清空'); };
    $('#resetMem').onclick = function () {
      if (confirm('确定清空全部学习记忆吗？这会重置掌握度、复习队列和对话历史。')) {
        window.Mem.reset(); $('#chatBody').innerHTML = ''; render(); toast('记忆已清空');
      }
    };
  }

  /* ============================================================
     AI 追问侧栏
     ============================================================ */
  function openChat() {
    $('#chat').classList.remove('hidden');
    $('#chat').setAttribute('aria-hidden', 'false');
    $('#toggleChat').setAttribute('aria-expanded', 'true');
    updateChatCtx();
    const b = $('#chatBody');
    if (!b.children.length) welcomeMsg();
    setTimeout(function () { $('#chatInput').focus(); }, 50);
  }
  function closeChat() {
    $('#chat').classList.add('hidden');
    $('#chat').setAttribute('aria-hidden', 'true');
    $('#toggleChat').setAttribute('aria-expanded', 'false');
  }

  function updateModePill() {
    const cfg = window.LLM.getCfg();
    const p = $('#modePill');
    if (cfg.enabled && cfg.apiKey) { p.textContent = '在线 · ' + cfg.model; p.classList.add('on'); }
    else { p.textContent = '离线讲解'; p.classList.remove('on'); }
  }

  function updateChatCtx() {
    const c = $('#chatCtx');
    c.textContent = currentTerm ? ('正在看：' + currentTerm.name) : '未选择概念';
    const q = $('#chatQuick');
    const qs = currentTerm
      ? ['举个生活例子', '为什么需要它', '用一个 8 岁小孩能懂的比喻', '它和别的方案比有什么代价']
      : ['我该从哪开始学', 'Agent 和 Chatbot 有什么区别', '给我一个学习路线'];
    q.innerHTML = qs.map(function (x) { return '<span class="q">' + x + '</span>'; }).join('');
  }

  function welcomeMsg() {
    const b = $('#chatBody');
    b.innerHTML = '<div class="msg ai"><div class="who">AI</div><div class="bubble">' +
      '选一个概念后直接追问，我会结合你的学习记录换一种讲法。<br><br>' +
      '也可以现在问：<b>我该从哪开始学？</b>' +
      '</div></div>';
  }

  function addMsg(role, htmlText, cls) {
    const b = $('#chatBody');
    const d = document.createElement('div');
    d.className = 'msg ' + role + (cls ? ' ' + cls : '');
    d.innerHTML = '<div class="who">' + (role === 'user' ? '你' : 'AI') + '</div>' +
      '<div class="bubble">' + (role === 'user' ? esc(htmlText) : htmlText) + '</div>';
    b.appendChild(d);
    b.scrollTop = b.scrollHeight;
    return d.querySelector('.bubble');
  }

  let streaming = false;

  async function send(text) {
    if (streaming || !text.trim()) return;
    streaming = true;
    $('#chatSend').disabled = true;
    addMsg('user', text);
    $('#chatInput').value = '';

    const bubble = addMsg('ai', '');
    bubble.innerHTML = '<span class="cursor"></span>';
    let acc = '';
    abortCtl = new AbortController();

    // 记录追问偏好（习惯画像的输入）
    window.Mem.logAsk(text);

    const res = await window.LLM.ask(text, currentTerm, function (delta) {
      acc += delta;
      bubble.innerHTML = md(acc) + '<span class="cursor"></span>';
      const b = $('#chatBody'); b.scrollTop = b.scrollHeight;
    }, abortCtl.signal);

    bubble.innerHTML = md(acc);
    $('#chatSend').disabled = false;
    streaming = false;

    if (res.mode === 'error') {
      bubble.innerHTML = md(acc || res.fallback || '') +
        '<div class="signal">⚠️ 在线调用失败：' + esc(res.error) + '。已切换为离线讲解，可到设置检查 API 配置。</div>';
    }
    if (res.mode !== 'abort') {
      window.Mem.pushChat('user', text, currentTerm ? currentTerm.id : null);
      window.Mem.pushChat('assistant', acc, currentTerm ? currentTerm.id : null);
      // 从对话里抽取学习信号
      const sig = window.Mem.detectSignal(text, currentTerm ? currentTerm.id : null);
      if (sig) {
        const s = document.createElement('div');
        s.className = 'signal';
        s.innerHTML = sig === 'confused'
          ? '🧠 已记入记忆：你对「' + esc(currentTerm.name) + '」还有困难，之后会进入复习队列并自动简化讲法'
          : '🧠 已记入记忆：「' + esc(currentTerm.name) + '」标记为已理解';
        bubble.parentNode.appendChild(s);
        renderSidebar();
        updateChatCtx();
      }
    }
    $('#chatBody').scrollTop = $('#chatBody').scrollHeight;
  }

  function askQuick(q) { $('#chatInput').value = q; send(q); }

  $('#chatSend').onclick = function () { send($('#chatInput').value); };
  $('#chatInput').addEventListener('keydown', function (e) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(this.value); }
  });
  $('#chatQuick').addEventListener('click', function (e) {
    const q = e.target.closest('.q'); if (q) askQuick(q.textContent);
  });
  $('#toggleChat').onclick = function () {
    const c = $('#chat');
    if (c.classList.contains('hidden')) openChat(); else closeChat();
  };
  $('#chatClose').onclick = closeChat;

  /* ---------- 其他 ---------- */
  $('#memPeek').onclick = function () { go('mastery'); };
  /* ---------- 阅读深度：读到末尾算「完成」，中途离开算「离开」 ---------- */
  let deepRead = false;
  $('#content').addEventListener('scroll', function () {
    const el = $('#content');
    $('#topbar').classList.toggle('scrolled', el.scrollTop > 4);
    if (currentTerm && !deepRead && el.scrollHeight > 0) {
      const pct = (el.scrollTop + el.clientHeight) / el.scrollHeight;
      if (pct > 0.85) { deepRead = true; window.Mem.finish(currentTerm.id, true); }
    }
  });
  window.addEventListener('hashchange', function () {
    if (currentTerm) window.Mem.finish(currentTerm.id, deepRead);
    deepRead = false;
    render();
  });

  /* ---------- 阅读心跳 ----------
     每 12 秒把已读时长结算一次。这样「读完这一页」当场就算数，
     不用等到离开页面才补记 —— 计划里「读一遍」这个条件才有意义。 */
  setInterval(function () {
    if (!currentTerm || document.visibilityState === 'hidden') return;
    const now = Date.now();
    const d = now - termEnterAt;
    if (d < 3000) return;
    window.Mem.dwell(currentTerm.id, d);
    termEnterAt = now;
    syncStripText();
  }, 12000);
  window.addEventListener('pagehide', function () {
    if (currentTerm) window.Mem.dwell(currentTerm.id, Date.now() - termEnterAt);
  });

  /* ---------- 全部展开（碎片时段被收起的内容） ---------- */
  let forceExpand = false;
  document.addEventListener('click', function (e) {
    if (e.target.closest('#expandAll')) { forceExpand = true; render(); }
  });

  /* ---------- 启动 ---------- */
  (async function boot() {
    await window.Store.init();
    window.Store.onChange = function () { renderSidebar(); };
    window.Mem.init();
    render();
    updateModePill();
    closeChat();
  })();

})();
