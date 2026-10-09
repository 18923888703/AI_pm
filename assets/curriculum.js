/* ============================================================
   课程大纲（Curriculum）
   ------------------------------------------------------------
   把散装的 60 个术语编成一份有顺序、有先修关系的固定课表。
   这是「学习计划」的骨架 —— 计划不是每天临时算出来的推荐，
   而是「这份大纲排到第几课了，今天继续往下走」。

   设计原则：
   1. 每节课 1~3 个概念，围绕同一个问题展开，而不是硬凑数量
   2. 先讲「它是什么」，再讲「怎么调」，最后讲「怎么评估」
   3. 每个阶段结束有一个检查点 —— 不复述新内容，只做复习 + 测验
   ============================================================ */

(function () {
  /** 每节课：no 序号 / stage 所属阶段 / t 标题 / g 一句话目标 / ids 本课概念 */
  const RAW = [
    /* ---------- 阶段 0：建立直觉 ---------- */
    { stage: 0, t: 'AI、模型、大模型，到底谁是谁', g: '能听懂团队开会时这三个词在说什么，不再混用', ids: ['ai', 'model', 'llm'] },
    { stage: 0, t: '它不是在读字，是在数块', g: '理解 Token 是怎么切分的，以及为什么它决定了你能塞多少东西', ids: ['token', 'prompt'] },
    { stage: 0, t: '它能记住多少，为什么会瞎编', g: '知道上下文窗口的天花板在哪，以及幻觉是什么性质的缺陷', ids: ['context', 'hallucination'] },
    { stage: 0, kind: 'checkpoint', t: '阶段检查 · 建立直觉', g: '不用死记，能把这 7 个词连成一句话讲给别人听就算过', ids: ['ai', 'model', 'llm', 'token', 'prompt', 'context', 'hallucination'] },

    /* ---------- 阶段 1：让它稳定干活 ---------- */
    { stage: 1, t: '调用一次到底发生了什么', g: '区分「训练」和「推理」，知道温度和每次回答不一样的关系', ids: ['inference', 'temperature'] },
    { stage: 1, t: '怎么让它稳定地听你的话', g: '系统提示词和示例分管不同的事，不再往用户提示里堆要求', ids: ['systemprompt', 'fewshot'] },
    { stage: 1, t: '要的不是一句话，是能用的数据', g: '什么时候必须上结构化输出，以及它挡掉的是哪一类事故', ids: ['structured'] },
    { stage: 1, t: '给它外挂一本自己的资料', g: '搞懂 RAG 这条链路：先把文字变成向量，再按问题找回来', ids: ['embedding', 'rag'] },
    { stage: 1, t: '资料存哪儿，要不要亲自训练它', g: '能判断一个需求该用 RAG 还是微调，不再拍脑袋', ids: ['vectordb', 'finetune'] },
    { stage: 1, kind: 'checkpoint', t: '阶段检查 · 稳定干活', g: '能独立说出「这个需求用提示词 / RAG / 微调」的选择依据', ids: ['inference', 'temperature', 'systemprompt', 'fewshot', 'structured', 'embedding', 'rag', 'vectordb', 'finetune'] },

    /* ---------- 阶段 2：Agent 是怎么转起来的 ---------- */
    { stage: 2, t: 'Agent 就是模型 + 手', g: '明白 Agent 和聊天的本质差别：它能不能真的去做一件事', ids: ['agent', 'tool'] },
    { stage: 2, t: '那个让它转起来的圈', g: '看懂 Loop 的四步，以及「规划」在里面到底起什么作用', ids: ['loop', 'planning'] },
    { stage: 2, t: '让它别忘了上一次聊过什么', g: '区分短期上下文和长期记忆，知道记忆写坏了会出什么事', ids: ['memory'] },
    { stage: 2, t: '把能力打包，让别人也能接', g: 'Skill 和 MCP 分管的是两件事：一个是说明书，一个是插槽标准', ids: ['skill', 'mcp'] },
    { stage: 2, t: '多个 Agent 和那个刹车', g: '知道什么时候该上工作流而不是 Agent，以及人在环里该卡在哪', ids: ['multiagent', 'workflow', 'hitl'] },
    { stage: 2, kind: 'checkpoint', t: '阶段检查 · Agent 拆解', g: '给你一个 AI 产品，你能画出它的循环图并指出会在哪一步失败', ids: ['agent', 'tool', 'loop', 'planning', 'memory', 'skill', 'mcp', 'multiagent', 'workflow', 'hitl'] },

    /* ---------- 阶段 3：从 Demo 到产品 ---------- */
    { stage: 3, t: '喂给它什么，比怎么问更值钱', g: '上下文工程是这一阶段的主线：给什么、给多少、什么时候给', ids: ['contexteng'] },
    { stage: 3, t: '好不好的标准怎么定', g: '能写出一道合格的评测题，并能用 A/B 结果说服别人', ids: ['eval', 'ab'] },
    { stage: 3, t: '兜住下限的那些东西', g: '护栏和安全分别防的是什么，两者的 checklist 长什么样', ids: ['guardrail', 'safety'] },
    { stage: 3, t: '算得清账，也看得见问题', g: '一个功能上线前，成本、延迟、可观测这三件事怎么落到表格里', ids: ['economics', 'observability'] },
    { stage: 3, kind: 'checkpoint', t: '结业 · 从 Demo 到产品', g: '能独立写一份 AI 功能的方案：场景、方案、评测、成本、风险', ids: ['contexteng', 'eval', 'ab', 'guardrail', 'safety', 'economics', 'observability'] },

    /* ---------- 阶段 4：进阶实战 ---------- */
    { stage: 4, t: '让它想清楚再答', g: '思维链和推理模型分别是什么，以及什么时候值得为「多想一会儿」付钱', ids: ['cot', 'reasoning'] },
    { stage: 4, t: '怎么又快又便宜', g: '路由、流式、缓存这三招分别省的是什么，以及各自会踩什么坑', ids: ['router', 'streaming', 'cache'] },
    { stage: 4, t: '工具不是越多越好', g: '工具的数量、描述、粒度怎么定，为什么加工具常常让 Agent 变笨', ids: ['tooldesign'] },
    { stage: 4, t: '从单干到会派活', g: '子智能体和编排解决了什么：上下文隔离、并行提速、失败了怎么补', ids: ['subagent', 'orchestration'] },
    { stage: 4, t: '长时间跑不崩', g: '上下文压缩保住长任务，幂等设计让重试不出事', ids: ['compaction', 'idempotent'] },
    { stage: 4, t: '怎么证明它变好了', g: '评测集怎么建、模型当裁判怎么用，从此「我们优化了」有据可依', ids: ['goldenset', 'llmjudge'] },
    { stage: 4, t: '信任才是护城河', g: '提示注入怎么防、信任怎么校准、数据飞轮怎么转起来', ids: ['promptinjection', 'calibration', 'flywheel'] },
    { stage: 4, kind: 'checkpoint', t: '阶段检查 · 进阶实战', g: '拿一个真实 AI 产品，你能指出它的成本大头、可靠性短板和数据飞轮在哪', ids: ['cot', 'reasoning', 'router', 'streaming', 'cache', 'tooldesign', 'subagent', 'orchestration', 'compaction', 'idempotent', 'goldenset', 'llmjudge', 'promptinjection', 'calibration', 'flywheel'] },

    /* ---------- 阶段 5：独立交付 ---------- */
    { stage: 5, t: '先判断值不值得用 AI', g: '先证明问题和价值，再判断 AI 是否匹配，而不是拿着技术找场景', ids: ['problemframing', 'aisuitability'] },
    { stage: 5, t: '把工作拆到能交给 AI', g: '把真实流程拆成可评测步骤，并为每一步划清人工与自动化边界', ids: ['taskdecomp', 'autonomy'] },
    { stage: 5, t: '模型和供应商怎么选', g: '会用真实任务做选型，也能算清自建、采购与退出的完整成本', ids: ['modelselection', 'buildbuy'] },
    { stage: 5, t: '别只做一个聊天框', g: '把结构化输入、结果控制、依据溯源和反馈做进真实工作流', ids: ['aiux', 'provenance'] },
    { stage: 5, t: '先把失败设计出来', g: '把失败当正常状态，按风险等级设计恢复、审批与审计', ids: ['recovery', 'riskgrading'] },
    { stage: 5, t: '用结果上线，而不是用感觉', g: '用成效指标、护栏指标、灰度和回滚把价值闭环做完整', ids: ['outcomemetric', 'rollout'] },
    { stage: 5, kind: 'checkpoint', t: '结业 · 独立交付', g: '能独立写出一份完整 AI 产品方案：问题、边界、体验、风险、指标与上线计划', ids: ['problemframing', 'aisuitability', 'taskdecomp', 'autonomy', 'modelselection', 'buildbuy', 'aiux', 'provenance', 'recovery', 'riskgrading', 'outcomemetric', 'rollout'] }
  ];

  const Stage = function (n) { return (window.STAGES || []).find(function (s) { return s.id === n; }); };

  const lessons = RAW.map(function (r, i) {
    return {
      no: i + 1,
      kind: r.kind || 'lesson',
      stage: r.stage,
      title: r.t,
      goal: r.g,
      ids: r.ids,
      terms: r.ids,
      min: r.kind === 'checkpoint' ? Math.max(6, Math.round(r.ids.length * 1.5)) : 0
    };
  });

  /* 每课的自估分钟数：按概念数量和难度估，用于展示「今天大约几分钟」 */
  lessons.forEach(function (l) {
    if (l.kind === 'checkpoint') return;
    l.min = l.ids.reduce(function (a, id) {
      const t = window.TERMS.find(function (x) { return x.id === id; });
      return a + 2 + (t ? t.level : 2);
    }, 0);
  });

  /* 术语 -> 首次正式出现在第几课（检查点不算，只认讲课那一次） */
  const termIndex = {};
  lessons.filter(function (l) { return l.kind === 'lesson'; }).forEach(function (l) {
    l.ids.forEach(function (id) { if (termIndex[id] == null) termIndex[id] = l.no; });
  });

  window.Curriculum = {
    version: 2,
    lessons: lessons,
    /** 非检查点的正式课，用于「第几课 / 共几课」这种人类可读的计数 */
    real: lessons.filter(function (l) { return l.kind === 'lesson'; }),
    total: lessons.length,
    get: function (no) { return lessons.find(function (l) { return l.no === no; }); },
    stageList: function (stage) { return lessons.filter(function (l) { return l.stage === stage; }); },
    lessonNoOf: function (termId) { return termIndex[termId] || null; },
    stageName: function (n) { const s = Stage(n); return s ? s.name : ''; }
  };
})();
