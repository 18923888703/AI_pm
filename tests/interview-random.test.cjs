const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

let seed = 20261010;
function random() {
  seed = (seed * 1664525 + 1013904223) >>> 0;
  return seed / 0x100000000;
}
const seededMath = Object.create(Math);
seededMath.random = random;

const state = {};
const context = { window: { Mem: { state, save() {} } }, Math: seededMath, Date, Set, Map, console };
vm.createContext(context);
['assets/data-core.js', 'assets/data-adv.js', 'assets/data-pro.js', 'assets/data-pm.js', 'assets/data-extension.js', 'assets/data-materials.js', 'assets/data-long-memory.js', 'assets/practice.js', 'assets/interview-core50.js', 'assets/interview-bank.js', 'assets/option-refinements.js'].forEach((file) => {
  vm.runInContext(fs.readFileSync(path.join(__dirname, '..', file), 'utf8'), context, { filename: file });
});

const { Lab, INTERVIEW_DIMS, INTERVIEW_BANK } = context.window;
assert.equal(Object.keys(INTERVIEW_DIMS).length, 8, '应包含八个面试能力维度');
assert.ok(INTERVIEW_BANK.length >= 90, '精选题库应至少包含 90 道客观与开放题');
assert.equal(new Set(INTERVIEW_BANK.map((q) => q.id)).size, INTERVIEW_BANK.length, '题目 ID 不应重复');
const core50 = INTERVIEW_BANK.filter((q) => q.id.startsWith('core50-open-'));
assert.equal(core50.length, 50, '新增核心 50 个考查角度应全部进入面试题库');
assert.equal(new Set(core50.map((q) => q.prompt)).size, 50, '新增核心题不应有完全重复的题干');
core50.forEach((q) => {
  assert.ok(INTERVIEW_DIMS[q.dimension], `${q.id} 应归属现有能力维度`);
  assert.ok([1, 2, 3].includes(q.difficulty));
  assert.ok(['scenario', 'project', 'strategy'].includes(q.subtype));
  assert.ok(q.rubric.length >= 3 && q.rubric.length <= 5);
  assert.ok(q.rubric.every((point) => point.label && point.weight > 0));
  assert.ok(q.answerOutline && q.sourceRef.includes('核心 50 题'));
});
assert.equal(Lab.interviewSessionSize(), 20, '每次测评应抽取 20 题');

function assertSession(session) {
  assert.equal(session.length, 20);
  assert.equal(session.filter((q) => q.type === 'mcq').length, 12);
  assert.equal(session.filter((q) => q.type === 'open').length, 8);
  assert.deepEqual([1, 2, 3].map((d) => session.filter((q) => q.type === 'mcq' && q.difficulty === d).length), [3, 6, 3]);
  assert.deepEqual(['scenario', 'project', 'strategy'].map((t) => session.filter((q) => q.type === 'open' && q.subtype === t).length), [4, 2, 2]);
  const dimCounts = Object.values(session.reduce((out, q) => {
    out[q.dimension] = (out[q.dimension] || 0) + 1; return out;
  }, {}));
  assert.ok(dimCounts.length >= 6, '每轮至少覆盖六个维度');
  assert.ok(Math.max(...dimCounts) <= 4, '同一维度不能超过四题');
  session.filter((q) => q.type === 'mcq').forEach((q) => {
    assert.ok(q.options.length >= 3 && q.options.length <= 5);
    assert.equal(new Set(q.options.map((o) => o.id)).size, q.options.length);
    assert.ok(q.options.some((o) => o.id === q.correctOptionId));
  });
}

function finishPerfectSession() {
  while (!Lab.interview().completedAt) {
    const questions = Lab.interviewQuestions();
    const q = questions[Lab.interview().answers.length];
    if (q.type === 'mcq') {
      Lab.answerInterview(q.correctOptionId);
      const feedback = Lab.interview().feedback;
      assert.ok(feedback && feedback.correct && feedback.correctOptionText && feedback.explanation, '客观题答题后必须有完整解析');
      Lab.nextInterview();
    } else {
      const submitted = Lab.submitOpenAnswer('我会先给出结论，再说明判断依据、执行步骤、指标和风险处理。');
      assert.ok(!submitted.error);
      Lab.scoreOpenAnswer(q.rubric.map((r) => r.id));
    }
  }
}

const first = Lab.startInterview();
assertSession(first);
finishPerfectSession();
assert.equal(Lab.interview().result.score, 100);

const previousIds = new Set(first.map((q) => q.id));
const abandoned = Lab.startInterview();
const abandonedFirst = abandoned[0];
const statBefore = (Lab.interview().questionStats[abandonedFirst.variantGroup] || { attempts: 0 }).attempts;
if (abandonedFirst.type === 'mcq') Lab.answerInterview(abandonedFirst.correctOptionId);
else {
  Lab.submitOpenAnswer('我会先给出结论，再说明判断依据、执行步骤、指标和风险处理。');
  Lab.scoreOpenAnswer(abandonedFirst.rubric.map((r) => r.id));
}
assert.equal((Lab.interview().questionStats[abandonedFirst.variantGroup] || { attempts: 0 }).attempts, statBefore, '未完成测评不应提前计入题目统计');
assert.equal(Lab.abortInterview('exit'), true, '退出进行中的测评应作废本轮');
assert.equal(Lab.interview().startedAt, 0);
assert.equal(Lab.interview().answers.length, 0);
assert.equal(Lab.interview().lastAbortReason, 'exit');

const second = Lab.startInterview();
assertSession(second);
assert.equal(second.filter((q) => previousIds.has(q.id)).length, 0, '最近一轮原题不应重复');
assert.ok(second.filter((q) => q.review).length >= 6, '第二轮应包含已掌握知识点复测');
second.filter((q) => q.review).forEach((q) => assert.ok(!previousIds.has(q.id), '复测应优先使用不同原题'));
finishPerfectSession();

const result = Lab.interview().result;
assert.equal(result.total, 20);
assert.equal(result.types.mcq.max, 60);
assert.equal(result.types.open.max, 40);
assert.equal(result.reviewCorrect, result.reviewCount);

Lab.startInterview();
const refreshQuestion = Lab.interviewQuestions()[0];
if (refreshQuestion.type === 'mcq') Lab.answerInterview(refreshQuestion.correctOptionId);
const reloadContext = { window: { Mem: { state, save() {} } }, Math: seededMath, Date, Set, Map, console };
vm.createContext(reloadContext);
['assets/data-core.js', 'assets/data-adv.js', 'assets/data-pro.js', 'assets/data-pm.js', 'assets/data-extension.js', 'assets/data-materials.js', 'assets/data-long-memory.js', 'assets/practice.js', 'assets/interview-core50.js', 'assets/interview-bank.js', 'assets/option-refinements.js'].forEach((file) => {
  vm.runInContext(fs.readFileSync(path.join(__dirname, '..', file), 'utf8'), reloadContext, { filename: file });
});
const refreshed = reloadContext.window.Lab.interview();
assert.equal(refreshed.startedAt, 0, '刷新页面后进行中的测评必须重置');
assert.equal(refreshed.answers.length, 0, '刷新页面后不应保留未完成答案');
assert.equal(refreshed.sessionQuestions.length, 0, '刷新页面后应重新抽题');
assert.equal(refreshed.lastAbortReason, 'refresh');

console.log('interview randomization tests passed');
