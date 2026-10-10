const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

let seed = 20261010;
function random() {
  seed = (seed * 1664525 + 1013904223) >>> 0;
  return seed / 0x100000000;
}

const seededMath = Object.create(Math);
seededMath.random = random;

const state = {};
const context = {
  window: {
    Mem: {
      state,
      save() {}
    }
  },
  Math: seededMath,
  Date,
  Set,
  Map,
  console
};

vm.createContext(context);
const source = fs.readFileSync(path.join(__dirname, '..', 'assets', 'practice.js'), 'utf8');
vm.runInContext(source, context, { filename: 'assets/practice.js' });

const { Lab, INTERVIEW_DIMS, INTERVIEW_QUESTIONS } = context.window;
assert.equal(INTERVIEW_QUESTIONS.length, 48, '题库应包含 48 道已校验题');
assert.equal(Lab.interviewSessionSize(), 18, '每次测评应抽取 18 题');

const first = Lab.startInterview();
assert.equal(first.length, 18);
Object.keys(INTERVIEW_DIMS).forEach((dim) => {
  assert.equal(first.filter((q) => q.dim === dim).length, 3, `${dim} 应抽 3 题`);
});
first.forEach((q) => Lab.answerInterview(q.a));
assert.equal(Lab.interview().result.score, 100);

const previousIds = new Set(first.map((q) => q.id));
const previousByConcept = new Map(first.map((q) => [q.concept, q.id]));
const second = Lab.startInterview();
assert.equal(second.length, 18);
assert.ok(second.filter((q) => q.review).length >= 6, '每个维度至少应包含一道已掌握知识点复测');
second.filter((q) => q.review && previousByConcept.has(q.concept)).forEach((q) => {
  assert.notEqual(q.id, previousByConcept.get(q.concept), '连续复测同一知识点时应切换变式题');
});
assert.ok(second.some((q) => !previousIds.has(q.id)), '第二轮应出现上一轮没有的题');

second.forEach((q) => Lab.answerInterview(q.a));
const result = Lab.interview().result;
assert.equal(result.total, 18);
assert.equal(result.reviewCorrect, result.reviewCount);
Object.keys(INTERVIEW_DIMS).forEach((dim) => {
  assert.equal(result.dims[dim].total, 3, `${dim} 的评分分母应为 3`);
});

console.log('interview randomization tests passed');
