import express from 'express';
import http from 'http';
import { Server as SocketIOServer } from 'socket.io';
import cors from 'cors';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import {
  createRoom,
  getRoom,
  joinRoom,
  updateParticipantProfile,
  drawRoomPairs,
  updateSantaClues,
  setParticipantReady,
  checkInParticipant,
  startPartyShow,
  advancePartyStep,
  submitPartyGuess,
  submitQuizAnswer,
  skipQuizBreak,
  submitPlayerCustomQuestion,
  skipPlayerCustomQuestion,
  postReaction,
  getClientRoomView,
  joinDemoCompany,
} from './rooms';
import { quizManager } from './quiz-manager';
import { getNetworkInfo, networkInfoHandler } from './network';
import { dbSaveUploadedFile, dbGetUploadedFile } from './db/database';

const app = express();
const server = http.createServer(app);
const io = new SocketIOServer(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
  },
});

const PORT = process.env.PORT || 3001;

// Upload directory configuration
const uploadsDir = path.join(process.cwd(), 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname) || '.jpg';
    const uniqueName = `santa-${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`;
    cb(null, uniqueName);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
});

app.use(cors());
app.use(express.json());

// Serve uploaded photos from disk or fallback to SQLite database
app.get('/uploads/:filename', (req, res) => {
  const filePath = path.join(uploadsDir, req.params.filename);
  if (fs.existsSync(filePath)) {
    return res.sendFile(filePath);
  }
  const dbFile = dbGetUploadedFile(req.params.filename);
  if (dbFile) {
    const buffer = Buffer.from(dbFile.dataBase64, 'base64');
    res.setHeader('Content-Type', dbFile.mimeType);
    res.setHeader('Cache-Control', 'public, max-age=31536000');
    return res.send(buffer);
  }
  res.status(404).send('File not found');
});
app.use('/uploads', express.static(uploadsDir));

// --- REST Endpoints ---

// Network Info (Auto-detection & QR support)
app.get('/api/network-info', networkInfoHandler);

// Create Room
app.post('/api/rooms', (req, res) => {
  try {
    const { title, budget, eventDate, hostName, avatar, tgUsername } = req.body;
    const { room, host } = createRoom({
      title,
      budget,
      eventDate,
      hostName,
      avatar,
      tgUsername,
    });
    res.json({
      success: true,
      roomCode: room.code,
      host,
      view: getClientRoomView(room.code, host.id),
    });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// Join Room
app.post('/api/rooms/:code/join', (req, res) => {
  try {
    const code = req.params.code.toUpperCase();
    const { name, avatar, tgUsername } = req.body;
    const { room, participant } = joinRoom({
      code,
      name,
      avatar,
      tgUsername,
    });

    // Notify room via sockets
    io.to(code).emit('participant:checked_in', {
      participantId: participant.id,
      name: participant.name,
      avatar: participant.avatar,
    });
    io.to(code).emit('sound:trigger', { sound: 'chime' });
    io.to(code).emit('room:updated');

    res.json({
      success: true,
      participant,
      view: getClientRoomView(room.code, participant.id),
    });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// Get Room View
app.get('/api/rooms/:code', (req, res) => {
  const code = req.params.code.toUpperCase();
  const participantId = req.query.participantId as string | undefined;
  const view = getClientRoomView(code, participantId);
  if (!view) {
    return res.status(404).json({ error: 'Комната не найдена' });
  }
  res.json({ success: true, view });
});

// Update Profile (Wishlist & Anti-Wishlist)
app.patch('/api/rooms/:code/participants/:id', (req, res) => {
  try {
    const code = req.params.code.toUpperCase();
    const participantId = req.params.id;
    const updated = updateParticipantProfile(code, participantId, req.body);

    io.to(code).emit('room:updated');
    res.json({ success: true, participant: updated });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// Draw Pairs (Host only)
app.post('/api/rooms/:code/draw', (req, res) => {
  try {
    const code = req.params.code.toUpperCase();
    const { hostId } = req.body;
    drawRoomPairs(code, hostId);

    // Broadcast update to all players
    io.to(code).emit('room:updated');
    io.to(code).emit('sound:trigger', { sound: 'bells' });

    res.json({ success: true });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// Santa Clues & Backstage photos
app.post('/api/rooms/:code/santa-clues', (req, res) => {
  try {
    const code = req.params.code.toUpperCase();
    const { giverId, hintRiddle, backstagePhotos } = req.body;
    updateSantaClues(code, giverId, hintRiddle, backstagePhotos);

    io.to(code).emit('room:updated');
    res.json({ success: true });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// Party Readiness Toggle
app.post('/api/rooms/:code/ready', (req, res) => {
  try {
    const code = req.params.code.toUpperCase();
    const { participantId, isReady } = req.body;
    if (!participantId) {
      return res.status(400).json({ error: 'participantId is required' });
    }
    const result = setParticipantReady(code, participantId, isReady);

    io.to(code).emit('room:updated');
    res.json({
      success: true,
      participant: result.participant,
      view: getClientRoomView(code, participantId),
    });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// Participant Check-in (QR code scan / lobby arrival)
app.post('/api/rooms/:code/checkin', (req, res) => {
  try {
    const code = req.params.code.toUpperCase();
    const { participantId } = req.body;
    if (!participantId) {
      return res.status(400).json({ error: 'participantId is required' });
    }
    const result = checkInParticipant(code, participantId);
    const p = result.participant;

    io.to(code).emit('participant:checked_in', {
      participantId: p.id,
      name: p.name,
      avatar: p.avatar,
    });
    io.to(code).emit('sound:trigger', { sound: 'chime' });
    io.to(code).emit('room:updated');

    res.json({
      success: true,
      participant: p,
      view: getClientRoomView(code, participantId),
    });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// Custom question submission
app.post('/api/rooms/:code/custom-question', (req, res) => {
  try {
    const code = req.params.code.toUpperCase();
    const { participantId, question, options, correctIndex, explanation, category } = req.body;
    if (!participantId) {
      return res.status(400).json({ error: 'participantId is required' });
    }
    const q = submitPlayerCustomQuestion(code, participantId, {
      question,
      options,
      correctIndex,
      explanation,
      category,
    });
    io.to(code).emit('sound:trigger', { sound: 'pop' });
    io.to(code).emit('room:updated');
    res.json({ success: true, question: q, view: getClientRoomView(code, participantId) });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// Custom question skip
app.post('/api/rooms/:code/skip-question', (req, res) => {
  try {
    const code = req.params.code.toUpperCase();
    const { participantId } = req.body;
    if (!participantId) {
      return res.status(400).json({ error: 'participantId is required' });
    }
    skipPlayerCustomQuestion(code, participantId);
    io.to(code).emit('room:updated');
    res.json({ success: true, view: getClientRoomView(code, participantId) });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});


// File upload for photos
app.post('/api/upload', upload.single('photo'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'Файл не прикреплен' });
  }
  try {
    const buffer = fs.readFileSync(req.file.path);
    dbSaveUploadedFile(req.file.filename, req.file.mimetype || 'image/jpeg', buffer.toString('base64'));
  } catch (err) {
    console.error('[Upload] Failed to persist file in SQLite:', err);
  }
  const fileUrl = `/uploads/${req.file.filename}`;
  res.json({ success: true, url: fileUrl });
});

// Join or reset demo sandbox company
app.post('/api/demo/join', (req, res) => {
  try {
    const { userName, avatar, asHost } = req.body;
    const { room, user } = joinDemoCompany({
      userName: userName || 'Гость',
      avatar: avatar || '🎅',
      asHost: asHost !== false,
    });

    io.to('SANTA-2026').emit('room:updated');
    res.json({
      success: true,
      user,
      view: getClientRoomView('SANTA-2026', user.id),
    });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// Quiz API: Stats and Custom Question Creation
app.get('/api/quiz/stats', (_req, res) => {
  res.json({ success: true, stats: quizManager.getQuizStats() });
});

app.post('/api/quiz/questions', (req, res) => {
  try {
    const question = quizManager.addCustomQuestion(req.body);
    res.json({ success: true, question, stats: quizManager.getQuizStats() });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// --- Socket.IO Real-time Events ---
io.on('connection', (socket) => {
  socket.on('room:join', ({ code, participantId }) => {
    const roomCode = code.toUpperCase();
    socket.join(roomCode);

    // Send initial view
    const view = getClientRoomView(roomCode, participantId);
    if (view) {
      socket.emit('room:state', view);
    }
  });

  socket.on('party:ready', ({ code, participantId, isReady }) => {
    try {
      const roomCode = code.toUpperCase();
      setParticipantReady(roomCode, participantId, isReady);
      io.to(roomCode).emit('room:updated');
    } catch (e: any) {
      socket.emit('error', e.message);
    }
  });

  socket.on('participant:checkin', ({ code, participantId }) => {
    try {
      const roomCode = code.toUpperCase();
      const result = checkInParticipant(roomCode, participantId);
      const p = result.participant;

      io.to(roomCode).emit('participant:checked_in', {
        participantId: p.id,
        name: p.name,
        avatar: p.avatar,
      });
      io.to(roomCode).emit('sound:trigger', { sound: 'chime' });
      io.to(roomCode).emit('room:updated');
    } catch (e: any) {
      socket.emit('error', e.message);
    }
  });

  socket.on('party:start', ({ code, hostId, skipWarmupQuiz, withCountdown }) => {
    try {
      const roomCode = code.toUpperCase();
      startPartyShow(roomCode, hostId, { skipWarmupQuiz, withCountdown });
      const room = getRoom(roomCode);
      const step = room?.party.currentStep;

      io.to(roomCode).emit('room:updated');
      let sound = 'bells';
      if (step === 'countdown') sound = 'countdown';
      else if (step === 'roulette') sound = 'roulette';
      io.to(roomCode).emit('sound:trigger', { sound });
    } catch (e: any) {
      socket.emit('error', e.message);
    }
  });

  socket.on('party:next', ({ code, hostId }) => {
    try {
      const roomCode = code.toUpperCase();
      advancePartyStep(roomCode, hostId);
      const room = getRoom(roomCode);
      const step = room?.party.currentStep;

      // Sound triggers according to step
      let sound = 'pop';
      if (step === 'countdown') sound = 'countdown';
      if (step === 'question_builder') sound = 'pop';
      if (step === 'quiz_question') sound = 'mystery';
      if (step === 'quiz_reveal') sound = 'fanfare';
      if (step === 'roulette') sound = 'roulette';
      if (step === 'riddle') sound = 'mystery';
      if (step === 'guess') sound = 'countdown';
      if (step === 'photos') sound = 'camera';
      if (step === 'reveal') sound = 'fanfare';
      if (step === 'finished') sound = 'celebration';

      io.to(roomCode).emit('sound:trigger', { sound });
      io.to(roomCode).emit('room:updated');
    } catch (e: any) {
      socket.emit('error', e.message);
    }
  });

  socket.on(
    'party:submit_custom_question',
    ({ code, participantId, question, options, correctIndex, explanation, category }) => {
      try {
        const roomCode = code.toUpperCase();
        submitPlayerCustomQuestion(roomCode, participantId, {
          question,
          options,
          correctIndex,
          explanation,
          category,
        });
        io.to(roomCode).emit('sound:trigger', { sound: 'pop' });
        io.to(roomCode).emit('room:updated');
      } catch (e: any) {
        socket.emit('error', e.message);
      }
    }
  );

  socket.on('party:skip_custom_question', ({ code, participantId }) => {
    try {
      const roomCode = code.toUpperCase();
      skipPlayerCustomQuestion(roomCode, participantId);
      io.to(roomCode).emit('room:updated');
    } catch (e: any) {
      socket.emit('error', e.message);
    }
  });

  socket.on('party:quiz_answer', ({ code, participantId, optionIndex }) => {
    const roomCode = code.toUpperCase();
    const success = submitQuizAnswer(roomCode, participantId, optionIndex);
    if (success) {
      io.to(roomCode).emit('room:updated');
    }
  });

  socket.on('party:quiz_skip', ({ code, hostId }) => {
    try {
      const roomCode = code.toUpperCase();
      skipQuizBreak(roomCode, hostId);
      io.to(roomCode).emit('room:updated');
      io.to(roomCode).emit('sound:trigger', { sound: 'bells' });
    } catch (e: any) {
      socket.emit('error', e.message);
    }
  });

  socket.on('party:guess', ({ code, voterId, guessedId }) => {
    const roomCode = code.toUpperCase();
    submitPartyGuess(roomCode, voterId, guessedId);
    io.to(roomCode).emit('room:updated');
  });

  socket.on('party:reaction', ({ code, emoji, sound, senderName }) => {
    const roomCode = code.toUpperCase();
    const reaction = postReaction(roomCode, emoji, sound, senderName);
    io.to(roomCode).emit('reaction:trigger', reaction);
    io.to(roomCode).emit('sound:trigger', { sound });
  });
});

// Production static frontend serving (Vite build in dist/)
const distPath = path.join(process.cwd(), 'dist');
if (fs.existsSync(distPath)) {
  app.use(express.static(distPath));
  app.use((req, res, next) => {
    if (req.method !== 'GET') return next();
    if (req.path.startsWith('/api') || req.path.startsWith('/uploads') || req.path.startsWith('/socket.io')) {
      return next();
    }
    res.sendFile(path.join(distPath, 'index.html'));
  });
}

const isMain = Boolean(process.argv[1] && /server\/index\.(ts|js)$/.test(process.argv[1]));

if (isMain && process.env.NODE_ENV !== 'test') {
  server.listen(PORT, () => {
    const netInfo = getNetworkInfo();
    console.log(`🎅 Secret Santa Jackbox Party server running on http://localhost:${PORT}`);
    console.log(`📡 Local Wi-Fi network detected: ${netInfo.url} (IP: ${netInfo.ip})`);
    if (netInfo.tunnelUrl) {
      console.log(`🌐 Active tunnel override: ${netInfo.tunnelUrl}`);
    }
  });
}

export { app, server, io };
