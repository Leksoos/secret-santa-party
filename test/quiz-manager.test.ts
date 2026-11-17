import assert from 'node:assert';
import { QuizManager } from '../server/quiz-manager.js';

console.log('🧪 Starting QuizManager Test Suite...');

const qm = new QuizManager();

// 1. Check total questions count
const stats = qm.getQuizStats();
console.log(`Total questions loaded: ${stats.totalQuestions} (Builtin: ${stats.builtinCount}, Custom: ${stats.customCount})`);
assert(stats.totalQuestions >= 120, 'Expected at least 120 questions in quiz bank');

// 2. Validate all questions have required fields
const allQuestions = qm.getAllQuestions();
for (const q of allQuestions) {
  assert(q.id, 'Question must have id');
  assert(q.question && q.question.trim().length > 0, `Question ${q.id} missing text`);
  assert(Array.isArray(q.options) && q.options.length >= 2 && q.options.length <= 6, `Question ${q.id} must have 2 to 6 options`);
  assert(typeof q.correctIndex === 'number' && q.correctIndex >= 0 && q.correctIndex < q.options.length, `Question ${q.id} invalid correctIndex`);
  assert(q.explanation && q.explanation.trim().length > 0, `Question ${q.id} missing explanation`);
  assert(q.category, `Question ${q.id} missing category`);
}
console.log('✅ Test 1 Passed: All 120+ questions have valid 2..6 options, correctIndex, category, and explanation');

// 3. Test random drawing and unused tracking
const used = new Set<string>();
for (let i = 0; i < 10; i++) {
  const q = qm.getRandomUnusedQuestion(used);
  assert(q, 'Must return a question');
  assert(!used.has(q.id), 'Must not return already used question');
  used.add(q.id);
}
assert.strictEqual(used.size, 10, 'Expected 10 unique questions chosen');
console.log('✅ Test 2 Passed: getRandomUnusedQuestion returns strictly unused questions');

// 4. Test adding custom question
const initialCount = stats.totalQuestions;
const customQ = qm.addCustomQuestion({
  question: 'В каком городе находится резиденция финского Йоулупукки?',
  options: ['Хельсинки', 'Рованиеми', 'Турку', 'Тампере'],
  correctIndex: 1,
  explanation: 'Деревня Санта-Клауса расположена в городе Рованиеми в провинции Лапландия!',
  category: '🌍 Традиции мира',
  author: 'Олег',
});

assert(customQ.id.startsWith('custom-'), 'Custom question id must start with custom-');
const newStats = qm.getQuizStats();
assert.strictEqual(newStats.totalQuestions, initialCount + 1, 'Total questions should increase by 1');
console.log('✅ Test 3 Passed: Custom question added and stats updated');

console.log('🎉 ALL QUIZ MANAGER TESTS PASSED 100%!');
