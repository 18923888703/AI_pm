const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const context = { window: { Mem: { state: {}, save() {}, completeDailyQuiz() {} } }, Math, Date, Set, Map, console };
vm.createContext(context);
for (const name of ['data-core', 'data-adv', 'data-pro', 'data-pm', 'data-extension', 'data-materials',
  'data-long-memory', 'data-agent-hallucination', 'curriculum', 'knowledge-base', 'knowledge-relations',
  'explanations', 'interview-core50', 'term-quiz-short', 'learning-quiz', 'practice', 'practice-coach', 'interview-bank']) {
  vm.runInContext(fs.readFileSync(path.join(__dirname, '../assets', name + '.js'), 'utf8'), context, { filename: name });
}
const w = context.window;
const term = w.TERMS.find(x => x.id === 'agenthallucination');
assert(term && term.optional && term.steps.length === 5);
assert.deepEqual(Array.from(term.quiz.map(q => q.variantType)), ['definition', 'scenario', 'boundary']);
assert(term.related.includes('hallucination') && term.related.includes('observability'));
assert(w.Curriculum.extension.some(x => x.id === term.id));
assert(w.KnowledgeRelations.forTerm(term.id).prerequisite.length >= 1);
const questions = w.LearningQuiz.bank(term.id);
assert.equal(questions.length, 5, '题池应保留三道人工题，并按单知识点上限补入生成变式');
for (const q of questions) {
  assert(q.options.length >= 3 && q.options.length <= 5);
  assert.equal(new Set(q.options.map(o => o.id)).size, q.options.length);
  assert(q.options.some(o => o.id === q.correctOptionId));
  for (const option of q.options) {
    const explanation = w.Explanations.learning(q, term, option.id);
    assert.equal(explanation.questionId, q.id);
    assert(explanation.correctReason.length > 25);
    if (option.id !== q.correctOptionId) assert(explanation.selectedReason.length > 15);
  }
}
for (const q of questions.filter(q => q.id.includes('-source-'))) {
  assert(q.options.every(o => o.reason && o.reason.length > 20));
  const wrong = q.options.find(o => o.id !== q.correctOptionId);
  assert.equal(w.LearningQuiz.answer(term.id, q.id, wrong.id).correct, false);
  assert.equal(w.LearningQuiz.answer(term.id, q.id, q.correctOptionId).correct, true);
}
const topic = w.KnowledgeBase.get('agent-hallucination-governance');
assert(topic && topic.relatedTerms.includes(term.id));
assert(w.KnowledgeBase.forTerm(term.id).some(x => x.id === topic.id));
const practice = w.Lab.exercise('agent-hallucination-governance');
assert(practice && practice.checkpoints.length === 4 && practice.reference.length === 4);
assert.equal(w.PracticeCoach.examples(practice.id).length, 2);
const interview = w.INTERVIEW_BANK.find(q => q.id === 'agent-hallucination-governance-open');
assert(interview && interview.rubric.length === 4 && interview.answerOutline);
assert.equal(w.TERMS.length, 93);
assert.equal(w.KNOWLEDGE_BASE.length, 35);
assert.equal(w.PRACTICES.length, 17);
assert.equal(w.INTERVIEW_BANK.length, 153);
console.log('agent hallucination content: concept, variants, explanations, map, topic, practice and interview validated');
