const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ctx = { window: { Mem: { state: {}, save() {}, completeDailyQuiz() {} } }, console };
vm.createContext(ctx);
['data-core', 'data-adv', 'data-pro', 'data-pm', 'data-extension', 'data-materials', 'data-long-memory', 'explanations', 'interview-core50', 'term-quiz-short', 'learning-quiz', 'practice', 'interview-bank', 'option-refinements'].forEach(file => {
  vm.runInContext(fs.readFileSync(path.join(__dirname, '../assets/' + file + '.js'), 'utf8'), ctx);
});
const { Explanations, LearningQuiz, TERMS, INTERVIEW_BANK } = ctx.window;
for (const term of TERMS) {
  for (const q of LearningQuiz.bank(term.id)) {
    for (const option of q.options) {
      const detail = Explanations.learning(q, term, option.id);
      assert(detail.teaching.summary && detail.teaching.analogy && detail.teaching.scenario, term.id + ' 缺少通俗解释和场景');
      assert(detail.teaching.steps.length >= 2, term.id + ' 缺少分步理解');
      assert.equal(detail.optionReviews.filter(x => x.selected).length, 1);
      assert.equal(detail.optionReviews.find(x => x.selected).id, option.id);
      assert(detail.selectedReason.length > 15, term.id + '/' + q.id + '/' + option.id + ' 缺少足够具体的解释');
    }
  }
}
for (const q of INTERVIEW_BANK.filter(x => x.type === 'mcq')) {
  const shuffled = { ...q, options: q.options.slice().reverse() };
  for (const option of q.options) {
    const detail = Explanations.interview(shuffled, option.id);
    assert(detail.teaching && detail.teaching.scenario && detail.teaching.steps.length >= 2, q.id + ' 缺少概念详解');
    const row = detail.optionReviews.find(x => x.selected);
    assert.equal(row.id, option.id);
    assert.equal(row.correct, option.id === q.correctOptionId);
    if (!row.correct) {
      assert.notEqual(row.reason, q.explanation, q.id + ' 错误选项没有专属解释');
      assert(row.reason.length > 20, q.id + ' 错误选项解释过于简短');
    }
  }
}
const question = LearningQuiz.pick('rerank');
const wrongId = question.options.find(o => o.id !== question.correctOptionId).id;
const feedback = LearningQuiz.answer('rerank', question.id, wrongId);
assert.equal(feedback.correct, false);
assert(feedback.selectedReason && feedback.teaching && feedback.optionReviews);
const unchanged = ctx.window.Mem.state.quizVariants.rerank.wrong;
assert.equal(LearningQuiz.answer('rerank', question.id, 'nonexistent-option'), null);
assert.equal(ctx.window.Mem.state.quizVariants.rerank.wrong, unchanged);
ctx.window.Lab.startInterview();
const session = ctx.window.Lab.interview();
const mcqIndex = session.sessionQuestions.findIndex(q => q.type === 'mcq');
const firstMcq = session.sessionQuestions.splice(mcqIndex, 1)[0];
session.sessionQuestions.unshift(firstMcq);
const wrongInterviewId = firstMcq.options.find(o => o.id !== firstMcq.correctOptionId).id;
ctx.window.Lab.answerInterview(wrongInterviewId);
assert.equal(ctx.window.Lab.interview().feedback.correct, false);
assert(ctx.window.Lab.interview().feedback.teaching && ctx.window.Lab.interview().feedback.selectedReason);
assert.equal(ctx.window.Lab.interview().answers[0].score, 0, '详解不应改变客观判分');
console.log('explanations: all learning questions and interview options have matched, detailed teaching');
