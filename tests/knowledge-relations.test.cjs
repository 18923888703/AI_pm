const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const context = { window: {}, console };
vm.createContext(context);
[
  'assets/data-core.js', 'assets/data-adv.js', 'assets/data-pro.js', 'assets/data-pm.js',
  'assets/curriculum.js', 'assets/knowledge-relations.js'
].forEach((file) => {
  vm.runInContext(fs.readFileSync(path.join(__dirname, '..', file), 'utf8'), context, { filename: file });
});

const ids = new Set(context.window.TERMS.map((t) => t.id));
context.window.TERMS.forEach((term) => {
  const quick = context.window.KnowledgeRelations.quick(term.id);
  assert.ok(quick && quick.meaning && quick.useWhen && quick.scenario, `${term.id} 应有快速理解内容`);
  const groups = context.window.KnowledgeRelations.forTerm(term.id);
  const relations = [].concat(groups.prerequisite, groups.companion, groups.extension);
  assert.ok(relations.length >= 2, `${term.id} 至少应有两个关联知识点`);
  assert.equal(new Set(relations.map((r) => r.id)).size, relations.length, `${term.id} 的关联不应重复`);
  relations.forEach((r) => {
    assert.ok(ids.has(r.id) && r.id !== term.id);
    assert.ok(r.name && r.one && r.reason);
  });
});

console.log('knowledge relation tests passed');
