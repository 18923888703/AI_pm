const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const context = { window: { Mem: { state: {}, save() {} } }, Math, Date, Set, Map, console };
vm.createContext(context);
for (const name of ['data-core', 'data-adv', 'data-pro', 'data-pm', 'data-extension', 'data-materials',
  'data-long-memory', 'interview-core50', 'term-quiz-short', 'learning-quiz', 'knowledge-base', 'practice', 'interview-bank']) {
  vm.runInContext(fs.readFileSync(path.join(__dirname, '../assets', name + '.js'), 'utf8'), context, { filename: name });
}
const w = context.window;
assert.equal(w.LONG_MEMORY_TERM_IDS.length, 7);
assert.equal(new Set(w.LONG_MEMORY_TERM_IDS).size, 7);
for (const id of w.LONG_MEMORY_TERM_IDS) {
  const term = w.TERMS.find(x => x.id === id);
  assert.ok(term && term.optional && term.sourceRef.includes('第 '), `${id}: 应标注课件页码`);
  assert.deepEqual(Array.from(term.quiz.map(q => q.variantType)), ['definition', 'scenario', 'boundary']);
  assert.equal(term.quiz.length, 3);
  assert.ok(term.quiz.every(q => q.options.length === 3 && q.reasons.length === 3));
  assert.ok(w.LearningQuiz.bank(id).length >= 5);
  assert.ok(term.related.every(other => w.TERMS.some(x => x.id === other)));
}
assert.equal(w.KnowledgeBase.get('agent-long-memory').relatedTerms.length, 4);
assert.ok(w.PRACTICES.find(x => x.id === 'learning-memory-design'));
assert.equal(w.INTERVIEW_BANK.filter(x => x.id.startsWith('long-memory-')).length, 2);
console.log('long-memory content: 7 concepts, 21 authored questions, 1 topic, 1 lab and 2 interview cases validated');
