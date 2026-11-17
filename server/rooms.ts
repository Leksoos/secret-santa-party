import {
  Room,
  Participant,
  PublicParticipant,
  Pair,
  ClientRoomView,
  ReactionEvent,
  BackstagePhoto,
  PartyStep,
  WishlistItem,
} from './types';
import { generatePairs } from './santa-matcher';
import { quizManager } from './quiz-manager';
import { v4 as uuidv4 } from 'uuid';
import { dbSaveRoom, dbGetRoom, dbGetAllRooms } from './db/database';

const rooms = new Map<string, Room>();

function persistRoom(room: Room): void {
  try {
    dbSaveRoom(room);
  } catch (err) {
    console.error(`[DB] Failed to persist room ${room.code}:`, err);
  }
}

export function generateRoomCode(): string {
  const num = Math.floor(1000 + Math.random() * 9000);
  return `SANTA-${num}`;
}

// Convert internal participant to public view (strictly hides private wishlists)
function toPublicParticipant(p: Participant): PublicParticipant {
  return {
    id: p.id,
    name: p.name,
    avatar: p.avatar,
    tgUsername: p.tgUsername,
    hobbies: p.hobbies || [],
    hasWishlist: !!p.wishlist?.trim() || (p.wishlistItems && p.wishlistItems.length > 0),
    hasAntiWishlist: !!p.antiWishlist?.trim() || (p.antiWishlistTags && p.antiWishlistTags.length > 0),
    isHost: p.isHost,
    isReady: p.isReady,
    online: p.online,
    checkedIn: !!p.checkedIn,
  };
}

export function createRoom(params: {
  title: string;
  budget: string;
  eventDate: string;
  hostName: string;
  avatar: string;
  tgUsername?: string;
}): { room: Room; host: Participant } {
  let code = generateRoomCode();
  while (rooms.has(code)) {
    code = generateRoomCode();
  }

  const host: Participant = {
    id: uuidv4(),
    name: params.hostName.trim() || 'Хост Санта',
    avatar: params.avatar || '🎅',
    tgUsername: params.tgUsername,
    wishlist: '',
    wishlistItems: [],
    antiWishlist: '',
    antiWishlistTags: [],
    hobbies: [],
    clothingSize: '',
    isHost: true,
    isReady: false,
    online: true,
    checkedIn: false,
  };

  const room: Room = {
    code,
    title: params.title.trim() || 'Новогодний Тайный Санта',
    budget: params.budget.trim() || 'до 3 000 ₽',
    eventDate: params.eventDate || new Date(Date.now() + 7 * 86400000).toISOString(),
    hostId: host.id,
    status: 'lobby',
    participants: [host],
    pairs: [],
    party: {
      status: 'not_started',
      currentPairId: null,
      pairOrder: [],
      currentPairIndex: 0,
      currentStep: 'lobby',
      timer: 0,
      stepStartTime: Date.now(),
      timerDuration: 0,
      guesses: {},
      scores: {},
      roundHistory: [],
      reactionCounts: {},
      quiz: null,
      usedQuestionIds: [],
      quizCorrectCounts: {},
      playerQuestions: [],
      builderStatus: {},
    },
    recentReactions: [],
    createdAt: Date.now(),
  };

  rooms.set(code, room);
  persistRoom(room);
  return { room, host };
}

export function getRoom(code: string): Room | undefined {
  if (!code) return undefined;
  const cleanCode = code.toUpperCase().trim();
  let room = rooms.get(cleanCode);
  if (!room) {
    try {
      const fromDb = dbGetRoom(cleanCode);
      if (fromDb) {
        rooms.set(cleanCode, fromDb);
        room = fromDb;
      }
    } catch {
      // Ignore DB lookup error
    }
  }
  return room;
}

export function joinRoom(params: {
  code: string;
  name: string;
  avatar: string;
  tgUsername?: string;
  checkedIn?: boolean;
}): { room: Room; participant: Participant } {
  const room = getRoom(params.code);
  if (!room) {
    throw new Error(`Комната с кодом ${params.code} не найдена`);
  }

  const existing = room.participants.find(
    (p) => p.name.toLowerCase() === params.name.trim().toLowerCase()
  );
  if (existing) {
    existing.online = true;
    if (params.checkedIn !== undefined) {
      existing.checkedIn = params.checkedIn;
    } else {
      existing.checkedIn = true;
    }
    if (params.avatar) existing.avatar = params.avatar;
    persistRoom(room);
    return { room, participant: existing };
  }

  if (room.status !== 'lobby') {
    throw new Error('Жеребьевка в этой комнате уже проведена. Новые участники не могут присоединиться.');
  }

  const participant: Participant = {
    id: uuidv4(),
    name: params.name.trim() || 'Гость',
    avatar: params.avatar || '⛄',
    tgUsername: params.tgUsername,
    wishlist: '',
    wishlistItems: [],
    antiWishlist: '',
    antiWishlistTags: [],
    hobbies: [],
    clothingSize: '',
    isHost: false,
    isReady: false,
    online: true,
    checkedIn: params.checkedIn !== undefined ? params.checkedIn : true,
  };

  room.participants.push(participant);
  persistRoom(room);
  return { room, participant };
}

export function updateParticipantProfile(
  code: string,
  participantId: string,
  updates: {
    wishlist?: string;
    wishlistItems?: WishlistItem[];
    antiWishlist?: string;
    antiWishlistTags?: string[];
    hobbies?: string[];
    clothingSize?: string;
    name?: string;
    avatar?: string;
  }
): Participant {
  const room = getRoom(code);
  if (!room) throw new Error('Комната не найдена');

  const p = room.participants.find((x) => x.id === participantId);
  if (!p) throw new Error('Участник не найден');

  if (updates.wishlist !== undefined) p.wishlist = updates.wishlist;
  if (updates.wishlistItems !== undefined) p.wishlistItems = updates.wishlistItems;
  if (updates.antiWishlist !== undefined) p.antiWishlist = updates.antiWishlist;
  if (updates.antiWishlistTags !== undefined) p.antiWishlistTags = updates.antiWishlistTags;
  if (updates.hobbies !== undefined) p.hobbies = updates.hobbies;
  if (updates.clothingSize !== undefined) p.clothingSize = updates.clothingSize;
  if (updates.name !== undefined) p.name = updates.name.trim();
  if (updates.avatar !== undefined) p.avatar = updates.avatar;

  persistRoom(room);
  return p;
}

export function drawRoomPairs(code: string, hostId: string): Pair[] {
  const room = getRoom(code);
  if (!room) throw new Error('Комната не найдена');
  if (room.hostId !== hostId) {
    throw new Error('Только создатель (администратор) комнаты может провести жеребьевку');
  }
  if (room.participants.length < 2) {
    throw new Error('Нужно как минимум 2 участника для жеребьевки');
  }

  const pairs = generatePairs(room.participants);
  room.pairs = pairs;
  room.status = 'drawn';

  const pairIds = pairs.map((p) => p.id).sort(() => Math.random() - 0.5);
  room.party = {
    status: 'not_started',
    currentPairId: pairIds[0] || null,
    pairOrder: pairIds,
    currentPairIndex: 0,
    currentStep: 'lobby',
    timer: 0,
    stepStartTime: Date.now(),
    timerDuration: 0,
    guesses: {},
    scores: {},
    roundHistory: [],
    reactionCounts: {},
    quiz: null,
    usedQuestionIds: [],
    quizCorrectCounts: {},
  };

  persistRoom(room);
  return pairs;
}

export function updateSantaClues(
  code: string,
  giverId: string,
  hintRiddle: string,
  backstagePhotos: BackstagePhoto[]
): Pair {
  const room = getRoom(code);
  if (!room) throw new Error('Комната не найдена');

  const pair = room.pairs.find((p) => p.giverId === giverId);
  if (!pair) throw new Error('Вы не назначены Сантой в этой комнате');

  pair.hintRiddle = hintRiddle.trim();
  pair.backstagePhotos = backstagePhotos;

  const giver = room.participants.find((p) => p.id === giverId);
  if (giver) {
    giver.isReady = true;
  }

  persistRoom(room);
  return pair;
}

export function setParticipantReady(
  code: string,
  participantId: string,
  isReady: boolean
): { success: boolean; participant: Participant } {
  const room = getRoom(code);
  if (!room) throw new Error('Комната не найдена');

  const participant = room.participants.find((p) => p.id === participantId);
  if (!participant) throw new Error('Участник не найден');

  participant.isReady = Boolean(isReady);
  persistRoom(room);
  return { success: true, participant };
}

export function checkInParticipant(
  code: string,
  participantId: string
): { success: boolean; participant: Participant } {
  const room = getRoom(code);
  if (!room) throw new Error('Комната не найдена');

  const participant = room.participants.find((p) => p.id === participantId);
  if (!participant) throw new Error('Участник не найден');

  participant.checkedIn = true;
  participant.online = true;
  persistRoom(room);
  return { success: true, participant };
}


export function startQuizBreak(
  room: Room,
  nextStepAfterQuiz: 'roulette' | 'finished',
  totalQuestions: number = 3
): void {
  const party = room.party;
  if (!party.usedQuestionIds) party.usedQuestionIds = [];
  if (!party.quizCorrectCounts) party.quizCorrectCounts = {};

  // Prioritize player custom questions from room.party.playerQuestions
  let q: QuizQuestion | null = null;
  const unusedPlayerQ = party.playerQuestions?.find(
    (pq) => !party.usedQuestionIds.includes(pq.id)
  );

  if (unusedPlayerQ) {
    q = unusedPlayerQ;
  } else {
    q = quizManager.getRandomUnusedQuestion(party.usedQuestionIds);
  }

  if (!q) {
    party.currentStep = nextStepAfterQuiz;
    party.stepStartTime = Date.now();
    party.timerDuration = nextStepAfterQuiz === 'roulette' ? 5 : 0;
    party.quiz = null;
    return;
  }

  party.usedQuestionIds.push(q.id);
  party.currentStep = 'quiz_question';
  party.timer = 20;
  party.timerDuration = 20;
  party.stepStartTime = Date.now();

  party.quiz = {
    questionIndex: 0,
    totalQuestions,
    currentQuestion: q,
    answers: {},
    answersCount: 0,
    correctParticipantIds: [],
    isLastInBatch: totalQuestions <= 1,
    nextStepAfterQuiz,
  };
}

export function startPartyShow(
  code: string,
  hostId: string,
  options?: { skipWarmupQuiz?: boolean; withCountdown?: boolean }
): Room {
  const room = getRoom(code);
  if (!room) throw new Error('Комната не найдена');
  if (room.hostId !== hostId) {
    throw new Error('Только администратор комнаты может запустить шоу вечеринки');
  }
  if (room.status !== 'drawn' && room.status !== 'party') {
    throw new Error('Сначала необходимо провести жеребьевку');
  }

  room.status = 'party';
  room.party.status = 'active';
  room.party.currentPairIndex = 0;
  room.party.currentPairId = room.party.pairOrder[0] || null;
  room.party.guesses = {};

  if (options?.withCountdown) {
    room.party.currentStep = 'countdown';
    room.party.timer = 5;
    room.party.timerDuration = 5;
    room.party.stepStartTime = Date.now();
    if (!room.party.playerQuestions) room.party.playerQuestions = [];
    room.party.builderStatus = {};
    room.party.quiz = null;
  } else if (options?.skipWarmupQuiz) {
    room.party.currentStep = 'roulette';
    room.party.stepStartTime = Date.now();
    room.party.timerDuration = 5;
    room.party.quiz = null;
  } else {
    // Start with 3-question Warm-Up Festive Quiz
    startQuizBreak(room, 'roulette', 3);
  }

  persistRoom(room);
  return room;
}

export function advancePartyStep(code: string, hostId?: string): Room {
  const room = getRoom(code);
  if (!room || room.status !== 'party') throw new Error('Вечеринка не активна');

  // Enforce host rights if hostId provided
  if (hostId && room.hostId !== hostId) {
    throw new Error('Только администратор комнаты может переключать шаги вечеринки');
  }

  const party = room.party;
  const currentPair = room.pairs.find((p) => p.id === party.currentPairId);

  party.stepStartTime = Date.now();

  switch (party.currentStep) {
    case 'countdown':
      party.currentStep = 'question_builder';
      party.stepStartTime = Date.now();
      party.timerDuration = 0;
      break;

    case 'question_builder':
      startQuizBreak(room, 'roulette', 3);
      break;

    case 'quiz_question':
      if (party.quiz) {
        party.currentStep = 'quiz_reveal';
        party.timerDuration = 10; // 10 seconds pause to read the "Почему именно так?" explanation
        party.stepStartTime = Date.now();

        const correctIdx = party.quiz.currentQuestion.correctIndex;
        const correctIds: string[] = [];

        Object.entries(party.quiz.answers).forEach(([pId, chosenIdx]) => {
          if (chosenIdx === correctIdx) {
            correctIds.push(pId);
            party.scores[pId] = (party.scores[pId] || 0) + 100;
            if (!party.quizCorrectCounts) party.quizCorrectCounts = {};
            party.quizCorrectCounts[pId] = (party.quizCorrectCounts[pId] || 0) + 1;
          }
        });

        party.quiz.correctParticipantIds = correctIds;
      } else {
        party.currentStep = 'roulette';
        party.timerDuration = 5;
        party.stepStartTime = Date.now();
      }
      break;

    case 'quiz_reveal':
      if (party.quiz && party.quiz.questionIndex + 1 < party.quiz.totalQuestions) {
        // Next question in the current batch! Prioritize player questions
        const nextIndex = party.quiz.questionIndex + 1;
        let nextQ: QuizQuestion | null = null;
        const unusedPlayerQ = party.playerQuestions?.find(
          (pq) => !party.usedQuestionIds.includes(pq.id)
        );
        if (unusedPlayerQ) {
          nextQ = unusedPlayerQ;
        } else {
          nextQ = quizManager.getRandomUnusedQuestion(party.usedQuestionIds);
        }

        if (nextQ) {
          party.usedQuestionIds.push(nextQ.id);
          party.quiz.questionIndex = nextIndex;
          party.quiz.currentQuestion = nextQ;
          party.quiz.answers = {};
          party.quiz.answersCount = 0;
          party.quiz.correctParticipantIds = [];
          party.quiz.isLastInBatch = nextIndex + 1 >= party.quiz.totalQuestions;

          party.currentStep = 'quiz_question';
          party.timer = 20;
          party.timerDuration = 20;
          party.stepStartTime = Date.now();
          break;
        }
      }

      // Quiz batch is complete! Move to nextStepAfterQuiz
      const nextStep = party.quiz?.nextStepAfterQuiz || 'roulette';
      party.quiz = null;

      if (nextStep === 'roulette') {
        party.currentStep = 'roulette';
        party.timerDuration = 5;
        party.stepStartTime = Date.now();
      } else {
        party.currentStep = 'finished';
        party.status = 'finished';
        party.timerDuration = 0;
        party.stepStartTime = Date.now();
      }
      break;

    case 'roulette':
      party.currentStep = 'riddle';
      party.timerDuration = 0;
      break;

    case 'riddle':
      party.currentStep = 'guess';
      party.timer = 25;
      party.timerDuration = 25;
      party.guesses = {};
      break;

    case 'guess':
      party.currentStep = 'photos';
      party.timerDuration = 0;
      if (currentPair) {
        const correctGuesserIds = Object.entries(party.guesses)
          .filter(([_, guessedId]) => guessedId === currentPair.giverId)
          .map(([voterId]) => voterId);

        if (!party.roundHistory) party.roundHistory = [];
        party.roundHistory.push({
          pairId: currentPair.id,
          giverId: currentPair.giverId,
          receiverId: currentPair.receiverId,
          guesses: { ...party.guesses },
          correctGuesserIds,
        });
      }
      break;

    case 'photos':
      party.currentStep = 'reveal';
      party.timerDuration = 0;
      if (currentPair) {
        currentPair.revealed = true;
        Object.entries(party.guesses).forEach(([voterId, guessedId]) => {
          if (guessedId === currentPair.giverId) {
            party.scores[voterId] = (party.scores[voterId] || 0) + 100;
          }
        });
      }
      break;

    case 'reveal':
      if (party.currentPairIndex + 1 < party.pairOrder.length) {
        party.currentPairIndex += 1;
        party.currentPairId = party.pairOrder[party.currentPairIndex];
        party.guesses = {};
        // Intermission Quiz (3 questions) before next gift roulette!
        startQuizBreak(room, 'roulette', 3);
      } else {
        // All gifts given! Final Quiz (3 questions) before podium!
        startQuizBreak(room, 'finished', 3);
      }
      break;

    case 'finished':
      break;

    default:
      party.currentStep = 'roulette';
  }

  persistRoom(room);
  return room;
}

export function submitQuizAnswer(
  code: string,
  participantId: string,
  optionIndex: number
): boolean {
  const room = getRoom(code);
  if (
    !room ||
    room.status !== 'party' ||
    room.party.currentStep !== 'quiz_question' ||
    !room.party.quiz
  ) {
    return false;
  }

  // Check valid option index
  if (
    optionIndex < 0 ||
    optionIndex >= room.party.quiz.currentQuestion.options.length
  ) {
    return false;
  }

  // Once answered, choice is locked
  if (room.party.quiz.answers[participantId] !== undefined) return false;

  room.party.quiz.answers[participantId] = optionIndex;
  room.party.quiz.answersCount = Object.keys(room.party.quiz.answers).length;

  // Fast-Forward: when all participants have answered, snap timer to 3 seconds!
  const totalPlayers = room.participants.length;
  if (room.party.quiz.answersCount >= totalPlayers) {
    const elapsed = (Date.now() - (room.party.stepStartTime || Date.now())) / 1000;
    const remaining = (room.party.timerDuration || 20) - elapsed;
    if (remaining > 3) {
      room.party.timerDuration = 3;
      room.party.stepStartTime = Date.now();
    }
  }

  persistRoom(room);
  return true;
}

export function submitPlayerCustomQuestion(
  code: string,
  participantId: string,
  params: {
    question: string;
    options: string[];
    correctIndex: number;
    explanation: string;
    category?: string;
  }
): QuizQuestion {
  const room = getRoom(code);
  if (!room) throw new Error('Комната не найдена');
  const participant = room.participants.find((p) => p.id === participantId);
  if (!participant) throw new Error('Участник не найден');

  if (!params.question || !params.question.trim()) {
    throw new Error('Вопрос не может быть пустым');
  }
  if (
    !params.options ||
    !Array.isArray(params.options) ||
    params.options.length < 2 ||
    params.options.length > 6 ||
    params.options.some((o) => typeof o !== 'string' || !o.trim())
  ) {
    throw new Error('Количество вариантов ответа должно быть от 2 до 6, и они не могут быть пустыми');
  }
  if (
    typeof params.correctIndex !== 'number' ||
    params.correctIndex < 0 ||
    params.correctIndex >= params.options.length
  ) {
    throw new Error(`Индекс правильного ответа должен быть от 0 до ${params.options.length - 1}`);
  }
  if (!params.explanation || !params.explanation.trim()) {
    throw new Error('Объяснение правильного ответа обязательно');
  }

  const customQ: QuizQuestion = {
    id: `player-q-${participantId}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    question: params.question.trim(),
    options: params.options.map((o) => o.trim()),
    correctIndex: params.correctIndex,
    explanation: params.explanation.trim(),
    category: params.category?.trim() || '🎁 Вопрос от игрока',
    isCustom: true,
    authorName: participant.name,
  };

  if (!room.party.playerQuestions) {
    room.party.playerQuestions = [];
  }
  room.party.playerQuestions.push(customQ);

  if (!room.party.builderStatus) {
    room.party.builderStatus = {};
  }
  room.party.builderStatus[participantId] = 'submitted';

  persistRoom(room);
  return customQ;
}

export function skipPlayerCustomQuestion(code: string, participantId: string): boolean {
  const room = getRoom(code);
  if (!room) return false;
  const participant = room.participants.find((p) => p.id === participantId);
  if (!participant) return false;

  if (!room.party.builderStatus) {
    room.party.builderStatus = {};
  }
  room.party.builderStatus[participantId] = 'skipped';
  persistRoom(room);
  return true;
}

export function skipQuizBreak(code: string, hostId: string): Room {
  const room = getRoom(code);
  if (!room) throw new Error('Комната не найдена');
  if (room.hostId !== hostId) throw new Error('Только организатор может пропустить викторину');

  if (room.party.currentStep !== 'quiz_question' && room.party.currentStep !== 'quiz_reveal') {
    return room;
  }

  const nextStep = room.party.quiz?.nextStepAfterQuiz || 'roulette';
  room.party.quiz = null;

  if (nextStep === 'roulette') {
    room.party.currentStep = 'roulette';
    room.party.timerDuration = 5;
    room.party.stepStartTime = Date.now();
  } else {
    room.party.currentStep = 'finished';
    room.party.status = 'finished';
    room.party.timerDuration = 0;
    room.party.stepStartTime = Date.now();
  }

  persistRoom(room);
  return room;
}

export function submitPartyGuess(
  code: string,
  voterId: string,
  guessedParticipantId: string
): void {
  const room = getRoom(code);
  if (!room || room.status !== 'party' || room.party.currentStep !== 'guess') return;

  const currentPair = room.pairs.find((p) => p.id === room.party.currentPairId);
  if (!currentPair) return;

  // 1. Recipient cannot vote in their own round
  if (voterId === currentPair.receiverId) return;

  // 2. Santa cannot vote for themselves in their own round
  if (voterId === currentPair.giverId) return;

  // 3. One vote per participant: once voted, choice is locked and cannot be changed
  if (room.party.guesses[voterId]) return;

  room.party.guesses[voterId] = guessedParticipantId;

  // Fast-Forward: When all eligible viewers have voted, clamp remaining timer to 3 seconds
  const eligibleVoters = room.participants.filter(
    (p) => p.id !== currentPair.receiverId && p.id !== currentPair.giverId
  );
  const eligibleCount = Math.max(1, eligibleVoters.length);
  const currentVotesCount = Object.keys(room.party.guesses).length;

  if (currentVotesCount >= eligibleCount) {
    const elapsed = (Date.now() - (room.party.stepStartTime || Date.now())) / 1000;
    const remaining = (room.party.timerDuration || 25) - elapsed;
    if (remaining > 3) {
      room.party.timerDuration = 3;
      room.party.stepStartTime = Date.now();
    }
  }

  persistRoom(room);
}

export function postReaction(
  code: string,
  emoji: string,
  sound: string,
  senderName: string
): ReactionEvent {
  const room = getRoom(code);
  if (!room) throw new Error('Комната не найдена');

  if (!room.party.reactionCounts) {
    room.party.reactionCounts = {};
  }
  const sender = room.participants.find(
    (p) => p.name.toLowerCase() === senderName.toLowerCase()
  );
  const senderKey = sender ? sender.id : senderName;
  room.party.reactionCounts[senderKey] = (room.party.reactionCounts[senderKey] || 0) + 1;

  const reaction: ReactionEvent = {
    id: uuidv4(),
    emoji,
    sound,
    senderName,
    timestamp: Date.now(),
  };

  room.recentReactions.push(reaction);
  if (room.recentReactions.length > 20) {
    room.recentReactions.shift();
  }

  return reaction;
}

// Compute Jackbox-style endgame nominations
export function computeEndgameNominations(room: Room) {
  const participants = room.participants;
  const history = room.party.roundHistory || [];
  const publicMap = new Map(participants.map((p) => [p.id, toPublicParticipant(p)]));

  const correctCounts: Record<string, number> = {};
  let totalGuessesMade = 0;
  let totalCorrectGuesses = 0;

  participants.forEach((p) => {
    correctCounts[p.id] = 0;
  });

  history.forEach((round) => {
    Object.entries(round.guesses).forEach(([voterId, guessedId]) => {
      totalGuessesMade++;
      if (guessedId === round.giverId) {
        correctCounts[voterId] = (correctCounts[voterId] || 0) + 1;
        totalCorrectGuesses++;
      }
    });
  });

  // Sherlock: highest correct guesses
  let sherlockId = participants[0]?.id;
  let maxCorrect = -1;
  participants.forEach((p) => {
    if (correctCounts[p.id] > maxCorrect) {
      maxCorrect = correctCounts[p.id];
      sherlockId = p.id;
    }
  });

  // Watson: lowest correct guesses
  let watsonId = participants[0]?.id;
  let minCorrect = 9999;
  participants.forEach((p) => {
    if (correctCounts[p.id] < minCorrect) {
      minCorrect = correctCounts[p.id];
      watsonId = p.id;
    }
  });

  // Santa stealth: how many people guessed each Santa?
  const santaGuessedCounts: Record<string, number> = {};
  history.forEach((round) => {
    santaGuessedCounts[round.giverId] = round.correctGuesserIds.length;
  });

  // Ninja (Master of disguise): Santa with MINIMUM people who guessed them
  let ninjaGiverId = history[0]?.giverId;
  let minGuessedBy = 9999;
  Object.entries(santaGuessedCounts).forEach(([giverId, count]) => {
    if (count < minGuessedBy) {
      minGuessedBy = count;
      ninjaGiverId = giverId;
    }
  });

  // Open Book: Santa with MAXIMUM people who guessed them
  let openBookGiverId = history[0]?.giverId;
  let maxGuessedBy = -1;
  Object.entries(santaGuessedCounts).forEach(([giverId, count]) => {
    if (count > maxGuessedBy) {
      maxGuessedBy = count;
      openBookGiverId = giverId;
    }
  });

  // Soundboard King: max reactions sent
  let soundboardKingId = participants[0]?.id;
  let maxReactions = 0;
  Object.entries(room.party.reactionCounts || {}).forEach(([pId, count]) => {
    if (count > maxReactions) {
      maxReactions = count;
      soundboardKingId = pId;
    }
  });

  // Quiz Master: player with highest correct quiz answers
  let quizMasterId: string | null = null;
  let maxQuizCorrect = 0;
  Object.entries(room.party.quizCorrectCounts || {}).forEach(([pId, count]) => {
    if (count > maxQuizCorrect) {
      maxQuizCorrect = count;
      quizMasterId = pId;
    }
  });

  const accuracyPercent =
    totalGuessesMade > 0 ? Math.round((totalCorrectGuesses / totalGuessesMade) * 100) : 0;

  return {
    sherlock: sherlockId && maxCorrect > 0 ? { participant: publicMap.get(sherlockId)!, count: maxCorrect } : null,
    watson: watsonId ? { participant: publicMap.get(watsonId)!, count: minCorrect === 9999 ? 0 : minCorrect } : null,
    ninja: ninjaGiverId ? { participant: publicMap.get(ninjaGiverId)!, guessedCount: minGuessedBy === 9999 ? 0 : minGuessedBy } : null,
    openBook: openBookGiverId ? { participant: publicMap.get(openBookGiverId)!, guessedCount: maxGuessedBy === -1 ? 0 : maxGuessedBy } : null,
    soundboardKing: soundboardKingId ? { participant: publicMap.get(soundboardKingId) || publicMap.get(participants[0].id)!, count: maxReactions } : null,
    quizMaster: quizMasterId && maxQuizCorrect > 0 ? { participant: publicMap.get(quizMasterId)!, count: maxQuizCorrect } : null,
    totalGifts: room.pairs.length,
    totalGuesses: totalGuessesMade,
    accuracyPercent,
  };
}

// Client-safe room representation:
// NEVER exposes other participants' wishlists!
export function getClientRoomView(
  code: string,
  participantId?: string
): ClientRoomView | null {
  const room = getRoom(code);
  if (!room) return null;

  // Mask public participants
  const publicParticipants: PublicParticipant[] = room.participants.map(toPublicParticipant);

  // My own private profile (so current user can edit and see their own items)
  const myProfile = participantId
    ? room.participants.find((p) => p.id === participantId) || null
    : null;

  // Full recipient info is ONLY available to their assigned Secret Santa!
  let myRecipient = null;
  if (participantId && room.status !== 'lobby') {
    const pair = room.pairs.find((p) => p.giverId === participantId);
    if (pair) {
      const receiver = room.participants.find((p) => p.id === pair.receiverId);
      if (receiver) {
        myRecipient = {
          participant: receiver, // Contains full wishlist, wishlistItems, antiWishlist, etc.
          pairId: pair.id,
          hintRiddle: pair.hintRiddle,
          backstagePhotos: pair.backstagePhotos,
        };
      }
    }
  }

  // Active party details for TV and controllers
  const party = room.party;
  let currentReceiver: PublicParticipant | null = null;
  let currentGiverId: string | null = null;
  let currentRiddle: string | null = null;
  let currentPhotos: BackstagePhoto[] | null = null;
  let revealedGiver: PublicParticipant | null = null;

  if (party.currentPairId) {
    const activePair = room.pairs.find((p) => p.id === party.currentPairId);
    if (activePair) {
      currentGiverId = activePair.giverId;
      const rec = room.participants.find((p) => p.id === activePair.receiverId);
      if (rec) currentReceiver = toPublicParticipant(rec);

      currentRiddle = activePair.hintRiddle || null;
      currentPhotos = activePair.backstagePhotos || null;

      if (activePair.revealed || party.currentStep === 'reveal') {
        const giv = room.participants.find((p) => p.id === activePair.giverId);
        if (giv) revealedGiver = toPublicParticipant(giv);
      }
    }
  }

  return {
    code: room.code,
    title: room.title,
    budget: room.budget,
    eventDate: room.eventDate,
    hostId: room.hostId,
    status: room.status,
    participants: publicParticipants,
    myRecipient,
    myProfile,
    party: {
      status: party.status,
      currentStep: party.currentStep,
      timer: party.timer,
      stepStartTime: party.stepStartTime || Date.now(),
      timerDuration: party.timerDuration || 0,
      currentPairIndex: party.currentPairIndex,
      totalPairs: room.pairs.length,
      currentReceiver,
      currentGiverId,
      currentRiddle,
      currentPhotos,
      revealedGiver,
      guessesCount: Object.keys(party.guesses).length,
      votedParticipantIds: Object.keys(party.guesses),
      scores: party.scores,
      quiz: party.quiz || null,
      nominations: party.status === 'finished' ? computeEndgameNominations(room) : null,
      builderStatus: party.builderStatus || {},
    },
    recentReactions: room.recentReactions,
  };
}

// Sandbox: Allows a user to join the demo company of friends in SANTA-2026
export function joinDemoCompany(params: {
  userName: string;
  avatar: string;
  asHost: boolean;
}): { room: Room; user: Participant } {
  // Reset or ensure SANTA-2026 exists
  initDemoRoom();
  const room = getRoom('SANTA-2026')!;

  const existing = room.participants.find(
    (p) => p.name.toLowerCase() === params.userName.trim().toLowerCase()
  );

  let user: Participant;
  if (existing) {
    user = existing;
    user.avatar = params.avatar || user.avatar;
    user.checkedIn = true;
    if (params.asHost) {
      room.hostId = user.id;
      user.isHost = true;
      room.participants.forEach((p) => {
        if (p.id !== user.id) p.isHost = false;
      });
    }
  } else {
    user = {
      id: uuidv4(),
      name: params.userName.trim() || 'Гость',
      avatar: params.avatar || '🦌',
      wishlist: 'Уютный новогодний сюрприз!',
      wishlistItems: [
        { id: 'item-1', title: 'Настольная игра или термокружка', price: '2 500 ₽' },
      ],
      antiWishlist: 'Не дарить сувениры и носки',
      antiWishlistTags: ['Свечи', 'Носки', 'Кружки'],
      hobbies: ['Гейминг 🎮', 'Кофе ☕'],
      clothingSize: 'M',
      isHost: params.asHost,
      isReady: true,
      online: true,
      checkedIn: true,
    };

    if (params.asHost) {
      room.hostId = user.id;
      room.participants.forEach((p) => {
        p.isHost = false;
      });
    }

    room.participants.push(user);
  }

  // Generate new pairs including the user!
  const pairs = generatePairs(room.participants);
  room.pairs = pairs;
  room.status = 'drawn';

  // Seed sample clues for pairs
  room.pairs.forEach((pair) => {
    const giver = room.participants.find((p) => p.id === pair.giverId);
    const receiver = room.participants.find((p) => p.id === pair.receiverId);

    if (!pair.hintRiddle) {
      pair.hintRiddle = `Специальный подарок для ${receiver?.name}! Выбирался с огромной душой и праздничным настроением.`;
    }
    if (pair.backstagePhotos.length === 0) {
      pair.backstagePhotos = [
        {
          id: `photo-${Date.now()}-${Math.random()}`,
          url: 'https://images.unsplash.com/photo-1512909006721-3d6018887383?w=800&auto=format&fit=crop&q=80',
          caption: `Санта (${giver?.name}) ищет лучший подарок!`,
        },
      ];
    }
  });

  const pairIds = pairs.map((p) => p.id).sort(() => Math.random() - 0.5);
  room.party = {
    status: 'not_started',
    currentPairId: pairIds[0] || null,
    pairOrder: pairIds,
    currentPairIndex: 0,
    currentStep: 'lobby',
    timer: 0,
    stepStartTime: Date.now(),
    timerDuration: 0,
    guesses: {},
    scores: {
      'demo-oleg': 200,
      'demo-elena': 300,
      'demo-dima': 100,
      'demo-anya': 200,
    },
    roundHistory: [],
    reactionCounts: {},
    quiz: null,
    usedQuestionIds: [],
    quizCorrectCounts: {},
    playerQuestions: [],
    builderStatus: {},
  };

  persistRoom(room);
  return { room, user };
}

// Pre-seed cozy demo room
export function initDemoRoom(): void {
  const code = 'SANTA-2026';
  const p1: Participant = {
    id: 'demo-oleg',
    name: 'Олег',
    avatar: '🎅',
    wishlist: 'Теплый вязаный свитер с оленями или хорошая термокружка',
    wishlistItems: [
      { id: 'ol-1', title: 'Термокружка Stanley / Contigo', url: 'https://ozon.ru', price: '2 800 ₽' },
      { id: 'ol-2', title: 'Вязаный свитер с оленями (размер L)' },
    ],
    antiWishlist: 'Не дарить сладости и сувениры-пылесборники',
    antiWishlistTags: ['Сладкое', 'Статуэтки / Сувениры'],
    hobbies: ['IT 💻', 'Спорт 🏂', 'Кофе ☕'],
    clothingSize: 'L',
    isHost: true,
    isReady: true,
    online: true,
    checkedIn: true,
  };
  const p2: Participant = {
    id: 'demo-elena',
    name: 'Лена',
    avatar: '🤶',
    wishlist: 'Настольная игра Codenames или книга по дизайну',
    wishlistItems: [
      { id: 'el-1', title: 'Настольная игра Codenames (Кодовые имена)', price: '1 900 ₽' },
      { id: 'el-2', title: 'Книга «Дизайн привычных вещей» Дона Нормана' },
    ],
    antiWishlist: 'Никакой косметики и гелей для душа',
    antiWishlistTags: ['Косметика', 'Гели для душа', 'Свечи'],
    hobbies: ['Дизайн 🎨', 'Книги 📚', 'Котики 🐱'],
    clothingSize: 'S',
    isHost: false,
    isReady: true,
    online: true,
    checkedIn: true,
  };
  const p3: Participant = {
    id: 'demo-dima',
    name: 'Дима',
    avatar: '🦌',
    wishlist: 'Свежеобжаренный спешелти кофе в зернах (Эфиопия/Кения)',
    wishlistItems: [
      { id: 'dm-1', title: 'Спешелти кофе в зернах (Tasty Coffee / Rockets)', price: '1 500 ₽' },
    ],
    antiWishlist: 'Не дарить ароматические свечи и блокноты',
    antiWishlistTags: ['Свечи', 'Блокноты'],
    hobbies: ['Кофе ☕', 'Гейминг 🎮', 'Музыка 🎧'],
    clothingSize: 'XL',
    isHost: false,
    isReady: true,
    online: true,
    checkedIn: false,
  };
  const p4: Participant = {
    id: 'demo-anya',
    name: 'Аня',
    avatar: '⛄',
    wishlist: 'Акварельная бумага хлопковая 300г и круглая кисть белка',
    wishlistItems: [
      { id: 'an-1', title: 'Скетчбук для акварели хлопок 300г', price: '2 200 ₽' },
      { id: 'an-2', title: 'Кисть Pinax белка круглая #6' },
    ],
    antiWishlist: 'Не дарить кружки с надписями',
    antiWishlistTags: ['Кружки', 'Носки'],
    hobbies: ['Творчество 🎨', 'Путешествия ✈️', 'Кулинария 🍳'],
    clothingSize: 'M',
    isHost: false,
    isReady: true,
    online: true,
    checkedIn: true,
  };

  const participants = [p1, p2, p3, p4];

  const pairs: Pair[] = [
    {
      id: 'pair-1',
      giverId: 'demo-oleg',
      receiverId: 'demo-elena',
      hintRiddle: 'Этот подарок тренирует мозги компании, но упакован в карту метро 2012 года!',
      backstagePhotos: [
        {
          id: 'photo-1',
          url: 'https://images.unsplash.com/photo-1512909006721-3d6018887383?w=800&auto=format&fit=crop&q=80',
          caption: 'Штурм магазина настолок в снегопад',
        },
        {
          id: 'photo-2',
          url: 'https://images.unsplash.com/photo-1543258103-a62bdc069871?w=800&auto=format&fit=crop&q=80',
          caption: 'Скотч закончился на 3-м слое упаковки',
        },
      ],
      revealed: false,
    },
    {
      id: 'pair-2',
      giverId: 'demo-elena',
      receiverId: 'demo-dima',
      hintRiddle: 'Пахнет так, что весь подъезд сбежался. Взбодрит любого соню!',
      backstagePhotos: [
        {
          id: 'photo-3',
          url: 'https://images.unsplash.com/photo-1447933601403-0c6688de566e?w=800&auto=format&fit=crop&q=80',
          caption: 'Выбирали самый ягодный лот зерна',
        },
      ],
      revealed: false,
    },
    {
      id: 'pair-3',
      giverId: 'demo-dima',
      receiverId: 'demo-anya',
      hintRiddle: 'Для будущих шедевров! Никакой синтетики — чистый хлопок.',
      backstagePhotos: [],
      revealed: false,
    },
    {
      id: 'pair-4',
      giverId: 'demo-anya',
      receiverId: 'demo-oleg',
      hintRiddle: 'Согреет даже в лютые январские морозы на балконе.',
      backstagePhotos: [],
      revealed: false,
    },
  ];

  const demoRoom: Room = {
    code,
    title: '🎄 Друзья: Новогодняя Вечеринка 2026',
    budget: 'до 3 000 ₽',
    eventDate: '2026-12-31T20:00:00.000Z',
    hostId: p1.id,
    status: 'drawn',
    participants,
    pairs,
    party: {
      status: 'not_started',
      currentPairId: pairs[0].id,
      pairOrder: pairs.map((p) => p.id),
      currentPairIndex: 0,
      currentStep: 'lobby',
      timer: 0,
      stepStartTime: Date.now(),
      timerDuration: 0,
      guesses: {},
      scores: {
        'demo-oleg': 200,
        'demo-elena': 300,
        'demo-dima': 100,
        'demo-anya': 200,
      },
      roundHistory: [],
      reactionCounts: {},
      quiz: null,
      usedQuestionIds: [],
      quizCorrectCounts: {},
      playerQuestions: [],
      builderStatus: {},
    },
    recentReactions: [],
    createdAt: Date.now(),
  };

  rooms.set(code, demoRoom);
  persistRoom(demoRoom);
}

// Hydrate from DB and seed demo room if not present
export function initAllRooms(): void {
  try {
    const loaded = dbGetAllRooms();
    for (const r of loaded) {
      rooms.set(r.code, r);
    }
  } catch (err) {
    console.warn('[DB] Could not load rooms from SQLite:', err);
  }
  if (!rooms.has('SANTA-2026')) {
    initDemoRoom();
  }
}

// Seed on startup
initAllRooms();
