const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
let seed = 28;
const rng = Object.create(Math);
rng.random = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);
const context = { window: { Mem: { state: {}, save() {}, completeDailyQuiz() {}, quiz() {} } }, Math: rng, Date, Set, Map, console };
vm.createContext(context);
for (const file of ['data-core', 'data-adv', 'data-pro', 'data-pm', 'data-extension', 'data-materials', 'data-long-memory', 'curriculum',
  'knowledge-base', 'explanations', 'interview-core50', 'learning-quiz', 'practice', 'interview-bank']) {
  vm.runInContext(fs.readFileSync(path.join(__dirname, '../assets/' + file + '.js'), 'utf8'), context, { filename: file });
}
const w = context.window;
assert.equal(w.MATERIAL_TERM_IDS.length, 9);
assert.equal(w.TERMS.length, 92);
assert.equal(w.TERMS.filter(t => !t.optional).length, 61);
assert.equal(w.Curriculum.real.length, 30, '新增资料不改变主课顺序');
assert.equal(w.KNOWLEDGE_BASE.length, 34);
assert.equal(w.PRACTICES.length, 16);
assert.equal(w.INTERVIEW_BANK.length, 152);
assert.equal(new Set(w.INTERVIEW_BANK.map(q => q.id)).size, w.INTERVIEW_BANK.length);
let authoredCount = 0;
for (const id of w.MATERIAL_TERM_IDS) {
  const term = w.TERMS.find(t => t.id === id);
  assert.ok(term.optional && term.sourceRef.includes('页'));
  assert.deepEqual(Array.from(term.quiz.map(q => q.variantType)), ['definition', 'scenario', 'boundary']);
  const authored = w.LearningQuiz.bank(id).filter(q => q.id.startsWith(id + '-source-'));
  assert.equal(authored.length, 3, `${id} 的三种人工编写问法都要进入题池`);
  authoredCount += authored.length;
  for (const question of authored) {
    assert.ok(question.options.length >= 3 && question.options.length <= 5);
    assert.equal(new Set(question.options.map(o => o.text)).size, question.options.length);
    assert.ok(question.options.every(o => o.reason && o.reason.length > 15));
    const wrong = question.options.find(o => o.id !== question.correctOptionId);
    const feedback = w.LearningQuiz.answer(id, question.id, wrong.id);
    assert.equal(feedback.correct, false);
    assert.equal(feedback.selectedReason, wrong.reason);
    assert.equal(w.LearningQuiz.answer(id, question.id, question.correctOptionId).correct, true);
  }
  assert.ok(w.KnowledgeBase.forTerm(id).length, `${id} 应能回到资料专题`);
}
assert.equal(authoredCount, 27);
for (const topic of w.MATERIAL_TOPICS) {
  assert.equal(w.KnowledgeBase.get(topic.id).sourceRef, topic.sourceRef);
  assert.equal(topic.keyPoints.length, 3);
  assert.ok(topic.relatedTerms.every(id => w.TERMS.some(t => t.id === id)));
}
for (const exercise of w.MATERIAL_PRACTICES) {
  assert.ok(w.Lab.exercise(exercise.id));
  assert.ok(exercise.task && exercise.reference.length >= 4 && exercise.rubric.length >= 3);
  assert.ok(exercise.decision.options[exercise.decision.a]);
  assert.ok(exercise.related.every(id => w.TERMS.some(t => t.id === id)));
}
const observed = new Set();
for (let i = 0; i < 100; i++) {
  const questions = w.Lab.startInterview();
  assert.equal(questions.length, 20);
  assert.equal(questions.filter(q => q.type === 'mcq').length, 12);
  assert.equal(questions.filter(q => q.type === 'open').length, 8);
  questions.filter(q => q.id.startsWith('material-')).forEach(q => observed.add(q.id));
  w.Lab.abortInterview('test');
}
assert.equal(observed.size, 6, '新增面试题应实际参与随机抽样');
w.LearningQuiz.startDaily(w.MATERIAL_TERM_IDS);
while (!w.LearningQuiz.daily().completedAt) {
  const question = w.LearningQuiz.dailyQuestion();
  w.LearningQuiz.answerDaily(question.correctOptionId);
  w.LearningQuiz.nextDaily();
}
assert.equal(w.LearningQuiz.dailyResult().score, 100, '新知识点应复用同一判分流程');
console.log('materials: 9 concepts, 27 authored questions, 3 topics, 3 practices, 6 interview questions validated');
