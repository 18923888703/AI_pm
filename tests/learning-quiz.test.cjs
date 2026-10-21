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
['assets/data-core.js', 'assets/data-adv.js', 'assets/data-pro.js', 'assets/data-pm.js', 'assets/data-extension.js', 'assets/interview-core50.js'].forEach((file) => {
  vm.runInContext(fs.readFileSync(path.join(__dirname, '..', file), 'utf8'), context, { filename: file });
});
const reviewEvents = [];
context.window.Mem = { state, save() {}, completeDailyQuiz() {}, quiz(id, cat, correct) { reviewEvents.push({ id, cat, correct }); } };
vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'assets/explanations.js'), 'utf8'), context, { filename: 'assets/explanations.js' });
vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'assets/learning-quiz.js'), 'utf8'), context, { filename: 'assets/learning-quiz.js' });

context.window.TERMS.forEach((term) => {
  const bank = context.window.LearningQuiz.bank(term.id);
  assert.ok(bank.length >= 5, `${term.id} 应保留至少五道变式题`);
  assert.equal(new Set(bank.map((q) => q.id)).size, bank.length, `${term.id} 题目 ID 不应重复`);
  bank.forEach((q) => {
    assert.ok(q.options.length >= 3 && q.options.length <= 5);
    assert.equal(new Set(q.options.map((o) => o.id)).size, q.options.length);
    assert.ok(q.options.some((o) => o.id === q.correctOptionId));
  });
});

assert.equal(context.window.CORE50_DAILY.length, 29, '应有 29 道日常场景变式');
context.window.CORE50_DAILY.forEach((q) => {
  assert.ok(context.window.TERMS.some((term) => term.id === q.termId), `${q.id} 必须关联现有知识点`);
  assert.ok(context.window.LearningQuiz.bank(q.termId).some((item) => item.id === q.id), `${q.id} 应进入随机题池`);
  assert.ok(q.options.every((option) => option.id === q.correctOptionId || option.reason), `${q.id} 错误选项需要逐项解释`);
});

const coreQuestion = context.window.CORE50_DAILY[0];
const coreWrong = coreQuestion.options.find((option) => option.id !== coreQuestion.correctOptionId);
const coreFeedback = context.window.LearningQuiz.answer(coreQuestion.termId, coreQuestion.id, coreWrong.id);
assert.equal(coreFeedback.correct, false);
assert.equal(coreFeedback.selectedOptionText, coreWrong.text);
assert.ok(coreFeedback.explanation);
assert.equal(coreFeedback.selectedReason, coreWrong.reason, '错选项应给出针对性原因');

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
  const lastQuestion = context.window.LearningQuiz.daily().responses.length + 1 === context.window.LearningQuiz.daily().questions.length;
  context.window.LearningQuiz.answerDaily(q.correctOptionId);
  assert.ok(context.window.LearningQuiz.daily().feedback);
  if (lastQuestion) {
    assert.ok(context.window.LearningQuiz.daily().completedAt, '最后一题答完应立即完成测评');
    assert.equal(context.window.LearningQuiz.dailyResult().score, 100, '无需额外点击即可显示评分');
  } else {
    assert.equal(context.window.LearningQuiz.dailyResult(), null, '全部答完前不应出现评分');
  }
  assert.deepEqual(context.window.LearningQuiz.dailyQuestion().options.map((o) => o.id), order, '反馈态不应打乱选项位置');
  context.window.LearningQuiz.nextDaily();
}
assert.equal(context.window.LearningQuiz.dailyResult().score, 100);
state.dailyLearning.completedAt = 0;
state.dailyLearning.result = null;
state.dailyLearning.feedback = { termId: 'rerank', questionId: state.dailyLearning.questions[1].questionId };
assert.equal(context.window.LearningQuiz.dailyResult().score, 100, '旧版停在最后一题解析时，升级后应直接完成评分');
state.dailyLearning.feedback = null;

const practice = context.window.LearningQuiz.startPractice(['rag', 'rerank']);
assert.equal(practice.questions.length, 4, '两个知识点应各抽两道不同变式题');
['rag', 'rerank'].forEach((id) => {
  const refs = practice.questions.filter((q) => q.termId === id);
  assert.equal(new Set(refs.map((q) => q.questionId)).size, 2, '本轮原题不应重复');
  assert.equal(new Set(refs.map((q) => context.window.LearningQuiz.bank(id).find((x) => x.id === q.questionId).variantType)).size, 2);
});
let practiceAnswered = 0;
while (!context.window.LearningQuiz.practice().completedAt) {
  const q = context.window.LearningQuiz.practiceQuestion();
  const chosen = practiceAnswered === 0 ? q.options.find((o) => o.id !== q.correctOptionId).id : q.correctOptionId;
  const lastQuestion = context.window.LearningQuiz.practice().responses.length + 1 === context.window.LearningQuiz.practice().questions.length;
  const feedback = context.window.LearningQuiz.answerPractice(chosen);
  assert.ok(feedback && feedback.explanation && feedback.correctOptionText);
  if (lastQuestion) {
    assert.ok(context.window.LearningQuiz.practice().completedAt, '巩固练习最后一题应立即出分');
    assert.equal(context.window.LearningQuiz.practice().result.score, 75);
  }
  assert.equal(context.window.LearningQuiz.practiceQuestion().id, q.id, '解析时不应跳到下一题');
  context.window.LearningQuiz.nextPractice();
  practiceAnswered++;
}
assert.equal(context.window.LearningQuiz.practice().result.score, 75);
assert.equal(context.window.LearningQuiz.dailyResult().score, 100, '追加练习不能修改今日掌握度');
assert.equal(reviewEvents.length, 4, '追加练习应计入知识点记忆');
const sevenWeak = context.window.LearningQuiz.startPractice(['ai', 'model', 'llm', 'token', 'prompt', 'context', 'hallucination']);
assert.equal(sevenWeak.questions.length, 14, '每个薄弱知识点都应获得两道新练习题');

const focusedDaily = context.window.LearningQuiz.startDaily(['ai', 'model']);
while (!context.window.LearningQuiz.daily().completedAt) {
  const q = context.window.LearningQuiz.dailyQuestion();
  const selected = q.termId === 'ai' ? q.options.find((o) => o.id !== q.correctOptionId).id : q.correctOptionId;
  context.window.LearningQuiz.answerDaily(selected);
  context.window.LearningQuiz.nextDaily();
}
let progress = context.window.LearningQuiz.reinforcementProgress();
assert.deepEqual(Array.from(progress.wrongIds), ['ai']);
assert.equal(progress.completedRounds, 0);
assert.equal(progress.verified, false);

const firstRound = context.window.LearningQuiz.startPractice(['ai'], { sourceDailyDate: focusedDaily.date });
while (!context.window.LearningQuiz.practice().completedAt) {
  const q = context.window.LearningQuiz.practiceQuestion();
  context.window.LearningQuiz.answerPractice(q.correctOptionId);
  context.window.LearningQuiz.nextPractice();
}
progress = context.window.LearningQuiz.reinforcementProgress();
assert.equal(progress.completedRounds, 1);
assert.equal(progress.verified, false, '只做一轮不应产生两轮巩固分');

const secondRound = context.window.LearningQuiz.startPractice(['ai'], { sourceDailyDate: focusedDaily.date });
assert.notEqual(secondRound.id, firstRound.id);
assert.equal(new Set(firstRound.questions.concat(secondRound.questions).map((q) => q.questionId)).size, 4,
  '第二轮应优先抽不同变式');
let answered = 0;
while (!context.window.LearningQuiz.practice().completedAt) {
  const q = context.window.LearningQuiz.practiceQuestion();
  context.window.LearningQuiz.answerPractice(answered++ ? q.correctOptionId : q.options.find((o) => o.id !== q.correctOptionId).id);
  context.window.LearningQuiz.nextPractice();
}
progress = context.window.LearningQuiz.reinforcementProgress();
assert.equal(progress.completedRounds, 2);
assert.equal(progress.verified, true);
assert.equal(progress.score, 75);
assert.deepEqual(Array.from(progress.needsWork), ['ai']);
assert.equal(state.practiceRounds.length, 3, '已完成轮次应单独保存且不重复写入');

state.practiceRounds = [];
state.learningPractice = JSON.parse(JSON.stringify(firstRound));
delete state.learningPractice.id;
delete state.learningPractice.sourceDailyDate;
assert.equal(context.window.LearningQuiz.reinforcementProgress().completedRounds, 1,
  '旧版已完成的当天错题巩固应迁移为第一轮');
context.window.LearningQuiz.reinforcementProgress();
assert.equal(state.practiceRounds.length, 1, '反复读取旧记录不能重复计算巩固轮次');
state.practiceRounds[0].date = '2000-1-1';
assert.equal(context.window.LearningQuiz.reinforcementProgress().completedRounds, 0,
  '其他日期的巩固记录不能计入今天');

console.log('learning quiz tests passed');
