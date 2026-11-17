import assert from 'node:assert';
import {
  createRoom,
  joinRoom,
  drawRoomPairs,
  startPartyShow,
  advancePartyStep,
  submitQuizAnswer,
  submitPartyGuess,
  computeEndgameNominations,
} from '../server/rooms.js';

console.log('🧪 Starting Quiz Flow & Scoring Integration Test Suite...');

// 1. Setup room with 3 participants
const { room, host } = createRoom({
  title: 'Новогодняя Викторина',
  budget: '1500 ₽',
  eventDate: '2026-12-31',
  hostName: 'Олег',
  avatar: '🎅',
});

const { participant: p2 } = joinRoom({ code: room.code, name: 'Лена', avatar: '🤶' });
const { participant: p3 } = joinRoom({ code: room.code, name: 'Дима', avatar: '🦌' });

drawRoomPairs(room.code, host.id);

// 2. Start Party Show (warmup quiz should be triggered by default!)
startPartyShow(room.code, host.id);

assert.strictEqual(room.party.currentStep, 'quiz_question');
assert(room.party.quiz, 'party.quiz must be initialized');
assert.strictEqual(room.party.quiz.questionIndex, 0);
assert.strictEqual(room.party.quiz.totalQuestions, 3);
assert.strictEqual(room.party.quiz.nextStepAfterQuiz, 'roulette');
assert.strictEqual(room.party.timerDuration, 20);
assert(room.party.quiz.currentQuestion, 'Question must be populated');
const q1 = room.party.quiz.currentQuestion;
console.log(`✅ Test 1 Passed: Party started with warm-up quiz question 1/3: "${q1.question}"`);

// 3. Submit quiz answers:
// Host (Олег) answers correctly
// p2 (Лена) answers incorrectly
submitQuizAnswer(room.code, host.id, q1.correctIndex);
assert.strictEqual(room.party.quiz.answers[host.id], q1.correctIndex);
assert.strictEqual(room.party.timerDuration, 20, 'Timer should still be 20s because 1 player has not answered');

// p3 (Дима) answers correctly
submitQuizAnswer(room.code, p3.id, q1.correctIndex);
// p2 (Лена) answers wrong
const wrongIndex = (q1.correctIndex + 1) % 4;
submitQuizAnswer(room.code, p2.id, wrongIndex);

// All 3 players answered -> fast-forward should snap timer to 3s!
assert.strictEqual(room.party.timerDuration, 3, 'Timer snapped to 3s after all players answered');
console.log('✅ Test 2 Passed: Fast-Forward to 3s triggered when all players submitted answers');

// 4. Advance to quiz_reveal
advancePartyStep(room.code, host.id);
assert.strictEqual(room.party.currentStep, 'quiz_reveal');
assert.strictEqual(room.party.timerDuration, 10, 'Reveal timer duration is 10s');
assert.deepStrictEqual(
  room.party.quiz.correctParticipantIds.sort(),
  [host.id, p3.id].sort(),
  'Revealed winners must be Oleg and Dima'
);

// Check score points (+100 for correct)
assert.strictEqual(room.party.scores[host.id], 100);
assert.strictEqual(room.party.scores[p3.id], 100);
assert.strictEqual(room.party.scores[p2.id] || 0, 0);
assert.strictEqual(room.party.quizCorrectCounts[host.id], 1);
assert.strictEqual(room.party.quizCorrectCounts[p3.id], 1);
assert.strictEqual(room.party.quizCorrectCounts[p2.id] || 0, 0);
console.log('✅ Test 3 Passed: Quiz reveal awarded +100 points and recorded correct counts');

// 5. Advance to question 2
advancePartyStep(room.code, host.id);
assert.strictEqual(room.party.currentStep, 'quiz_question');
assert.strictEqual(room.party.quiz.questionIndex, 1);
const q2 = room.party.quiz.currentQuestion;
assert.notStrictEqual(q2.id, q1.id, 'Question 2 must not repeat Question 1');

// Quick advance question 2 -> reveal -> question 3 -> reveal
advancePartyStep(room.code, host.id); // -> reveal 2
assert.strictEqual(room.party.currentStep, 'quiz_reveal');

advancePartyStep(room.code, host.id); // -> question 3
assert.strictEqual(room.party.currentStep, 'quiz_question');
assert.strictEqual(room.party.quiz.questionIndex, 2);

advancePartyStep(room.code, host.id); // -> reveal 3
assert.strictEqual(room.party.currentStep, 'quiz_reveal');

// 6. After reveal of 3rd question, next advance MUST transition to 'roulette'!
advancePartyStep(room.code, host.id);
assert.strictEqual(room.party.currentStep, 'roulette');
assert.strictEqual(room.party.quiz, null, 'Quiz state cleared when returning to main flow');
console.log('✅ Test 4 Passed: Warm-up quiz concluded and seamlessly transitioned to roulette');

// 7. Test Endgame Nominations includes quizMaster
const nominations = computeEndgameNominations(room);
assert(nominations.quizMaster, 'Endgame nominations must have quizMaster');
assert(
  nominations.quizMaster.participant.id === host.id || nominations.quizMaster.participant.id === p3.id,
  'Quiz master must be one of the top answerers'
);
console.log(`✅ Test 5 Passed: Quiz Master nomination computed: ${nominations.quizMaster.participant.name} (${nominations.quizMaster.count} правильных ответов)`);

console.log('🎉 ALL QUIZ FLOW TESTS PASSED 100%!');
