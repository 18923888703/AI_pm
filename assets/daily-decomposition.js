/* Daily requirement-decomposition training. Records live inside Mem.lab so the
   existing export/import and encrypted sync paths keep working. */
(function () {
  const DAYS = [
    { title: '从一句愿望找到真实问题', focus: '目标用户与问题', meaning: '先问清楚谁在什么情境下遇到什么困难；功能名称不是问题本身。',
      scenario: '业务同学提出：「做个 AI 简历优化工具，用户上传简历后自动改好。」',
      task: '把这句话拆成目标用户、发生时刻、当前困难和需要验证的事实。不要先写功能方案。',
      fields: [['用户与时刻','谁会在什么具体时刻使用？'],['当前困难','在没有这个功能时，用户要完成什么，卡在哪里？'],['证据与假设','题目明确给了什么？哪些仍是假设，准备怎样核实？'],['可验证的问题','把需求改写成一句不带功能答案的问题。']],
      rubric: ['用户和使用时刻具体','困难描述的是用户任务而非功能缺失','事实与假设明确区分','问题表述没有预设解决方案'],
      reference: ['锁定正在投递、需要针对岗位调整材料的人和具体投递时刻。','说明用户要判断经历如何对应岗位要求，而不把“缺 AI 工具”写成痛点。','没有数据或访谈时，把使用频率、效果期待标为待验证。','将问题写成用户需要完成的判断任务，并保留多种解法空间。'], related: ['problemframing','aisuitability'] },
    { title: '把事实、推断和未知拆开', focus: '证据与澄清', meaning: '需求经常把推断说成事实。拆解时要标出信息来源和置信度，并追问会改变方案的未知项。',
      scenario: '团队说：「客服每天都被重复问题拖慢，所以应该让 Agent 自动处理大多数工单。」目前没有工单分类、处理时长或用户反馈。',
      task: '将描述拆为已知、假设、关键未知，并写出最值得先问的三个问题。',
      fields: [['已知信息','只写题目明确提供的事实。'],['待验证假设','哪些因果或频率判断尚无证据？'],['关键未知','哪三项信息会改变是否做、做什么或如何验收？'],['优先追问','先问谁、问什么，为什么这条答案能改变决策？']],
      rubric: ['只把题目给定内容当作事实','将因果判断标成假设','未知项与决策相关','追问能区分不同方案'],
      reference: ['题目只说明团队提出了重复问题拖慢客服这一判断，缺少数据证实。','“重复问题很多”与“Agent 能处理大多数”都是待验证假设。','先了解工单主题分布、风险类别、当前时长和错误成本。','优先查看脱敏工单样本与操作流程，区分可自动答复、需确认和必须人工处理。'], related: ['problemframing','eval','calibration'] },
    { title: '把功能目标改成用户结果', focus: '目标与结果', meaning: '“上线一个 AI 功能”是交付物，不是用户结果。需求应说明用户最终能更快、更准确或更安全地完成什么。',
      scenario: '学校希望上线「AI 学习计划生成」，但尚未定义计划是否有用。',
      task: '把功能愿望改写为用户结果，并给出一个可观察的早期信号和一个不能单独证明价值的指标。',
      fields: [['目标用户','哪类学习者遇到这个任务？'],['期望结果','用户使用后实际能完成什么？'],['早期信号','怎样观察用户是否理解并开始执行计划？'],['误导指标','哪项容易好看、却不能单独代表价值？']],
      rubric: ['目标聚焦在用户任务','结果可被用户感知','早期信号与结果有因果联系','避免把使用量等同于价值'],
      reference: ['面向不知道如何安排每日学习任务的初学者。','用户能判断今天先做什么，并开始一项可完成的学习任务。','观察计划被接受后是否启动首项任务，以及用户是否需要反复修改。','生成次数或页面停留时长只能说明使用，不能独自证明学习效果。'], related: ['outcomemetric','problemframing'] },
    { title: '切出首版范围和明确不做', focus: '范围与 MVP', meaning: 'MVP 不是功能越少越好，而是保留验证关键假设所需的完整闭环，同时写清本次不解决什么。',
      scenario: '简历产品的愿望清单包括：简历诊断、岗位匹配、自动改写、模板商城、求职社区、面试模拟和投递追踪。团队只能做一个闭环。',
      task: '选定一个用户时刻，切出首版范围，并列出明确不做项与继续/停止的信号。',
      fields: [['单一时刻','用户何时最需要帮助？'],['首版闭环','输入、判断、结果和下一步分别是什么？'],['暂不做','列出至少三个不进入首版的能力及原因。'],['验证门槛','什么观察结果支持继续？什么结果要求调整或停止？']],
      rubric: ['用户时刻范围足够窄','首版从输入到行动形成闭环','不做项与验证目标一致','继续或停止信号可观察'],
      reference: ['聚焦提交某个岗位申请前检查简历是否覆盖要求。','用户提供简历和岗位描述，得到证据对应、缺口及一条可编辑建议。','不做社区、投递追踪、模板商城和未经验证的自动投递。','观察用户是否能理解修改依据并完成一次修改；不能只看生成量。'], related: ['aisuitability','taskdecomp','outcomemetric'] },
    { title: '画清主流程与用户状态', focus: '流程与状态', meaning: '一段需求要讲清用户从开始到结束经历哪些状态、每一步可以做什么、何时算完成。',
      scenario: '用户提交学习目标后，AI 生成计划；用户可能修改、接受、暂存，或发现信息不足。',
      task: '定义从输入到计划执行的主流程、关键状态和完成条件。',
      fields: [['入口与输入','用户从哪里开始，需要给出什么？'],['状态变化','至少写出生成前、生成后、确认后几个状态。'],['用户动作','每个关键状态允许做什么？'],['完成定义','什么证据能证明用户完成了这段流程？']],
      rubric: ['入口和输入明确','状态变化前后连贯','用户可控动作清楚','完成条件可操作验证'],
      reference: ['收集主题、目标、每日时间和周期后才开始生成。','初始输入 → 生成中 → 待确认草稿 → 已采纳/已修改/已放弃。','待确认时可编辑、重新生成或保存；生成中可取消。','用户确认计划且看到第一项可执行任务后，才算完成首次创建。'], related: ['workflow','structured','autonomy'] },
    { title: '定义输入、输出和缺失信息', focus: '数据契约', meaning: 'AI 的输入输出应有字段、类型、必填条件和缺失处理；否则前端、模型和后端会各自理解。',
      scenario: '产品需要 AI 从客服对话中提取订单问题并生成工单。对话有时不包含订单号或联系方式。',
      task: '定义最小输入、结构化输出和缺字段时的行为，避免模型猜测。',
      fields: [['输入字段','哪些是必填、选填？分别从哪里来？'],['输出结构','列出工单需要的字段及含义。'],['缺失处理','缺订单号、用户身份或问题描述时怎么做？'],['校验规则','哪些值必须验证，哪些内容必须保留原文证据？']],
      rubric: ['字段必要性和来源明确','输出可供系统处理','缺失时不会编造','证据和数据校验规则明确'],
      reference: ['输入为脱敏对话、渠道、时间和已验证的用户身份；订单号可缺失。','输出包含意图、问题摘要、订单号、证据原句、待补信息和风险标记。','订单号缺失则生成待补状态并向用户追问，不从上下文猜值。','关键信息需能回溯到对话原文；订单和身份由业务系统校验。'], related: ['structured','prompt','provenance'] },
    { title: '判断哪里用 AI，哪里用规则', focus: 'AI 边界', meaning: '需求拆解要把模糊理解交给模型，把稳定条件、权限、金额和状态校验交给确定性逻辑。',
      scenario: '报销助手要阅读票据、判断费用类别、核对金额上限，并提交报销申请。',
      task: '把流程拆为 AI 判断、确定性规则和必须由用户确认的动作，并说明边界。',
      fields: [['适合 AI 的任务','哪一步需要理解非结构化内容或生成解释？'],['确定性规则','哪些校验必须规则化且可重复？'],['用户确认点','哪些动作应在提交或产生影响前由用户确认？'],['失败边界','低置信、冲突或信息不足时系统怎样处理？']],
      rubric: ['AI 与确定性逻辑分工合理','规则可重复且不交给模型随意决定','高影响动作有确认门槛','不确定输入进入安全失败路径'],
      reference: ['票据文字提取和费用说明归类可由 AI 辅助，并给出证据。','金额上限、币种、重复报销和必填字段由规则或财务系统校验。','提交报销前展示金额、类别和凭证，由本人确认。','低置信或字段冲突时保留草稿并要求补充，不自动提交。'], related: ['aisuitability','guardrail','autonomy'] },
    { title: '规定信息来源和新鲜度', focus: '知识与检索', meaning: '如果回答依赖企业知识，需定义数据源、更新时间、引用方式、权限和检索不到时的行为。',
      scenario: '员工助手回答差旅政策，政策可能按地区和生效日期变化。',
      task: '写清知识数据边界、回答必须携带的依据，以及无匹配结果时的处理。',
      fields: [['权威来源','哪些系统是权威来源？如何处理版本？'],['检索与筛选','按地区、身份或生效日期需要哪些过滤？'],['回答证据','用户如何看到来源、日期和适用条件？'],['无答案处理','找不到、冲突或过期内容时怎么办？']],
      rubric: ['权威数据源明确','检索过滤条件与问题相关','答案能追溯到有效来源','缺少或冲突时不会编造'],
      reference: ['政策库需记录版本、生效日期、地区和适用员工范围。','先按身份和地区过滤有效文档，再检索条款，不跨权限拼接。','回答展示政策名称、条款位置、生效日期和适用地区。','无有效条款或版本冲突时说明无法确认并转 HR，不生成推测结论。'], related: ['rag','rerank','provenance'] },
    { title: '补齐异常、边界和恢复', focus: '异常路径', meaning: '完整需求不仅写理想路径，还要覆盖超时、重复提交、空结果、错误数据和中断后如何恢复。',
      scenario: '用户让 Agent 查订单并发起退货；查询接口偶尔超时，用户可能重复点击。',
      task: '找出主要失败分支，定义用户看到什么、系统保存什么、怎样恢复或避免重复执行。',
      fields: [['可能失败','列出至少三个与题目相关的失败条件。'],['用户反馈','每种失败如何说明，不制造“已完成”错觉？'],['状态与恢复','哪些信息要保留，用户如何继续？'],['重复与副作用','如何避免重复查询、重复申请或越权操作？']],
      rubric: ['失败条件具体','状态反馈诚实并可理解','恢复路径保留必要上下文','副作用有幂等和权限控制'],
      reference: ['订单不存在、查询超时、订单已超退货期、重复点击都需单独处理。','接口超时显示“查询失败”，不得显示“已申请退货”。','保留用户已确认的订单和申请内容，重试无需重填。','使用幂等请求标识防重复申请；退货资格由业务规则校验，提交前再确认。'], related: ['recovery','idempotent','guardrail'] },
    { title: '设计确认、授权和人工接管', focus: '风险与确认', meaning: 'AI 建议、草稿和正式执行要区分；越可能影响资金、权益或真实业务状态，越需要权限核验和明确确认。',
      scenario: '会议助手提取出行动项后，准备替负责人创建任务并发送通知。部分负责人是从上下文推断出的。',
      task: '设计草稿到正式执行的状态链，明确证据、授权、确认和失败后的回退方式。',
      fields: [['结果状态','生成结果如何标记为草稿、待确认和已执行？'],['证据与身份','怎样展示推断字段并确认执行人身份？'],['放行条件','什么条件齐全后允许创建和通知？'],['失败回退','创建或发送失败时怎样避免重复并让人接手？']],
      rubric: ['草稿与执行状态分离','推断字段和来源可识别','授权和用户确认条件明确','失败可恢复且不会误报成功'],
      reference: ['提取后进入待确认草稿，不直接创建任务或通知。','展示每条行动项原文证据；推断负责人标为待确认。','执行人核对内容、负责人和时间并确认；系统校验权限后才写入。','记录幂等 ID 和执行状态；失败保留草稿并说明未执行，可转人工处理。'], related: ['autonomy','provenance','idempotent'] },
    { title: '把验收标准写成可执行检查', focus: '验收标准', meaning: '验收标准要能由不同的人按步骤得到相同结论。避免“体验好”“准确率高”等没有口径的话。',
      scenario: '需求写着「AI 总结会议纪要要准确、简洁、好用」。',
      task: '把模糊要求改成可操作验收，并覆盖正常、缺失和失败场景。',
      fields: [['对象与步骤','测试人员拿什么输入，执行什么操作？'],['预期结果','每一步应出现哪些字段或状态？'],['边界用例','至少写一个空、冲突或超时场景。'],['通过条件','如何客观判定通过，哪些问题必须阻断上线？']],
      rubric: ['验收步骤可复现','预期行为明确','异常场景有覆盖','通过门槛可判定并关联风险'],
      reference: ['准备含明确发言人、决定和行动项的测试纪要，输入后运行总结。','输出需分开列决策、待办、负责人、日期和对应原文证据。','无负责人或日期时标“待确认”；输入超长时提示分段而非静默截断。','关键字段无证据或将推断标成事实应阻断正式创建，普通格式问题可记录后修复。'], related: ['eval','goldenset','calibration'] },
    { title: '让指标对应要验证的假设', focus: '指标与实验', meaning: '指标不是越多越好。每个指标都应说明它验证哪个假设，并配上护栏，避免局部优化伤害用户。',
      scenario: '产品想用 AI 自动回答售后问题，团队计划用“自动回答率”作为唯一成功指标。',
      task: '指出该指标的盲点，并设计一个主指标、两个护栏和观察分群。',
      fields: [['核心假设','这项能力要改善用户的哪种结果？'],['主指标','怎样测量结果改善而不只测量模型输出？'],['护栏指标','哪些错误或成本不能因优化而变差？'],['分群与观察','哪些问题类型或用户群需单独分析？']],
      rubric: ['假设与主指标对应','区分输出量和用户结果','护栏覆盖质量风险','分群能暴露平均值掩盖的问题'],
      reference: ['假设是用户能更快解决售后问题且不增加错误处理。','观察问题是否一次解决、重复联系率或转人工后解决时间。','监控错误政策回答、投诉率、人工返工和单次处理成本。','按问题类型、风险等级和新老用户分群，避免低风险问题掩盖高风险错误。'], related: ['outcomemetric','eval','economics'] },
    { title: '设计评测样本和回归门槛', focus: '评测与回归', meaning: '上线前要有代表性样本和失败样本，定义谁来判、如何复核，以及版本变化后哪些质量不能退化。',
      scenario: '客服助手刚修改了系统提示词，产品经理只用自己写的两个问题试了一遍，感觉回答更自然。',
      task: '设计最小评测集、评审规则和上线前回归门槛。',
      fields: [['样本构成','需要覆盖哪些常见、边界和高风险问题？'],['判定规则','答案按哪些维度评？谁来复核模型评委？'],['对照方式','如何比较新旧版本，保证同条件？'],['放行与回滚','哪些指标触发暂停、回滚或人工检查？']],
      rubric: ['样本覆盖真实风险分布','判定标准清晰且有人工校准','新旧对照可比','放行和回滚门槛明确'],
      reference: ['样本包含高频咨询、缺信息、相似意图、政策冲突和越权诱导。','按事实依据、政策匹配、必要追问和风险控制评分；抽样由人工复核。','固定数据、提示词版本、模型参数与运行条件比较新旧结果。','高风险错误不得增加，核心任务质量不能低于既定门槛；异常先灰度或回滚。'], related: ['eval','goldenset','llmjudge'] },
    { title: '写清数据、权限和隐私要求', focus: '数据与权限', meaning: '需求需定义最少收集什么、谁能看、何时删除，以及模型厂商会收到哪些内容。',
      scenario: '简历助手要分析用户的简历和目标岗位，并可能把修改结果同步到个人档案。',
      task: '写出数据流、权限范围、用户控制和删除要求，避免“默认保存一切”。',
      fields: [['数据清单','任务实际需要哪些数据，哪些不应收集？'],['访问范围','谁或什么服务可以读取，基于什么授权？'],['保存与删除','草稿和历史保留多久，用户如何删除？'],['第三方传输','哪些内容发送给模型，怎样告知并控制？']],
      rubric: ['收集遵循任务最小化','访问和授权对象清楚','保留和删除行为可执行','模型传输范围透明可控'],
      reference: ['只收分析所需的简历文本和岗位描述，不要求无关身份证、地址等信息。','按用户身份隔离数据；后台和模型服务仅获得完成任务必需的最小范围。','明确草稿默认保存期限、导出与删除入口，删除后同步处理衍生副本。','提交前告知发送的字段、用途和供应商；用户可以取消或先脱敏。'], related: ['guardrail','provenance','privacy'] },
    { title: '把多轮需求收敛成可交付 PRD', focus: '综合拆解与交付', meaning: '把前面练过的用户问题、范围、流程、边界、指标和验收连成一份可以评审、开发和验证的交付契约。',
      scenario: '一个 AI 助手要帮助新员工完成报销政策查询和材料准备，但不能替用户承诺审批结果或绕过财务系统。',
      task: '写一份精简需求卡，说明用户问题、首版边界、流程、AI/规则分工、异常、安全、指标和验收。',
      fields: [['问题与范围','目标用户、时刻、问题、目标结果和不做项。'],['流程与契约','输入输出、状态、主要步骤和用户确认点。'],['边界与恢复','证据来源、异常、权限、人工接管和恢复。'],['验证与交付','主指标、护栏、验收样例、上线与回滚门槛。']],
      rubric: ['问题、用户结果和范围一致','流程与数据契约可实现','AI 边界、证据和风险控制完整','验收和上线门槛可复核'],
      reference: ['聚焦新员工准备报销材料，不承诺审批通过，也不纳入自动提交。','政策问答需引用有效条款；材料检查返回缺项、依据和下一步，用户确认后保存。','金额和资格由财务规则判断；政策冲突、无引用或高风险问题转人工，失败保留草稿。','以材料一次准备完整率和人工返工为主观测，并监控错误政策、越权访问和成本；高风险错误阻断上线。'], related: ['problemframing','taskdecomp','workflow','eval'] }
  ];

  DAYS.forEach(function (item, index) { item.day = index + 1; });

  function todayKey(date) {
    const d = date || new Date();
    return [d.getFullYear(), String(d.getMonth() + 1).padStart(2, '0'), String(d.getDate()).padStart(2, '0')].join('-');
  }
  function state() {
    const lab = window.Lab.state;
    if (!lab.dailyDecomposition || typeof lab.dailyDecomposition !== 'object') {
      lab.dailyDecomposition = { version: 1, startedAt: 0, sessions: {} };
    }
    const s = lab.dailyDecomposition;
    s.version = 1;
    if (!s.sessions || typeof s.sessions !== 'object') s.sessions = {};
    return s;
  }
  function save() { window.Mem.state.lab = window.Lab.state; window.Mem.save(); }
  function completedDays(s) {
    return DAYS.filter(function (task) { return s.sessions[task.day] && s.sessions[task.day].completedAt; }).length;
  }
  function nextDay(s) { return Math.min(DAYS.length + 1, completedDays(s) + 1); }
  function record(day, create) {
    const s = state();
    if (!s.sessions[day] && create) {
      s.sessions[day] = { day: day, fields: ['', '', '', ''], answer: '', submittedAnswer: '', submissionId: '', analysis: null,
        attempts: [], completedAt: 0, updatedAt: Date.now() };
      save();
    }
    return s.sessions[day] || null;
  }
  function streak(s) {
    const keys = new Set(Object.keys(s.sessions).map(function (key) {
      const r = s.sessions[key]; return r && r.completedAt ? todayKey(new Date(r.completedAt)) : '';
    }).filter(Boolean));
    let day = new Date();
    if (!keys.has(todayKey(day))) day.setDate(day.getDate() - 1);
    let n = 0;
    while (keys.has(todayKey(day))) { n++; day.setDate(day.getDate() - 1); }
    return n;
  }
  function viewState() {
    const s = state();
    const count = completedDays(s), day = nextDay(s), last = count ? record(count, false) : null;
    const today = todayKey();
    const completedToday = !!(last && last.completedAt && todayKey(new Date(last.completedAt)) === today);
    const active = day <= DAYS.length ? record(day, false) : null;
    return { started: !!s.startedAt, startedAt: s.startedAt, total: DAYS.length, completed: count, day: day,
      streak: streak(s), completedToday: completedToday, active: active, last: last, lastCompletedDay: count,
      lockedUntilTomorrow: completedToday && day <= DAYS.length, complete: count >= DAYS.length };
  }
  function task(day) { return DAYS[Number(day) - 1] || null; }
  function start() {
    const s = state();
    if (!s.startedAt) s.startedAt = Date.now();
    const n = nextDay(s);
    if (n <= DAYS.length && !s.sessions[n]) s.sessions[n] = { day: n, fields: ['', '', '', ''], answer: '', submittedAnswer: '', submissionId: '', analysis: null, attempts: [], completedAt: 0, updatedAt: Date.now() };
    save(); return viewState();
  }
  function saveFields(day, fields) {
    const r = record(day, true);
    r.fields = (Array.isArray(fields) ? fields : []).slice(0, 4).map(function (x) { return String(x || '').slice(0, 1200); });
    while (r.fields.length < 4) r.fields.push('');
    r.updatedAt = Date.now(); save(); return r;
  }
  function submit(day, answerOrFields) {
    const s = state(), n = nextDay(s), item = task(day), current = viewState();
    const sameDayRevision = current.completedToday && Number(day) === current.lastCompletedDay;
    if (!s.startedAt || !item || (!sameDayRevision && Number(day) !== n) || (current.lockedUntilTomorrow && !sameDayRevision))
      return { error: '今天的训练状态已变化，请刷新训练页后再试。' };
    const r = record(day, true);
    let answer;
    if (Array.isArray(answerOrFields)) {
      r.fields = answerOrFields.slice(0, 4).map(function (x) { return String(x || '').trim().slice(0, 1200); });
      while (r.fields.length < 4) r.fields.push('');
      answer = item.fields.map(function (field, i) { return field[0] + '：' + r.fields[i]; }).filter(function (_, i) { return !!r.fields[i]; }).join('\n');
    } else answer = String(answerOrFields || '').trim().slice(0, 6000);
    if (answer.replace(/[^\u4e00-\u9fa5a-z0-9]/gi, '').length < 40) return { error: '请先写出至少 40 个有效字符，再提交评估。' };
    if (r.submissionId && r.submittedAnswer) r.attempts = (r.attempts || []).concat([{ answer: r.submittedAnswer, analysis: r.analysis, at: r.updatedAt }]).slice(-10);
    r.answer = answer; r.submittedAnswer = answer;
    r.submissionId = 'daily-' + day + '-' + Date.now() + '-' + Math.random().toString(36).slice(2);
    r.analysis = null; r.updatedAt = Date.now(); save();
    return { submissionId: r.submissionId, answer: answer };
  }
  function saveAnalysis(day, submissionId, analysis) {
    const r = record(day, false);
    if (!r || r.submissionId !== submissionId) return false;
    r.analysis = Object.assign({}, analysis, { submissionId: submissionId, at: Date.now() });
    r.updatedAt = Date.now();
    if (analysis && analysis.mode === 'model') r.completedAt = r.completedAt || Date.now();
    save(); return true;
  }
  function history() {
    const s = state();
    return DAYS.map(function (item) { return { task: item, record: s.sessions[item.day] || null }; });
  }
  window.DailyDecomposition = { days: DAYS.slice(), task: task, state: viewState, start: start, record: record,
    saveFields: saveFields, submit: submit, saveAnalysis: saveAnalysis, history: history, todayKey: todayKey };
})();
