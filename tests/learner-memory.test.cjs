const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const state = { terms: { rag: { seen: 1, right: 0, wrong: 2, confused: 0, cleared: 0 } },
  quizVariants: { rag: { answered: { 'rag-source-1': { wrong: 2, lastAt: 100 } } } },
  syllabus: { learned: ['rag'], doneAt: { rag: 100 } }, spacedReview: {} };
let saves = 0;
const context = { window: { Mem: { state, save() { saves++; } } }, Math, Date, Set, Map, console };
vm.createContext(context);
for (const name of ['data-core', 'data-adv', 'data-pro', 'data-pm', 'data-extension', 'data-materials', 'data-long-memory', 'data-agent-hallucination',
  'interview-core50', 'term-quiz-short', 'spaced-review', 'learner-memory', 'learning-quiz']) {
  vm.runInContext(fs.readFileSync(path.join(__dirname, '../assets', name + '.js'), 'utf8'), context, { filename: name });
}
const { LearnerMemory, LearningQuiz, SpacedReview } = context.window;
LearnerMemory.initialize();
assert.equal(LearnerMemory.entries().find(x => x.termId === 'rag').wrong, 2, '旧错题次数应迁移，不伪造旧选项');
assert.equal(LearnerMemory.entries().find(x => x.termId === 'rag').recent.length, 0);
assert.ok(saves >= 1);
const q = LearningQuiz.bank('rag')[0];
const wrong = q.options.find(x => x.id !== q.correctOptionId);
LearnerMemory.recordAnswer(q, wrong.id, false, 'term');
LearnerMemory.recordAnswer(q, wrong.id, false, 'term');
const entry = LearnerMemory.entries().find(x => x.termId === 'rag');
assert.equal(entry.wrong, 4);
assert.equal(entry.recent.length, 2);
assert.equal(entry.recent[0].selectedText, wrong.text);
assert.equal(entry.recent[0].correctOptionId, q.correctOptionId);
assert.ok(entry.patterns.some(x => x.state === '重复出现'));
assert.equal(LearnerMemory.summary().repeatedPatterns >= 1, true);
LearnerMemory.mark('rag', 'not_yet');
assert.equal(LearnerMemory.status('rag').key, 'weak');
assert.ok(SpacedReview.status('rag').dueAt <= Date.now());
LearnerMemory.mark('rag', 'mastered');
assert.equal(LearnerMemory.status('rag').key, 'pending', '自评不能直接伪装为长期掌握');
SpacedReview.status('rag').successStreak = 2;
assert.equal(LearnerMemory.status('rag').key, 'mastered');
const base = Date.UTC(2026, 9, 1);
const patterns = LearnerMemory.buildPatterns([
  { id: 'w', termId: 'rag', variantType: 'scenario', correct: false, at: base, source: 'daily' },
  { id: 'r1', termId: 'rag', variantType: 'definition', correct: true, at: base + 86400000, source: 'spaced' },
  { id: 'r2', termId: 'rag', variantType: 'boundary', correct: true, at: base + 3 * 86400000, source: 'spaced' }
]);
assert.equal(patterns['rag|scenario'].state, '已通过跨日复测');
console.log('learner memory: legacy migration, evidence, repeated patterns, manual marks and cross-day correction validated');
