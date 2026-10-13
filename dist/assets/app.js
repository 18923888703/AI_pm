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
  let activeRoute = null;

  const T = function (id) { return window.TERMS.find(function (t) { return t.id === id; }); };
  const STAGE_ICONS = ['🌱', '🔧', '🔄', '🚀', '⚡', '🎯'];
  const stageIcon = function (id) { return STAGE_ICONS[id] || '•'; };

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  function escAttr(s) { return esc(s).replace(/"/g, '&quot;').replace(/'/g, '&#39;'); }

  function shuffled(list) {
    const out = list.slice();
    for (let i = out.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      const tmp = out[i]; out[i] = out[j]; out[j] = tmp;
    }
    return out;
  }

  /** 极简 Markdown：加粗 / 行内代码 / 引用 / 分割线 / 换行 */
  function md(s) {
    let h = esc(String(s || '').replace(/。{2,}/g, '。'));
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
    const rq = window.Mem.reviewQueue(99);
    const rc = $('#reviewCount');
    if (rc) { rc.textContent = rq.length ? String(rq.length) : ''; rc.className = 'nav-count' + (rq.length ? ' hot' : ''); }

    const practice = window.Lab.practiceProgress();
    const practiceCount = $('#practiceCount');
    if (practiceCount) practiceCount.textContent = practice.done + '/' + practice.total;
    const interviewScore = $('#interviewScore');
    const interview = window.Lab.interview();
    const lastInterview = (interview.history || []).slice(-1)[0];
    if (interviewScore) interviewScore.textContent = interview.result ? interview.result.score :
      (interview.startedAt && !interview.completedAt ? '测评中' : (lastInterview ? lastInterview.score : '未测'));
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
    const hp = window.Mem.habits();
    const pd = window.Mem.plan();
    const sy = window.Mem.syllabus();
    const grouped = {};
    pd.items.filter(function (i) { return i.termId; }).forEach(function (it) {
      if (!grouped[it.termId] || (!it.done && grouped[it.termId].done)) grouped[it.termId] = it;
    });
    const todayItems = Object.keys(grouped).map(function (id) { return grouped[id]; });
    const pending = todayItems.filter(function (i) { return !i.done; });
    const completed = todayItems.filter(function (i) { return i.done; });
    const firstUndone = pending[0] || null;
    const displayRemainMin = pending.reduce(function (sum, it) { return sum + (it.min || 0); }, 0);
    const overall = Math.round(sy.learnedCount / sy.totalTerms * 100);
    const dailySession = window.LearningQuiz.daily();
    const dailyResult = window.LearningQuiz.dailyResult();

    let html = '<div class="page home-focus"><h1>' + (pd.allDone ? '今天完成了' : '今天继续向前') + '</h1>' +
      '<p class="lead">' + esc(pd.lessonTitle) + '</p>' +
      '<div class="home-data-strip">' +
      '<div><b>' + completed.length + '/' + todayItems.length + '</b><span>今日完成</span></div>' +
      '<div><b>' + displayRemainMin + '</b><span>剩余分钟</span></div>' +
      '<div><b>' + Math.max(1, hp.streak) + '</b><span>连续天数</span></div>' +
      '<div><b>' + overall + '%</b><span>课程进度</span></div>' +
      '<div><b>' + (dailyResult ? dailyResult.score + '%' : '—') + '</b><span>今日掌握度</span></div></div>' +
      '<section class="home-next"><div><span class="tag">' + (pd.lessonKind === 'checkpoint' ? '阶段检查' : '第 ' + sy.realNo + ' 课') + '</span>' +
      '<h2>' + esc(pd.lessonTitle) + '</h2><p>' + esc(pd.lessonGoal) + '</p></div>' +
      (dailySession && !dailySession.completedAt ? '<button class="btn primary" data-route="learn">继续答题 →</button>' :
        firstUndone ? '<button class="btn primary" data-learn-start="1">' + (completed.length ? '继续学习' : '开始学习') + ' →</button>' :
        '<button class="btn" data-route="path">查看学习路径</button>') + '</section>';

    if (pending.length) {
      html += '<div class="home-tag-section"><h2>待学习</h2><div class="knowledge-tags">' + pending.map(function (it) {
        return '<span class="knowledge-tag pending">' + esc(planItemName(it)) + '</span>';
      }).join('') + '</div></div>';
    }
    if (completed.length) {
      html += '<div class="home-tag-section completed"><h2>今天已完成</h2><div class="knowledge-tags">' + completed.map(function (it) {
        return '<span class="knowledge-tag done">✓ ' + esc(planItemName(it)) + '</span>';
      }).join('') + '</div></div>';
    }
    if (pd.carriedCount) html += '<p class="tiny home-carry">昨天未完成的 ' + pd.carriedCount + ' 项已自动顺延到今天。</p>';
    return html + '</div>';
  }

  function answerExplanationHTML(f) {
    // 旧版进行中的今日学习保留答案，同时补上新详解。
    if (!f.teaching && f.termId && window.LearningQuiz && window.Explanations) {
      const term = T(f.termId);
      const question = window.LearningQuiz.bank(f.termId).find(function (q) { return q.id === f.questionId; });
      if (term && question) f = Object.assign({}, f, window.Explanations.learning(question, term, f.selectedOptionId));
    }
    let html = '<div class="answer-explanation ' + (f.correct ? 'is-correct' : 'is-wrong') + '">' +
      '<div class="answer-verdict"><b>' + (f.correct ? '判断正确' : '这道题答错了') + '</b><span>' +
      (f.correct ? '看看判断依据，确认自己也能解释原因。' : '看清选项的差异，再用具体场景理解。') + '</span></div>' +
      '<div class="answer-compare"><div><span>你的选择</span><p>' + esc(f.selectedOptionText || '—') + '</p></div>' +
      '<div><span>正确答案</span><p>' + esc(f.correctOptionText || '—') + '</p></div></div>' +
      (!f.correct && f.selectedReason ? '<div class="answer-reason answer-selected-reason"><b>你选的这一项，具体错在哪里</b><p>' + md(f.selectedReason) + '</p></div>' : '') +
      '<div class="answer-reason"><b>正确答案为什么成立</b><p>' + md(f.explanation || '') + '</p></div>';
    const teach = f.teaching;
    if (teach) {
      html += '<section class="answer-teaching"><h3>把「' + esc(teach.name) + '」讲明白</h3>' +
        '<p class="answer-definition">' + md(teach.summary) + '</p>' +
        (teach.analogy ? '<div class="answer-story"><b>换成生活中的例子</b><p>' + md(teach.analogy) + '</p></div>' : '') +
        '<h4>分几步理解</h4><ol class="answer-steps">' + (teach.steps || []).map(function (step) { return '<li>' + md(step) + '</li>'; }).join('') + '</ol>' +
        '<div class="answer-story"><b>放到具体场景里</b><p>' + md(teach.scenario) + '</p></div>' +
        (teach.application ? '<div class="answer-reason"><b>做产品时如何判断</b><p>' + md(teach.application) + '</p></div>' : '') +
        '<div class="answer-memory"><b>下次遇到类似题，记住这句话</b><p>' + md(teach.memory || teach.summary) + '</p></div></section>';
      if (teach.contrasts && teach.contrasts.length) {
        html += '<details class="answer-options-detail"><summary>容易混淆的概念，分别解决什么</summary><dl class="answer-contrasts">' + teach.contrasts.map(function (x) {
          return '<dt>' + esc(x.name) + '</dt><dd>' + md(x.meaning) + '</dd>';
        }).join('') + '</dl></details>';
      }
    } else if (f.conceptSummary) html += '<div class="answer-memory"><b>一句话记住「' + esc(f.conceptName) + '」</b><p>' + md(f.conceptSummary) + '</p></div>';
    if (f.optionReviews && f.optionReviews.length) {
      html += '<details class="answer-options-detail"><summary>逐项看其他选项为什么对或错</summary><div>' + f.optionReviews.map(function (o) {
        return '<div class="answer-option-review"><b>' + (o.correct ? '正确选项' : '错误选项') + (o.selected ? ' · 你的选择' : '') + '</b><p>' + esc(o.text) + '</p><p class="answer-option-reason">' + md(o.reason) + '</p></div>';
      }).join('') + '</div></details>';
    }
    if (!f.correct && f.pitfall) html += '<div class="answer-reason"><b>再提醒一个常见误区</b><p>' + md(f.pitfall) + '</p></div>';
    return html + '</div>';
  }

  function viewLearn() {
    let session = window.LearningQuiz.daily();
    if (!session) {
      const ids = window.Mem.plan().items.filter(function (it) { return !it.done && it.termId; }).map(function (it) { return it.termId; });
      session = window.LearningQuiz.startDaily(ids);
    }
    if (!session || !session.questions.length) {
      return '<div class="page assessment-page"><div class="empty">今天没有待完成的知识点。<br><br><button class="btn" data-route="home">返回今日学习</button></div></div>';
    }
    if (session.completedAt && session.result) {
      return '<div class="page daily-result"><div class="result-head"><div class="score-disc" style="--score:' + session.result.score + ';--score-color:' + scoreTone(session.result.score) + '"><b>' + session.result.score + '</b><span>/100</span></div>' +
        '<div><h1>今日学习完成</h1><p class="lead">答对 ' + session.result.correct + '/' + session.result.total + ' 题。答错的知识点已进入后续变式复测。</p>' +
        '<button class="btn primary" data-route="home">查看今日数据</button></div></div><h2>今日知识点</h2><div class="knowledge-tags">' +
        session.responses.map(function (r) {
          const term = T(r.termId); return '<span class="knowledge-tag ' + (r.correct ? 'done' : 'pending') + '">' + (r.correct ? '✓ ' : '需复习 · ') + esc(term ? term.name : r.termId) + '</span>';
        }).join('') + '</div></div>';
    }
    const q = window.LearningQuiz.dailyQuestion();
    if (!q) return '<div class="page"><div class="empty">学习状态异常，请返回首页重新开始。</div></div>';
    const term = T(q.termId);
    const answered = session.responses.length;
    const currentScore = answered ? Math.round(session.responses.filter(function (x) { return x.correct; }).length / answered * 100) : 0;
    let html = '<div class="page assessment-page"><div class="assessment-top"><div><span>第 ' + (session.index + 1) + ' / ' + session.questions.length + ' 题</span><b>' + esc(term.name) + '</b></div>' +
      '<div class="assessment-progress"><i style="width:' + Math.round(session.index / session.questions.length * 100) + '%"></i></div></div>' +
      '<div class="daily-score-line"><span>今日掌握度</span><b>' + (answered ? currentScore + '%' : '答题后生成') + '</b></div>' +
      '<div class="assessment-card"><div class="assessment-question-meta"><span>今日学习</span>' + (q.review ? '<span class="review">变式复测</span>' : '<span>新知识</span>') + '</div>' +
      '<h1>' + esc(q.prompt) + '</h1><div class="assessment-options">';
    q.options.forEach(function (o, i) {
      let cls = '', disabled = '';
      if (session.feedback) {
        disabled = ' disabled';
        if (o.id === session.feedback.correctOptionId) cls = ' correct';
        else if (o.id === session.feedback.selectedOptionId) cls = ' wrong';
      }
      html += '<button class="' + cls + '" data-learn-answer="' + esc(o.id) + '"' + disabled + '><span>' + 'ABCDE'[i] + '</span>' + esc(o.text) + '</button>';
    });
    html += '</div>';
    if (session.feedback) {
      html += answerExplanationHTML(session.feedback) +
        '<div class="assessment-open-actions"><button class="btn primary" data-learn-next="1">' + (session.index + 1 >= session.questions.length ? '查看今日掌握度' : '下一题 →') + '</button></div>';
    }
    return html + '</div></div>';
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
     视图：专题知识库（导入资料的结构化延伸）
     ============================================================ */
  function knowledgeCardHTML(x) {
    return '<article class="kb-card" data-goto="kb/' + escAttr(x.id) + '">' +
      '<span class="kb-category">' + esc(x.category) + '</span><h3>' + esc(x.title) + '</h3>' +
      '<p>' + esc(x.summary) + '</p><span class="kb-more">阅读专题 <span aria-hidden="true">→</span></span></article>';
  }

  function knowledgeBaseMapHTML(categories) {
    const ordered = [categories[0], categories[1], categories[2], categories[7], categories[3], categories[4], categories[5], categories[6]];
    const width = 1180, height = 1100;
    const root = { x: 500, y: 516, w: 180, h: 68 };
    const centers = [150, 410, 670, 930];
    let paths = '', hubs = '', leaves = '';
    ordered.forEach(function (category, index) {
      const items = window.KNOWLEDGE_BASE.filter(function (x) { return x.category === category; });
      const left = index < 4;
      const sideIndex = left ? index : index - 4;
      const centerY = centers[sideIndex];
      const hubX = left ? 250 : 750;
      const hubW = 180, hubH = 46;
      const leafX = left ? 10 : 960;
      const leafW = 210, leafH = 38, gap = 6;
      const total = items.length * leafH + Math.max(0, items.length - 1) * gap;
      const startY = centerY - total / 2;
      const rootEdgeX = left ? root.x : root.x + root.w;
      const hubEdgeX = left ? hubX + hubW : hubX;
      const hubLeafX = left ? hubX : hubX + hubW;
      const leafEdgeX = left ? leafX + leafW : leafX;
      const bendRoot = left ? 462 : 718;
      const bendLeaf = left ? 234 : 946;

      paths += '<path class="kb-map-trunk cat-' + index + '" d="M' + rootEdgeX + ' ' + (root.y + root.h / 2) +
        ' C' + bendRoot + ' ' + (root.y + root.h / 2) + ' ' + bendRoot + ' ' + centerY + ' ' + hubEdgeX + ' ' + centerY + '"/>';
      hubs += '<g class="kb-map-hub cat-' + index + '"><rect x="' + hubX + '" y="' + (centerY - hubH / 2) + '" width="' + hubW + '" height="' + hubH + '" rx="13"/>' +
        '<text x="' + (hubX + hubW / 2) + '" y="' + (centerY + 5) + '" text-anchor="middle">' + esc(category) + '</text>' +
        '<text class="kb-map-count" x="' + (hubX + hubW / 2) + '" y="' + (centerY + 20) + '" text-anchor="middle">' + items.length + ' 个专题</text></g>';
      items.forEach(function (item, itemIndex) {
        const y = startY + itemIndex * (leafH + gap);
        const leafCenterY = y + leafH / 2;
        paths += '<path class="kb-map-link cat-' + index + '" d="M' + hubLeafX + ' ' + centerY +
          ' C' + bendLeaf + ' ' + centerY + ' ' + bendLeaf + ' ' + leafCenterY + ' ' + leafEdgeX + ' ' + leafCenterY + '"/>';
        leaves += '<g class="kb-map-topic cat-' + index + '" role="button" tabindex="0" data-goto="kb/' + escAttr(item.id) +
          '" aria-label="阅读专题：' + escAttr(item.title) + '"><title>' + esc(item.summary) + '</title>' +
          '<rect x="' + leafX + '" y="' + y + '" width="' + leafW + '" height="' + leafH + '" rx="10"/>' +
          '<text x="' + (left ? leafX + leafW - 12 : leafX + 12) + '" y="' + (y + 24) + '" text-anchor="' + (left ? 'end' : 'start') + '">' +
          esc(mindText(item.title, 15)) + '</text></g>';
      });
    });

    return '<section class="kb-overview-map" aria-labelledby="kbMapTitle"><div class="kb-map-head"><div><h2 id="kbMapTitle">知识关联地图</h2>' +
      '<p>从能力分类理解知识结构，点击任一专题节点即可进入学习。</p></div><div class="kb-map-controls" aria-label="移动脑图视图">' +
      '<button type="button" data-kb-pan="-1">← 左侧分支</button><button type="button" data-kb-center="1">回到中心</button><button type="button" data-kb-pan="1">右侧分支 →</button></div></div>' +
      '<div class="kb-overview-map-scroll" tabindex="0" aria-label="AI PM 专题知识库关联脑图，可横向滚动">' +
      '<svg class="kb-overview-map-svg" viewBox="0 0 ' + width + ' ' + height + '" role="img" aria-label="以 AI PM 能力体系为中心，连接八类能力和 ' + window.KNOWLEDGE_BASE.length + ' 个专题的知识脑图">' +
      paths + '<g class="kb-map-root"><rect x="' + root.x + '" y="' + root.y + '" width="' + root.w + '" height="' + root.h + '" rx="18"/>' +
      '<text class="kb-map-root-small" x="' + (root.x + root.w / 2) + '" y="' + (root.y + 24) + '" text-anchor="middle">知识中心</text>' +
      '<text class="kb-map-root-title" x="' + (root.x + root.w / 2) + '" y="' + (root.y + 48) + '" text-anchor="middle">AI PM 能力体系</text></g>' +
      hubs + leaves + '</svg></div><div class="kb-map-hint"><span>技术与工具</span><i></i><b>AI PM 能力体系</b><i></i><span>产品与业务</span></div></section>';
  }

  function viewKnowledgeBase() {
    const categories = window.KnowledgeBase.categories();
    let html = '<div class="page kb-page"><div class="kb-hero"><span class="eyebrow">AI PM KNOWLEDGE BASE</span>' +
      '<h1>专题知识库</h1><p>从导入资料中去重、校正并结构化的延伸内容。它不替代 61 个核心概念，而是帮助你把技术、产品方法和商业判断连起来。</p>' +
      '<div class="kb-stats"><span><b>' + window.KNOWLEDGE_BASE.length + '</b> 个专题</span><span><b>' + categories.length + '</b> 类能力</span><span>已关联课程脑图</span></div></div>' +
      knowledgeBaseMapHTML(categories) + '<div class="kb-list-intro"><h2>全部专题</h2><p>脑图用于理解结构；下方按分类浏览完整解释。</p></div>';
    categories.forEach(function (category) {
      const items = window.KNOWLEDGE_BASE.filter(function (x) { return x.category === category; });
      html += '<section class="kb-section"><div class="kb-section-head"><h2>' + esc(category) + '</h2><span>' + items.length + ' 个专题</span></div>' +
        '<div class="kb-grid">' + items.map(knowledgeCardHTML).join('') + '</div></section>';
    });
    return html + '<div class="kb-source">内容来源：用户导入的《AI产品经理--知识库》。已做去重、事实性降噪与课程结构化改写；原始文档未直接公开。</div></div>';
  }

  function shuffled(items) {
    const out = items.slice();
    for (let i = out.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      const tmp = out[i]; out[i] = out[j]; out[j] = tmp;
    }
    return out;
  }

  function knowledgeCheckHTML(x) {
    const peers = window.KNOWLEDGE_BASE.filter(function (p) { return p.id !== x.id; });
    const same = peers.filter(function (p) { return p.category === x.category; });
    const pool = shuffled(same.concat(peers.filter(function (p) { return p.category !== x.category; }))).slice(0, 3);
    const type = Math.floor(Math.random() * 3);
    let prompt, correct, choices;
    if (type === 0) {
      prompt = '下面哪项最准确地概括了「' + x.title + '」？';
      correct = { id: 'correct', text: x.summary, reason: '这项对应当前专题的定义。三个判断要点是：' + x.keyPoints.join('；') + '。' };
      choices = [correct].concat(pool.map(function (p, i) { return { id: 'd' + i, text: p.summary,
        reason: '这项解释的是「' + p.title + '」。它的应用是：' + p.application + '。本题问「' + x.title + '」，需要抓住：' + x.keyPoints[0] + '。' }; }));
    } else if (type === 1) {
      prompt = '在实际产品工作中，哪种做法最符合「' + x.title + '」？';
      correct = { id: 'correct', text: x.application, reason: '这项把专题原则落实为具体操作：' + x.keyPoints.join('；') + '。' };
      choices = [correct].concat(pool.map(function (p, i) { return { id: 'd' + i, text: p.application,
        reason: '这项是「' + p.title + '」的应用场景：' + p.summary + '。它可以在自己的场景中成立，但没有回答当前专题要解决的问题：' + x.summary }; }));
    } else {
      const foreign = pool[0];
      prompt = '下面哪一项不属于「' + x.title + '」的核心判断？';
      correct = { id: 'correct', text: foreign.keyPoints[0], reason: '题目问的是“不属于”。这一项来自「' + foreign.title + '」，而当前专题的核心是：' + x.summary };
      choices = x.keyPoints.map(function (p, i) { return { id: 'p' + i, text: p,
        reason: '题目要求找“不属于”的项。这一项实际是当前专题的核心要点，它与「' + x.title + '」的定义相符：' + x.summary + '。因此不应排除这一项。' }; }).concat([correct]);
    }
    return '<section class="kb-check" data-correct="correct"><div class="sec-h"><span class="ico">✅</span>快速自测 · 每次随机换一种问法</div>' +
      '<h2>' + esc(prompt) + '</h2><div class="kb-check-options">' + shuffled(choices).map(function (o, i) {
        return '<button type="button" data-kb-answer="' + escAttr(o.id) + '" data-answer-text="' + escAttr(o.text) + '" data-answer-reason="' + escAttr(o.reason) + '"><span>' + 'ABCD'[i] + '</span>' + esc(o.text) + '</button>';
      }).join('') + '</div><div class="kb-check-explain" hidden></div></section>';
  }

  function viewKnowledgeTopic(id) {
    const x = window.KnowledgeBase.get(id);
    if (!x) return '<div class="page"><div class="empty">找不到这个知识专题</div></div>';
    const related = x.relatedTerms.map(T).filter(Boolean);
    let html = '<div class="page kb-topic"><button type="button" class="kb-back" data-goto="kb">← 返回专题知识库</button>' +
      '<header><span class="kb-category">' + esc(x.category) + '</span><h1>' + esc(x.title) + '</h1><p class="lead">' + esc(x.summary) + '</p></header>' +
      '<section class="kb-takeaway"><span>一句话应用</span><p>' + esc(x.application) + '</p></section>' +
      '<section class="sec"><div class="sec-h"><span class="ico">🧭</span>理解这个专题的三个抓手</div><div class="kb-points">' +
      x.keyPoints.map(function (p, i) { return '<div><b>0' + (i + 1) + '</b><p>' + esc(p) + '</p></div>'; }).join('') + '</div></section>';
    if (related.length) {
      html += '<section class="sec"><div class="sec-h"><span class="ico">🕸️</span>回到核心课程</div><p class="tiny">点击相关概念，继续查看快速理解、随机小测和知识关联脑图。</p>' +
        '<div class="kb-related">' + related.map(function (t) {
          return '<button type="button" data-goto="term:' + escAttr(t.id) + '"><span>' + esc(t.name) + '</span><small>' + esc(t.one) + '</small></button>';
        }).join('') + '</div></section>';
    }
    html += knowledgeCheckHTML(x);
    html += '<div class="kb-source">来源：《AI产品经理--知识库》；页面内容为结构化改写，不代表原文逐字转载。</div></div>';
    return html;
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

    const kbList = (window.KNOWLEDGE_BASE || []).filter(function (x) {
      if (!q) return false;
      return (x.title + x.summary + x.category + (x.keywords || []).join(' ')).toLowerCase().indexOf(q) >= 0;
    });

    let html = '<div class="page"><h1>知识搜索</h1>' +
      '<p class="lead">搜索课程术语与专题知识库。当前包含 <b>' + window.TERMS.length + '</b> 个核心概念和 <b>' +
      window.KNOWLEDGE_BASE.length + '</b> 个延伸专题' +
      (q ? '，共匹配 <b>' + (list.length + kbList.length) + '</b> 项' : '') + '。</p>';

    html += '<div class="dict-search"><div class="search-box" style="max-width:340px">' +
      '<span class="ico">🔍</span><input id="dictSearch" placeholder="搜索术语、英文或含义…" value="' + esc(searchQuery) + '"></div></div>';

    html += '<div class="dict-head"><div>术语</div><div>一句话</div><div style="width:80px">掌握度</div></div>';
    if (!list.length) {
      if (!kbList.length) html += '<div class="empty">没有匹配内容，换个词试试</div>';
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
    if (kbList.length) {
      html += '<h2>专题知识库</h2><div class="kb-grid compact">' + kbList.map(function (x) {
        return knowledgeCardHTML(x);
      }).join('') + '</div>';
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
    if (r.decision != null) html += answerExplanationHTML({ correct: r.correct,
      selectedOptionText: p.decision.options[r.decision], correctOptionText: p.decision.options[p.decision.a],
      explanation: p.decision.why,
      selectedReason: p.decision.why + '。对照这道练习的真实场景：' + p.scenario,
      teaching: { name: p.title, summary: p.decision.why, steps: p.reference,
        scenario: p.scenario, application: '验收时逐项检查：' + p.checkpoints.join('；'), memory: p.decision.why } });
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
    const questions = window.Lab.interviewQuestions();
    const wrong = questions.map(function (q, i) { return { q: q, answer: iv.answers[i] }; })
      .filter(function (x) { return x.q.type === 'mcq' && (!x.answer || !x.answer.correct); });
    const openAnswers = questions.map(function (q, i) { return { q: q, answer: iv.answers[i] }; })
      .filter(function (x) { return x.q.type === 'open' && x.answer; });
    const reviewNote = result.reviewCount ? '变式复测通过 ' + result.reviewCorrect + '/' + result.reviewCount + '。' : '';
    let html = '<div class="page"><div class="result-head"><div class="score-disc" style="--score:' + result.score + ';--score-color:' + scoreTone(result.score) + '"><b>' + result.score + '</b><span>/100</span></div>' +
      '<div><h1>' + esc(result.label) + '</h1><p class="lead">客观题答对 ' + result.correct + '/' + (result.objectiveTotal || 12) + '，开放题量表 ' +
      Math.round((result.types && result.types.open ? result.types.open.points : 0) * 10) / 10 + '/40。' + esc(reviewNote) + '</p>' +
      '<button class="btn" data-assess-start="1">重新测评</button></div></div>' +
      '<h2>八维能力诊断</h2><div class="dimension-list">';
    Object.keys(window.INTERVIEW_DIMS).forEach(function (k) {
      const d = window.INTERVIEW_DIMS[k], s = result.dims[k] ? result.dims[k].score : 0;
      html += '<div class="dimension-row"><div class="dimension-copy"><b>' + esc(d.name) + '</b><span>' + esc(d.desc) + '</span></div>' +
        '<div class="dimension-bar"><i style="width:' + s + '%;background:' + scoreTone(s) + '"></i></div><strong>' + s + '</strong></div>';
    });
    html += '</div>' + interviewPlanHTML(false);
    if (wrong.length) {
      html += '<h2>客观题错题</h2><div class="wrong-list">' + wrong.map(function (x) {
        const correct = (x.q.options || []).find(function (o) { return o.id === x.q.correctOptionId; });
        const selected = (x.q.options || []).find(function (o) { return x.answer && o.id === x.answer.value; });
        const feedback = Object.assign({ correct: false, selectedOptionText: selected ? selected.text : '未选择', correctOptionText: correct ? correct.text : '—', explanation: x.q.explanation },
          window.Explanations.interview(x.q, selected ? selected.id : ''));
        return '<details><summary>' + esc(x.q.prompt) + '</summary>' + answerExplanationHTML(feedback) + '</details>';
      }).join('') + '</div>';
    }
    if (openAnswers.length) {
      html += '<h2>开放题复盘</h2><div class="wrong-list">' + openAnswers.map(function (x) {
        return '<details><summary>' + esc(x.q.prompt) + ' <span class="tag">' + Math.round((x.answer.score || 0) * 10) / 10 + '/5</span></summary>' +
          '<p><b>你的回答：</b>' + esc(x.answer.text) + '</p><p><b>参考结构：</b>' + esc(x.q.answerOutline) + '</p>' +
          '<p><button class="btn sm ghost" data-assess-ai="' + esc(x.q.id) + '">让 AI 补充点评</button></p></details>';
      }).join('') + '</div>';
    }
    return html + '</div>';
  }

  function viewInterview() {
    const iv = window.Lab.interview();
    if (iv.completedAt && iv.result) return viewInterviewResult(iv);
    if (iv.startedAt) {
      const questions = window.Lab.interviewQuestions();
      const feedback = iv.feedback;
      const idx = feedback ? iv.answers.length - 1 : iv.answers.length;
      const q = questions[idx];
      if (!q) return '<div class="page"><div class="empty">测评状态异常，请重新开始。<br><br><button class="btn" data-assess-start="1">重新开始</button></div></div>';
      const dim = window.INTERVIEW_DIMS[q.dimension];
      let html = '<div class="page assessment-page"><div class="assessment-top"><div><span>第 ' + (idx + 1) + ' / ' + questions.length + ' 题</span><b>' + esc(dim.name) + '</b></div>' +
        '<div class="assessment-progress"><i style="width:' + Math.round(idx / questions.length * 100) + '%"></i></div></div>' +
        '<div class="assessment-session-warning">本轮需要连续完成。刷新页面或退出测评会作废当前答案，返回后重新抽题计分。</div>' +
        '<div class="assessment-card"><div class="assessment-question-meta"><span>随机题</span>' +
        (q.review ? '<span class="review">变式复测</span>' : '<span>首次抽到</span>') +
        '<span>' + (q.difficulty === 1 ? '基础' : q.difficulty === 2 ? '进阶' : '高阶') + '</span></div><h1>' + esc(q.prompt) + '</h1>';
      if (q.type === 'mcq') {
        html += '<div class="assessment-options">' + q.options.map(function (o, i) {
          let cls = '', disabled = '';
          if (feedback) {
            disabled = ' disabled';
            if (o.id === feedback.correctOptionId) cls = ' correct';
            else if (o.id === feedback.selectedOptionId) cls = ' wrong';
          }
          return '<button class="' + cls + '" data-assess-answer="' + esc(o.id) + '"' + disabled + '><span>' + 'ABCDE'[i] + '</span>' + esc(o.text) + '</button>';
        }).join('') + '</div>';
        if (feedback) {
          html += answerExplanationHTML(feedback) + '<div class="assessment-open-actions"><button class="btn primary" data-assess-next="1">' +
            (iv.answers.length >= questions.length ? '查看测评结果' : '下一题 →') + '</button></div>';
        } else {
          html += '<p class="assessment-note">选择后先查看解析，再进入下一题。</p>';
        }
        return html + '</div></div>';
      }
      const pending = iv.pendingOpen;
      if (!pending || pending.questionId !== q.id) {
        html += '<textarea id="assessmentOpenAnswer" class="assessment-open-answer" placeholder="先写结论，再写判断依据、关键动作和验证方式。至少 20 个字。"></textarea>' +
          '<div class="assessment-open-actions"><span class="tiny">回答只保存在当前浏览器。</span><button class="btn primary" data-assess-open-submit="1">查看评分要点</button></div></div></div>';
        return html;
      }
      html += '<div class="assessment-your-answer"><b>你的回答</b><p>' + esc(pending.text) + '</p></div>' +
        '<div class="assessment-rubric"><h2>根据自己的回答勾选已覆盖要点</h2>' + (q.rubric || []).map(function (r) {
          return '<label><input type="checkbox" value="' + esc(r.id) + '"> <span>' + esc(r.label) + '</span></label>';
        }).join('') + '</div><div class="assessment-outline"><b>参考结构</b><p>' + esc(q.answerOutline) + '</p></div>' +
        '<div class="assessment-open-actions"><span class="tiny">AI 点评不会改变量表得分。</span><button class="btn primary" data-assess-open-score="1">确认评分并继续</button></div></div></div>';
      return html;
    }

    const last = (iv.history || []).slice(-1)[0];
    const sessionSize = window.Lab.interviewSessionSize();
    const bankSize = window.Lab.interviewBankSize();
    let html = '<div class="page interview-intro"><h1>AI PM 面试测评</h1>' +
      '<p class="lead">每次从 ' + bankSize + ' 道精选题中分层抽取 12 道客观题与 8 道开放题，覆盖八个能力维度。答对过的知识点仍会换一种问法复测。</p>' +
      (iv.lastAbortReason ? '<div class="callout yellow"><span class="emo">↻</span><div class="ct"><b>上一轮测评已作废</b><br>' +
        (iv.lastAbortReason === 'refresh' ? '页面曾被刷新或重新打开' : '你在完成前退出了测评') +
        '，未完成答案没有计入成绩和题目统计。请重新开始测评。</div></div>' : '') +
      '<div class="assessment-facts"><div><b>' + sessionSize + '</b><span>每次抽题</span></div><div><b>' + bankSize + '</b><span>精选题库</span></div><div><b>25</b><span>分钟左右</span></div></div>' +
      '<div class="dimension-preview">';
    Object.keys(window.INTERVIEW_DIMS).forEach(function (k) {
      const d = window.INTERVIEW_DIMS[k];
      html += '<div><b>' + esc(d.name) + '</b><span>' + esc(d.desc) + '</span></div>';
    });
    html += '</div>' + (last ? '<div class="last-score">上次得分 <b>' + last.score + '</b> / 100</div>' : '') +
      '<button class="btn primary assessment-start" data-assess-start="1">开始测评</button>' +
      '<p class="tiny">题目、题序和 3–5 个选项顺序都会随机；开放题按稳定量表自评，AI 仅提供可选点评。</p></div>';
    return html;
  }

  /* ============================================================
     视图：复习队列
     ============================================================ */
  function myTabs(active) {
    return '<div class="my-tabs" aria-label="我的学习分区">' +
      '<button class="' + (active === 'progress' ? 'active' : '') + '" data-route="my">学习进度</button>' +
      '<button class="' + (active === 'review' ? 'active' : '') + '" data-route="review">复习队列</button>' +
      '<button class="' + (active === 'settings' ? 'active' : '') + '" data-route="settings">设置与记忆</button></div>';
  }

  function viewReview() {
    const q = window.Mem.reviewQueue(99);
    let html = '<div class="page"><h1>我的学习</h1>' + myTabs('review') + '<h2>复习队列</h2>' +
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
    let html = '<div class="page"><h1>我的学习</h1>' + myTabs('progress') + '<h2>学习进度</h2>' +
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
  function quickUnderstandHTML(t) {
    const q = window.KnowledgeRelations.quick(t.id);
    if (!q) return '';
    return '<section class="concept-quick" aria-label="快速理解">' +
      '<div><span>它是什么</span><p>' + esc(q.meaning) + '</p></div>' +
      '<div><span>什么时候用</span><p>' + esc(q.useWhen) + '</p></div>' +
      '<div><span>典型场景</span><p>' + esc(q.scenario) + '</p></div></section>';
  }

  function relationGroupHTML(title, desc, items, cls) {
    if (!items || !items.length) return '';
    return '<section class="relation-group ' + cls + '"><div class="relation-group-head"><b>' + title + '</b><span>' + desc + '</span></div><div class="relation-list">' +
      items.map(function (r) {
        return '<button type="button" class="relation-node" data-goto="term:' + esc(r.id) + '">' +
          '<span class="relation-link">' + (cls === 'prerequisite' ? '先修' : cls === 'extension' ? '延伸' : '协同') + '</span>' +
          '<b>' + esc(r.name) + '</b><span class="relation-one">' + esc(r.one) + '</span>' +
          '<span class="relation-reason">' + esc(r.reason) + '</span></button>';
      }).join('') + '</div></section>';
  }

  function mindText(text, max) {
    const s = String(text || '').replace(/\*\*/g, '').replace(/`/g, '').replace(/\s+/g, ' ').trim();
    return s.length > max ? s.slice(0, max - 1) + '…' : s;
  }

  function mindMapSVG(t, rel, kbTopics) {
    const groups = [
      { key: 'prerequisite', title: '先修知识', items: rel.prerequisite, cls: 'prerequisite' },
      { key: 'companion', title: '协同概念', items: rel.companion, cls: 'companion' },
      { key: 'extension', title: '后续延伸', items: rel.extension, cls: 'extension' },
      { key: 'knowledge', title: '专题阅读', cls: 'knowledge', items: (kbTopics || []).slice(0, 3).map(function (x) {
        return { id: x.id, name: x.title, one: x.summary, reason: '从课程概念延伸到「' + x.title + '」的产品应用。', goto: 'kb/' + x.id };
      }) }
    ].filter(function (g) { return g.items && g.items.length; });
    const total = groups.reduce(function (n, g) { return n + g.items.length; }, 0);
    const height = Math.max(620, total * 72 + 90);
    const rootY = height / 2 - 34;
    let paths = '', hubs = '', leaves = '';

    groups.forEach(function (group, gi) {
      const centerY = height * (gi + 1) / (groups.length + 1);
      const hubY = centerY - 23;
      paths += '<path class="mind-branch ' + group.cls + '" d="M250 ' + (rootY + 34) + ' C285 ' + (rootY + 34) + ' 285 ' + centerY + ' 320 ' + centerY + '"/>';
      hubs += '<g class="mind-hub ' + group.cls + '"><rect x="320" y="' + hubY + '" width="154" height="46" rx="12"/>' +
        '<text x="397" y="' + (hubY + 28) + '" text-anchor="middle">' + esc(group.title) + '</text></g>';
      const startY = centerY - (group.items.length * 66) / 2;
      group.items.forEach(function (item, i) {
        const y = startY + i * 66;
        paths += '<path class="mind-leaf-line ' + group.cls + '" d="M474 ' + centerY + ' C515 ' + centerY + ' 515 ' + (y + 26) + ' 556 ' + (y + 26) + '"/>';
        leaves += '<g class="mind-leaf ' + group.cls + '" role="button" tabindex="0" data-goto="' + escAttr(item.goto || ('term:' + item.id)) + '" aria-label="查看知识点：' + escAttr(item.name) + '">' +
          '<title>' + esc(item.reason) + '</title><rect x="556" y="' + y + '" width="390" height="54" rx="12"/>' +
          '<text class="mind-leaf-name" x="572" y="' + (y + 22) + '">' + esc(mindText(item.name, 20)) + '</text>' +
          '<text class="mind-leaf-desc" x="572" y="' + (y + 41) + '">' + esc(mindText(item.one, 38)) + '</text></g>';
      });
    });

    return '<div class="mindmap-scroll" tabindex="0" aria-label="' + escAttr(t.name) + ' 知识关联脑图，可横向滚动">' +
      '<svg class="mindmap" viewBox="0 0 980 ' + height + '" role="img" aria-label="以 ' + escAttr(t.name) + ' 为根节点的知识关联脑图">' +
      '<defs><marker id="mindArrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse"><path d="M0 0 L10 5 L0 10 z"/></marker></defs>' +
      paths + '<g class="mind-root"><rect x="30" y="' + rootY + '" width="220" height="68" rx="16"/>' +
      '<text class="mind-root-label" x="48" y="' + (rootY + 23) + '">当前知识点</text>' +
      '<text class="mind-root-name" x="48" y="' + (rootY + 48) + '">' + esc(mindText(t.name, 17)) + '</text></g>' + hubs + leaves + '</svg></div>';
  }

  function knowledgeMapHTML(t) {
    const rel = window.KnowledgeRelations.forTerm(t.id);
    const kbTopics = window.KnowledgeBase.forTerm(t.id);
    return '<div class="divider"></div><section class="knowledge-map"><div class="knowledge-map-head"><div><h2>知识关联地图</h2>' +
      '<p>从当前知识点展开先修、协同、延伸与专题阅读；点击节点可跳转，手机端可左右滑动查看完整脑图。</p></div></div>' + mindMapSVG(t, rel, kbTopics) +
      '<details class="relation-details"><summary>查看每条关联的解释</summary><div>' +
      relationGroupHTML('先修知识', '先理解这些，当前概念会更容易懂', rel.prerequisite, 'prerequisite') +
      relationGroupHTML('协同概念', '实际产品方案中通常会一起使用', rel.companion, 'companion') +
      relationGroupHTML('后续延伸', '掌握当前概念后继续学习', rel.extension, 'extension') +
      (kbTopics.length ? '<section class="relation-group knowledge"><div class="relation-group-head"><b>专题阅读</b><span>把当前概念连接到产品方法和业务应用</span></div><div class="kb-grid compact">' +
        kbTopics.map(knowledgeCardHTML).join('') + '</div></section>' : '') + '</div></details></section>';
  }

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

    // 三段式快速理解
    html += quickUnderstandHTML(t);

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
      '<p class="tiny" style="margin-top:-4px">每次只抽一道；答对后下次会换一种问法复测，选项数量和顺序不固定。</p>';
    const quiz = window.LearningQuiz.pick(t.id);
    if (quiz) {
      html += '<div class="quiz" data-question-id="' + esc(quiz.id) + '"><div class="quiz-q">' +
        (quiz.review ? '<span class="tag purple">变式复测</span> ' : '') + esc(quiz.prompt) + '</div>' +
        quiz.options.map(function (o, oi) {
          return '<button type="button" class="opt" data-opt="' + oi + '" data-answer-id="' + esc(o.id) + '"><span class="k">' + 'ABCDE'[oi] + '</span><span>' + esc(o.text) + '</span></button>';
        }).join('') + '<div class="explain" style="display:none"></div></div>';
    }

    // 反馈
    html += '<div class="feedback"><span class="lbl">这个概念现在懂了吗？</span>' +
      '<button class="btn sm" data-fb="cleared">😄 我懂了</button>' +
      '<button class="btn sm" data-fb="confused">😵 还是不懂</button>' +
      '<button class="btn sm ghost" data-ask="1">💬 让 AI 再讲一遍</button></div>';

    // 今日计划内的上一项 / 下一项
    html += planNavHTML(t);

    // 知识关联地图
    html += knowledgeMapHTML(t);

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

    let html = '<div class="page"><h1>我的学习</h1>' + myTabs('settings') + '<h2>设置与记忆</h2>' +
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
    const kb = h.match(/^kb[:\/](.+)$/);
    if (kb) return { route: 'kb-topic', id: decodeURIComponent(kb[1]) };
    if (h.indexOf('dict') === 0) {
      const q = h.split('?q=')[1];
      return { route: 'dict', q: q ? decodeURIComponent(q) : '' };
    }
    return { route: h };
  }

  function render() {
    const r = parseHash();
    if (activeRoute === 'interview' && r.route !== 'interview') {
      window.Lab.abortInterview('exit');
    }
    activeRoute = r.route;
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
      home: '今日学习', learn: '今日学习', plan: '学习计划', path: '学习路径', dict: '术语词典',
      practice: '实战练习', 'practice-detail': '实战练习', interview: '面试测评',
      kb: '专题知识库', 'kb-topic': '专题知识库',
      my: '我的学习', review: '我的学习', mastery: '我的学习', settings: '我的学习'
    };
    try {
      if (r.route === 'term') html = viewTerm(r.id);
      else if (r.route === 'learn') html = viewLearn();
      else if (r.route === 'plan') html = viewPlan();
      else if (r.route === 'path') html = viewPath();
      else if (r.route === 'kb') html = viewKnowledgeBase();
      else if (r.route === 'kb-topic') html = viewKnowledgeTopic(r.id);
      else if (r.route === 'dict') { searchQuery = r.q || ''; html = viewDict(); }
      else if (r.route === 'practice') html = viewPractice();
      else if (r.route === 'practice-detail') html = viewPracticeDetail(r.id);
      else if (r.route === 'interview') html = viewInterview();
      else if (r.route === 'review') html = viewReview();
      else if (r.route === 'mastery' || r.route === 'my') html = viewMastery();
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
    if (document.scrollingElement) document.scrollingElement.scrollTop = 0;

    // 面包屑
    if (r.route === 'term' && currentTerm) {
      crumb.innerHTML = '<span>术语词典</span><span class="sep">/</span><b>' + esc(currentTerm.name) + '</b>';
    } else if (r.route === 'practice-detail') {
      const p = window.Lab.exercise(r.id);
      crumb.innerHTML = '<span>实战练习</span><span class="sep">/</span><b>' + esc(p ? p.title : '练习') + '</b>';
    } else if (r.route === 'kb-topic') {
      const k = window.KnowledgeBase.get(r.id);
      crumb.innerHTML = '<span>专题知识库</span><span class="sep">/</span><b>' + esc(k ? k.title : '专题') + '</b>';
    } else {
      crumb.innerHTML = '<b>' + (titles[r.route] || '今日学习') + '</b>';
    }

    // 侧栏高亮
    document.querySelectorAll('.nav-item').forEach(function (el) {
      el.classList.toggle('active', el.dataset.route === r.route ||
        (r.route === 'learn' && el.dataset.route === 'home') ||
        (r.route === 'term' && el.dataset.route === 'path') ||
        (r.route === 'kb-topic' && el.dataset.route === 'kb') ||
        (['review', 'mastery', 'settings', 'my'].indexOf(r.route) >= 0 && el.dataset.route === 'my') ||
        (r.route === 'practice-detail' && el.dataset.route === 'practice'));
    });
    document.querySelectorAll('.mobile-nav [data-route]').forEach(function (el) {
      el.classList.toggle('active', el.dataset.route === r.route ||
        (r.route === 'learn' && el.dataset.route === 'home') ||
        (r.route === 'term' && el.dataset.route === 'path') ||
        (['kb', 'kb-topic'].indexOf(r.route) >= 0 && el.dataset.route === 'path') ||
        (['review', 'mastery', 'settings', 'my'].indexOf(r.route) >= 0 && el.dataset.route === 'my') ||
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
    if (r.route === 'kb') requestAnimationFrame(function () {
      const map = document.querySelector('.kb-overview-map-scroll');
      if (map) map.scrollLeft = Math.max(0, (map.scrollWidth - map.clientWidth) / 2);
    });
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
    if (typeof el.click === 'function') el.click();
    else el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
  });

  /* ============================================================
     交互（事件委托）
     ============================================================ */
  document.addEventListener('click', function (e) {
    const el = e.target.closest('[data-goto],[data-route],[data-fb],[data-ask],[data-opt],[data-stage],[data-regen],' +
      '[data-practice-save],[data-practice-choice],[data-practice-rate],[data-assess-start],[data-assess-answer],' +
      '[data-assess-next],[data-assess-open-submit],[data-assess-open-score],[data-assess-ai],[data-learn-start],[data-learn-answer],[data-learn-next],[data-plan-day],[data-kb-answer],[data-kb-pan],[data-kb-center]');
    if (!el) return;

    if (el.dataset.kbPan !== undefined || el.dataset.kbCenter !== undefined) {
      const map = document.querySelector('.kb-overview-map-scroll');
      if (!map) return;
      const reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      const target = el.dataset.kbCenter !== undefined
        ? (map.scrollWidth - map.clientWidth) / 2
        : map.scrollLeft + Number(el.dataset.kbPan) * Math.max(320, map.clientWidth * 0.75);
      map.scrollTo({ left: Math.max(0, target), behavior: reduce ? 'auto' : 'smooth' });
      return;
    }

    if (el.dataset.kbAnswer !== undefined) {
      const box = el.closest('.kb-check');
      if (!box || box.dataset.done) return;
      box.dataset.done = '1';
      const ok = el.dataset.kbAnswer === box.dataset.correct;
      box.querySelectorAll('[data-kb-answer]').forEach(function (button) {
        button.disabled = true;
        if (button.dataset.kbAnswer === box.dataset.correct) button.classList.add('correct');
        else if (button === el) button.classList.add('wrong');
      });
      const x = window.KnowledgeBase.get(parseHash().id);
      const explain = box.querySelector('.kb-check-explain');
      explain.hidden = false;
      const reviews = Array.from(box.querySelectorAll('[data-kb-answer]')).map(function (button) {
        return { id: button.dataset.kbAnswer, text: button.dataset.answerText, reason: button.dataset.answerReason,
          correct: button.dataset.kbAnswer === box.dataset.correct, selected: button === el };
      });
      const right = reviews.find(function (o) { return o.correct; });
      explain.innerHTML = answerExplanationHTML({ correct: ok, selectedOptionText: el.dataset.answerText, correctOptionText: right.text,
        selectedReason: el.dataset.answerReason, explanation: right.reason, optionReviews: reviews,
        teaching: { name: x.title, summary: x.summary, steps: x.keyPoints, scenario: x.application, memory: x.keyPoints[0] } });
      return;
    }

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
      window.Lab.answerInterview(el.dataset.assessAnswer);
      render();
      return;
    }
    if (el.dataset.assessNext) {
      window.Lab.nextInterview();
      render(); return;
    }
    if (el.dataset.assessOpenSubmit) {
      const input = $('#assessmentOpenAnswer');
      const res = window.Lab.submitOpenAnswer(input ? input.value : '');
      if (res && res.error) { toast(res.error); return; }
      render(); return;
    }
    if (el.dataset.assessOpenScore) {
      const selected = Array.from(document.querySelectorAll('.assessment-rubric input:checked')).map(function (x) { return x.value; });
      window.Lab.scoreOpenAnswer(selected);
      render(); return;
    }
    if (el.dataset.assessAi) {
      const q = window.Lab.interviewQuestions().find(function (x) { return x.id === el.dataset.assessAi; });
      const idx = window.Lab.interviewQuestions().findIndex(function (x) { return x.id === el.dataset.assessAi; });
      const answer = window.Lab.interview().answers[idx];
      openChat();
      if (q && answer) askQuick('请以 AI PM 面试官身份点评这道题。题目：' + q.prompt + '\n我的回答：' + answer.text + '\n请按参考结构指出做得好的地方、缺失判断和更清晰的表达方式。不要修改系统量表得分。');
      return;
    }
    if (el.dataset.learnStart) {
      const ids = [];
      window.Mem.plan().items.filter(function (it) { return !it.done && it.termId; }).forEach(function (it) {
        if (ids.indexOf(it.termId) < 0) ids.push(it.termId);
      });
      window.LearningQuiz.startDaily(ids);
      go('learn'); return;
    }
    if (el.dataset.learnAnswer !== undefined) {
      window.LearningQuiz.answerDaily(el.dataset.learnAnswer);
      render(); return;
    }
    if (el.dataset.learnNext) {
      window.LearningQuiz.nextDaily();
      render(); return;
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
      const result = window.LearningQuiz.answer(currentTerm.id, quizEl.dataset.questionId, el.dataset.answerId);
      if (!result) return;
      const ok = result.correct;
      quizEl.dataset.done = '1';
      quizEl.querySelectorAll('.opt').forEach(function (o) {
        o.classList.add('disabled');
        if (o.dataset.answerId === result.correctOptionId) o.classList.add('correct');
        else if (o === el) o.classList.add('wrong');
      });
      const ex = quizEl.querySelector('.explain');
      ex.style.display = 'block';
      ex.innerHTML = answerExplanationHTML(result);
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
  const memPeek = $('#memPeek');
  if (memPeek) memPeek.onclick = function () { go('my'); };
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
