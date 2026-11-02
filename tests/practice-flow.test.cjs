const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const memory = { lab: {} };
const context = { window: { Mem: { state: memory, save() {} } }, Math, Date, Set, Map, console };
vm.createContext(context);
for (const name of ['data-core', 'data-adv', 'data-pro', 'data-pm', 'data-extension', 'data-materials', 'data-long-memory', 'data-agent-hallucination', 'data-memory-workflow', 'data-model-growth', 'practice', 'practice-coach']) {
  vm.runInContext(fs.readFileSync(path.join(__dirname, '../assets', name + '.js'), 'utf8'), context, { filename: name });
}
const { Lab, PRACTICES, PracticeCoach } = context.window;
assert.equal(PRACTICES.length, 20);
for (const practice of PRACTICES) {
  const cases = PracticeCoach.examples(practice.id);
  assert.equal(cases.length, 2, `${practice.id}: 每题应有两个案例`);
  assert.ok(cases.every(x => x.scene && x.worked && x.lesson));
  const guide = PracticeCoach.guide(practice);
  assert.ok(guide.meaning && guide.steps.length === practice.rubric.length, `${practice.id}: 应提供按题拆解的引导`);
  assert.ok(guide.steps.every(x => x.title && x.prompt && x.hint), `${practice.id}: 拆解问题或检查方向缺失`);
}

const id = 'brief-to-task';
assert.equal(Lab.practicePhase(id), 'learn');
Lab.startPractice(id);
assert.equal(Lab.practicePhase(id), 'breakdown');
const notes = ['第一次做学习计划的入门者，需要今晚开始。', '输入目标、水平和每天时间；输出今晚第一步。',
  '缺少时间时先追问，不保证转岗。', '修改时间预算后计划应重新计算。'];
Lab.savePracticeBreakdown(id, notes);
assert.equal(Lab.practiceRec(id).breakdown[1], notes[1]);
Lab.continuePractice(id, notes);
assert.equal(Lab.practicePhase(id), 'write');
assert.ok(Lab.practiceRec(id).answer.includes(notes[2]), '拆解笔记应成为可编辑初稿');
assert.equal(Lab.submitPractice(id, '太短').error.includes('40'), true);
assert.equal(Lab.practicePhase(id), 'write');
const answer = '目标用户是初次接触项目管理的同事。输入预约时间和联系方式，缺少时间时提示补充。输出当天行动清单。验收时修改输入，检查提醒和取消预约后的状态。';
const first = Lab.submitPractice(id, answer);
assert.ok(first.submissionId);
assert.deepEqual(Array.from(Lab.practiceRec(id).choiceOrder).sort(), [0, 1, 2, 3], '关键判断选项每次提交应生成稳定的随机顺序');
assert.equal(Lab.practicePhase(id), 'review');
assert.equal(Lab.practiceDone(id), false, '未完成分析前不得算已完成');
const local = PracticeCoach.localAnalysis(Lab.exercise(id), answer);
assert.equal(local.mode, 'local');
assert.ok(local.summary.includes('本地检查不能判断方案是否正确'));
assert.ok(local.strengths.every(x => answer.includes(x.quote)));
assert.ok(local.gaps.every(x => x.criterion && x.why && x.revision));
assert.equal(Lab.savePracticeAnalysis(id, first.submissionId, local), true);
assert.equal(Lab.practiceDone(id), false, '本地关键词提示不能代替在线模型判定');
Lab.revisePractice(id);
assert.equal(Lab.practicePhase(id), 'write');
assert.equal(Lab.practiceDone(id), false);
const second = Lab.submitPractice(id, answer + ' 另外增加一次失败时的人工处理流程。');
assert.notEqual(second.submissionId, first.submissionId);
assert.deepEqual(Array.from(Lab.practiceRec(id).choiceOrder).sort(), [0, 1, 2, 3]);
assert.equal(Lab.savePracticeAnalysis(id, first.submissionId, local), false, '旧请求不得覆盖新版本点评');
assert.equal(PracticeCoach.normalizeModelAnalysis({ summary: '已覆盖输入，但仍缺失败状态。',
  criteria: [{ criterion: '问题和用户是否具体', status: 'met', quote: '不存在的原文', why: '这是一个无法在原文中核对的评价依据。', revision: '' }],
  nextStep: '补写接口失败时的状态。', revisedAnswer: answer }, Lab.exercise(id), answer), null);
assert.equal(PracticeCoach.normalizeModelAnalysis({ summary: '还需要进一步优化才能使用。',
  criteria: Lab.exercise(id).rubric.map(criterion => ({ criterion, status: 'missing', quote: '',
    why: '需要进一步优化方案', revision: '请继续完善内容' })),
  nextStep: '继续优化方案', revisedAnswer: answer }, Lab.exercise(id), answer), null, '笼统的模型评价不能被当成具体解析');
const phrases = ['目标用户是初次接触项目管理的同事', '输入预约时间和联系方式',
  '缺少时间时提示补充', '验收时修改输入，检查提醒和取消预约后的状态'];
const valid = PracticeCoach.normalizeModelAnalysis({ summary: '四项要求都有具体表述，方案可以进入下一轮真实验证。',
  criteria: Lab.exercise(id).rubric.map((criterion, i) => ({ criterion, status: 'met', quote: phrases[i],
    why: '这一处写出了本题所要求的具体对象或处理动作，可据此继续检查方案。', revision: '' })),
  nextStep: '下一版补充一条真实输入的验收样本。', revisedAnswer: answer + ' 另补一个无效输入测试，检查错误提示和草稿保留。' }, Lab.exercise(id), answer);
assert.equal(valid.mode, 'model');
assert.equal(valid.verdict, 'pass');
assert.equal(valid.criteria[2].quote, '缺少时间时提示补充');
const partial = PracticeCoach.normalizeModelAnalysis({ summary: '输入与用户有依据，但失败和验收仍不够可执行。',
  criteria: Lab.exercise(id).rubric.map((criterion, i) => ({ criterion,
    status: i < 2 ? 'met' : 'partial', quote: phrases[i],
    why: '这一处虽然写了相关动作，但还缺少明确的失败处理或可核对结果。',
    revision: i < 2 ? '' : '请补写触发条件、预期状态和实际可检查的结果。' })),
  nextStep: '先补全失败状态与恢复动作。', revisedAnswer: answer + ' 失败时保留草稿并提示重试。' }, Lab.exercise(id), answer);
assert.equal(partial.verdict, 'partial');
Lab.savePracticeAnalysis(id, second.submissionId, partial);
assert.equal(Lab.practiceDone(id), false, '未完全达到量表时应保留修改任务');
const unverifiable = PracticeCoach.normalizeModelAnalysis({ summary: '答案中两项结论没有证据，当前不能确认方案成立。',
  criteria: Lab.exercise(id).rubric.map((criterion, i) => ({ criterion,
    status: i < 2 ? 'uncertain' : 'missing', quote: '',
    why: '答案没有提供可以核对的依据，暂时无法确认这一处判断是否成立。',
    revision: '请写出证据来源、判断条件和对应的操作步骤。' })),
  nextStep: '先核对事实来源并补齐一个可验证例子。', revisedAnswer: answer + ' 待补证据来源和一条验证样例。' }, Lab.exercise(id), answer);
assert.equal(unverifiable.verdict, 'unverified');
Lab.savePracticeAnalysis(id, second.submissionId, valid);
assert.equal(Lab.practiceDone(id), true);
Lab.revisePractice(id, valid.revisedAnswer);
assert.equal(Lab.practicePhase(id), 'write');
assert.equal(Lab.practiceRec(id).answer, valid.revisedAnswer, 'AI 修改稿应作为草稿，不直接覆盖历史作答');
assert.equal(Lab.practiceRec(id).submittedAnswer, second.answer, '原始提交仍应可追溯');

memory.lab.practices['mvp-slice'] = { answer: '旧版已有草稿，尚未完成检查与自评。', updatedAt: 1 };
assert.equal(Lab.practicePhase('mvp-slice'), 'write');
memory.lab.practices['prompt-contract'] = { answer: answer, decision: 1, rating: 2, updatedAt: 1 };
assert.equal(Lab.practicePhase('prompt-contract'), 'review');
assert.equal(Lab.practiceDone('prompt-contract'), true);
console.log('practice flow: cases, submit gating, analysis, stale guard, legacy records validated');
