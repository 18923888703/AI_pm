const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const DAY = 86400000;
const now = Date.now();
const state = { terms: {}, syllabus: { learned: [], doneAt: {} }, quizVariants: {} };
let saves = 0;
const context = { window: { Mem: { state, save() { saves++; }, quiz() {}, completeDailyQuiz() {} } }, Date, Set, Map, Math, console };
vm.createContext(context);
['data-core', 'data-adv', 'data-pro', 'data-pm', 'spaced-review', 'learning-quiz'].forEach((file) => {
  vm.runInContext(fs.readFileSync(path.join(__dirname, '../assets/' + file + '.js'), 'utf8'), context, { filename: file });
});
const { SpacedReview: spaced, LearningQuiz: quiz } = context.window;

spaced.record('rerank', 'rerank-source-1', 'scenario', true, 'daily', now - 3 * DAY);
assert(spaced.due(now).some((r) => r.termId === 'rerank'), '到期知识点应进入复测');
assert.equal(spaced.summary(now).score, null, '当天答对不能直接获得长期掌握分');

const session = quiz.startSpaced();
const question = quiz.spacedQuestion();
assert.equal(session.questions.length, 1);
assert.notEqual(question.id, 'rerank-source-1', '复测应优先更换原题');
assert.notEqual(question.variantType, 'scenario', '复测应优先换一种问法');
quiz.answerSpaced(question.correctOptionId);
assert.equal(quiz.spaced().responses[0].questionId, question.id);
assert.equal(quiz.spaced().responses[0].selectedOptionId, question.correctOptionId,
  '到期变式题须保存所选选项，完成后才能重建对应题的解析');
assert.equal(spaced.status('rerank').successStreak, 1);
assert.equal(quiz.spaced().result.score, 100, '最后一题答完即显示本轮成绩');
assert.equal(spaced.summary(now).score, 0, '一次跨日答对仍不能算长期掌握');
assert(quiz.spacedQuestion(), '最后一题解析应可在结果页读取');
quiz.nextSpaced();
assert.equal(quiz.spacedQuestion(), null);

const secondAt = now + 4 * DAY + 1000;
spaced.record('rerank', 'rerank-generated-definition', 'definition', true, 'spaced', secondAt);
assert.equal(spaced.status('rerank').successStreak, 2);
assert.equal(spaced.summary(secondAt).score, 100, '不同日期两次到期复测答对后计入长期掌握');
const afterMaster = spaced.status('rerank').dueAt;
spaced.record('rerank', 'rerank-generated-pm', 'tradeoff', true, 'spaced', secondAt + 2000);
assert.equal(spaced.status('rerank').successStreak, 2, '同日重复答题不能刷高长期掌握');
assert.equal(spaced.status('rerank').dueAt, afterMaster);
spaced.record('rerank', 'rerank-source-2', 'boundary', false, 'spaced', afterMaster + 1000);
assert.equal(spaced.status('rerank').successStreak, 0, '到期答错后应重置连续掌握');
assert.equal(spaced.summary(afterMaster + 1000).score, 0);
assert.equal(spaced.status('rerank').dueAt, afterMaster + 1000 + DAY, '答错后安排次日复测');

state.terms.rag = { right: 2, wrong: 0, lastAt: now - 2 * DAY };
state.syllabus.learned.push('rag');
spaced.initialize(now);
assert(spaced.status('rag') && spaced.status('rag').migrated, '旧学习数据应进入待复测队列');
assert(spaced.due(now).some((r) => r.termId === 'rag'));
state.terms.model = { right: 1, wrong: 0, lastAt: now };
state.syllabus.learned.push('model');
spaced.initialize(now);
assert(spaced.status('model') && !spaced.due(now).some((r) => r.termId === 'model'),
  '今天刚学过的旧记录应从次日开始复测');
spaced.reopen('ai', now);
spaced.record('ai', 'ai-source-1', 'scenario', true, 'spaced', now + 1000);
assert.equal(spaced.status('ai').successStreak, 0, '同日立即纠正不能增加跨日掌握次数');
assert.ok(spaced.status('ai').dueAt > now + 1000, '同日完成后不能一直留在到期队列');
assert(saves > 0);
console.log('spaced review tests passed');
