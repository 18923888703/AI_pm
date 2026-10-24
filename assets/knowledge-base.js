/* ============================================================
   AI 产品经理专题知识库
   来源：用户导入的《AI产品经理--知识库》；内容已去重、校正并结构化改写。
   这些专题是课程的延伸阅读，不改变 61 个核心概念的学习进度。
   ============================================================ */

(function () {
  const topics = [
    {
      id: 'data-quality', category: 'AI 技术基础', title: '数据质量与数据资产',
      summary: '模型效果的上限通常受数据约束。AI PM 要判断数据是否准确、完整、一致、多样、及时，并能否合法用于目标场景。',
      keyPoints: ['区分通用训练数据与企业可控的业务数据', '检查来源、标注、覆盖面、时效性与隐私合规', '先定义数据如何改善具体任务，再决定采集和治理成本'],
      application: '做客服、推荐或风控方案时，把数据来源、质量门槛、缺失处理和更新责任写进 PRD。',
      relatedTerms: ['eval', 'goldenset', 'flywheel', 'safety'], keywords: ['数据集', '标注', '数据治理', '质量']
    },
    {
      id: 'compute-roi', category: 'AI 技术基础', title: '算力、推理成本与 ROI',
      summary: '算力不是纯技术预算，它会直接决定响应速度、单位经济性和产品能否规模化。',
      keyPoints: ['估算单次调用、日调用量和月度推理成本', '同时看延迟、吞吐、峰值容量与服务稳定性', '用量化、蒸馏、缓存或模型路由降低成本，但要重新评测效果'],
      application: '立项时同时给出效果目标与成本上限，避免 Demo 可用、上线后单位经济性失控。',
      relatedTerms: ['economics', 'inference', 'cache', 'modelselection'], keywords: ['GPU', 'TPU', '算力', 'ROI', '成本']
    },
    {
      id: 'training-map', category: 'AI 技术基础', title: '预训练、微调与 RLHF',
      summary: '预训练建立通用能力，微调改变特定任务或风格表现，RLHF 利用人类偏好改善模型行为；三者解决的问题不同。',
      keyPoints: ['预训练从大规模语料学习通用模式', '微调用高质量领域样本改变模型参数与行为', 'RLHF 用人类偏好信号做行为对齐，不等于给模型补充实时事实'],
      application: '优先从提示词和 RAG 验证价值；只有稳定的行为或分类差距无法解决时，再评估微调。',
      relatedTerms: ['model', 'finetune', 'prompt', 'rag'], keywords: ['预训练', '强化学习', 'RLHF', 'LoRA']
    },
    {
      id: 'model-evaluation', category: 'AI 技术基础', title: '模型选型与人工/自动评测',
      summary: '榜单只能做初筛，真正的模型选择必须回到自己的任务集、用户体验、成本、延迟和合规约束。',
      keyPoints: ['通用榜单不等于业务任务表现', '高频任务适合自动评测，关键高风险任务需要人工复核', '模型切换必须在同一评测集、同一约束和同一版本下比较'],
      application: '建立候选模型记分卡：任务质量、P95 延迟、单位成本、工具能力、上下文和合规。',
      relatedTerms: ['modelselection', 'eval', 'goldenset', 'llmjudge'], keywords: ['模型榜单', '人工评测', '自动评测', '选型']
    },
    {
      id: 'rag-data-ops', category: 'RAG 与知识工程', title: 'RAG 知识库清洗与缺失处理',
      summary: 'RAG 不会把坏资料变好答案。知识冲突、重复、切分错误或根本没有答案，都会把模型推向看似可信的错误。',
      keyPoints: ['清理噪声、重复、冲突和过期版本', '为每个片段保留来源、版本、权限和更新时间', '检索不到可靠证据时明确拒答或转人工'],
      application: '上线前专门构造“知识库没有答案”的测试集，检查系统是否能承认不知道。',
      relatedTerms: ['rag', 'rerank', 'provenance', 'recovery'], keywords: ['知识库', '清洗', '切分', '缺失', '拒答']
    },
    {
      id: 'private-deployment', category: 'RAG 与知识工程', title: '私有化部署决策',
      summary: '私有化部署用更高的硬件、运维和升级成本，换取更强的数据边界、网络隔离和定制控制。',
      keyPoints: ['先明确数据能否出域、审计和监管要求', '比较公有 API、专有云与本地部署的总拥有成本', '把模型升级、容量、监控和灾备纳入长期成本'],
      application: '医院、金融或政府场景先做数据分级，再按敏感级别选择部署形态，而不是一律私有化。',
      relatedTerms: ['safety', 'buildbuy', 'observability', 'economics'], keywords: ['本地部署', '私有云', '数据安全']
    },
    {
      id: 'tool-landscape', category: '工具与原型', title: 'AI 工具选型地图',
      summary: '模型服务、智能体平台、桌面工作台和生成式内容工具属于不同层，不能只按“功能多”比较。',
      keyPoints: ['模型服务关注能力、价格、稳定性和 API 约束', '智能体平台关注工作流、插件、权限、调试和发布', '桌面工作台适合个人验证，生产系统仍需评估治理与可运维性'],
      application: '先写清要验证的任务和退出条件，再选 Cherry Studio、Coze、模型 API 或自建代码。',
      relatedTerms: ['buildbuy', 'workflow', 'agent', 'modelselection'], keywords: ['Cherry Studio', 'Coze', '模型平台', '工具']
    },
    {
      id: 'agent-use-cases', category: '工具与原型', title: 'Agent 产品场景识别',
      summary: 'Agent 适合目标明确、步骤需要动态选择且能调用工具验证结果的任务；固定流程通常优先用工作流。',
      keyPoints: ['先区分生成文字与真实执行', '把规划、工具调用、观察和恢复设计成闭环', '每增加一步都会累积失败概率，关键节点要有人审或规则校验'],
      application: '旅行规划、订单查询或周报整理可先做受限 Agent，支付、删除等高风险动作保留确认。',
      relatedTerms: ['agent', 'workflow', 'autonomy', 'hitl'], keywords: ['智能体', '任务流', '自主执行']
    },
    {
      id: 'pmf', category: '产品方法', title: 'PMF：产品与市场匹配',
      summary: 'PMF 不是“有人说喜欢”，而是目标用户持续使用、愿意付出成本，且获取与交付可以形成可持续增长。',
      keyPoints: ['明确是哪一类用户的哪一项高频或高价值需求', '同时观察留存、付费、推荐和替代行为', '没有稳定价值信号前，不用增长投放掩盖产品问题'],
      application: 'AI 功能验证先看任务完成和重复使用，再看曝光量或生成次数。',
      relatedTerms: ['problemframing', 'outcomemetric', 'aisuitability'], keywords: ['产品市场匹配', '留存', '增长']
    },
    {
      id: 'mvp', category: '产品方法', title: 'MVP 与最小可行验证',
      summary: 'MVP 是验证最关键风险的最小闭环，不是把完整产品做得粗糙，也不是功能数量越少越好。',
      keyPoints: ['先写清要验证的最大不确定性', '保留用户从输入到结果再到反馈的完整闭环', '用验证结果决定继续、调整或停止'],
      application: 'AI Demo 至少要包含真实输入、失败处理和效果采集，不能只演示理想样例。',
      relatedTerms: ['problemframing', 'aisuitability', 'eval', 'rollout'], keywords: ['最小可行产品', '验证', 'Demo']
    },
    {
      id: 'kano', category: '产品方法', title: 'Kano 需求分类',
      summary: 'Kano 用满意度变化区分必备、期望、魅力、无差异与反向需求，帮助团队避免把所有需求当成同一优先级。',
      keyPoints: ['必备项缺失会强烈不满，但做好不一定惊喜', '期望项通常越好满意度越高', '魅力项会随市场成熟逐渐变成期望甚至必备'],
      application: '通过正反向问卷与 Better/Worse 系数判断需求属性，再结合成本和战略排序。',
      relatedTerms: ['problemframing', 'outcomemetric', 'ab'], keywords: ['必备属性', '魅力属性', 'Better', 'Worse']
    },
    {
      id: 'hmw', category: '产品方法', title: 'HMW：把问题改写成机会',
      summary: 'How Might We 用开放但有边界的问题陈述，把抱怨转成可探索的设计机会。',
      keyPoints: ['避免把解决方案直接写进问题', '问题范围太大会失焦，太小会锁死方案', '可以从积极、转移、逆向和拆解角度产生多个 HMW'],
      application: '把“用户总忘记保存”改成“我们如何让保存自动发生且可恢复”。',
      relatedTerms: ['problemframing', 'taskdecomp', 'aiux'], keywords: ['How Might We', '机会点', '问题重构']
    },
    {
      id: 'five-planes', category: '产品方法', title: '产品五层结构',
      summary: '从战略、范围、结构、框架到表现逐层推导，能避免团队只在界面层修补根本性问题。',
      keyPoints: ['战略层定义用户需求与商业目标', '范围和结构层决定功能、内容和信息架构', '框架与表现层解决布局、导航和感知体验'],
      application: '复盘一个 AI 助手时，先判断价值和能力范围，再讨论对话框样式。',
      relatedTerms: ['problemframing', 'aiux', 'taskdecomp'], keywords: ['战略层', '范围层', '结构层', '表现层']
    },
    {
      id: 'competitor-analysis', category: '产品方法', title: '竞品分析六步法',
      summary: '竞品分析的产出不是功能截图，而是基于目标、阶段和能力差异形成可执行的竞争判断。',
      keyPoints: ['区分直接竞品与替代方案', '从战略、范围、结构、框架和表现层拆解', '结论必须落到取舍、验证动作和差异化策略'],
      application: '比较 AI 助手时统一任务集，记录完成质量、时间、成本与失败恢复，而非只列功能。',
      relatedTerms: ['modelselection', 'outcomemetric', 'problemframing'], keywords: ['竞品', '对标', '差异化']
    },
    {
      id: 'industry-analysis', category: '商业与战略', title: 'PEST、五力与产业链分析',
      summary: 'PEST 看宏观环境，波特五力看行业利润结构，产业链分析看价值和话语权分布；三者回答不同层次的问题。',
      keyPoints: ['PEST：政策、经济、社会、技术', '五力：竞争者、进入者、替代品、供应商、购买者', '产业链：上中下游的利润、壁垒与依赖'],
      application: '评估 AI 赛道时，把模型供应商依赖、客户议价和监管变化放在同一张图上。',
      relatedTerms: ['buildbuy', 'modelselection', 'riskgrading'], keywords: ['PEST', '波特五力', '产业链']
    },
    {
      id: 'gartner-hype', category: '商业与战略', title: 'Gartner 技术成熟度曲线',
      summary: '技术通常经历萌芽、期望膨胀、泡沫破裂、稳步爬升和生产成熟；它用于校准预期，不是预测具体日期。',
      keyPoints: ['区分媒体热度与可交付能力', '在泡沫期用小实验验证，在低谷期寻找真实效率提升', '决策仍要基于自己的场景、数据和组织能力'],
      application: '面对新 Agent 技术，先限定任务、建立评测和失败边界，再决定是否规模投入。',
      relatedTerms: ['aisuitability', 'eval', 'rollout'], keywords: ['技术成熟度', '炒作周期', '趋势']
    },
    {
      id: 'business-model', category: '商业与战略', title: '商业模式画布与变现',
      summary: '商业模式画布用九个模块检查用户价值、交付方式、资源与收入成本是否形成闭环。',
      keyPoints: ['客户细分与价值主张必须一一对应', '渠道、客户关系、关键资源和合作伙伴决定交付可行性', '收入来源要覆盖长期获客、模型调用和服务成本'],
      application: 'AI 产品不能只算订阅收入，还要把 Token、人工审核和第三方工具调用计入成本结构。',
      relatedTerms: ['economics', 'outcomemetric', 'buildbuy'], keywords: ['商业画布', '收入来源', '成本结构', '变现']
    },
    {
      id: 'ltv-cac', category: '商业与战略', title: 'LTV、CAC 与单位经济性',
      summary: 'LTV 衡量一个客户生命周期贡献，CAC 衡量获取一个客户的成本；两者必须与毛利、回收周期一起看。',
      keyPoints: ['统一时间窗口和客户口径', 'CAC 不只含广告，也应含销售和渠道成本', 'LTV 高于 CAC 不代表现金流安全，还要看回本周期和留存'],
      application: '按用户分层计算 AI 使用成本，避免重度用户越活跃亏得越多。',
      relatedTerms: ['economics', 'outcomemetric', 'flywheel'], keywords: ['获客成本', '生命周期价值', '单位经济性']
    },
    {
      id: 'aarrr', category: '增长与数据', title: 'AARRR 增长漏斗',
      summary: 'AARRR 从获取、激活、留存、变现到推荐描述用户生命周期，重点是找出阻塞增长的关键环节。',
      keyPoints: ['获取量不能代替激活质量', '留存通常比短期转化更能证明持续价值', '推荐应来自真实价值，而不是只靠奖励补贴'],
      application: 'AI 学习产品可把“首次完成练习并理解解析”定义为激活，而不是仅完成注册。',
      relatedTerms: ['outcomemetric', 'ab', 'flywheel'], keywords: ['海盗模型', '激活', '留存', '推荐']
    },
    {
      id: 'aha-magic-number', category: '增长与数据', title: 'Aha Moment 与 Magic Number',
      summary: 'Aha Moment 是用户首次感知核心价值的时刻；Magic Number 是与长期留存相关的早期行为阈值，两者都需要数据验证。',
      keyPoints: ['先用访谈找候选价值时刻', '再比较留存与流失用户的早期行为', '相关不等于因果，需实验或准实验验证'],
      application: '找出高留存学习者在首周完成的关键动作，并用 A/B 实验验证引导是否有效。',
      relatedTerms: ['outcomemetric', 'ab', 'flywheel'], keywords: ['惊喜时刻', '魔法数字', '关键行为']
    },
    {
      id: 'tracking', category: '增长与数据', title: '数据埋点与指标口径',
      summary: '埋点是把关键行为转成可分析事件；真正困难的是事件语义、触发时机、字段和口径一致性。',
      keyPoints: ['每个事件要有明确业务问题', '定义触发时机、属性、去重规则和版本', '上线前用测试账号核对前端、服务端和报表数据'],
      application: '对 AI 回答记录请求、首字延迟、完成、引用点击、重试和用户反馈，但避免采集敏感原文。',
      relatedTerms: ['observability', 'outcomemetric', 'ab', 'safety'], keywords: ['事件', '字段', '数据采集', '口径']
    },
    {
      id: 'ab-experiment', category: '增长与数据', title: 'A/B 实验与 ICE 排序',
      summary: 'A/B 实验通过随机分流比较方案因果效果；ICE 用影响、信心和易实现度帮助排序实验候选。',
      keyPoints: ['实验前确定主指标、护栏指标和最小可检测效应', '避免中途反复偷看并提前停止', 'ICE 是排序启发式，不是替代数据和战略判断'],
      application: '测试新 Reranker 时同时观察任务成功率、延迟和成本，避免只优化点击率。',
      relatedTerms: ['ab', 'eval', 'outcomemetric', 'rerank'], keywords: ['随机分流', '对照组', 'ICE']
    },
    {
      id: 'fishbone', category: '分析与表达', title: '鱼骨图与根因分析',
      summary: '鱼骨图把一个结果问题拆成多类候选原因，价值在于系统枚举和验证，而不是画完图就宣布根因。',
      keyPoints: ['先定义可度量的问题和时间范围', '按人、流程、技术、数据、环境等类别发散', '用日志、实验或访谈排除候选原因'],
      application: 'AI 回答准确率下降时，分别检查模型、检索、提示词、数据版本、流量结构和评测口径。',
      relatedTerms: ['observability', 'eval', 'recovery'], keywords: ['因果图', '根因', '排障']
    },
    {
      id: 'pyramid', category: '分析与表达', title: '金字塔原理',
      summary: '先给结论，再用相互独立且共同穷尽的论点和证据支撑，让复杂判断能被快速理解和质询。',
      keyPoints: ['结论先行', '同层论点保持同一抽象层级', '每个观点必须有事实、数据或推理链支持'],
      application: '汇报 AI 立项时先给“做/不做”的判断，再说明用户价值、技术可行性、风险和 ROI。',
      relatedTerms: ['problemframing', 'outcomemetric', 'riskgrading'], keywords: ['结论先行', '结构化表达', 'MECE']
    },
    {
      id: 'eval-engineering', category: 'AI 产品落地', title: 'Eval 工程体系：从评估集到 CI 门禁',
      summary: 'Eval 是标准化、可重复的 AI 质量工程：用固定评估集、分维度标准、多方法评分和版本报告，让每次模型、Prompt 或知识库改动都能被比较和拦截。',
      keyPoints: ['评估集覆盖真实场景、难例与高风险边界，并为每题配置标准答案或评分要点', '评分按维度组合规则、语义相似度、LLM-as-Judge 与人工复核', '把执行、报告和阈值接入 CI，失败用例进入标注与复测闭环'],
      application: '发布 AI 客服新版本前自动跑 Eval；正确性与安全性未过硬门槛则阻断发布，报告同时给出失败用例、原因和版本趋势。',
      relatedTerms: ['eval', 'goldenset', 'llmjudge', 'observability', 'flywheel', 'rollout'],
      keywords: ['自动化测试', '评估维度', '评估报告', 'CI', '发布门禁', 'Bad Case', '标注一致性']
    },
    {
      id: 'mair', category: 'AI 产品落地', title: 'MAIR：寻找 AI 机会点',
      summary: 'MAIR 从业务流程出发，识别高价值脑力劳动，再判断 AI 替代或辅助是否值得。',
      keyPoints: ['M：梳理端到端流程', 'A：找到需要判断、分析或创作的环节', 'I/R：评估价值，再匹配合适 AI 方案'],
      application: '先定位耗时且高错率的客服审核环节，再讨论模型，而不是先有技术再找场景。',
      relatedTerms: ['problemframing', 'aisuitability', 'taskdecomp'], keywords: ['流程梳理', '脑力劳动', '机会点']
    },
    {
      id: 'ops-core', category: 'AI 产品落地', title: 'Ops-Core：把机会变成可执行方案',
      summary: 'Ops-Core 将 AI 场景拆成输出目标、输入、流程、风格、提示词、模拟测试和系统结构。',
      keyPoints: ['先定义可验收输出与必要输入', '明确工作流、输出格式和异常处理', '用历史真实样本模拟，再决定模型与系统结构'],
      application: '设计 AI 审单时，明确风险等级输出、订单与黑名单输入、转人工规则和离线测试集。',
      relatedTerms: ['taskdecomp', 'workflow', 'eval', 'recovery'], keywords: ['AI 替代', 'SOP', '方案设计']
    },
    {
      id: 'crispe', category: 'AI 产品落地', title: 'CRISPE 提示词框架',
      summary: 'CRISPE 用角色能力、背景洞察、任务、风格、实验和响应格式组织复杂提示词。',
      keyPoints: ['框架用于防遗漏，不是固定咒语', '优先给真实材料与验收标准', '对高频提示词做版本化和回归测试'],
      application: '写产品发布稿时明确受众、事实材料、语气、备选方向和最终格式。',
      relatedTerms: ['prompt', 'systemprompt', 'fewshot', 'eval'], keywords: ['提示词框架', '角色', '响应格式']
    },
    {
      id: 'star', category: '分析与表达', title: 'STAR 项目表达',
      summary: 'STAR 用情境、任务、行动和结果组织项目经历，重点是你的判断、行动和可验证结果。',
      keyPoints: ['S/T 只交代必要背景和目标', 'A 说明你做了什么、为何这样做以及关键取舍', 'R 给出量化结果、验证方法和复盘'],
      application: '面试回答 AI 项目时补充失败案例、评测方法和上线后的业务变化，避免只讲功能。',
      relatedTerms: ['outcomemetric', 'eval', 'problemframing'], keywords: ['面试', '项目经历', '情境任务行动结果']
    },
    {
      id: 'pi-skills', category: '分析与表达', title: 'AI PM 的 π 型能力',
      summary: 'π 型能力是在产品通识之上形成两项可独立交付的深度能力，例如产品决策加数据评测或技术原型。',
      keyPoints: ['横向能力包括沟通、业务与项目协作', '第一纵深是产品发现、定义和取舍', '第二纵深可选数据、AI 技术、行业或设计，但必须能产出结果'],
      application: '用项目证据而不是课程数量评估能力：是否能独立完成定义、原型、评测与复盘。',
      relatedTerms: ['problemframing', 'eval', 'taskdecomp', 'buildbuy'], keywords: ['能力模型', 'T 型人才', '职业发展']
    }
  ];

  topics.push.apply(topics, window.MATERIAL_TOPICS || []);
  topics.push.apply(topics, window.LONG_MEMORY_TOPICS || []);

  function get(id) { return topics.find(function (x) { return x.id === id; }) || null; }
  function forTerm(termId) {
    return topics.filter(function (x) { return x.relatedTerms.indexOf(termId) >= 0; }).slice(0, 6);
  }
  function categories() {
    return topics.reduce(function (out, x) { if (out.indexOf(x.category) < 0) out.push(x.category); return out; }, []);
  }

  window.KNOWLEDGE_BASE = topics;
  window.KnowledgeBase = { get: get, forTerm: forTerm, categories: categories };
})();
