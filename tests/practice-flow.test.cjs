const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const memory = { lab: {} };
const context = { window: { Mem: { state: memory, save() {} } }, Math, Date, Set, Map, console };
vm.createContext(context);
for (const name of ['data-core', 'data-adv', 'data-pro', 'data-pm', 'data-extension', 'data-materials', 'practice', 'practice-coach']) {
  vm.runInContext(fs.readFileSync(path.join(__dirname, '../assets', name + '.js'), 'utf8'), context, { filename: name });
}
const { Lab, PRACTICES, PracticeCoach } = context.window;
assert.equal(PRACTICES.length, 15);
for (const practice of PRACTICES) {
  const cases = PracticeCoach.examples(practice.id);
  assert.equal(cases.length, 2, `${practice.id}: 每题应有两个案例`);
  assert.ok(cases.every(x => x.scene && x.worked && x.lesson));
}

const id = 'brief-to-task';
assert.equal(Lab.practicePhase(id), 'learn');
Lab.startPractice(id);
assert.equal(Lab.practicePhase(id), 'write');
assert.equal(Lab.submitPractice(id, '太短').error.includes('40'), true);
assert.equal(Lab.practicePhase(id), 'write');
const answer = '目标用户是初次接触项目管理的同事。输入预约时间和联系方式，缺少时间时提示补充。输出当天行动清单。验收时修改输入，检查提醒和取消预约后的状态。';
const first = Lab.submitPractice(id, answer);
assert.ok(first.submissionId);
assert.equal(Lab.practicePhase(id), 'review');
assert.equal(Lab.practiceDone(id), false, '未完成分析前不得算已完成');
const local = PracticeCoach.localAnalysis(Lab.exercise(id), answer);
assert.equal(local.mode, 'local');
assert.ok(local.summary.includes('本地检查不能判断方案是否正确'));
assert.ok(local.strengths.every(x => answer.includes(x.quote)));
assert.ok(local.gaps.every(x => x.criterion && x.why && x.revision));
assert.equal(Lab.savePracticeAnalysis(id, first.submissionId, local), true);
assert.equal(Lab.practiceDone(id), true);
Lab.revisePractice(id);
assert.equal(Lab.practicePhase(id), 'write');
assert.equal(Lab.practiceDone(id), false);
const second = Lab.submitPractice(id, answer + ' 另外增加一次失败时的人工处理流程。');
assert.notEqual(second.submissionId, first.submissionId);
assert.equal(Lab.savePracticeAnalysis(id, first.submissionId, local), false, '旧请求不得覆盖新版本点评');
assert.equal(PracticeCoach.normalizeModelAnalysis({ strengths: [{ quote: '不存在的原文', why: '夸奖' }], gaps: [] }, answer), null);
const valid = PracticeCoach.normalizeModelAnalysis({ summary: '已覆盖输入，但仍缺失败状态。',
  strengths: [{ quote: '缺少时间时提示补充', why: '写明了缺参路径' }],
  gaps: [{ criterion: '异常处理', quote: '', why: '没有写接口失败后的状态', revision: '失败时保留草稿并提示重试。' }],
  nextStep: '补写接口失败。' }, answer);
assert.equal(valid.mode, 'model');
assert.equal(valid.strengths[0].quote, '缺少时间时提示补充');
Lab.savePracticeAnalysis(id, second.submissionId, valid);
assert.equal(Lab.practiceDone(id), true);

memory.lab.practices['mvp-slice'] = { answer: '旧版已有草稿，尚未完成检查与自评。', updatedAt: 1 };
assert.equal(Lab.practicePhase('mvp-slice'), 'write');
memory.lab.practices['prompt-contract'] = { answer: answer, decision: 1, rating: 2, updatedAt: 1 };
assert.equal(Lab.practicePhase('prompt-contract'), 'review');
assert.equal(Lab.practiceDone('prompt-contract'), true);
console.log('practice flow: cases, submit gating, analysis, stale guard, legacy records validated');
