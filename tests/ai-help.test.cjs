const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const files = name => fs.readFileSync(path.join(__dirname, '../assets', name + '.js'), 'utf8');
const context = { window: {} };
vm.createContext(context);
vm.runInContext(files('ai-help'), context);
const help = context.window.AIHelp;

const before = help.question({ kind: 'learning', id: 'rerank-1', termId: 'rerank', title: '重排序',
  prompt: '正确资料在候选第 14 位，模型只看前 5 位，应如何处理？',
  options: ['扩大召回', '重排候选', '提高温度'], answered: false,
  selectedText: '扩大召回', correctText: '重排候选', explanation: '先召回再重排', reason: '扩大召回不改前五名' });
assert.equal(before.answered, false);
assert.equal(before.correctText, undefined, '答题前上下文不能包含正解');
assert.equal(before.explanation, undefined, '答题前上下文不能包含解析');
assert(!help.system(before).includes('先召回再重排'));
assert(!help.offline(before).includes('重排候选'));
assert.match(help.system(before), /不要指出正确字母/);

const after = help.question({ kind: 'learning', id: 'rerank-1', termId: 'rerank', title: '重排序',
  prompt: before.prompt, options: before.options, answered: true,
  selectedText: '扩大召回', correctText: '重排候选', explanation: '先召回再重排', reason: '扩大召回不改前五名' });
assert.notEqual(before.scope, after.scope, '答前提示和答后解析必须隔离历史，避免复测泄题');
assert.match(help.system(after), /扩大召回不改前五名/);
assert.match(help.offline(after), /为什么不成立/);
const term = help.topic({ id: 'rerank', title: '重排序', summary: '对召回候选重新排序', detail: '企业知识问答' });
assert.match(help.system(term), /企业知识问答/);

let captured;
const encoder = new TextEncoder();
const llmContext = {
  window: { AIHelp: help, Mem: { memoryBrief() { return ''; }, chatHistory(scope) {
    assert.equal(scope, before.scope); return [];
  } } },
  localStorage: { getItem() { return JSON.stringify({ enabled: true, baseUrl: 'https://configured-provider.example/v1',
    apiKey: 'test-key', model: 'configured-model' }); } },
  fetch: async (_, options) => {
    captured = JSON.parse(options.body);
    let sent = false;
    return { ok: true, body: { getReader() { return { async read() {
      if (sent) return { done: true };
      sent = true;
      return { done: false, value: encoder.encode('data: {"choices":[{"delta":{"content":"先看资料进入上下文的顺序。"}}]}\n\n') };
    } }; } } };
  },
  TextDecoder, setTimeout, console
};
vm.createContext(llmContext);
vm.runInContext(files('llm'), llmContext);
let reply = '';
llmContext.window.LLM.ask('给我提示', { id: 'rerank', name: '重排序', one: '先召回再重排' },
  delta => { reply += delta; }, undefined, before).then(result => {
  assert.equal(result.mode, 'llm');
  assert.match(reply, /先看资料/);
  assert.equal(captured.model, 'configured-model', '应沿用用户已经配置的供应商模型');
  assert(!captured.messages[0].content.includes('先召回再重排'), '答前系统提示不得注入术语卡片正解');
  assert.match(captured.messages[0].content, /答题前辅导/);
  console.log('AI help: context isolation, no pre-answer leak, and configured-provider reuse validated');
}).catch(error => { console.error(error); process.exitCode = 1; });
