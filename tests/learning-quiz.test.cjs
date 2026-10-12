const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

let seed = 17;
const seededMath = Object.create(Math);
seededMath.random = () => ((seed = (seed * 1103515245 + 12345) >>> 0) / 0x100000000);
const state = {};
const context = { window: {}, Math: seededMath, Date, Set, Map, console };
vm.createContext(context);
['assets/data-core.js', 'assets/data-adv.js', 'assets/data-pro.js', 'assets/data-pm.js'].forEach((file) => {
  vm.runInContext(fs.readFileSync(path.join(__dirname, '..', file), 'utf8'), context, { filename: file });
});
context.window.Mem = { state, save() {}, completeDailyQuiz() {} };
vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'assets/learning-quiz.js'), 'utf8'), context, { filename: 'assets/learning-quiz.js' });

context.window.TERMS.forEach((term) => {
  const bank = context.window.LearningQuiz.bank(term.id);
  assert.equal(bank.length, 3, `${term.id} 应有三道变式题`);
  bank.forEach((q) => {
    assert.ok(q.options.length >= 3 && q.options.length <= 5);
    assert.equal(new Set(q.options.map((o) => o.id)).size, q.options.length);
    assert.ok(q.options.some((o) => o.id === q.correctOptionId));
  });
});

const first = context.window.LearningQuiz.pick('rerank');
assert.ok(first);
const firstFeedback = context.window.LearningQuiz.answer('rerank', first.id, first.correctOptionId);
assert.equal(firstFeedback.correct, true);
assert.ok(firstFeedback.selectedOptionText && firstFeedback.correctOptionText && firstFeedback.explanation);
assert.ok(firstFeedback.conceptSummary && firstFeedback.pmView, '学习题解析应包含概念总结与产品应用');
const second = context.window.LearningQuiz.pick('rerank');
assert.notEqual(second.id, first.id, '答对后应切换到另一道变式题');
assert.equal(second.review, true);

const daily = context.window.LearningQuiz.startDaily(['rag', 'rerank']);
assert.equal(daily.questions.length, 2);
while (!context.window.LearningQuiz.daily().completedAt) {
  const q = context.window.LearningQuiz.dailyQuestion();
  const order = q.options.map((o) => o.id);
  context.window.LearningQuiz.answerDaily(q.correctOptionId);
  assert.ok(context.window.LearningQuiz.daily().feedback);
  assert.deepEqual(context.window.LearningQuiz.dailyQuestion().options.map((o) => o.id), order, '反馈态不应打乱选项位置');
  context.window.LearningQuiz.nextDaily();
}
assert.equal(context.window.LearningQuiz.dailyResult().score, 100);

console.log('learning quiz tests passed');
