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

  const SKILLS = {
    framing: { label: '用户问题与证据', scenarios: [
      '业务说“做个 AI 助手，用户就会更愿意续费”，但没有流失原因或用户反馈。',
      '运营说“年轻用户都喜欢排行榜”，目前只看到少数用户在群里提过。',
      '老板要求上线“智能导师”，目标是让所有学员都坚持完成课程。'],
      forms: [
        { name: '事实 / 假设分类卡', fields: [['确定事实','题目明确给了哪些信息？'],['待验证假设','哪些因果或人群结论还没有证据？'],['决策缺口','哪三项未知会改变方案？'],['优先追问','先向谁验证什么，为什么？']] },
        { name: '用户问题改写', fields: [['具体用户','谁在什么时刻遇到问题？'],['当前任务','他现在要完成什么？'],['证据与反例','什么证据支持？什么现象会推翻？'],['问题陈述','写一句不预设功能的问题。']] },
        { name: '访谈问题排序', fields: [['要验证的判断','最关键的假设是什么？'],['过去行为','用什么问题了解真实经历而非态度？'],['替代做法','用户目前怎样解决、付出什么代价？'],['决策信号','什么回答会让你继续、调整或停止？']] }
      ], rubric: ['事实与假设区分准确','用户任务和时刻具体','关键未知能改变决策','追问或结论不预设方案'],
      reference: ['仅把题目明确描述的行为或材料标成事实，愿望和因果推断列为假设。','明确具体用户与发生任务的时刻，避免“所有用户”这类泛化。','优先补充能改变目标、范围或是否使用 AI 的信息。','使用过去真实行为、替代方案或可观察证据来检验，不把表态当需求。'] },
    scope: { label: '范围与流程', scenarios: [
      '团队想做一个智能报销助手：自动读票据、核对政策、填表、提交、追踪审批和催财务。',
      '订单客服希望增加聊天、语音、自动退款、优惠推荐、投诉分析和人工协作。',
      '学习产品想同时做测评、计划、内容推荐、社群、打卡和导师陪练。'],
      forms: [
        { name: 'MVP 取舍表', fields: [['核心用户时刻','这一版只解决哪一个时刻？'],['必须闭环','用户从输入到下一步要走完什么？'],['明确不做','哪些功能先排除，理由是什么？'],['继续门槛','什么观察结果支持扩大范围？']] },
        { name: '状态流程图（文字）', fields: [['起点与输入','触发条件和必需字段是什么？'],['状态序列','按顺序列出主流程状态。'],['分支条件','什么时候停下、追问或转人工？'],['完成定义','什么状态和证据表示任务完成？']] },
        { name: '方案取舍题', fields: [['可选方案','给出两个范围不同的方案。'],['用户价值','各自解决哪个问题，证据是什么？'],['代价与边界','成本、风险和不做项分别是什么？'],['选择条件','当前选哪个，满足什么条件再升级？']] }
      ], rubric: ['首版目标和范围一致','主流程输入输出完整','状态与分支条件明确','取舍依据和完成条件可验证'],
      reference: ['聚焦一个用户时刻和一个主要结果，不把愿望清单都放进首版。','把输入、处理、结果、下一步连成可完成的闭环。','明确缺字段、失败、等待确认和人工接手时的状态。','说明为何选该范围、暂不做什么，以及什么证据触发扩展。'] },
    risk: { label: '边界、权限与恢复', scenarios: [
      'AI 助手读取邮件后，准备自动接受会议邀请并代用户回复参会人。',
      '智能客服根据订单记录处理退款，接口偶尔超时，客户可能重复点击。',
      '会议助手会提取负责人和截止日期，并直接在项目系统创建任务。'],
      forms: [
        { name: 'AI / 规则 / 人工分工表', fields: [['可交给 AI','哪些理解或归纳任务可由 AI 辅助？'],['确定性规则','哪些权限、资格或数值必须由规则校验？'],['确认门槛','执行前用户要看到和确认什么？'],['失败兜底','信息不足或冲突时如何停下？']] },
        { name: '故障诊断卡', fields: [['故障状态','怎样区分超时、拒绝、未执行和已执行？'],['用户反馈','页面该如何准确表达当前状态？'],['副作用控制','怎样防止重复操作或越权？'],['恢复办法','保留什么信息，如何重试或交给人工？']] },
        { name: '风险优先级矩阵', fields: [['高影响场景','哪些错误会影响权益、资金或他人？'],['权限与证据','哪些身份和依据必须先核实？'],['阻断条件','出现什么情况必须停止自动化？'],['审计与接管','如何记录动作并让人纠正或撤回？']] }
      ], rubric: ['AI 与确定性职责分清','权限和关键证据明确','高影响动作有确认或阻断','失败状态可恢复且不重复执行'],
      reference: ['只让模型承担不确定文本理解或草拟，不让其自行决定权限和业务资格。','关键事实可追溯，身份、金额、状态等由可信业务系统校验。','发送、退款、创建正式记录等动作前要有明确授权和确认门槛。','使用明确状态和幂等控制；失败保留草稿，不把未知说成成功。'] },
    validation: { label: '验收、指标与评测', scenarios: [
      '团队想把“回答更自然”作为客服助手上线标准。',
      '产品只统计“生成了多少份计划”，准备据此判断学习功能有效。',
      '提示词改过后，大家各试了一个问题，觉得结果更好了。'],
      forms: [
        { name: '验收用例卡', fields: [['输入与操作','测试人拿什么数据、执行什么步骤？'],['可观察结果','用户能看到哪些字段和状态？'],['异常用例','缺信息、冲突或超时要怎样表现？'],['判定门槛','什么必须通过，什么错误阻断发布？']] },
        { name: '指标与护栏设计', fields: [['用户结果','功能希望改善什么真实任务结果？'],['主指标','怎样测结果而不是只测使用量？'],['风险护栏','质量、成本、时延或人工返工看什么？'],['分群观察','哪些类型要单独拆开，避免均值掩盖？']] },
        { name: '回归评测方案', fields: [['样本覆盖','常见、边界、高风险样本各有哪些？'],['评分规则','按哪些维度判，谁来复核？'],['版本对照','怎样保持新旧测试条件可比？'],['发布决策','何时灰度、回滚或补充验证？']] }
      ], rubric: ['验收对象和步骤可复现','结果指标对应用户价值','护栏覆盖关键风险','门槛和回归决策可执行'],
      reference: ['写明输入、操作、预期字段和状态，让不同测试人能复现。','主指标关注是否解决用户任务，不能只把生成量或点击量当价值。','同时监控错误事实、人工返工、时延和单次成本等护栏。','用固定样本对照版本；高风险错误达到阻断门槛时不发布或回滚。'] }
  };

  function skillFor(label) {
    const text = String(label || '');
    if (/用户|问题|事实|假设|证据|目标|追问|需求|关键未知|决策/.test(text)) return 'framing';
    if (/范围|MVP|流程|状态|输入|输出|闭环|分支|方案|取舍/.test(text)) return 'scope';
    if (/边界|异常|风险|权限|确认|隐私|安全|恢复|失败|数据/.test(text)) return 'risk';
    if (/验收|指标|评测|回归|样本|通过|验证|实验/.test(text)) return 'validation';
    return 'scope';
  }
  function buildReviewTask(skill, level, runCount, chosenFormat) {
    const domain = SKILLS[skill] || SKILLS.scope;
    const index = Math.max(0, Number(runCount || 1) - 1) % domain.scenarios.length;
    const formIndex = Number.isInteger(chosenFormat) && chosenFormat >= 0 && chosenFormat < domain.forms.length
      ? chosenFormat : (index + Math.max(0, Number(level || 2) - 1)) % domain.forms.length;
    const form = domain.forms[formIndex];
    const difficulty = Number(level || 2);
    const tier = difficulty === 1 ? '基础补强' : difficulty >= 3 ? '高阶迁移' : '场景应用';
    return { id: 'adaptive-review-' + skill + '-' + index + '-' + formIndex, title: domain.label + ' · ' + form.name,
      focus: domain.label, format: form.name, level: difficulty, levelLabel: tier,
      meaning: '这是根据你最近评估中的薄弱项安排的间隔复习。它换了场景和作答形式，检查你是否能把同一判断迁移到新问题。',
      scenario: domain.scenarios[index], task: '按「' + form.name + '」完成这次复测。' +
        (difficulty === 1 ? '先把对象、事实和条件写具体，再给出结论。' : difficulty >= 3 ? '除给出方案外，还要说明取舍、反例和升级条件。' : '明确依据、操作条件和可验证结果。'),
      fields: form.fields, rubric: domain.rubric, reference: domain.reference,
      checkpoints: domain.reference, related: [] };
  }

  function todayKey(date) {
    const d = date || new Date();
    return [d.getFullYear(), String(d.getMonth() + 1).padStart(2, '0'), String(d.getDate()).padStart(2, '0')].join('-');
  }
  function queueWeakCriteria(s, day, r, analysis, at) {
    if (!analysis || analysis.mode !== 'model' || !Array.isArray(analysis.criteria)) return;
    const groups = {};
    analysis.criteria.forEach(function (row) {
      const skill = skillFor(row.criterion);
      if (!groups[skill]) groups[skill] = { skill: skill, rows: [], weak: 0, severity: 0 };
      groups[skill].rows.push(row);
      if (row.status !== 'met') {
        groups[skill].weak++;
        groups[skill].severity += row.status === 'missing' ? 2 : 1;
      }
    });
    const groupsList = Object.keys(groups).map(function (key) { return groups[key]; });
    if (!groupsList.length) return;
    const weak = groupsList.filter(function (item) { return item.weak > 0; }).sort(function (a, b) {
      return b.severity - a.severity || b.weak - a.weak;
    });
    const targets = weak.length ? weak.slice(0, 2) : [groupsList[(Number(day) - 1) % groupsList.length]];
    const now = at || analysis.at || Date.now();
    targets.forEach(function (chosen) {
      const row = chosen.rows.find(function (item) { return item.status !== 'met'; }) || chosen.rows[0];
      const skill = chosen.skill, old = s.reviewQueue[skill] || {}, failed = chosen.weak > 0;
      const priorSuccesses = old.status === 'active' ? (old.successes || 0) : 0;
      const dueAt = now + (failed ? 86400000 : 3 * 86400000);
      s.reviewQueue[skill] = Object.assign({}, old, { skill: skill, label: (SKILLS[skill] || SKILLS.scope).label,
        status: 'active', dueAt: failed ? (old.status === 'active' ? Math.min(old.dueAt || dueAt, dueAt) : dueAt) :
          old.status === 'active' && old.dueAt > now ? old.dueAt : dueAt,
        successes: failed ? 0 : Math.max(1, priorSuccesses), failures: (old.failures || 0) + (failed ? 1 : 0),
        sourceDay: Number(day), lastCriterion: row.criterion, lastStatus: failed ? row.status : 'met', updatedAt: Date.now() });
    });
  }
  function seedLegacyReviews(s) {
    if (s.reviewSeeded) return;
    Object.keys(s.sessions).forEach(function (day) {
      const r = s.sessions[day];
      if (r && r.completedAt && r.analysis && r.analysis.mode === 'model') queueWeakCriteria(s, day, r, r.analysis, r.analysis.at || r.completedAt);
    });
    s.reviewSeeded = true;
  }
  function state() {
    const lab = window.Lab.state;
    if (!lab.dailyDecomposition || typeof lab.dailyDecomposition !== 'object') {
      lab.dailyDecomposition = { version: 2, startedAt: 0, sessions: {}, reviewQueue: {}, reviewRuns: {}, reviewSeeded: false };
    }
    const s = lab.dailyDecomposition;
    const previousVersion = Number(s.version || 1);
    s.version = 2;
    if (!s.sessions || typeof s.sessions !== 'object') s.sessions = {};
    if (!s.reviewQueue || typeof s.reviewQueue !== 'object') s.reviewQueue = {};
    if (!s.reviewRuns || typeof s.reviewRuns !== 'object') s.reviewRuns = {};
    if (!Number.isInteger(s.optionalSeq)) s.optionalSeq = 0;
    if (previousVersion < 2) Object.keys(s.sessions).forEach(function (key) {
      const item = s.sessions[key];
      if (item && item.completedAt && item.analysis && item.analysis.mode === 'model') item.coreAdvancedAt = item.completedAt;
    });
    const needsSeed = !s.reviewSeeded;
    seedLegacyReviews(s);
    if (needsSeed) window.Mem.save();
    return s;
  }
  function save() { window.Mem.state.lab = window.Lab.state; window.Mem.save(); }
  function completedDays(s) {
    return DAYS.filter(function (task) { return s.sessions[task.day] && s.sessions[task.day].coreAdvancedAt; }).length;
  }
  function nextDay(s) { return Math.min(DAYS.length + 1, completedDays(s) + 1); }
  function rubricScore(analysis) {
    if (!analysis || !Array.isArray(analysis.criteria) || !analysis.criteria.length) return 0;
    const value = analysis.criteria.reduce(function (sum, row) {
      return sum + (row.status === 'met' ? 1 : row.status === 'partial' ? 0.5 : 0);
    }, 0);
    return Math.round(value / analysis.criteria.length * 100);
  }
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
    }).concat(Object.keys(s.reviewRuns).map(function (key) {
      const r = s.reviewRuns[key]; return r && r.completedAt ? todayKey(new Date(r.completedAt)) : '';
    })).filter(Boolean));
    let day = new Date();
    if (!keys.has(todayKey(day))) day.setDate(day.getDate() - 1);
    let n = 0;
    while (keys.has(todayKey(day))) { n++; day.setDate(day.getDate() - 1); }
    return n;
  }
  function learnerProfile(s) {
    const records = Object.keys(s.sessions).map(function (key) { return s.sessions[key]; })
      .concat(Object.keys(s.reviewRuns).map(function (key) { return s.reviewRuns[key]; }));
    const assessments = records.reduce(function (all, item) {
      if (!item) return all;
      (item.attempts || []).forEach(function (attempt) { if (attempt.analysis && attempt.analysis.mode === 'model') all.push({ analysis: attempt.analysis }); });
      if (item.analysis && item.analysis.mode === 'model') all.push(item);
      return all;
    }, [])
      .filter(function (item) { return item && item.analysis && Array.isArray(item.analysis.criteria); })
      .sort(function (a, b) { return (a.analysis.at || a.completedAt || 0) - (b.analysis.at || b.completedAt || 0); });
    const score = function (item) {
      const rows = item.analysis.criteria;
      return rows.length ? rows.reduce(function (sum, row) { return sum + (row.status === 'met' ? 1 : row.status === 'partial' ? 0.5 : 0); }, 0) / rows.length : 0;
    };
    const recent = assessments.slice(-5), rates = recent.map(score);
    const lastTwo = rates.slice(-2), lastThree = rates.slice(-3);
    const level = lastTwo.length === 2 && lastTwo.every(function (x) { return x < 0.5; }) ? 1 :
      lastThree.length === 3 && lastThree.every(function (x) { return x >= 0.85; }) ? 3 : 2;
    const weakness = {};
    recent.forEach(function (item) {
      item.analysis.criteria.forEach(function (row) {
        if (row.status === 'met') return;
        const skill = skillFor(row.criterion);
        weakness[skill] = (weakness[skill] || 0) + (row.status === 'missing' ? 2 : 1);
      });
    });
    const weakest = Object.keys(weakness).sort(function (a, b) { return weakness[b] - weakness[a]; })[0] || '';
    return { level: level, pace: level === 1 ? '补基础' : level === 3 ? '加速迁移' : '稳步推进',
      weakest: weakest ? (SKILLS[weakest] || SKILLS.scope).label : '',
      assessmentCount: assessments.length, recentRates: rates.slice(-3).map(function (x) { return Math.round(x * 100); }),
      weakCounts: weakness };
  }
  function viewState() {
    const s = state();
    const count = completedDays(s), day = nextDay(s), last = count ? record(count, false) : null;
    const today = todayKey();
    const active = day <= DAYS.length ? record(day, false) : null;
    const activeAssessedToday = !!(active && active.completedAt && todayKey(new Date(active.completedAt)) === today);
    const lastAdvancedToday = !!(last && last.completedAt && todayKey(new Date(last.completedAt)) === today);
    const completedToday = activeAssessedToday || lastAdvancedToday;
    const todayDay = activeAssessedToday ? day : lastAdvancedToday ? count : 0;
    const todayAdvanced = !!(todayDay && s.sessions[todayDay] && s.sessions[todayDay].coreAdvancedAt);
    const profile = learnerProfile(s);
    const dueReviews = Object.keys(s.reviewQueue).map(function (key) { return s.reviewQueue[key]; })
      .filter(function (item) { return item.status === 'active' && item.dueAt <= Date.now(); }).sort(function (a, b) { return a.dueAt - b.dueAt; });
    return { started: !!s.startedAt, startedAt: s.startedAt, total: DAYS.length, completed: count, day: day,
      streak: streak(s), completedToday: completedToday, todayDay: todayDay, todayAdvanced: todayAdvanced,
      active: active, last: last, lastCompletedDay: count,
      lockedUntilTomorrow: completedToday && day <= DAYS.length, complete: count >= DAYS.length,
      level: profile.level, pace: profile.pace, weakest: profile.weakest, dueReviewCount: dueReviews.length,
      scheduledReviewCount: Object.keys(s.reviewQueue).filter(function (key) { return s.reviewQueue[key].status === 'active'; }).length };
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
    const sameDayRevision = current.completedToday && Number(day) === current.todayDay;
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
    if (analysis && analysis.mode === 'model') {
      r.completedAt = Date.now();
      if (rubricScore(analysis) >= 75) r.coreAdvancedAt = r.coreAdvancedAt || Date.now();
      queueWeakCriteria(state(), day, r, r.analysis, r.analysis.at);
    }
    save(); return true;
  }
  function dueReview() {
    const s = state();
    const reviewedToday = todayReview();
    if (reviewedToday && reviewedToday.analysis && reviewedToday.analysis.mode === 'model') return null;
    const queue = Object.keys(s.reviewQueue).map(function (key) { return s.reviewQueue[key]; })
      .filter(function (item) { return item.status === 'active' && item.dueAt <= Date.now(); })
      .sort(function (a, b) { return (a.dueAt - b.dueAt) || ((b.failures || 0) - (a.failures || 0)); })[0];
    if (!queue) return null;
    let run = queue.currentRunId ? s.reviewRuns[queue.currentRunId] : null;
    if (!run || run.completedAt) {
      const runCount = (queue.runCount || 0) + 1, profile = learnerProfile(s);
      const challenge = buildReviewTask(queue.skill, profile.level, runCount);
      const id = 'review-' + queue.skill + '-' + runCount;
      run = { id: id, type: 'review', skill: queue.skill, day: queue.sourceDay || nextDay(s), runCount: runCount,
        variantId: challenge.id, task: challenge, fields: ['', '', '', ''], answer: '', submittedAnswer: '',
        submissionId: '', analysis: null, attempts: [], completedAt: 0, updatedAt: Date.now() };
      s.reviewRuns[id] = run; queue.currentRunId = id; queue.runCount = runCount; save();
    }
    return { queue: queue, record: run, task: run.task, id: run.id, level: learnerProfile(s).level };
  }
  function reviewRun(id) { return state().reviewRuns[id] || null; }
  function optionalRun() {
    const s = state();
    return s.optionalCurrentId ? s.reviewRuns[s.optionalCurrentId] || null : null;
  }
  function startOptional(skill, formatIndex) {
    const s = state(), domain = SKILLS[skill];
    if (!domain) return null;
    s.optionalSeq++;
    const count = Object.keys(s.reviewRuns).filter(function (id) { return s.reviewRuns[id].optional && s.reviewRuns[id].skill === skill; }).length + 1;
    const task = buildReviewTask(skill, learnerProfile(s).level, count, Number(formatIndex));
    const id = 'optional-' + skill + '-' + s.optionalSeq;
    s.reviewRuns[id] = { id: id, type: 'review', optional: true, skill: skill, day: nextDay(s), runCount: count,
      variantId: task.id, task: task, fields: ['', '', '', ''], answer: '', submittedAnswer: '', submissionId: '',
      analysis: null, attempts: [], completedAt: 0, updatedAt: Date.now() };
    s.optionalCurrentId = id; save(); return s.reviewRuns[id];
  }
  function clearOptional() { const s = state(); s.optionalCurrentId = ''; save(); }
  function optionalFormats(skill) {
    const domain = SKILLS[skill];
    return domain ? domain.forms.map(function (form, index) { return { index: index, name: form.name }; }) : [];
  }
  function saveReviewFields(id, fields) {
    const run = reviewRun(id); if (!run) return null;
    run.fields = (Array.isArray(fields) ? fields : []).slice(0, 4).map(function (x) { return String(x || '').slice(0, 3000); });
    while (run.fields.length < 4) run.fields.push('');
    run.updatedAt = Date.now(); save(); return run;
  }
  function submitReview(id, answerOrFields) {
    const s = state(), run = s.reviewRuns[id];
    if (!run || (!run.optional && (!s.reviewQueue[run.skill] || s.reviewQueue[run.skill].currentRunId !== id)))
      return { error: '这条间隔复习已更新，请刷新后继续。' };
    const item = run.task;
    let answer;
    if (Array.isArray(answerOrFields)) {
      run.fields = answerOrFields.slice(0, 4).map(function (x) { return String(x || '').trim().slice(0, 3000); });
      while (run.fields.length < 4) run.fields.push('');
      answer = item.fields.map(function (field, i) { return field[0] + '：' + run.fields[i]; }).filter(function (_, i) { return !!run.fields[i]; }).join('\n');
    } else answer = String(answerOrFields || '').trim().slice(0, 12000);
    if (answer.replace(/[^\u4e00-\u9fa5a-z0-9]/gi, '').length < 40) return { error: '请先写出至少 40 个有效字符，再提交评估。' };
    if (run.submissionId && run.submittedAnswer) run.attempts = (run.attempts || []).concat([{ answer: run.submittedAnswer, analysis: run.analysis, at: run.updatedAt }]).slice(-10);
    run.answer = answer; run.submittedAnswer = answer;
    run.submissionId = id + '-submission-' + Date.now() + '-' + Math.random().toString(36).slice(2);
    run.analysis = null; run.pending = true; run.completedAt = 0; run.lastAttemptAt = Date.now(); run.updatedAt = Date.now(); save();
    return { submissionId: run.submissionId, answer: answer };
  }
  function saveReviewAnalysis(id, submissionId, analysis) {
    const s = state(), run = s.reviewRuns[id], queue = run && s.reviewQueue[run.skill];
    if (!run || (!run.optional && !queue) || run.submissionId !== submissionId) return false;
    run.analysis = Object.assign({}, analysis, { submissionId: submissionId, at: Date.now() });
    run.pending = false; run.updatedAt = Date.now();
    if (analysis && analysis.mode === 'model') {
      run.completedAt = Date.now();
      if (run.optional) {
        queueWeakCriteria(s, run.day || nextDay(s), run, run.analysis, run.completedAt);
        save(); return true;
      }
      const passed = analysis.verdict === 'pass';
      if (passed) {
        queue.successes = (queue.successes || 0) + 1;
        queue.lastStatus = 'met'; queue.lastReviewAt = run.completedAt;
        if (queue.successes >= 3) { queue.status = 'resolved'; queue.dueAt = 0; }
        else queue.dueAt = run.completedAt + (queue.successes === 1 ? 3 : 7) * 86400000;
      } else {
        queue.successes = 0; queue.failures = (queue.failures || 0) + 1;
        queue.lastStatus = 'needs-work'; queue.lastReviewAt = run.completedAt;
        queue.dueAt = run.completedAt + 86400000;
      }
      queue.updatedAt = Date.now();
    }
    save(); return true;
  }
  function todayReview() {
    const s = state(), today = todayKey();
    const run = Object.keys(s.reviewRuns).map(function (key) { return s.reviewRuns[key]; })
      .filter(function (run) { return run && !run.optional && ((run.lastAttemptAt && todayKey(new Date(run.lastAttemptAt)) === today) ||
        (run.completedAt && todayKey(new Date(run.completedAt)) === today)); })
      .sort(function (a, b) { return (b.lastAttemptAt || b.completedAt || 0) - (a.lastAttemptAt || a.completedAt || 0); })[0] || null;
    return run ? Object.assign({}, run, { queue: s.reviewQueue[run.skill] || null }) : null;
  }
  function reviewHistory() {
    const s = state();
    return Object.keys(s.reviewRuns).map(function (key) { return s.reviewRuns[key]; })
      .filter(function (run) { return run && run.completedAt; }).sort(function (a, b) { return b.completedAt - a.completedAt; });
  }
  function history() {
    const s = state();
    return DAYS.map(function (item) { return { task: item, record: s.sessions[item.day] || null }; });
  }
  window.DailyDecomposition = { days: DAYS.slice(), task: task, state: viewState, start: start, record: record,
    saveFields: saveFields, submit: submit, saveAnalysis: saveAnalysis, history: history, todayKey: todayKey,
    dueReview: dueReview, reviewRun: reviewRun, saveReviewFields: saveReviewFields, submitReview: submitReview,
    saveReviewAnalysis: saveReviewAnalysis, todayReview: todayReview, reviewHistory: reviewHistory,
    optionalRun: optionalRun, startOptional: startOptional, clearOptional: clearOptional, optionalFormats: optionalFormats,
    skills: Object.keys(SKILLS).map(function (key) { return { key: key, label: SKILLS[key].label }; }),
    profile: function () { const p = learnerProfile(state()); p.weakestKey = Object.keys(p.weakCounts).sort(function (a, b) { return p.weakCounts[b] - p.weakCounts[a]; })[0] || 'framing'; return p; } };
})();
