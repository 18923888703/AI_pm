const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const context = { window: { Mem: { state: {}, save() {}, completeDailyQuiz() {} } }, Math, Date, Set, Map, console };
vm.createContext(context);
for (const name of ['data-core', 'data-adv', 'data-pro', 'data-pm', 'data-extension', 'data-materials',
  'data-long-memory', 'data-agent-hallucination', 'data-memory-workflow', 'data-model-growth', 'curriculum',
  'knowledge-base', 'knowledge-relations', 'explanations', 'interview-core50', 'term-quiz-short',
  'learning-quiz', 'practice', 'practice-coach', 'interview-bank']) {
  vm.runInContext(fs.readFileSync(path.join(__dirname, '../assets', name + '.js'), 'utf8'), context, { filename: name });
}
const w = context.window;
const newIds = w.MEMORY_WORKFLOW_TERM_IDS.concat(w.MODEL_GROWTH_TERM_IDS);
assert.equal(newIds.length, 7);
assert.equal(new Set(newIds).size, 7);
assert.equal(w.TERMS.length, 100);
assert.equal(w.TERMS.filter(x => !x.optional).length, 61, '新内容不改变主课进度分母');
assert.equal(w.Curriculum.extension.length, 39);
assert.equal(w.KNOWLEDGE_BASE.length, 38);
assert.equal(w.PRACTICES.length, 20);
assert.equal(w.INTERVIEW_BANK.length, 156);
for (const id of newIds) {
  const term = w.TERMS.find(x => x.id === id);
  assert(term && term.optional && term.sourceRef.includes('第 '), id + ': 来源与页码缺失');
  assert.deepEqual(Array.from(term.quiz.map(q => q.variantType)), ['definition', 'scenario', 'boundary']);
  assert.ok(term.quiz.every(q => q.options.length === 3 && q.reasons.every(reason => reason.length > 18)));
  assert.ok(term.related.every(other => w.TERMS.some(x => x.id === other)), id + ': 关联知识缺失');
  assert.ok(w.KnowledgeBase.forTerm(id).length, id + ': 未进入专题知识库');
  const bank = w.LearningQuiz.bank(id);
  assert.equal(bank.length, 5, id + ': 变式题池数量');
  for (const question of bank.filter(q => q.id.includes('-source-'))) {
    const wrong = question.options.find(option => option.id !== question.correctOptionId);
    const detail = w.Explanations.learning(question, term, wrong.id);
    assert.equal(detail.questionPrompt, question.prompt);
    assert.ok(detail.selectedReason.length > 18 && detail.correctReason.includes(question.options.find(o => o.id === question.correctOptionId).text));
    assert.equal(w.LearningQuiz.answer(id, question.id, wrong.id).correct, false);
    assert.equal(w.LearningQuiz.answer(id, question.id, question.correctOptionId).correct, true);
  }
}
for (const topic of w.MEMORY_WORKFLOW_TOPICS.concat(w.MODEL_GROWTH_TOPICS)) {
  assert.equal(topic.keyPoints.length, 3);
  assert(topic.sourceRef && topic.relatedTerms.length >= 4);
  assert(w.KnowledgeBase.get(topic.id));
}
for (const practice of w.MEMORY_WORKFLOW_PRACTICES.concat(w.MODEL_GROWTH_PRACTICES)) {
  assert(w.Lab.exercise(practice.id));
  assert.equal(w.PracticeCoach.examples(practice.id).length, 2);
  assert.equal(practice.rubric.length, 4);
  assert(practice.reference.length >= 4 && practice.decision.options.length === 4);
  assert.equal(Object.keys(practice.decision.reasons).length, 3);
}
for (const question of w.MEMORY_WORKFLOW_INTERVIEW.concat(w.MODEL_GROWTH_INTERVIEW)) {
  assert(w.INTERVIEW_BANK.some(x => x.id === question.id));
  assert.equal(question.rubric.length, 4);
  assert(question.answerOutline && question.sourceRef);
}
assert(w.TERMS.find(x => x.id === 'cacltv').example.includes('81 元'), '四个月示例应修正课件中的月份口径');
console.log('new course content: 7 concepts, 21 authored questions, 3 topics, 3 practices and 3 interviews validated');
