const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const context = { window: {}, console };
vm.createContext(context);
[
  'assets/data-core.js',
  'assets/data-adv.js',
  'assets/data-pro.js',
  'assets/data-pm.js',
  'assets/data-extension.js',
  'assets/data-materials.js',
  'assets/data-long-memory.js',
  'assets/curriculum.js'
].forEach((file) => {
  vm.runInContext(fs.readFileSync(path.join(__dirname, '..', file), 'utf8'), context, { filename: file });
});

const terms = context.window.TERMS;
assert.equal(terms.length, 92, '应包含 61 个主课知识点与 31 个延伸知识点');
assert.equal(terms.filter((t) => !t.optional).length, 61);
assert.equal(context.window.Curriculum.extension.length, 31);
assert.equal(new Set(terms.map((t) => t.id)).size, terms.length, '知识点 ID 不应重复');

const rerank = terms.find((t) => t.id === 'rerank');
assert.ok(rerank, '应存在 Rerank 知识点');
assert.equal(rerank.quiz.length, 2, 'Rerank 应包含两道小测');
assert.ok(rerank.steps.length >= 4 && rerank.pitfalls.length >= 4, 'Rerank 内容应覆盖链路与常见误区');

const evaluation = terms.find((t) => t.id === 'eval');
assert.ok(evaluation && evaluation.name.includes('Eval'), '应存在 Eval 工程体系知识点');
assert.ok(evaluation.steps.length >= 6 && evaluation.pitfalls.length >= 4, 'Eval 应覆盖评估集、评分、报告、CI 与反馈闭环');
assert.ok(evaluation.related.includes('goldenset') && evaluation.related.includes('llmjudge') && evaluation.related.includes('rollout'));

const ids = new Set(terms.map((t) => t.id));
terms.forEach((term) => {
  (term.related || []).forEach((id) => assert.ok(ids.has(id), `${term.id} 关联了不存在的概念：${id}`));
  assert.ok(term.one && term.analogy && term.example && term.pm && term.steps.length >= 2 && term.quiz.length,
    `${term.id} 的讲解或自测不完整`);
});
context.window.Curriculum.lessons.forEach((lesson) => {
  lesson.ids.forEach((id) => {
    assert.ok(ids.has(id), `课程引用了不存在的知识点：${id}`);
    assert.ok(!terms.find((t) => t.id === id).optional, `延伸知识不应改变既有主课：${id}`);
  });
});
assert.ok(context.window.Curriculum.lessons.some((lesson) => lesson.kind === 'lesson' && lesson.ids.includes('rerank')));
assert.ok(context.window.Curriculum.lessons.some((lesson) => lesson.kind === 'checkpoint' && lesson.ids.includes('rerank')));

console.log('course integrity tests passed');
