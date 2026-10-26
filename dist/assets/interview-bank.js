/* ============================================================
   精选 AI PM 面试题库
   ------------------------------------------------------------
   来源：用户提供的《AI产品经理--面试题库.md》，经过去重、去时效化、
   重写与结构化；不包含原文长答案。现有客观题在加载时统一转换为稳定 ID。
   ============================================================ */

(function () {
  const DIMS = {
    project_experience: { name: '项目与产品经验', desc: '项目价值、个人贡献与复盘' },
    product_value: { name: '产品方法与商业价值', desc: '需求、MVP、ROI 与产品判断' },
    ai_foundation: { name: 'AI 与模型基础', desc: '模型能力、边界与技术选型' },
    rag_retrieval: { name: 'RAG、检索与 Rerank', desc: '知识库、召回、重排序与生成' },
    agent_workflow: { name: 'Agent、工作流与工具', desc: '状态、工具、MCP 与流程设计' },
    evaluation_data: { name: '评测、数据与指标', desc: '评测集、Badcase、指标与反馈' },
    delivery_collaboration: { name: '交付、项目管理与协作', desc: '排期、灰度、风险与跨团队推进' },
    industry_soft: { name: '行业判断、表达与软素质', desc: '趋势判断、沟通、成长与影响力' }
  };

  const LEGACY_DIM_MAP = {
    foundation: 'ai_foundation',
    problem: 'product_value',
    architecture: 'rag_retrieval',
    workflow: 'agent_workflow',
    product: 'evaluation_data',
    delivery: 'delivery_collaboration'
  };

  function option(id, text) { return { id: id, text: text }; }

  function mcq(id, group, dim, difficulty, prompt, optionTexts, correctIndex, explanation, source) {
    const options = optionTexts.map(function (text, i) { return option(id + '-o' + (i + 1), text); });
    return {
      id: id, variantGroup: group, dimension: dim, difficulty: difficulty, type: 'mcq',
      topics: [group], prompt: prompt, options: options,
      correctOptionId: options[correctIndex].id, explanation: explanation,
      sourceRef: source || '精选题库'
    };
  }

  function open(id, group, dim, difficulty, subtype, prompt, rubricTexts, answerOutline, source) {
    return {
      id: id, variantGroup: group, dimension: dim, difficulty: difficulty, type: 'open', subtype: subtype,
      topics: [group], prompt: prompt,
      rubric: rubricTexts.map(function (label, i) { return { id: id + '-r' + (i + 1), label: label, weight: 1 }; }),
      answerOutline: answerOutline, sourceRef: source || '精选题库'
    };
  }

  const legacy = (window.INTERVIEW_QUESTIONS || []).map(function (q, index) {
    const id = q.id || ('legacy-' + index);
    const dim = LEGACY_DIM_MAP[q.dim] || q.dim;
    const difficulty = index % 6 === 0 ? 3 : (q.variant === 2 ? 2 : (index % 3 === 0 ? 2 : 1));
    return mcq(
      id, q.concept || id, dim, difficulty, q.q, q.options, q.a, q.why,
      '原课程题库 · ' + (DIMS[dim] ? DIMS[dim].name : dim)
    );
  });

  const addedMcq = [
    mcq('project-product-a', 'project-product', 'project_experience', 1, '面试官要求你介绍“产品”而不是“项目”，最关键的区别是什么？', ['产品强调持续服务的用户、价值与迭代；项目强调一次性交付过程', '产品必须有移动端，项目只能做后台', '产品不需要商业目标', '项目不需要明确负责人'], 0, '产品是持续创造价值的载体；项目是实现某个阶段目标的组织方式。', '项目产品经验类'),
    mcq('project-product-b', 'project-product', 'project_experience', 2, '介绍一个做了三年的系统时，哪种表达最能证明你讲的是产品能力？', ['只罗列参与过的会议', '说明目标用户、核心价值、版本演进、规模与持续指标', '只展示最终页面截图', '重点描述开发使用的框架'], 1, '长期用户价值、版本演进和指标最能体现产品，而不只是交付项目。', '项目产品经验类'),
    mcq('project-contribution-a', 'project-contribution', 'project_experience', 2, '描述项目成果时，哪种证据最能说明你的个人贡献？', ['团队最终拿到奖项', '明确自己负责的决策、动作、协作对象及动作前后指标变化', '项目使用了大模型', '团队人数很多'], 1, '个人贡献要能连接“我的判断和动作”与可验证结果。', '项目产品经验类'),
    mcq('project-contribution-b', 'project-contribution', 'project_experience', 3, '项目指标提升但你无法拆出自己的作用，面试中最合理的处理是？', ['把全部结果归因给自己', '区分团队结果与个人负责范围，并说明可验证的影响链路', '避开所有数字', '虚构一组 A/B 数据'], 1, '诚实拆分团队结果和个人贡献，比夸大归因更可信。', '项目产品经验类'),
    mcq('project-learning-a', 'project-learning', 'project_experience', 1, '进入陌生业务时，合理的第一步是？', ['立即写完整 PRD', '先建立业务地图：角色、流程、指标、规则与高频问题', '先换技术架构', '先承诺上线日期'], 1, '业务地图先帮助识别对象、流程和约束，再进入方案设计。', '产品核心方法论'),
    mcq('project-learning-b', 'project-learning', 'project_experience', 2, '怎样证明自己已经“上手”一个新业务？', ['背完全部行业术语', '能独立解释核心流程、发现关键问题并完成一次可验证交付', '参加足够多会议', '写出最长的调研报告'], 1, '上手应以能做出正确判断和交付为准，而不是信息摄入量。', '产品核心方法论'),

    mcq('industry-success-a', 'industry-success', 'industry_soft', 1, '评价一个 AI 产品是否成功，下面哪项最完整？', ['模型参数最大', '用户任务改善、商业结果成立、质量与风险可控', '生成内容最长', '使用最新模型'], 1, '技术能力只有转化成稳定用户与业务结果，产品才算成功。', '行业产品认知类'),
    mcq('industry-success-b', 'industry-success', 'industry_soft', 2, 'AI 功能调用量持续增长，但用户任务成功率下降，应如何判断？', ['调用量增长即可认定成功', '增长可能来自反复重试，必须结合任务成功、满意度与成本判断', '继续增加入口', '只统计 Token 消耗'], 1, '调用量是过程指标，可能掩盖失败和重复操作。', '行业产品认知类'),
    mcq('industry-expectation-a', 'industry-expectation', 'industry_soft', 2, '客户希望模型“任何问题都答对”，产品经理应先做什么？', ['直接答应', '用真实样本说明能力边界，并对高风险场景设计兜底和验收标准', '隐藏错误结果', '停止所有沟通'], 1, '管理预期需要可验证样本、边界和失败处理，不是口头降预期。', '项目管理类'),
    mcq('industry-expectation-b', 'industry-expectation', 'industry_soft', 3, '业务方质疑 AI 效果不稳定，最有效的沟通材料是什么？', ['模型厂商宣传页', '按场景拆分的评测结果、Badcase、改进计划与放行门槛', '更长的产品愿景', '竞争对手截图'], 1, '结构化证据能把争论从感受转成可决策的问题。', '项目管理类'),
    mcq('industry-conflict-a', 'industry-conflict', 'industry_soft', 2, '算法结果与业务预期差异很大时，产品经理最先应该做什么？', ['要求算法立即按业务意见修改', '对齐样本、指标口径和失败类型，确认分歧发生在哪一层', '向上级投诉', '停止评测'], 1, '先对齐证据和口径，才能判断是数据、模型、指标还是业务假设问题。', '跨团队协调类'),
    mcq('industry-conflict-b', 'industry-conflict', 'industry_soft', 3, '研发认为需求无法按期实现，产品经理最合理的推进方式是？', ['坚持原范围和日期不变', '拆出目标、关键路径与可裁剪范围，共同形成分阶段交付方案', '绕过研发直接承诺客户', '删除验收标准'], 1, '分阶段交付要守住目标，同时透明处理范围、依赖和风险。', '跨团队协调类')
  ];

  const openQuestions = [
    open('open-project-1', 'project-story', 'project_experience', 2, 'project', '请用 3 分钟介绍一个你认为做得最好的 AI 产品项目，并证明它为什么“好”。', ['先定义“好”的衡量标准', '说明用户、场景与原问题', '讲清个人负责的关键决策', '用可信指标或证据说明结果', '给出复盘与方法沉淀'], '标准 → 背景与目标 → 个人动作 → 结果证据 → 复盘沉淀。', '项目产品经验类'),
    open('open-project-2', 'project-badcase', 'project_experience', 3, 'scenario', '你已经收集并分类了一批 Badcase，下一步如何把它们转化为有效迭代？', ['按根因而非表象归类', '估算频率、影响与优先级', '为每类选择对应优化手段', '建立固定回归集验证改动', '监控上线后的副作用'], '根因分类 → 优先级 → 分层修复 → 离线回归 → 灰度监控。', '项目产品经验类'),
    open('open-project-3', 'project-roi', 'project_experience', 3, 'strategy', '有人质疑 AI 功能成本高、ROI 不明确，你会如何回应并推动决策？', ['拆清收益、成本和替代方案', '区分短期验证与长期规模收益', '给出可量化假设和数据来源', '提出小范围验证与停止条件', '说明风险与机会成本'], '用可验证的小实验回答 ROI，而不是用愿景压过不确定性。', '项目管理类'),
    open('open-project-4', 'project-learning', 'project_experience', 2, 'scenario', '如果进入一个完全陌生的业务，你会如何在两周内完成第一次可用交付？', ['建立角色、流程、规则和指标地图', '访谈关键角色并观察真实任务', '识别最高风险假设', '切出最小交付闭环', '设置评审、验收和复盘节点'], '先理解业务，再用最小闭环证明自己能做出正确判断。', '产品核心方法论'),

    open('open-product-1', 'product-ai-fit', 'product_value', 2, 'scenario', '面对一个业务需求，你如何判断它是否值得使用 AI？', ['定义用户问题和业务结果', '区分确定性规则与概率性任务', '评估数据、模型和系统可行性', '比较非 AI 方案与迁移成本', '设置成功、护栏和停止指标'], '问题价值 → AI 适配 → 可行性 → 替代方案 → 验证指标。', '产品核心方法论'),
    open('open-product-2', 'product-mvp', 'product_value', 2, 'scenario', '资源只够两周，需求包含测评、推荐、问答、社区和排行榜，你如何切 MVP？', ['锁定单一用户时刻', '明确唯一关键假设', '形成最小输入到结果闭环', '列出明确不做项', '定义成功与停止信号'], 'MVP 是最小验证闭环，不是所有功能各做一点。', '产品核心方法论'),
    open('open-product-3', 'product-research', 'product_value', 2, 'project', '请说明你会如何为一个 AI 产品做产品调研，并避免被“用户说想要”误导。', ['明确调研决策目标', '选择真实使用者与替代方案用户', '追问过去行为而非未来态度', '结合行为数据与现场观察', '把结论分成事实、假设和待验证项'], '用真实行为证据约束访谈结论，并让调研服务具体决策。', '产品核心方法论'),
    open('open-product-4', 'product-priority', 'product_value', 3, 'strategy', '多个客户同时提出高优先级需求，但资源不足，你如何排序并管理预期？', ['统一价值与成本口径', '识别通用能力和单客定制', '考虑战略、收入、风险与依赖', '给出版本切片和替代方案', '透明同步决策依据与承诺边界'], '排序不是拍脑袋，而是把价值、复用、成本、风险和承诺放到同一张表。', '产品核心方法论'),

    open('open-ai-1', 'ai-boundary', 'ai_foundation', 2, 'strategy', '请说明大模型的能力边界，以及产品设计如何把这些边界变成可控体验。', ['说明概率生成与知识时效边界', '区分事实、推理和行动风险', '设计资料来源与不确定性提示', '设置确认、拒答和人工兜底', '用评测与监控持续校准'], '不要只描述模型缺陷，要落到产品门槛和恢复路径。', 'AI 技术实操类'),
    open('open-ai-2', 'ai-rag-finetune', 'ai_foundation', 2, 'scenario', '同一需求可以改 Prompt、做 RAG 或微调，你如何选择？', ['区分知识、行为和格式问题', '先尝试低成本可逆方案', '评估数据量与维护成本', '考虑更新频率和可溯源要求', '用固定样本对比验证'], '知识更新优先 RAG；稳定行为/格式可考虑微调；简单约束先用 Prompt。', 'AI 技术实操类'),
    open('open-ai-3', 'ai-model-selection', 'ai_foundation', 3, 'project', '新模型能力更强，你会如何证明它值得替换当前模型并安全上线？', ['建立真实任务评测集', '比较质量、延迟、成本和稳定性', '检查接口、提示词与供应商迁移成本', '做影子与灰度验证', '准备回滚与版本记录'], '替换模型是产品与工程迁移，不是只比较榜单。', 'AI 技术实操类'),
    open('open-ai-4', 'ai-reasoning', 'ai_foundation', 3, 'scenario', '什么时候应使用推理模型，什么时候普通指令模型更合适？', ['按任务复杂度与可验证性判断', '比较质量收益和延迟成本', '区分开放推理与固定流程', '设置超时和降级策略', '通过真实样本而非模型名决策'], '复杂推理需要更多计算；稳定简单任务应优先低延迟、低成本方案。', 'AI 技术实操类'),

    open('open-rag-1', 'rag-pipeline', 'rag_retrieval', 2, 'project', '请从离线到在线完整讲解一个企业知识问答 RAG 系统。', ['离线数据接入、解析、切分与索引', '权限、版本和元数据治理', '查询理解、改写与混合召回', 'Rerank、阈值和上下文组装', '生成、引用、拒答与监控'], '离线知识工程 + 在线检索生成 + 权限与评测闭环。', 'RAG 核心考点'),
    open('open-rag-2', 'rag-chunking', 'rag_retrieval', 3, 'scenario', '文档中两个关键事实距离很远，单个 Chunk 无法同时包含，如何优化？', ['按结构和语义而非固定长度切分', '保留父子块与相邻块关系', '使用查询改写或多跳检索', '召回后组合与 Rerank', '用命中样本验证而非无限增大 Chunk'], '先保持语义结构，再用父子检索、多跳与重排补足跨块关系。', 'RAG 核心考点'),
    open('open-rag-3', 'rag-rerank', 'rag_retrieval', 3, 'scenario', '正确资料已经被召回，但总排不到上下文前几位，你会如何定位和优化？', ['区分召回问题与排序问题', '检查候选集、标签、版本和重复块', '选择适合的 Reranker 与 TopK', '设置相关性阈值和无答案分支', '用 NDCG/MRR/Precision@K 验证'], '候选中已有正确资料时，重点优化精排、过滤和阈值。', 'RAG 核心考点'),
    open('open-rag-4', 'rag-out-of-domain', 'rag_retrieval', 2, 'strategy', '用户问题不在知识库覆盖范围内，系统应该怎么办？', ['识别知识库外问题', '避免硬选最高分片段', '明确证据不足并最小追问', '按风险转搜索、工具或人工', '记录问题用于知识库补全'], '无答案是一种正常状态，不能让检索分数最高等于答案正确。', 'RAG 核心考点'),

    open('open-agent-1', 'agent-workflow-choice', 'agent_workflow', 2, 'strategy', '什么情况下选择 Workflow，什么情况下选择 Agent？', ['比较目标开放度和步骤可枚举性', '考虑风险、合规和审计要求', '评估工具与数据确定性', '设计人工确认位置', '优先选择更简单可控的结构'], '稳定高风险流程优先工作流；路径开放且需探索时才增加自治。', 'Agent 技术类'),
    open('open-agent-2', 'agent-memory', 'agent_workflow', 3, 'scenario', '多轮对话越来越长且开始脱节，你如何设计上下文与记忆？', ['区分工作记忆、状态和长期画像', '抽取稳定事实而非保存所有原文', '按任务相关性检索记忆', '处理冲突、过期与用户更正', '监控错误记忆和提供删除能力'], '记忆的难点不是存，而是写什么、何时取、怎样更正和删除。', 'AI 问答高阶问题'),
    open('open-agent-3', 'agent-stability', 'agent_workflow', 3, 'scenario', 'Agent 在任务规划中经常幻觉或调用错工具，你会如何治理？', ['缩小工具集合并改进描述', '分离规划、执行和校验状态', '为工具参数做 schema 校验', '高风险动作增加确认和最小权限', '建立 Trace 与失败回归集'], '用结构、权限和可观测性约束 Agent，而不是只追加提示词。', 'Agent 技术类'),
    open('open-agent-4', 'agent-mcp', 'agent_workflow', 2, 'project', '请解释 MCP 与 Function Calling 的区别，并说明产品经理要负责什么。', ['区分调用机制与连接协议', '说明工具真实执行仍在应用端', '覆盖权限、认证和审计', '定义工具契约与错误处理', '结合具体产品场景说明价值'], 'MCP 统一暴露和发现能力；Function Calling 描述模型如何提出一次工具调用。', 'AI 技术实操类'),

    open('open-eval-1', 'eval-process', 'evaluation_data', 2, 'project', '请介绍一套你能真正执行的模型效果评测流程。', ['从业务任务定义质量标准', '构建真实分布与边界样本', '制定标注规范和一致性检查', '执行基线、对比与误差分析', '上线后监控并回流新失败'], '目标与标准 → 数据集 → 标注 → 对比评测 → Badcase → 线上闭环。', '评估与迭代类'),
    open('open-eval-2', 'eval-badcase', 'evaluation_data', 3, 'scenario', '某次 Prompt 优化让总体准确率上升，但高风险问题变差，你如何决策？', ['按场景和风险分层看指标', '检查样本分布与统计可信度', '明确护栏指标不可被平均数掩盖', '定位新增失败并回归验证', '必要时停止发布或分流'], '总体分数不能抵消高风险场景退化，护栏指标应拥有否决权。', '评估与迭代类'),
    open('open-eval-3', 'eval-answer-quality', 'evaluation_data', 2, 'strategy', '你如何定义“好的 AI 回答”并转化成可执行指标？', ['从用户任务而非文风出发', '拆分正确、相关、完整和可执行性', '加入引用、不确定性与安全性', '建立人工标注与自动指标组合', '连接线上任务成功和满意度'], '质量必须拆成可标注维度，并与真实任务结果连接。', '项目产品经验类'),
    open('open-eval-4', 'eval-satisfaction', 'evaluation_data', 2, 'scenario', 'AI 产品的用户满意度应该如何收集，怎样避免只看点赞率？', ['结合显式与隐式反馈', '区分回答满意与任务成功', '分析不反馈人群和选择偏差', '将反馈关联到题目、版本与 Trace', '形成可处理的 Badcase 闭环'], '点赞只是一个信号，需要与任务完成、重试、转人工和访谈组合。', '评估与迭代类'),

    open('open-delivery-1', 'delivery-resource', 'delivery_collaboration', 2, 'scenario', '研发资源不足，关键需求始终排不上期，你如何推进？', ['重申目标与影响而非只争功能', '拆分最小可交付范围', '量化优先级、依赖和机会成本', '提出替代方案与阶段计划', '同步风险并获得明确决策'], '把冲突从“谁更重要”转成范围、价值、依赖和风险决策。', '项目管理类'),
    open('open-delivery-2', 'delivery-gap', 'delivery_collaboration', 3, 'scenario', '算法效果与业务预期差距很大，双方互不认可指标，你怎么处理？', ['还原真实业务样本', '统一指标定义与验收口径', '按失败类型定位责任层', '共同确认基线和目标', '用小实验和评审节奏推进'], '先对齐证据和标准，再讨论方案与责任。', '项目管理类'),
    open('open-delivery-3', 'delivery-launch', 'delivery_collaboration', 2, 'project', '描述你会如何推动一个 AI 功能从 Demo 进入正式上线。', ['明确产品目标和责任边界', '冻结接口、状态与验收契约', '完成安全、成本和质量评测', '设计灰度、监控与人工兜底', '准备回滚和上线复盘'], 'Demo 可演示，产品必须可验收、可监控、可恢复。', '项目产品经验类'),
    open('open-delivery-4', 'delivery-rollout', 'delivery_collaboration', 3, 'strategy', '新模型或新策略准备上线，你如何设计灰度与回滚？', ['先跑离线与影子评测', '选择低风险人群和流量阶梯', '定义成功与止损指标', '保留版本、配置和数据可追溯', '确保一键回滚和异常通知'], '每一级放量都必须由证据触发，而不是按日期自动全量。', '评估与迭代类'),

    open('open-industry-1', 'industry-success', 'industry_soft', 2, 'strategy', '你认为什么样的 AI 产品才算成功？', ['解决真实且高频的问题', '任务效果可量化且持续改善', '商业收益覆盖长期成本', '质量、隐私和风险可控', '产品能随着反馈形成复利'], '成功不是模型先进，而是价值、可持续性与风险同时成立。', '行业产品认知类'),
    open('open-industry-2', 'industry-gap', 'industry_soft', 3, 'scenario', '普通用户不理解 AI 的能力与使用方法，你会怎样缩小认知鸿沟？', ['用任务语言而非模型术语', '提供示例、模板与智能默认值', '让限制、不确定性和依据可见', '设计渐进式引导与可撤销操作', '用用户成功率验证而非只看曝光'], '降低使用门槛，同时建立正确预期和控制感。', '行业产品认知类'),
    open('open-industry-3', 'industry-conflict', 'industry_soft', 2, 'project', '请举例说明你如何解决一次跨团队冲突，并推动项目继续前进。', ['说明冲突背景与各方目标', '识别事实、利益和口径差异', '描述自己的具体协调动作', '给出决策机制和最终结果', '复盘如何防止问题重复'], '用 STAR 结构讲清自己的判断与动作，不把成果全部归因于职位权力。', '跨团队协调类'),
    open('open-industry-4', 'industry-growth', 'industry_soft', 3, 'strategy', '你认为高阶产品经理与低阶产品经理的核心差异是什么？', ['从接需求升级为定义问题', '能做价值、风险与资源取舍', '能建立机制而非只交付一次', '能影响跨团队共同决策', '用结果和复盘形成可迁移方法'], '差异不在文档数量，而在问题定义、决策质量和组织影响力。', '个人规划类')
  ];

  const core50 = (window.CORE50_OPEN || []).map(function (row) {
    const number = row[0];
    return open('core50-open-' + String(number).padStart(2, '0'), row[1], row[2], row[3], row[4],
      row[5], row[6].split('|'), row[7], '新增核心 50 题 · 第 ' + number + ' 题（改写）');
  });

  window.INTERVIEW_DIMS = DIMS;
  window.INTERVIEW_BANK = legacy.concat(addedMcq, openQuestions, core50, window.MATERIAL_INTERVIEW || [], window.LONG_MEMORY_INTERVIEW || [], window.AGENT_HALLUCINATION_INTERVIEW || []);
})();
