const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ctx = { window: { Mem: { state: {}, save() {}, completeDailyQuiz() {} } }, console };
vm.createContext(ctx);
['data-core', 'data-adv', 'data-pro', 'data-pm', 'data-extension', 'data-materials', 'data-long-memory', 'data-agent-hallucination', 'explanations', 'interview-core50', 'term-quiz-short', 'learning-quiz', 'practice', 'interview-bank', 'option-refinements'].forEach(file => {
  vm.runInContext(fs.readFileSync(path.join(__dirname, '../assets/' + file + '.js'), 'utf8'), ctx);
});
const { Explanations, LearningQuiz, TERMS, INTERVIEW_BANK } = ctx.window;
for (const term of TERMS) {
  for (const q of LearningQuiz.bank(term.id)) {
    for (const option of q.options) {
      if (option.id !== q.correctOptionId) assert(option.reason || option.peerTermId,
        q.id + '/' + option.id + ' 缺少逐项编写的误因或相邻概念来源');
      const detail = Explanations.learning(q, term, option.id);
      assert.equal(detail.questionId, q.id);
      assert.equal(detail.questionPrompt, q.prompt);
      assert(detail.correctReason.includes(q.options.find(o => o.id === q.correctOptionId).text),
        q.id + ' 正解解析未关联本题选项');
      assert(detail.teaching.summary && detail.teaching.analogy && detail.teaching.scenario, term.id + ' 缺少通俗解释和场景');
      assert(detail.teaching.steps.length >= 2, term.id + ' 缺少分步理解');
      assert.equal(detail.optionReviews.filter(x => x.selected).length, 1);
      assert.equal(detail.optionReviews.find(x => x.selected).id, option.id);
      assert(detail.selectedReason.length > 15, term.id + '/' + q.id + '/' + option.id + ' 缺少足够具体的解释');
      if (option.id !== q.correctOptionId) assert(!detail.selectedReason.startsWith('本题的判断依据是：'), q.id + ' 仍在复述通用模板');
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
      assert(!row.reason.startsWith('这项把判断重点放在'), q.id + ' 仍在使用旧的笼统解析');
      assert(option.reason, q.id + ' 重写选项缺少绑定到答案 ID 的专属理由');
    }
  }
}
const rerank = LearningQuiz.bank('rerank').find(q => q.id === 'rerank-source-1');
const wrongRerank = rerank.options.find(o => /温度|扩大召回/.test(o.text));
assert(wrongRerank && /召回|生成|排序|温度/.test(Explanations.learning(rerank, TERMS.find(t => t.id === 'rerank'), wrongRerank.id).selectedReason));
const generated = LearningQuiz.bank('rerank').find(q => q.id === 'rerank-generated-mechanism');
assert(generated.options.some(o => o.peerTermId), '生成题须保留干扰项来源，便于解释相邻概念');
const reversedGenerated = { ...generated, options: generated.options.slice().reverse() };
const reversedDetail = Explanations.learning(reversedGenerated, TERMS.find(t => t.id === 'rerank'), reversedGenerated.options[0].id);
assert.deepEqual(Array.from(reversedDetail.optionReviews.map(o => o.id)), Array.from(reversedGenerated.options.map(o => o.id)),
  '复盘时逐项解析顺序应与当时展示的变式题选项顺序一致');
const basicAi = LearningQuiz.bank('ai').find(q => q.id === 'ai-source-1');
assert.match(Explanations.learning(basicAi, TERMS.find(t => t.id === 'ai'), basicAi.options.find(o => /注册时间/.test(o.text)).id).selectedReason,
  /数据库.*精确字段/, '确定性查询与 AI 语义判断须解释具体差异');
const aiPitfall = LearningQuiz.bank('ai').find(q => q.id === 'ai-generated-pitfall');
const modelPitfall = aiPitfall.options.find(o => o.peerTermId === 'model');
const pitfallDetail = Explanations.learning(aiPitfall, TERMS.find(t => t.id === 'ai'), modelPitfall.id);
assert(pitfallDetail.selectedReason.includes(modelPitfall.text) &&
  pitfallDetail.selectedReason.includes(aiPitfall.options.find(o => o.id === aiPitfall.correctOptionId).text),
  '误区变式必须对照本题所选误区与正确误区，而不是只解释相邻概念定义');
assert(pitfallDetail.correctReason.includes('AI 不是万能胶'),
  '正确项原文与题库解释相同时，必须补充原因而不是重复答案');
for (const practice of ctx.window.PRACTICES) {
  const wrong = practice.decision.options.map((_, i) => i).filter(i => i !== practice.decision.a);
  for (const i of wrong) assert((practice.decision.reasons || {})[i]?.length > 15, practice.id + ' 实战误选缺少专属原因');
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
const bankQuestion = INTERVIEW_BANK.find(q => q.id === firstMcq.id);
assert(ctx.window.Lab.interview().feedback.selectedReason.includes(bankQuestion.options.find(o => o.id === wrongInterviewId).reason),
  '测评会话洗牌与重新载入后仍须使用新选项专属理由');
assert.equal(ctx.window.Lab.interview().answers[0].score, 0, '详解不应改变客观判分');
console.log('explanations: all learning questions and interview options have matched, detailed teaching');
