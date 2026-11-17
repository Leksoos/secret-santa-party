import { DatabaseSync } from 'node:sqlite';
import path from 'path';
import fs from 'fs';
import { Room, Participant, Pair, BackstagePhoto } from '../types';

let dbInstance: DatabaseSync | null = null;
let currentDbPath = '';

/**
 * Initializes the SQLite database, enabling WAL mode and creating all tables.
 * Can be called with ':memory:' for tests or with a custom path.
 */
export function getDatabase(customPath?: string): DatabaseSync {
  if (dbInstance && (!customPath || customPath === currentDbPath)) {
    return dbInstance;
  }

  const defaultDir = path.join(process.cwd(), 'data');
  if (!fs.existsSync(defaultDir) && customPath !== ':memory:') {
    try {
      fs.mkdirSync(defaultDir, { recursive: true });
    } catch (e) {
      // Directory creation error handler
    }
  }

  const dbPath = customPath || process.env.DATABASE_PATH || path.join(defaultDir, 'santa.db');
  currentDbPath = dbPath;

  const db = new DatabaseSync(dbPath);
  if (dbPath !== ':memory:') {
    db.exec('PRAGMA journal_mode = WAL;');
  }
  db.exec('PRAGMA foreign_keys = ON;');

  createTables(db);
  dbInstance = db;
  return dbInstance;
}

/**
 * Closes the database (used in testing).
 */
export function closeDatabase(): void {
  if (dbInstance) {
    try {
      dbInstance.close();
    } catch {
      // Ignore close error
    }
    dbInstance = null;
    currentDbPath = '';
  }
}

/**
 * Creates tables if they don't exist.
 */
function createTables(db: DatabaseSync): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS rooms (
      code TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      budget TEXT NOT NULL,
      event_date TEXT NOT NULL,
      host_id TEXT NOT NULL,
      status TEXT NOT NULL,
      party_json TEXT NOT NULL,
      recent_reactions_json TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS participants (
      id TEXT PRIMARY KEY,
      room_code TEXT NOT NULL,
      name TEXT NOT NULL,
      avatar TEXT NOT NULL,
      tg_username TEXT,
      wishlist TEXT,
      wishlist_items_json TEXT,
      anti_wishlist TEXT,
      anti_wishlist_tags_json TEXT,
      hobbies_json TEXT,
      clothing_size TEXT,
      is_host INTEGER NOT NULL DEFAULT 0,
      is_ready INTEGER NOT NULL DEFAULT 0,
      online INTEGER NOT NULL DEFAULT 0,
      checked_in INTEGER NOT NULL DEFAULT 0,
      created_at INTEGER NOT NULL,
      FOREIGN KEY(room_code) REFERENCES rooms(code) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_participants_room_code ON participants(room_code);

    CREATE TABLE IF NOT EXISTS pairs (
      id TEXT PRIMARY KEY,
      room_code TEXT NOT NULL,
      giver_id TEXT NOT NULL,
      receiver_id TEXT NOT NULL,
      hint_riddle TEXT,
      backstage_photos_json TEXT,
      revealed INTEGER NOT NULL DEFAULT 0,
      FOREIGN KEY(room_code) REFERENCES rooms(code) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_pairs_room_code ON pairs(room_code);

    CREATE TABLE IF NOT EXISTS uploaded_files (
      filename TEXT PRIMARY KEY,
      mime_type TEXT NOT NULL,
      data_base64 TEXT NOT NULL,
      created_at INTEGER NOT NULL
    );
  `);
}

/**
 * Persists a Room (including participants and pairs) to SQLite.
 */
export function dbSaveRoom(room: Room): void {
  const db = getDatabase();
  const now = Date.now();

  const partyJson = JSON.stringify(room.party || {});
  const reactionsJson = JSON.stringify(room.recentReactions || []);

  const upsertRoom = db.prepare(`
    INSERT INTO rooms (
      code, title, budget, event_date, host_id, status, party_json, recent_reactions_json, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(code) DO UPDATE SET
      title = excluded.title,
      budget = excluded.budget,
      event_date = excluded.event_date,
      host_id = excluded.host_id,
      status = excluded.status,
      party_json = excluded.party_json,
      recent_reactions_json = excluded.recent_reactions_json,
      updated_at = excluded.updated_at
  `);

  upsertRoom.run(
    room.code,
    room.title,
    room.budget,
    room.eventDate,
    room.hostId,
    room.status,
    partyJson,
    reactionsJson,
    room.createdAt || now,
    now
  );

  // Sync participants
  if (room.participants && room.participants.length > 0) {
    const upsertParticipant = db.prepare(`
      INSERT INTO participants (
        id, room_code, name, avatar, tg_username, wishlist, wishlist_items_json,
        anti_wishlist, anti_wishlist_tags_json, hobbies_json, clothing_size,
        is_host, is_ready, online, checked_in, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        name = excluded.name,
        avatar = excluded.avatar,
        tg_username = excluded.tg_username,
        wishlist = excluded.wishlist,
        wishlist_items_json = excluded.wishlist_items_json,
        anti_wishlist = excluded.anti_wishlist,
        anti_wishlist_tags_json = excluded.anti_wishlist_tags_json,
        hobbies_json = excluded.hobbies_json,
        clothing_size = excluded.clothing_size,
        is_host = excluded.is_host,
        is_ready = excluded.is_ready,
        online = excluded.online,
        checked_in = excluded.checked_in
    `);

    for (const p of room.participants) {
      upsertParticipant.run(
        p.id,
        room.code,
        p.name,
        p.avatar,
        p.tgUsername || null,
        p.wishlist || '',
        JSON.stringify(p.wishlistItems || []),
        p.antiWishlist || '',
        JSON.stringify(p.antiWishlistTags || []),
        JSON.stringify(p.hobbies || []),
        p.clothingSize || null,
        p.isHost ? 1 : 0,
        p.isReady ? 1 : 0,
        p.online ? 1 : 0,
        p.checkedIn ? 1 : 0,
        now
      );
    }
  }

  // Sync pairs
  if (room.pairs && room.pairs.length > 0) {
    const upsertPair = db.prepare(`
      INSERT INTO pairs (
        id, room_code, giver_id, receiver_id, hint_riddle, backstage_photos_json, revealed
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        giver_id = excluded.giver_id,
        receiver_id = excluded.receiver_id,
        hint_riddle = excluded.hint_riddle,
        backstage_photos_json = excluded.backstage_photos_json,
        revealed = excluded.revealed
    `);

    for (const pair of room.pairs) {
      upsertPair.run(
        pair.id,
        room.code,
        pair.giverId,
        pair.receiverId,
        pair.hintRiddle || '',
        JSON.stringify(pair.backstagePhotos || []),
        pair.revealed ? 1 : 0
      );
    }
  }
}

/**
 * Loads a single Room from SQLite by code.
 */
export function dbGetRoom(code: string): Room | null {
  const db = getDatabase();
  const roomRow = db.prepare(`SELECT * FROM rooms WHERE code = ?`).get(code) as any;
  if (!roomRow) return null;

  return hydrateRoom(db, roomRow);
}

/**
 * Loads all Rooms from SQLite.
 */
export function dbGetAllRooms(): Room[] {
  const db = getDatabase();
  const roomRows = db.prepare(`SELECT * FROM rooms`).all() as any[];
  return roomRows.map((row) => hydrateRoom(db, row));
}

/**
 * Hydrates full Room object from DB rows.
 */
function hydrateRoom(db: DatabaseSync, row: any): Room {
  const pRows = db.prepare(`SELECT * FROM participants WHERE room_code = ?`).all(row.code) as any[];
  const participants: Participant[] = pRows.map((p) => ({
    id: p.id,
    name: p.name,
    avatar: p.avatar,
    tgUsername: p.tg_username || undefined,
    wishlist: p.wishlist || '',
    wishlistItems: p.wishlist_items_json ? JSON.parse(p.wishlist_items_json) : [],
    antiWishlist: p.anti_wishlist || '',
    antiWishlistTags: p.anti_wishlist_tags_json ? JSON.parse(p.anti_wishlist_tags_json) : [],
    hobbies: p.hobbies_json ? JSON.parse(p.hobbies_json) : [],
    clothingSize: p.clothing_size || undefined,
    isHost: Boolean(p.is_host),
    isReady: Boolean(p.is_ready),
    online: Boolean(p.online),
    checkedIn: Boolean(p.checked_in),
  }));

  const pairRows = db.prepare(`SELECT * FROM pairs WHERE room_code = ?`).all(row.code) as any[];
  const pairs: Pair[] = pairRows.map((pair) => ({
    id: pair.id,
    giverId: pair.giver_id,
    receiverId: pair.receiver_id,
    hintRiddle: pair.hint_riddle || '',
    backstagePhotos: pair.backstage_photos_json ? JSON.parse(pair.backstage_photos_json) : [],
    revealed: Boolean(pair.revealed),
  }));

  const party = row.party_json ? JSON.parse(row.party_json) : {};
  const recentReactions = row.recent_reactions_json ? JSON.parse(row.recent_reactions_json) : [];

  return {
    code: row.code,
    title: row.title,
    budget: row.budget,
    eventDate: row.event_date,
    hostId: row.host_id,
    status: row.status,
    participants,
    pairs,
    party,
    recentReactions,
    createdAt: row.created_at,
  };
}

/**
 * Persists an uploaded file in SQLite.
 */
export function dbSaveUploadedFile(filename: string, mimeType: string, dataBase64: string): void {
  const db = getDatabase();
  const stmt = db.prepare(`
    INSERT INTO uploaded_files (filename, mime_type, data_base64, created_at)
    VALUES (?, ?, ?, ?)
    ON CONFLICT(filename) DO UPDATE SET
      mime_type = excluded.mime_type,
      data_base64 = excluded.data_base64
  `);
  stmt.run(filename, mimeType, dataBase64, Date.now());
}

/**
 * Retrieves an uploaded file from SQLite.
 */
export function dbGetUploadedFile(filename: string): { mimeType: string; dataBase64: string } | null {
  const db = getDatabase();
  const row = db.prepare(`SELECT mime_type, data_base64 FROM uploaded_files WHERE filename = ?`).get(filename) as any;
  if (!row) return null;
  return {
    mimeType: row.mime_type,
    dataBase64: row.data_base64,
  };
}
