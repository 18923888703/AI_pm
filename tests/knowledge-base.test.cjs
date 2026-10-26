const assert = require('assert');
const fs = require('fs');
const vm = require('vm');

const context = { window: {} };
vm.createContext(context);
['data-core.js', 'data-adv.js', 'data-pro.js', 'data-pm.js', 'data-extension.js', 'data-materials.js', 'data-long-memory.js', 'data-agent-hallucination.js', 'knowledge-base.js'].forEach((file) => {
  vm.runInContext(fs.readFileSync('assets/' + file, 'utf8'), context, { filename: file });
});

const terms = context.window.TERMS;
const topics = context.window.KNOWLEDGE_BASE;
const ids = new Set();
const termIds = new Set(terms.map((x) => x.id));

assert(topics.length >= 25, '知识库专题数量不足');
assert.equal(context.window.KnowledgeBase.categories().length, 8, '知识库应保持八类能力结构');
topics.forEach((topic) => {
  assert(topic.id && !ids.has(topic.id), '专题 ID 缺失或重复：' + topic.id);
  ids.add(topic.id);
  assert(topic.title && topic.category && topic.summary && topic.application, '专题基础字段不完整：' + topic.id);
  assert(Array.isArray(topic.keyPoints) && topic.keyPoints.length === 3, '专题必须有 3 个理解抓手：' + topic.id);
  assert(Array.isArray(topic.relatedTerms) && topic.relatedTerms.length >= 3, '专题课程关联不足：' + topic.id);
  topic.relatedTerms.forEach((id) => assert(termIds.has(id), '专题关联了不存在的概念：' + topic.id + ' -> ' + id));
});

const evalEngineering = context.window.KnowledgeBase.get('eval-engineering');
assert(evalEngineering && evalEngineering.relatedTerms.includes('eval'), '应包含 Eval 工程体系专题并关联核心课程');

terms.forEach((term) => {
  const related = context.window.KnowledgeBase.forTerm(term.id);
  assert(related.length <= 6, '单个知识点专题延伸过多：' + term.id);
});

console.log('knowledge-base: ' + topics.length + ' topics, schema and term links valid');
