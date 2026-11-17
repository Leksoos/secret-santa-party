import {
  createRoom,
  joinRoom,
  setParticipantReady,
  getClientRoomView,
  drawRoomPairs,
  updateSantaClues,
} from '../server/rooms';

console.log('🧪 Starting Party Readiness (R1) Test Suite...');

// 1. Setup room with 4 participants
const { room, host } = createRoom({
  title: 'Тест Готовности к Вечеринке',
  budget: '3 000 ₽',
  eventDate: '2026-12-31',
  hostName: 'Олег (Хост)',
  avatar: '🎅',
});

const { participant: p1 } = joinRoom({
  code: room.code,
  name: 'Аня',
  avatar: '👩',
});

const { participant: p2 } = joinRoom({
  code: room.code,
  name: 'Борис',
  avatar: '🧔',
});

const { participant: p3 } = joinRoom({
  code: room.code,
  name: 'Вика',
  avatar: '🧝‍♀️',
});

// Test 1: Initial readiness state
const initialView = getClientRoomView(room.code, host.id);
if (!initialView) throw new Error('Test 1 Failed: Room view is null');

const initialTotal = initialView.participants.length;
const initialReady = initialView.participants.filter((p) => p.isReady).length;
const initialPreparing = initialView.participants.filter((p) => !p.isReady).length;

if (initialTotal !== 4) {
  throw new Error(`Test 1 Failed: Expected 4 participants, got ${initialTotal}`);
}
if (initialReady !== 0 || initialPreparing !== 4) {
  throw new Error(
    `Test 1 Failed: Expected 0 ready and 4 preparing, got ${initialReady} ready and ${initialPreparing} preparing`
  );
}
console.log('✅ Test 1 Passed: Initial room state has 0/4 ready participants');

// Test 2: Toggle readiness to true for single participant
const result1 = setParticipantReady(room.code, p1.id, true);
if (!result1.success || result1.participant.isReady !== true) {
  throw new Error('Test 2 Failed: setParticipantReady did not return success with isReady: true');
}

const viewAfterP1Ready = getClientRoomView(room.code, p1.id);
if (!viewAfterP1Ready) throw new Error('Test 2 Failed: Room view is null');

const p1Public = viewAfterP1Ready.participants.find((p) => p.id === p1.id);
const p2Public = viewAfterP1Ready.participants.find((p) => p.id === p2.id);

if (!p1Public || !p1Public.isReady) {
  throw new Error('Test 2 Failed: PublicParticipant for p1 does not have isReady: true');
}
if (!p2Public || p2Public.isReady) {
  throw new Error('Test 2 Failed: Other participants should remain not ready');
}

const readyCountAfterP1 = viewAfterP1Ready.participants.filter((p) => p.isReady).length;
if (readyCountAfterP1 !== 1) {
  throw new Error(`Test 2 Failed: Expected 1 ready participant, got ${readyCountAfterP1}`);
}
console.log('✅ Test 2 Passed: Single participant readiness toggled to true and reflected in public view');

// Test 3: Toggle readiness to false (revoke)
const resultRevoke = setParticipantReady(room.code, p1.id, false);
if (!resultRevoke.success || resultRevoke.participant.isReady !== false) {
  throw new Error('Test 3 Failed: Revoking readiness failed');
}

const viewAfterRevoke = getClientRoomView(room.code, p1.id);
const p1Revoked = viewAfterRevoke?.participants.find((p) => p.id === p1.id);
if (!p1Revoked || p1Revoked.isReady) {
  throw new Error('Test 3 Failed: PublicParticipant for p1 should be isReady: false after revoke');
}
console.log('✅ Test 3 Passed: Participant readiness revoked back to false successfully');

// Test 4: Aggregated readiness progression (0% -> 50% -> 100%)
// Re-enable p1 and enable p2 (2 out of 4 = 50%)
setParticipantReady(room.code, p1.id, true);
setParticipantReady(room.code, p2.id, true);

const view50 = getClientRoomView(room.code, host.id);
if (!view50) throw new Error('Test 4 Failed: Room view is null');

const ready50 = view50.participants.filter((p) => p.isReady).length;
const total50 = view50.participants.length;
const percent50 = Math.round((ready50 / total50) * 100);

if (ready50 !== 2 || percent50 !== 50) {
  throw new Error(`Test 4 Failed: Expected 2/4 ready (50%), got ${ready50}/${total50} (${percent50}%)`);
}
console.log('✅ Test 4.1 Passed: Aggregated readiness calculates 2/4 (50%) accurately');

// Enable p3 and host (4 out of 4 = 100%)
setParticipantReady(room.code, p3.id, true);
setParticipantReady(room.code, host.id, true);

const view100 = getClientRoomView(room.code, host.id);
if (!view100) throw new Error('Test 4 Failed: Room view is null');

const ready100 = view100.participants.filter((p) => p.isReady).length;
const percent100 = Math.round((ready100 / view100.participants.length) * 100);

if (ready100 !== 4 || percent100 !== 100) {
  throw new Error(`Test 4 Failed: Expected 4/4 ready (100%), got ${ready100}/4 (${percent100}%)`);
}
console.log('✅ Test 4.2 Passed: Aggregated readiness reaches 4/4 (100%) when all participants are ready');

// Test 5: Error handling for invalid room or participant
let roomErrorCaught = false;
try {
  setParticipantReady('NON-EXISTENT-ROOM', p1.id, true);
} catch (e: any) {
  roomErrorCaught = e.message.includes('Комната не найдена');
}
if (!roomErrorCaught) {
  throw new Error('Test 5 Failed: Expected "Комната не найдена" error for invalid room code');
}

let participantErrorCaught = false;
try {
  setParticipantReady(room.code, 'non-existent-user-id', true);
} catch (e: any) {
  participantErrorCaught = e.message.includes('Участник не найден');
}
if (!participantErrorCaught) {
  throw new Error('Test 5 Failed: Expected "Участник не найден" error for invalid participant id');
}
console.log('✅ Test 5 Passed: Error handling throws descriptive errors for non-existent room and participant');

// Test 6: Interoperability with draw and santa clues
drawRoomPairs(room.code, host.id);
// Reset p1 readiness
setParticipantReady(room.code, p1.id, false);
const viewAfterReset = getClientRoomView(room.code, p1.id);
if (viewAfterReset?.participants.find((p) => p.id === p1.id)?.isReady) {
  throw new Error('Test 6 Failed: p1 should be not ready after reset');
}

// Updating Santa clues should mark giver as ready
updateSantaClues(room.code, p1.id, 'Моя загадка для ТВ', []);
const viewAfterClues = getClientRoomView(room.code, p1.id);
const p1AfterClues = viewAfterClues?.participants.find((p) => p.id === p1.id);
if (!p1AfterClues || !p1AfterClues.isReady) {
  throw new Error('Test 6 Failed: updateSantaClues did not set giver isReady to true');
}

// Verify participant can still manually revoke after clues
setParticipantReady(room.code, p1.id, false);
const viewAfterManualRevoke = getClientRoomView(room.code, p1.id);
if (viewAfterManualRevoke?.participants.find((p) => p.id === p1.id)?.isReady) {
  throw new Error('Test 6 Failed: Participant should be able to manually revoke readiness even after clues');
}
console.log('✅ Test 6 Passed: Seamless interoperability between Santa clues and direct readiness toggle');

console.log('🎉 ALL PARTY READINESS (R1) TESTS PASSED 100%!');
