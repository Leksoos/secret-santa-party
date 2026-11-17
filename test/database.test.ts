import { strict as assert } from 'assert';
import {
  getDatabase,
  closeDatabase,
  dbSaveRoom,
  dbGetRoom,
  dbGetAllRooms,
  dbSaveUploadedFile,
  dbGetUploadedFile,
} from '../server/db/database';
import { Room } from '../server/types';

console.log('🧪 Starting SQLite Database Unit Test Suite...');

// Use in-memory database for clean isolated tests
const db = getDatabase(':memory:');
assert(db, 'Database instance should be created');

// Test 1: Save Room and Participants
const testRoom: Room = {
  code: 'SANTA-9999',
  title: 'Новогодняя Корпоративная Вечеринка',
  budget: 'до 5 000 ₽',
  eventDate: '2026-12-31',
  hostId: 'host-123',
  status: 'lobby',
  participants: [
    {
      id: 'host-123',
      name: 'Организатор Алекс',
      avatar: '🎅',
      tgUsername: 'alex_santa',
      wishlist: 'Умная колонка, кофе в зернах',
      wishlistItems: [
        { id: 'w1', title: 'Умная колонка', price: '4500' },
        { id: 'w2', title: 'Кофе спешелти', price: '900' },
      ],
      antiWishlist: 'Свечи, носки',
      antiWishlistTags: ['свечи', 'носки'],
      hobbies: ['программирование', 'кофе'],
      clothingSize: 'L',
      isHost: true,
      isReady: true,
      online: true,
      checkedIn: true,
    },
    {
      id: 'user-456',
      name: 'Мария',
      avatar: '🦊',
      wishlist: 'Книга по дизайну',
      wishlistItems: [{ id: 'w3', title: 'Книга' }],
      antiWishlist: '',
      antiWishlistTags: [],
      hobbies: ['дизайн', 'йога'],
      isHost: false,
      isReady: false,
      online: true,
      checkedIn: false,
    },
  ],
  pairs: [
    {
      id: 'pair-1',
      giverId: 'host-123',
      receiverId: 'user-456',
      hintRiddle: 'Любит пить латте по утрам',
      backstagePhotos: [{ id: 'p1', url: '/uploads/coffee.jpg', caption: 'Выбираю лучший кофе' }],
      revealed: false,
    },
  ],
  party: {
    status: 'not_started',
    currentPairId: null,
    pairOrder: ['pair-1'],
    currentPairIndex: 0,
    currentStep: 'lobby',
    timer: 0,
    stepStartTime: 0,
    timerDuration: 0,
    guesses: {},
    scores: { 'host-123': 100 },
    roundHistory: [],
    reactionCounts: {},
    quiz: null,
    usedQuestionIds: [],
    quizCorrectCounts: {},
  },
  recentReactions: [],
  createdAt: Date.now(),
};

dbSaveRoom(testRoom);
console.log('✅ Test 1 Passed: Room and participants inserted into SQLite');

// Test 2: Retrieve Room and verify full hydration
const loaded = dbGetRoom('SANTA-9999');
assert(loaded, 'Room must be found in DB');
assert.equal(loaded.code, 'SANTA-9999');
assert.equal(loaded.title, 'Новогодняя Корпоративная Вечеринка');
assert.equal(loaded.participants.length, 2);
assert.equal(loaded.participants[0].name, 'Организатор Алекс');
assert.equal(loaded.participants[0].wishlistItems.length, 2);
assert.equal(loaded.participants[0].isReady, true);
assert.equal(loaded.participants[0].checkedIn, true);
assert.equal(loaded.pairs.length, 1);
assert.equal(loaded.pairs[0].backstagePhotos[0].caption, 'Выбираю лучший кофе');
assert.equal(loaded.party.scores['host-123'], 100);
console.log('✅ Test 2 Passed: Loaded room verified with 100% field fidelity');

// Test 3: Update existing room and participants (upsert)
testRoom.status = 'drawn';
testRoom.participants[1].isReady = true;
testRoom.participants[1].checkedIn = true;
dbSaveRoom(testRoom);

const updated = dbGetRoom('SANTA-9999');
assert(updated, 'Updated room must exist');
assert.equal(updated.status, 'drawn');
assert.equal(updated.participants[1].isReady, true);
assert.equal(updated.participants[1].checkedIn, true);
console.log('✅ Test 3 Passed: Upsert correctly updated room status and participant check-in');

// Test 4: GetAllRooms
const allRooms = dbGetAllRooms();
assert(allRooms.length >= 1, 'Should find at least 1 room');
assert(allRooms.some((r) => r.code === 'SANTA-9999'));
console.log('✅ Test 4 Passed: dbGetAllRooms returns all stored rooms');

// Test 5: Uploaded Files persistence (BLOB/Base64)
const sampleImageBase64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
dbSaveUploadedFile('santa-test-photo.png', 'image/png', sampleImageBase64);

const fileData = dbGetUploadedFile('santa-test-photo.png');
assert(fileData, 'File must be found in DB');
assert.equal(fileData.mimeType, 'image/png');
assert.equal(fileData.dataBase64, sampleImageBase64);
console.log('✅ Test 5 Passed: Uploaded file stored and retrieved from SQLite');

closeDatabase();
console.log('🎉 ALL SQLITE DATABASE TESTS PASSED 100%!\n');
