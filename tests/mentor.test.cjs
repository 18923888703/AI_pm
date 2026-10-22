const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const state = { terms: {}, mentor: { signals: [], summary: null, supplements: {} } };
let saves = 0;
const browserStorage = new Map();
const context = {
  window: {}, console, Date, Math, Set, Map, Promise, setTimeout,
  localStorage: {
    getItem(key) { return browserStorage.get(key) || null; },
    setItem(key, value) { browserStorage.set(key, String(value)); }
  }
};
vm.createContext(context);
for (const file of ['data-core', 'data-adv', 'data-pro', 'data-pm', 'data-extension', 'curriculum', 'knowledge-relations']) {
  vm.runInContext(fs.readFileSync(path.join(__dirname, '../assets/' + file + '.js'), 'utf8'), context, { filename: file });
}
context.window.Mem = {
  state, save() { saves++; }, weakCats() { return [{ key: 'engineering', name: '工程实现' }]; },
  graduated(id) { return !!state.terms[id] && state.terms[id].mastery >= 2; },
  memoryBrief() { return ''; }, adaptFor() { return null; }, chatHistory() { return []; }
};
vm.runInContext(fs.readFileSync(path.join(__dirname, '../assets/mentor.js'), 'utf8'), context, { filename: 'mentor.js' });
const mentor = context.window.Mentor;

const first = mentor.record('rag', {
  difficulty: ['confuse', 'unrecognized'], style_worked: ['example', 'unrecognized'],
  understood: 'partly', note: '把 RAG 和模型训练混在一起'
}, 'chat-model');
assert.deepEqual(Array.from(first.difficulty), ['confuse']);
assert.deepEqual(Array.from(first.styleWorked), ['example']);
assert.equal(mentor.profile().topDifficulty[0].key, 'confuse');
assert.equal(mentor.infer('还是没懂 RAG 为什么要查资料', 'rag').understood, 'no');

state.terms.rag = { seen: 1, wrong: 2, right: 0, confused: 1, cleared: 0, mastery: 0.2, lastAt: Date.now() };
assert.equal(mentor.termStatus('rag'), 'confused');
assert.equal(mentor.recommend(6)[0].id, 'rag', '卡住的知识点应优先推荐');
assert.ok(mentor.recommend(6)[0].why.includes('卡住'));

(async () => {
  for (let i = 0; i < 5; i++) mentor.record('rag', {
    difficulty: ['flow'], style_worked: [], understood: 'partly', note: '不清楚检索顺序 ' + i
  }, 'chat-rule');
  await mentor.maybeSummarize();
  const profile = mentor.profile();
  assert.equal(profile.signalCount, 6);
  assert.ok(profile.summary.text && profile.summary.mode === 'offline', '未配置模型时也要形成透明的确定性画像');
  assert.equal((await mentor.maybeSummarize()), null, '未有六条新信号时不重复归纳');

  const generated = await mentor.supplement('rag', false);
  const cached = await mentor.supplement('rag', false);
  assert.ok(generated.text.includes('检索') && generated.title);
  assert.equal(generated.cached, false);
  assert.equal(cached.cached, true, '画像不变时复用补充讲解');
  assert.equal((await mentor.supplement('rag', true)).cached, false, '手动重新生成应绕过缓存');
  assert.ok(saves >= 7);

  vm.runInContext(fs.readFileSync(path.join(__dirname, '../assets/learning-quiz.js'), 'utf8'), context);
  const quiz = context.window.LearningQuiz.pick('rag');
  const wrong = quiz.options.find((option) => option.id !== quiz.correctOptionId);
  context.window.LearningQuiz.answer('rag', quiz.id, wrong.id);
  assert.equal(mentor.profile().recent[0].source, 'quiz', '答错应进入可核对的学习信号');

  const replies = [
    JSON.stringify({ reply: '先检索可信资料，再基于证据回答。', signals: {
      difficulty: ['confuse'], style_worked: [], understood: 'partly', note: '仍混淆训练与检索' } }),
    JSON.stringify({ memory: '该学员易混淆训练与检索，适合先给具体场景。' }),
    JSON.stringify({ title: '从工单出发', text: '先把用户的问题匹配到可信制度，再组织回答。' })
  ];
  let requests = 0;
  context.fetch = async (_url, options) => {
    requests++;
    const body = JSON.parse(options.body);
    assert.equal(body.stream, false);
    assert.equal(body.model, 'existing-provider-model');
    return { ok: true, json: async () => ({ choices: [{ message: { content: replies.shift() } }] }) };
  };
  vm.runInContext(fs.readFileSync(path.join(__dirname, '../assets/llm.js'), 'utf8'), context, { filename: 'llm.js' });
  context.window.LLM.setCfg({ enabled: true, baseUrl: 'https://configured-provider.test/v1',
    apiKey: 'fake-key-for-mocked-test', model: 'existing-provider-model' });
  const term = context.window.TERMS.find((t) => t.id === 'rag');
  let shown = '';
  const chat = await context.window.LLM.ask('RAG 和训练有什么区别？', term, (delta) => { shown += delta; });
  assert.equal(chat.mode, 'llm');
  assert.equal(shown, chat.reply);
  assert.equal(chat.signals.difficulty[0], 'confuse');
  const summary = await context.window.LLM.summarizeLearner(profile, state.mentor.signals);
  assert.ok(summary.includes('训练与检索'));
  const reteach = await context.window.LLM.reteach(term, profile);
  assert.ok(reteach.text.includes('制度'));
  assert.equal(requests, 3, '回答与学习信号应由同一次模型调用取得');

  const formatAttempts = [];
  context.fetch = async (_url, options) => {
    const body = JSON.parse(options.body);
    const mode = body.response_format ? body.response_format.type : 'plain';
    formatAttempts.push(mode);
    if (mode !== 'plain') return { ok: false, status: 400,
      json: async () => ({ error: { message: 'response_format unsupported' } }) };
    return { ok: true, json: async () => ({ choices: [{ message: {
      content: JSON.stringify({ memory: '先讲结论，再用真实产品场景解释。' })
    } }] }) };
  };
  context.window.LLM.setCfg({ baseUrl: 'https://format-incompatible.test/v1' });
  await context.window.LLM.summarizeLearner(profile, state.mentor.signals);
  await context.window.LLM.summarizeLearner(profile, state.mentor.signals);
  assert.deepEqual(formatAttempts, ['json_schema', 'json_object', 'plain', 'plain'],
    '不支持结构化格式的供应商应降级并记住可用模式');

  const practiceAnswer = '我会先写清目标用户和输入字段，再定义缺参提示与验收步骤。';
  let practicePayload;
  context.fetch = async (_url, options) => {
    practicePayload = JSON.parse(options.body);
    return { ok: true, json: async () => ({ choices: [{ message: { content: JSON.stringify({
      summary: '方案已有基本结构，但验收对象不够明确。',
      strengths: [{ quote: '先写清目标用户和输入字段', why: '先锁定对象与契约' }],
      gaps: [{ criterion: '验收', quote: '', why: '尚无可观察的结果', revision: '给出一条输入变化后的预期结果。' }],
      nextStep: '补一条实际测试用例。'
    }) } }] }) };
  };
  context.window.LLM.setCfg({ enabled: true, apiKey: 'fake-test-key', baseUrl: 'https://provider-mock.test/v1' });
  const review = await context.window.LLM.analyzePractice({ title: '练习', scenario: '场景', task: '写任务卡',
    checkpoints: ['输入输出'], rubric: ['验收'], reference: ['明确条件'] }, practiceAnswer);
  assert.equal(review.strengths[0].quote, '先写清目标用户和输入字段');
  assert.ok(practicePayload.messages[1].content.includes(practiceAnswer), '在线模型应收到已提交的原文');
  assert.equal(practicePayload.stream, false);

  const localDoc = { updatedAt: 100, createdAt: 1, events: [], chat: [], terms: {}, cats: {},
    lab: { practices: { 'brief-to-task': { answer: '较新的本地草稿', updatedAt: 200 } } },
    practiceRounds: [{ id: 'round-local', completedAt: 80, date: '2026-10-21' }],
    mentor: { signals: [{ id: 's-local', at: 10, termId: 'rag' }],
      summary: { text: '旧归纳', at: 20 }, supplements: { 'rag|a': { text: '旧重讲', at: 21 } } } };
  const remoteDoc = { updatedAt: 120, createdAt: 1, events: [], chat: [], terms: {}, cats: {},
    lab: { practices: { 'brief-to-task': { answer: '较旧远程草稿', updatedAt: 150 },
      'mvp-slice': { answer: '另一设备的草稿', updatedAt: 160 } } },
    practiceRounds: [{ id: 'round-remote', completedAt: 90, date: '2026-10-21' }],
    mentor: { signals: [{ id: 's-remote', at: 30, termId: 'model' }],
      summary: { text: '新归纳', at: 40 }, supplements: { 'rag|a': { text: '新重讲', at: 41 } } } };
  const syncStorage = new Map([['aipm.memory.v1', JSON.stringify(localDoc)]]);
  const syncContext = { window: {}, location: { protocol: 'https:' }, Date, Math, Map, Set, console,
    localStorage: { getItem(k) { return syncStorage.get(k) || null; }, setItem(k, v) { syncStorage.set(k, String(v)); } } };
  vm.createContext(syncContext);
  vm.runInContext(fs.readFileSync(path.join(__dirname, '../assets/store.js'), 'utf8'), syncContext);
  syncContext.window.Store.handle = { getFile: async () => ({ text: async () => JSON.stringify(remoteDoc) }) };
  assert.equal(await syncContext.window.Store.pull(), true);
  const merged = JSON.parse(syncStorage.get('aipm.memory.v1'));
  assert.equal(merged.mentor.signals.length, 2, '文件同步应合并两台设备的学习信号');
  assert.equal(merged.practiceRounds.length, 2, '文件同步应保留两台设备的巩固轮次');
  assert.equal(merged.mentor.summary.text, '新归纳');
  assert.equal(merged.mentor.supplements['rag|a'].text, '新重讲');
  assert.equal(merged.lab.practices['brief-to-task'].answer, '较新的本地草稿');
  assert.equal(merged.lab.practices['mvp-slice'].answer, '另一设备的草稿');

  console.log('mentor profile, recommendation, cache, and configured-provider tests passed');
})().catch((error) => { console.error(error); process.exitCode = 1; });
