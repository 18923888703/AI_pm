/* 用户补充的 Agent 幻觉治理材料：提炼为课程、练习与面试题，不公开原文。 */
(function () {
  const SRC = '《Agent 出现幻觉，AI 产品经理应该如何治理？》（用户补充材料）';
  function quiz(variantType, prompt, correct, wrongA, wrongB, explanation, reasonA, reasonB) {
    return { variantType: variantType, q: prompt, options: [correct, wrongA, wrongB], a: 0,
      reasons: [explanation, reasonA, reasonB], why: explanation };
  }
  const term = {
    id: 'agenthallucination', name: 'Agent 幻觉与可靠性治理', en: 'Agent Hallucination & Reliability Governance',
    stage: 5, cat: 'product', level: 4, optional: true, sourceRef: SRC,
    one: 'Agent 不仅可能编造事实，还可能误读证据、误报工具结果或声称动作已完成；要按故障环节设置可验证的治理闭环。',
    analogy: '像核对一份出差报销：票据要真实、计算要对、审批要有记录，不能只因为报告写得像真的就付款。',
    steps: [
      '先定位错误：事实或来源不实、推理越界、工具结果误读、记忆过期、动作未执行却声称成功；调用失败本身属于可靠性故障，不都叫模型幻觉。',
      '输入层保存数据来源、时间、权限与指标口径；RAG 召回和 Rerank 排序提高找到证据的机会，但不保证原始证据真实。',
      '生成层区分已核实事实、推断和建议；没有足够证据就说明缺口、继续查询或降级，不把模型自报置信度当作事实证明。',
      '执行层校验工具参数和返回状态；写入或发布等有副作用动作限权、必要时让人确认，并核对目标系统的最终状态。',
      '输出层校验 Schema 与逐条引用；用 Trace 和失败样本回溯检索、生成、工具及动作节点，再做回归评测。'
    ],
    example: '趋势分析 Agent 只有上周的部分数据，却生成“近七天增长 45%”并声称已发布周报。正确流程应核对时间窗、指标分母与来源；数据不足时不报增长结论，发布后查询目标系统确认状态。这里的数字仅是模拟错误示例。',
    pm: '先按业务后果给错误分级：未经证实的建议可标注不确定，金额、发布、客户通知等动作必须有来源、权限、确认与结果核验；分别追踪证据支持率、错误动作率和端到端任务成功率。',
    pitfalls: [
      '只在 Prompt 写“不要幻觉”，却没有来源、时间窗和无证据时的返回状态。',
      '把“检索到一段内容”或“Rerank 排名靠前”当成来源真实且支持结论。',
      '工具返回超时或失败，仍对用户说“已经发送/发布成功”。',
      '用模型自评置信度替代引用核验或目标系统状态检查。'
    ],
    related: ['hallucination', 'grounding', 'provenance', 'rag', 'rerank', 'tool', 'hitl', 'observability', 'eval'],
    quiz: [
      quiz('definition', 'Agent 把未核实的增长率写进报告，并在发送失败后说“已发出”。怎样判断？',
        '分别核查结论证据与发送状态，再归因事实错误和执行反馈',
        '把两处都归为模型幻觉，只需加强生成提示词',
        '只检查报告文字是否流畅，不再核对工具返回',
        '报告数字缺证据是事实问题；“已发出”还必须对照工具与目标系统状态。',
        '发送失败也可能是工具或网络故障，单改 Prompt 无法验证执行结果。',
        '语言流畅不能证明数字真实，也不能证明发送动作成功。'),
      quiz('scenario', '趋势助手只检索到旧数据，但用户要“最近七天的增长率”。最稳妥的产品行为是？',
        '提示时间窗不符，补查有效数据；查不到则不生成具体增长率',
        '先用旧数据估算增长率，并把它写成已确认的近七天事实',
        '让 Rerank 把旧数据排在首位，再直接计算近七天增长率',
        '时间窗是结论成立的前提；缺少七天数据时应补查或明确无法计算。',
        '旧数据可以用于假设，但不能冒充近七天的已核实指标。',
        '重排序只改变候选顺序，不会把过期资料变成当前证据。'),
      quiz('boundary', 'Agent 调用“发布”工具返回超时，没有拿到最终状态。下一步如何设计？',
        '保留待确认状态，按操作标识查询目标系统，确认后再告知结果',
        '直接告诉用户发布成功，因为超时不代表系统一定失败',
        '立即无条件重试发布，随后告诉用户已完成一次发布',
        '超时意味着结果未知；先核对最终状态，必要时用去重键安全重试。',
        '超时既不证明成功也不证明失败，不能把未知结果包装成成功。',
        '无条件重试可能重复发布；次数和最终状态都不能凭调用次数推断。')
    ]
  };
  window.TERMS = window.TERMS.concat([term]);
  window.AGENT_HALLUCINATION_TERM_IDS = [term.id];
  window.AGENT_HALLUCINATION_TOPICS = [{
    id: 'agent-hallucination-governance', category: 'AI 产品落地', title: 'Agent 幻觉治理：证据、执行与评测闭环',
    summary: '从事实和引用、检索资料、工具执行与最终动作四处定位问题，设计可追溯、可降级、可回归的产品机制。',
    keyPoints: ['先分清事实编造、来源不支持结论与工具/网络故障，不把所有失败都算成模型幻觉',
      '核对资料来源、时间窗与指标口径；检索和重排不能保证原始资料可信',
      '高风险动作限权并核验最终状态；用 Trace、失败样本和分层指标持续回归'],
    application: '为趋势助手画出“数据来源 → 检索 → 生成 → 发布 → 结果确认”的检查点；缺数据时返回可解释的待补证据状态。',
    relatedTerms: ['agenthallucination', 'hallucination', 'grounding', 'provenance', 'observability', 'eval'],
    keywords: ['Agent 幻觉', '事实核验', '证据支持', '工具校验', 'Trace', '错误动作'], sourceRef: SRC
  }];
  window.AGENT_HALLUCINATION_PRACTICES = [{
    id: 'agent-hallucination-governance', title: '为趋势分析 Agent 设计幻觉治理闭环', track: '工作流与 Agent', level: 4, min: 18,
    source: SRC,
    scenario: '一个内容趋势助手拿到不完整的近七天数据，生成了具体增长率；发布接口超时后，它仍告诉用户“周报已发布”。',
    task: '先识别事实、来源、工具和动作四类风险；再写数据核验、无证据降级、发布确认、Trace 与回归评测方案。',
    checkpoints: ['增长率有时间窗、分子分母和来源', '旧数据不能冒充当前事实', '超时后不误报发布成功', '失败样本能定位环节并回归'],
    reference: ['输入层记录数据来源、采集时间、指标口径和权限；增长率要核对基期与现期。',
      '生成层将已核实事实与推断分开；缺少有效数据时展示缺口并请求补查，不填造数字。',
      '发布前校验字段和权限，必要时由人确认；超时后以操作标识查询目标状态，避免重复发布。',
      'Trace 串起检索片段、模型结论、工具参数和返回；按证据支持、错误动作与任务成功拆分指标。'],
    rubric: ['事实与指标可核验', '无证据降级明确', '工具动作可确认', 'Trace 与回归可执行'],
    related: ['agenthallucination', 'provenance', 'tool', 'observability'],
    decision: { q: '发布接口超时，Agent 应如何向用户反馈？', options: [
      '显示待确认，并查询目标系统核对最终状态', '显示已发布，因为超时不等于操作失败',
      '立即再发布一次，并显示已完成发布', '隐藏接口状态，只展示生成的周报内容'], a: 0,
      reasons: {
        1: '“超时不等于失败”同样不等于成功；没有目标系统的确认，已发布属于未经核验的动作结论。',
        2: '超时后盲目再发布可能造成重复内容；应先用操作标识查状态，再决定是否安全重试。',
        3: '隐藏接口状态会让用户误以为任务完成；周报内容生成与真正发布是两个不同阶段。'
      },
      why: '超时只说明本次请求没有得到确定结果；应先查目标状态，不能直接声称成功，也不能盲目重试造成重复发布。' }
  }];
  window.AGENT_HALLUCINATION_INTERVIEW = [{
    id: 'agent-hallucination-governance-open', variantGroup: 'agenthallucination', topics: ['agenthallucination'],
    dimension: 'agent_workflow', difficulty: 3, type: 'open', subtype: 'scenario',
    prompt: '趋势分析 Agent 用旧数据生成最新增长率，并在发布接口超时后声称已发布。你会怎样区分问题、治理并验证改进？',
    rubric: [
      '区分事实无据与执行状态未知', '核查来源、时间窗、口径并设计无数据降级',
      '发布动作限权、确认、去重与状态核验', '按 Trace 分层定位并用失败样本回归'
    ].map(function (label, i) { return { id: 'agent-hallucination-governance-r' + (i + 1), label: label, weight: 1 }; }),
    answerOutline: '先按数据/生成/执行分层归因；旧数据不报当前增长率，超时保留待确认并查询目标状态；监测证据支持率、错误动作率与端到端成功率。',
    sourceRef: SRC
  }];
})();
