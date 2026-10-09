/* ============================================================
   LLM 对话层
   ------------------------------------------------------------
   1) 配置了 API（任意 OpenAI 兼容端点）→ 真正调用大模型，流式输出
   2) 未配置 → 使用内置知识库离线作答（保证开箱可用）
   System prompt 会注入长期记忆摘要（Mem.memoryBrief）
   ============================================================ */

(function () {
  const CFG_KEY = 'aipm.llm.v1';

  const DEFAULT_CFG = {
    enabled: false,
    baseUrl: 'https://api.openai.com/v1',
    apiKey: '',
    model: 'gpt-4o-mini',
    temperature: 0.4
  };

  function getCfg() {
    try {
      return Object.assign({}, DEFAULT_CFG, JSON.parse(localStorage.getItem(CFG_KEY) || '{}'));
    } catch (e) { return Object.assign({}, DEFAULT_CFG); }
  }
  function setCfg(c) { localStorage.setItem(CFG_KEY, JSON.stringify(Object.assign(getCfg(), c))); }

  /* ---------- 系统提示词：注入长期记忆 ---------- */
  function buildSystem(term) {
    const brief = window.Mem.memoryBrief(term || null);
    const adapt = term ? window.Mem.adaptFor(term) : null;
    const styleMap = {
      analogy: '这一轮请**先用类比**开场，再落到定义。',
      example: '这一轮请**先给一个具体例子**再讲原理，这是这位用户习惯的接收方式。',
      steps: '这一轮请**拆成编号步骤**来讲，用户关心「到底怎么做」。',
      why: '这一轮请**先讲为什么需要它 / 解决什么问题**，再讲它是什么。',
      standard: '按「一句话 → 类比 → 展开 → 例子」的顺序讲。'
    };
    const adaptNote = adapt
      ? ('【本轮的讲解策略】\n' +
        (styleMap[adapt.style] || styleMap.standard) + '\n' +
        (adapt.simple ? '· 该用户在「' + window.CATS[term.cat].name + '」类内容上反复卡住 → **降级讲法**：句子更短、多用生活场景、每步不超过 2 行，并在结尾补一个例子。\n' : '') +
        (adapt.depth === 'shallow' ? '· 用户处于起步阶段 → **不要引入二级术语**，遇到必须提到的术语就地用一句话解释。\n' : '') +
        (adapt.depth === 'deep' ? '· 用户已达进阶 → 可以讲权衡、成本和常见踩坑，不用停留在基础定义。\n' : '') +
        (adapt.attention && adapt.attention.key === 'short' ? '· 现在是碎片 / 深夜时段 → 回答控制在 **150 字以内**，一次只讲一件事。\n' : '') +
        (adapt.prefix && adapt.prefix.length ? '· 如果发现用户连 ' + adapt.prefix.map(function (p) { return '「' + p.name + '」'; }).join('、') + ' 都没掌握，先用一句人话补一下再往下讲。' : ''))
      : '';

    return [
      '你是「AI PM 学院」里的讲解助手，专门帮一位想转岗/入门 AI 产品经理的学习者理解 AI 与 Agent 相关概念。',
      '',
      '你的讲解原则：',
      '1. 说人话。默认用生活化的类比（餐厅、快递、实习生、搬家）来讲，避免堆术语。',
      '2. 先讲「为什么需要它 / 解决什么问题」，再讲「它是什么」，最后讲「怎么用/注意什么」。',
      '3. 句子要短。每段不超过 3 行，重要结论加粗。',
      '4. 如果涉及用户已经理解吃力的内容类型，自动降级到更简单的讲法，并主动补一个例子。',
      '5. 不知道就说不知道，绝不编造事实和来源。',
      '6. 结尾可以反问一句「要不要我举个 XX 的例子？」来确认理解，但不要啰嗦。',
      '',
      brief,
      '',
      adaptNote,
      term ? ('【当前概念卡片】\n' + term.name + '（' + term.en + '）\n一句话：' + term.one + '\n类比：' + term.analogy) : '',
      '',
      '请用中文回答，字数控制在 300 字以内，除非用户要求展开。'
    ].filter(Boolean).join('\n');
  }

  /* ---------- 在线调用（流式） ---------- */
  async function stream(messages, onDelta, signal) {
    const cfg = getCfg();
    const url = cfg.baseUrl.replace(/\/+$/, '') + '/chat/completions';
    const body = {
      model: cfg.model,
      messages: messages,
      temperature: Number(cfg.temperature) || 0.4,
      stream: true
    };
    const resp = await fetch(url, {
      method: 'POST',
      signal: signal,
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + cfg.apiKey },
      body: JSON.stringify(body)
    });
    if (!resp.ok) {
      let detail = '';
      try { const j = await resp.json(); detail = (j.error && (j.error.message || j.error.code)) || ''; } catch (e) { detail = await resp.text().catch(() => ''); }
      throw new Error('HTTP ' + resp.status + ' ' + detail);
    }
    if (!resp.body) throw new Error('该端点不支持流式响应');
    const reader = resp.body.getReader();
    const dec = new TextDecoder('utf-8');
    let buf = '';
    while (true) {
      const r = await reader.read();
      if (r.done) break;
      buf += dec.decode(r.value, { stream: true });
      const lines = buf.split('\n');
      buf = lines.pop();
      for (const line of lines) {
        const s = line.trim();
        if (!s.startsWith('data:')) continue;
        const data = s.slice(5).trim();
        if (data === '[DONE]') return;
        try {
          const j = JSON.parse(data);
          const d = j.choices && j.choices[0] && (j.choices[0].delta || {}).content;
          if (d) onDelta(d);
        } catch (e) { /* ignore keepalive */ }
      }
    }
  }

  /* ---------- 离线兜底：基于内置知识库作答 ---------- */
  const STOP = ['的', '了', '是', '什么', '为什么', '怎么', '如何', '吗', '呢', '啊', '请', '我', '你', '给', '讲', '说', '解释', '一下', '意思', '意思是什么', '和', '与', '区别', '有哪些', '这个', '那个', '一个', '到底', '到底怎么'];

  function score(term, q) {
    let s = 0;
    const hay = (term.name + term.en + term.one + term.analogy + term.steps.join('') + term.example + term.pm).toLowerCase();
    const qq = q.toLowerCase();
    if (qq.indexOf(term.name.toLowerCase()) >= 0) s += 12;
    if (term.en && qq.indexOf(term.en.split(' ')[0].toLowerCase()) >= 0) s += 8;
    // 逐字匹配（中文）
    term.name.split('').forEach(function (ch) { if (qq.indexOf(ch) >= 0) s += 1.5; });
    [...new Set(q.replace(/[，。？！、\s]/g, '').split(''))].forEach(function (ch) {
      if (STOP.indexOf(ch) >= 0) return;
      if (hay.indexOf(ch) >= 0) s += 0.6;
    });
    return s;
  }

  /** 用「管什么」区分两个概念 */
  function keySentence(a, b) {
    const ca = window.CATS[a.cat], cb = window.CATS[b.cat];
    const ha = ca ? ca.hint.replace(/[「」]/g, '') : '它是什么';
    const hb = cb ? cb.hint.replace(/[「」]/g, '') : '它是什么';
    if (a.cat === b.cat) {
      return '两者都属于「' + ca.name + '」，是解决同一类问题的两种不同做法，所以最容易混。';
    }
    return a.name + ' 管的是「' + ha + '」，' + b.name + ' 管的是「' + hb + '」。';
  }
  function pickHint(a, b) {
    const ca = window.CATS[a.cat], cb = window.CATS[b.cat];
    if (!ca || !cb) return '取决于你要解决的具体问题。';
    if (a.cat === b.cat) {
      const first = a.level <= b.level ? a : b;
      const second = first === a ? b : a;
      return '建议按顺序学：先看「' + first.name + '」，再看「' + second.name + '」，否则两个一起看更容易糊。';
    }
    const first = a.level <= b.level ? a : b;
    const second = first === a ? b : a;
    return a.name + '更偏' + ca.name + '（' + ca.hint + '），' + b.name + '更偏' + cb.name + '（' + cb.hint + '）——看你当前卡在哪一类问题上。如果都还没学过，建议先看「' + first.name + '」。';
  }

  function offlineAnswer(q, term) {
    const query = (q || '').trim();
    let target = term;

    // 对比类问题："A 和 B 有什么区别"
    const vs = query.match(/(.+?)\s*(?:和|与|跟|vs|VS|对比)\s*(.+?)\s*(?:有?什么区别|区别|有什么不同|哪个好)/);
    if (vs) {
      const all = window.TERMS;
      const hit = function (frag) {
        const f = String(frag || '').replace(/[？?。，,]/g, '').trim().toLowerCase();
        return all.find(function (t) {
          return f.includes(t.name.toLowerCase()) ||
            f.includes(String(t.en || '').split(/[ ·(]/)[0].toLowerCase());
        });
      };
      const f1 = hit(vs[1]);
      const f2 = hit(vs[2]);
      if (f1 && f2 && f1.id !== f2.id) {
        return '**' + f1.name + ' vs ' + f2.name + '**\n\n' +
          '· **' + f1.name + '**：' + f1.one + '\n' +
          '· **' + f2.name + '**：' + f2.one + '\n\n' +
          '**一句话记住**：' + keySentence(f1, f2) + '\n\n' +
          pickHint(f1, f2) + '\n\n' +
          '> 想让我用同一个真实场景分别演一遍吗？（当前是离线讲解模式，配置 API 后可以进行真正的多轮追问）';
      }
    }

    if (!target) {
      const ranked = window.TERMS.map(t => ({ t, s: score(t, query) })).sort((a, b) => b.s - a.s);
      if (ranked.length && ranked[0].s > 3) target = ranked[0].t;
    }

    if (!target) {
      return '我现在处于**离线讲解模式**（还没配置大模型 API），只能基于内置知识库回答。\n\n' +
        '你可以这样问我：\n· 某个术语的名字，比如「什么是 RAG」「Loop 是什么」\n· 两个概念的区别，比如「RAG 和微调有什么区别」\n· 或者直接点开左侧任意一个术语，再点「AI 追问」\n\n' +
        '到「设置」里填上任意 OpenAI 兼容的 API（OpenAI / DeepSeek / 通义 / Moonshot / 本地 Ollama 都行），就可以进行真正的自由对话了。';
    }

    const isWhy = /为什么|凭什么|有什么用|干嘛|作用|意义/.test(query);
    const isEg = /例子|举例|举个|场景|怎么用|实战/.test(query);
    const isHow = /怎么做|怎么实现|如何做|怎么搭|步骤|流程/.test(query);

    let head = isWhy ? '为什么需要「' + target.name + '」？'
      : isEg ? '「' + target.name + '」的例子'
        : isHow ? '「' + target.name + '」大致怎么做'
          : '「' + target.name + '」是什么';

    let body = '';
    if (isWhy) {
      body = target.one + '\n\n' + target.pm;
    } else if (isEg) {
      body = target.example;
    } else if (isHow) {
      body = target.steps.map((s, i) => (i + 1) + '. ' + s).join('\n');
    } else {
      body = '**一句话**：' + target.one + '\n\n' +
        '**打个比方**：' + target.analogy + '\n\n' +
        (target.steps[0] || '') + '\n\n' +
        '**举个例子**：' + target.example;
    }

    const more = target.related.slice(0, 2).map(function (id) {
      const r = window.TERMS.find(t => t.id === id);
      return r ? ('· ' + r.name + '：' + r.one) : '';
    }).filter(Boolean).join('\n');

    const tail = '\n\n---\n顺带一提：\n' + more +
      '\n\n> 当前是**离线讲解模式**。在「设置」里配置大模型 API 后，我就能针对你的追问自由展开、并会记住你哪里听不懂。';

    return '**' + head + '**\n\n' + body + tail;
  }

  /* ---------- 对外接口 ---------- */
  async function ask(userText, term, onDelta, signal) {
    const cfg = getCfg();
    const history = window.Mem.chatHistory(term ? term.id : null);
    const messages = [{ role: 'system', content: buildSystem(term) }]
      .concat(history.map(m => ({ role: m.role, content: m.content })))
      .concat([{ role: 'user', content: userText }]);

    if (cfg.enabled && cfg.apiKey) {
      try {
        await stream(messages, onDelta, signal);
        return { mode: 'llm' };
      } catch (e) {
        if (e.name === 'AbortError') return { mode: 'abort' };
        return { mode: 'error', error: e.message, fallback: offlineAnswer(userText, term) };
      }
    }
    // 离线：模拟逐段输出，体验一致
    const text = offlineAnswer(userText, term);
    const chunks = text.match(/[\s\S]{1,14}/g) || [text];
    for (const c of chunks) {
      await new Promise(r => setTimeout(r, 16));
      onDelta(c);
    }
    return { mode: 'offline' };
  }

  window.LLM = { getCfg, setCfg, ask, buildSystem, offlineAnswer };
})();
