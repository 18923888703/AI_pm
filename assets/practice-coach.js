/* 实战练习的先学案例与本地结构反馈。案例与练习使用不同任务，避免提前泄露参考方案。 */
(function () {
  function item(title, scene, worked, lesson) { return { title: title, scene: scene, worked: worked, lesson: lesson }; }
  const examples = {
    'brief-to-task': [
      item('案例：预约提醒', '团队只说“加一个智能提醒”。', '先写目标：减少忘记预约；输入预约时间与联系方式；输出提醒时间和内容；缺时间时不发送；用真实预约记录验收。', '把愿望拆成输入、输出、边界和可观察结果。'),
      item('反例：更聪明的提醒', '文档写“AI 在合适的时候提醒用户”。', '“合适”没有时间规则，也没说明用户取消预约后怎么办。先补触发条件和撤销路径。', '形容词不能当验收标准。')
    ],
    'assumption-evidence': [
      item('案例：报名中断', '团队猜用户因表单太长而离开。', '事实是第 3 步流失明显；“太长”仍是假设。访谈离开者、看错误日志，再比较缩短表单和保存进度两种方案。', '区分观察到的事实与解释事实的假设。'),
      item('反例：功能当问题', '团队说“需要排行榜，用户才会坚持”。', '排行榜是方案。先看用户何时中断、是否需要比较，以及中断是否真的由动力不足造成。', '不要用功能名称证明需求存在。')
    ],
    'mvp-slice': [
      item('案例：票据识别', '财务想做识别、审批、统计和报表。', '首版先验证“上传一张票据→提取金额与日期→用户确认→形成一条草稿”；暂不做自动付款。', '最小版本仍要让用户完成一件事。'),
      item('反例：四个入口', '原型同时摆出识别、报表、审批和聊天入口。', '每个入口都只能展示欢迎页，无法验证票据处理是否有价值。应完成一个端到端闭环。', '半成品入口之和不等于 MVP。')
    ],
    'prompt-contract': [
      item('案例：会议行动项', '助手从会议纪要提取负责人和时间。', '定义输入原文、输出 JSON 字段、证据原句；负责人缺失时返回 need_confirmation，不能猜同事名字。', 'Prompt 是可校验的输入输出契约。'),
      item('反例：专家人设', '提示词只写“你是顶级项目管理专家”。', '它没有字段、格式和缺失分支，下游系统仍无法可靠创建任务。', '角色描述不能代替状态和数据结构。')
    ],
    'workflow-breakdown': [
      item('案例：退货资格', '用户上传订单并询问是否能退货。', '拆为识别凭证、查订单、核政策、给建议四个职责；查不到订单进入 NEED_MORE，不跳过核验。', '节点按单一职责和输入输出契约拆。'),
      item('反例：一步完成', '一个模型节点同时识别、查询、判断并通知。', '通知失败时难以知道判断是否已完成，重试可能再次通知。把写操作与判断分开。', '可排障和可重试需要清楚的节点边界。')
    ],
    'confirmation-gate': [
      item('案例：地址更正', '助手从聊天中猜出用户新地址。', '先展示原话、候选地址和缺失字段；用户核对后才更新订单，系统返回成功再显示已更改。', '候选、确认和真实执行必须分状态。'),
      item('反例：直接生效', '模型说“我觉得是这个地址”，页面立即提示修改成功。', '模型猜测不等于用户授权，提示成功也不等于后端写入成功。', '高影响动作需要证据、确认与执行结果。')
    ],
    'agent-four-layers': [
      item('案例：会议排期', '用户说“帮我约下周讨论会”，没有参与人。', '事实层记录已有时间范围；状态层进入缺参；能力层追问参与人并查空闲；边界层在发邀请前确认。', '事实、状态、能力与执行门槛各管一件事。'),
      item('反例：未确认就邀请', '助手按通讯录猜参与人并发出正式邀请。', '猜测对象可能错误；应先呈现候选名单并得到用户确认。', 'Agent 能调用工具不等于拥有执行授权。')
    ],
    'rag-tool-selection': [
      item('案例：请假助手', '员工问“年假规则”和“我还剩几天”。', '制度规则查有效版本文档并引用；个人余额查授权的人事系统。两个问题用不同数据源。', '知识解释和实时个人状态应分流。'),
      item('反例：向量查余额', '助手从相似的旧对话检索员工余额。', '相似内容不代表同一员工今天的余额；应做身份校验和精确查询。', '语义相似度不能代替交易事实。')
    ],
    'order-chatflow': [
      item('案例：多笔订单', '用户只提供手机号，系统查到两笔订单。', '先核身份，再展示可见订单的时间与商品供选择；确认后查目标订单，无法定位时追问最少信息。', '多个候选对象需要确认，不能随机选。'),
      item('反例：先承诺结果', '未查到物流，助手已说“明天送达”。', '送达时间需要最新物流事实支持；工具失败时应保留问题并解释下一步。', '承诺必须晚于事实查询。')
    ],
    'risk-workflow': [
      item('案例：库存接口延迟', '接口今天已超时，明天促销可能无法显示库存。', '已超时是问题；促销失败是风险。记录影响、负责人、修复时间和升级门槛。', '当前故障与未来后果要分开。'),
      item('反例：只写红色预警', '处置单写“风险很高，请尽快处理”。', '没有故障证据、责任人、期限或升级条件，团队无法执行。', '风险等级必须连接具体动作。')
    ],
    'demo-product-loop': [
      item('案例：每周待办', '原型能生成计划，但刷新后清空进度。', '先保存输入、已完成项和当前位置，再验证用户次日能继续；之后才考虑排行榜。', '先修阻断核心任务的断点。'),
      item('反例：功能越多越好', '团队增加皮肤、社区和徽章，仍无法恢复进度。', '新功能没解决最早断点，用户仍不能完成跨天任务。', '可持续使用比功能数量重要。')
    ],
    'enterprise-handoff': [
      item('案例：工单原型交接', '个人 Demo 可生成工单摘要，准备正式研发。', '交接目标、字段契约、错误码、密钥归属、回归样本与上线回滚；明确 Demo 尚未满足生产要求。', '可演示与可交付之间需要可测试契约。'),
      item('反例：把 Key 写前端', '原型脚本中直接保存了服务商密钥。', '浏览器代码会被下载，正式调用需后端代理并限制权限和额度。', '体验演示不能成为生产权限设计。')
    ],
    'prd-ue-contract': [
      item('案例：请假助手 PRD', '助手能查政策并生成申请草稿。', '写清目标、不能审批的边界、知识版本、请假额度接口、缺资料与无权限状态，再用样本逐项验收。', '产品文档要连起行为、界面与验收。'),
      item('反例：一张正常页', '设计稿只有“申请成功”状态。', '还需缺额度、待确认、接口失败和用户撤销状态，否则团队无法实现完整流程。', '正常态不能覆盖交付风险。')
    ],
    'eval-regression-lab': [
      item('案例：文档解析回归', '新版本修复了表格错行。', '保存同一组 caseIds、评分器和模型配置；检查原失败是否修好，也检查正常表格是否出现新失败。', '先保证比较条件一致，再看 Fixed 与 Regression。'),
      item('反例：换题得高分', '新版跑了一批更简单的文档，分数提高。', '题集变化使结果不可直接比较；应补同集回归并记录评分版本。', '分数变化只有在条件可比时才支持归因。')
    ],
    'resume-evidence-lab': [
      item('案例：内部知识工具', '候选人做了个人原型，没有生产流量。', '如实写明个人项目、三次可复核的用户访谈和改动记录；若访谈不存在，就只写已完成的原型与测试。', '成果表述必须与实际证据同一层级。'),
      item('反例：模拟当业绩', '把模拟运行次数写成真实用户数。', '模拟调用不能证明用户采用或业务收益，应把样本性质与缺口写清。', '可信的小成果胜过不可核验的大数字。')
    ],
    'learning-memory-design': [
      item('案例：语言练习助手', '学员一次把过去式写错，系统准备记录能力。', '先保存题目、原回答和时间；暂不写“语法差”。若在不同场景再次出错，再形成带证据的薄弱点并安排变式。', '事件先于画像，画像不能比证据更确定。'),
      item('反例：偏好覆盖', '学员说“今晚只学五分钟”，系统把长期习惯改为五分钟。', '这是一晚的约束，应影响当前计划；只有本人明确更正或多次稳定证据才更新长期偏好。', '临时状态和长期特征要分开。')
    ],
    'agent-hallucination-governance': [
      item('案例：库存助手', '助手查到的是昨天库存，用户却问现在能否下单。', '先看库存时间戳并补查实时系统；若接口不可用，说明当前库存未知，不把昨天记录当作现货保证。', '资料相关不等于当前有效，事实结论要满足时间与来源条件。'),
      item('反例：退款已完成', '退款工具请求超时，助手直接说“款项已退回”。', '超时只说明调用结果未知；先按交易标识查询退款状态，再决定是否重试和如何通知用户。', '动作声明必须晚于目标系统的状态确认。')
    ]
  };
  const cues = {
    'brief-to-task': [/用户|人群|场景/, /输入|字段|参数|输出/, /缺失|缺少|异常|边界|不做|不编造/, /验收|指标|验证/],
    'assumption-evidence': [/事实|观察|已知/, /假设|推测|可能/, /证据|访谈|数据|日志/, /结论|验证|方案/],
    'mvp-slice': [/用户|场景|时刻/, /输入|输出|结果|完成/, /不做|范围|排除/, /成功|停止|验证/],
    'prompt-contract': [/角色|任务|目标/, /输入|字段|材料/, /输出|JSON|格式|schema/i, /缺失|失败|拒答|验收/],
    'workflow-breakdown': [/结果|输出|处置单/, /节点|职责|拆分/, /字段|输入|契约/, /分支|验证|失败/],
    'confirmation-gate': [/证据|原文|来源/, /草稿|状态|确认/, /修改|排除|纠正/, /权限|执行|失败/],
    'agent-four-layers': [/事实|已知|证据/, /状态|待确认|READY|NEED_MORE/, /调用|工具|能力/, /边界|确认|越权/],
    'rag-tool-selection': [/知识|文档|RAG|检索/, /订单|状态|API|数据库/, /权限|工具|写入/, /失败|兜底|查不到/],
    'order-chatflow': [/订单|查询|意图/, /缺|追问|凭证/, /多笔|循环|列表/, /异常|退款|人工/],
    'risk-workflow': [/问题|已发生|失败/, /风险|影响|可能/, /负责人|时间|动作/, /升级|确认|分支/],
    'demo-product-loop': [/断点|完成|用户/, /迭代|先后|版本/, /状态|撤销|保存/, /刷新|恢复|数据/],
    'enterprise-handoff': [/目标|责任|范围/, /密钥|权限|安全/, /接口|字段|错误码/, /评测|验收|回滚/],
    'prd-ue-contract': [/目标|非目标|用户/, /边界|Prompt|知识|工具/, /状态|异常|交接/, /验收|测试|版本/],
    'eval-regression-lab': [/用例|caseIds|四态|PASS|FAIL/i, /Trace|证据|实际回复/, /版本|基线|评分器|条件/, /回归|发布|可比|暂缓/],
    'resume-evidence-lab': [/岗位|要求|匹配/, /项目|经历|本人|阶段/, /数据|证据|口径|样本/, /缺口|追问|补强|计划/],
    'learning-memory-design': [/原文|题目|选择|证据/, /次数|多次|门槛|归纳/, /复测|跨日|间隔|变式/, /更正|删除|冲突|同步/],
    'agent-hallucination-governance': [/来源|时间窗|口径|分子|分母|证据/, /缺失|无数据|补查|降级|拒答/, /超时|状态|确认|去重|权限/, /Trace|回归|样本|指标|评测/]
  };
  function localAnalysis(practice, answer) {
    const text = String(answer || '').trim();
    const sentences = text.split(/[。！？；\n]/).map(s => s.trim()).filter(s => s.length >= 8);
    const strengths = [], gaps = [];
    const rules = cues[practice.id] || [];
    practice.rubric.forEach(function (criterion, index) {
      const hit = sentences.find(sentence => rules[index] && rules[index].test(sentence));
      if (hit) strengths.push({ quote: hit.slice(0, 90), why: '这句包含与「' + criterion + '」相关的表述；但只出现关键词不代表已经满足要求，请核对具体条件和执行动作。' });
      else gaps.push({ criterion: criterion, quote: '', why: '本地检查未找到与「' + criterion + '」明显相关的文字，可能遗漏，也可能用了不同说法。',
        revision: '回到这道题的任务要求，补写与「' + criterion + '」相关的对象、判断条件、处理动作和验收办法；再对照下面的参考拆解。' });
    });
    return { mode: 'local', summary: '已根据你提交的 ' + text.length + ' 个字寻找结构线索；本地检查不能判断方案是否正确，也不能确认缺失项一定没有写。',
      strengths: strengths, gaps: gaps,
      nextStep: gaps.length ? '先补「' + gaps[0].criterion + '」，写出一个可被他人复核的例子，再对照参考拆解。' :
        '四项结构均有提及。请对照参考拆解检查条件、证据和异常路径是否真的可执行。' };
  }
  function normalizeModelAnalysis(raw, practice, answer) {
    if (!raw || typeof raw !== 'object' || !practice || !Array.isArray(practice.rubric)) return null;
    const text = String(answer || '');
    const rubric = practice.rubric;
    if (!Array.isArray(raw.criteria) || raw.criteria.length !== rubric.length || !rubric.length) return null;
    const summary = String(raw.summary || '').trim();
    const nextStep = String(raw.nextStep || '').trim();
    if (summary.length < 12 || nextStep.length < 8) return null;
    const statuses = ['met', 'partial', 'missing', 'uncertain'];
    const criteria = rubric.map(function (label) {
      const matches = raw.criteria.filter(function (row) { return row && row.criterion === label; });
      if (matches.length !== 1) return null;
      const row = matches[0];
      const status = String(row.status || '');
      const quote = String(row.quote || '').trim();
      const why = String(row.why || '').trim();
      const revision = String(row.revision || '').trim();
      if (!statuses.includes(status) || why.length < 18 || (quote && !text.includes(quote))) return null;
      if ((status === 'met' || status === 'partial') && !quote) return null;
      if (status !== 'met' && revision.length < 12) return null;
      return { criterion: label, status: status, quote: quote.slice(0, 160),
        why: why.slice(0, 500), revision: revision.slice(0, 500) };
    });
    if (criteria.some(function (row) { return !row; })) return null;
    const met = criteria.filter(function (row) { return row.status === 'met'; }).length;
    const uncertain = criteria.filter(function (row) { return row.status === 'uncertain'; }).length;
    const partial = criteria.filter(function (row) { return row.status === 'partial'; }).length;
    const verdict = uncertain >= Math.ceil(criteria.length / 2) ? 'unverified' :
      met === criteria.length ? 'pass' : met + partial >= Math.ceil(criteria.length / 2) ? 'partial' : 'revise';
    return { mode: 'model', verdict: verdict, criteria: criteria, summary: summary.slice(0, 500),
      strengths: criteria.filter(function (row) { return row.status === 'met'; }).map(function (row) {
        return { quote: row.quote, why: row.why };
      }),
      gaps: criteria.filter(function (row) { return row.status !== 'met'; }).map(function (row) {
        return { criterion: row.criterion, quote: row.quote, why: row.why, revision: row.revision };
      }), nextStep: nextStep.slice(0, 500) };
  }
  window.PracticeCoach = { examples: id => (examples[id] || []).slice(), localAnalysis, normalizeModelAnalysis };
})();
