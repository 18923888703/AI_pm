const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const context = { window: { Mem: { state: {}, save() {} } }, Math, Date, Set, Map, console };
vm.createContext(context);
for (const name of ['data-core', 'data-adv', 'data-pro', 'data-pm', 'data-extension', 'data-materials', 'data-long-memory', 'data-agent-hallucination',
  'interview-core50', 'term-quiz-short', 'learning-quiz', 'practice', 'interview-bank', 'option-refinements']) {
  vm.runInContext(fs.readFileSync(path.join(__dirname, '../assets', name + '.js'), 'utf8'), context, { filename: name });
}
const w = context.window;
const pools = {
  learning: w.TERMS.flatMap(term => w.LearningQuiz.bank(term.id)),
  interview: w.INTERVIEW_BANK.filter(q => q.type === 'mcq'),
  practice: w.PRACTICES.map(p => ({ id: p.id, prompt: p.decision.q,
    options: p.decision.options.map((text, i) => ({ text, id: String(i) })), correctOptionId: String(p.decision.a) }))
};
for (const [name, questions] of Object.entries(pools)) {
  const rows = questions.map(q => {
    const lens = q.options.map(o => o.text.length);
    const right = q.options.find(o => o.id === q.correctOptionId).text.length;
    return { id: q.id, prompt: q.prompt, right, min: Math.min(...lens), max: Math.max(...lens),
      ratio: Math.max(...lens) / Math.max(1, Math.min(...lens)), options: q.options.map(o => o.text) };
  }).sort((a, b) => b.ratio - a.ratio);
  console.log(`${name}: ${questions.length} questions, ${rows.filter(x => x.ratio > 2).length} ratio>2, ${rows.filter(x => x.ratio > 2.2).length} ratio>2.2, ${rows.filter(x => x.ratio > 2.5).length} ratio>2.5, ${rows.filter(x => x.right === x.max && x.max - x.min >= 10).length} longest-correct`);
  if (name === 'learning') console.log('learning difficult by family:', ['source', 'generated', 'core50'].map(family =>
    `${family}=${rows.filter(x => x.id.includes(family) && x.ratio > 2).length}`).join(', '));
  if (name === 'learning') console.log('learning verbose:', rows.filter(x => x.max > 65).length,
    'options over 65 chars:', questions.flatMap(q => q.options).filter(o => o.text.length > 65).length,
    'options under 6 chars:', questions.flatMap(q => q.options).filter(o => o.text.length < 6).length);
  if (process.argv.includes('--short') && name === 'learning') questions.forEach(q => q.options.filter(o => o.text.length < 6)
    .forEach(o => console.log(q.id + ' | ' + o.text)));
  if (process.argv.includes('--all-learning') && name === 'learning') {
    rows.filter(x => x.ratio > 2).forEach(x => console.log(x.id + ' | ' + x.prompt + ' | 正确：' +
      questions.find(q => q.id === x.id).options.find(o => o.id === questions.find(q => q.id === x.id).correctOptionId).text +
      ' | 错误：' + questions.find(q => q.id === x.id).options.filter(o => o.id !== questions.find(q => q.id === x.id).correctOptionId).map(o => o.text).join(' / ')));
  } else rows.slice(0, 12).forEach(x => console.log(JSON.stringify(x)));
}
