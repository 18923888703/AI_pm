const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const context = { window: { Mem: { state: {}, save() {} } }, Math, Date, Set, Map, console };
vm.createContext(context);
for (const name of ['data-core', 'data-adv', 'data-pro', 'data-pm', 'data-extension', 'data-materials',
  'interview-core50', 'term-quiz-short', 'explanations', 'learning-quiz', 'practice', 'interview-bank', 'option-refinements']) {
  vm.runInContext(fs.readFileSync(path.join(__dirname, '../assets', name + '.js'), 'utf8'), context, { filename: name });
}
const w = context.window;
assert.equal(Object.keys(w.TERM_QUIZ_SHORT).length, w.TERMS.length, '每个概念的产品与机制题都要有精简文案');
const pools = {
  learning: w.TERMS.flatMap(term => w.LearningQuiz.bank(term.id)),
  interview: w.INTERVIEW_BANK.filter(q => q.type === 'mcq'),
  practice: w.PRACTICES.map(p => ({ id: p.id, options: p.decision.options.map((text, i) => ({ id: String(i), text })),
    correctOptionId: String(p.decision.a) }))
};
assert.equal(pools.interview.length, 62);
assert.equal(pools.practice.length, 15);
for (const [name, questions] of Object.entries(pools)) {
  for (const q of questions) {
    assert.ok(q.options.length >= 3 && q.options.length <= 5, `${name}/${q.id}: 选项数`);
    const answer = q.options.find(o => o.id === q.correctOptionId);
    assert.ok(answer, `${name}/${q.id}: 稳定答案 ID`);
    const texts = q.options.map(o => o.text);
    assert.equal(new Set(texts).size, texts.length, `${name}/${q.id}: 选项不能重复`);
    const lengths = texts.map(text => text.length);
    assert.ok(Math.min(...lengths) >= 6, `${name}/${q.id}: 存在过短选项`);
    assert.ok(Math.max(...lengths) <= 65, `${name}/${q.id}: 存在过长选项`);
    assert.ok(Math.max(...lengths) / Math.min(...lengths) <= (name === 'learning' ? 2.2 : 2),
      `${name}/${q.id}: 选项长度差异过大`);
  }
}
for (const [poolName, overrides] of Object.entries(w.OPTION_REFINEMENTS)) {
  const questions = pools[poolName];
  for (const [id, texts] of Object.entries(overrides)) {
    const q = questions.find(item => item.id === id);
    assert.ok(q, `${poolName}/${id}: 覆写题必须存在`);
    assert.equal(q.options.length, texts.length, `${poolName}/${id}: 覆写选项数必须匹配`);
    assert.equal(q.options.find(o => o.id === q.correctOptionId).text, texts[0], `${poolName}/${id}: 正确项不能错位`);
  }
}
const contextQ = pools.interview.find(q => q.id === 'foundation-context-a');
const wrong = contextQ.options.find(o => o.id !== contextQ.correctOptionId);
const detail = w.Explanations.interview(contextQ, wrong.id);
assert.ok(detail.selectedReason.includes(wrong.text), '改写后的解析必须引用新选项，不能套用旧选项理由');
console.log('option quality: 454 learning, 62 interview and 15 practice questions validated');
