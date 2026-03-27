/**
 * Entry point — wires Express (static file serving) with Socket.IO
 * (real-time quiz events) and the Game state machine.
 */

import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import { createServer } from 'node:http';
import { Server } from 'socket.io';

import { Game, ROUND_DELAY_SECONDS } from './game.js';
import { recordWin, fetchTopScores } from './redis.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/* ── bootstrap ──────────────────────────────────────────────────────── */

const PORT = process.env.PORT || 3000;
const app  = express();
const server = createServer(app);
const io     = new Server(server);

const game = new Game();

/* ── static files ───────────────────────────────────────────────────── */

app.use(express.static(path.join(__dirname, '..', 'public')));

/* ── helpers ────────────────────────────────────────────────────────── */

/** Broadcast a new round to every connected client. */
function broadcastNewRound() {
  const round = game.startRound();
  io.emit('new-question', {
    roundNumber: round.roundNumber,
    question:    round.question,
  });
  io.emit('scoreboard', game.getScoreboard());
}

/** Schedule the next round after the between-round delay. */
function scheduleNextRound() {
  game.clearRoundTimer();

  // Emit countdown start so clients can show the timer.
  io.emit('round-countdown', { seconds: ROUND_DELAY_SECONDS });

  game._roundTimer = setTimeout(() => {
    broadcastNewRound();
  }, ROUND_DELAY_SECONDS * 1000);
}

/* ── socket events ──────────────────────────────────────────────────── */

io.on('connection', (socket) => {
  console.log(`⚡  connected: ${socket.id}`);

  /* ── player registration ──────────────────────────────────────────── */
  socket.on('register', (name) => {
    const sanitized = String(name).trim().slice(0, 20) || 'Anon';
    game.addPlayer(socket.id, sanitized);
    console.log(`👤  registered: ${sanitized} (${socket.id})`);

    // If this is the first player and no round is active, kick one off.
    if (game.roundNumber === 0) {
      broadcastNewRound();
    } else {
      // Send the current state so the newcomer / reconnector is in sync.
      socket.emit('new-question', {
        roundNumber: game.roundNumber,
        question:    game.currentQuestion?.question ?? '',
        answered:    game.answered,
      });
    }

    io.emit('scoreboard', game.getScoreboard());

    // Send the current top-3 to the newly connected client.
    fetchTopScores()
      .then((top) => socket.emit('top-scores', top))
      .catch((err) => console.error('Redis fetchTopScores error:', err));
  });

  /* ── answer submission ────────────────────────────────────────────── */
  socket.on('submit-answer', (answer) => {
    const result = game.submitAnswer(socket.id, answer);

    // Personal feedback to the submitter.
    socket.emit('answer-feedback', result);

    if (result.correct && result.first) {
      const winnerName = game.getPlayerName(socket.id);

      // Announce the winner to everyone.
      io.emit('round-result', {
        winnerId:   socket.id,
        winnerName,
        answer:     game.currentQuestion.answer,
      });

      // Persist the win and broadcast updated top-3.
      recordWin(winnerName)
        .then((top) => io.emit('top-scores', top))
        .catch((err) => console.error('Redis recordWin error:', err));

      scheduleNextRound();
    }
  });

  /* ── disconnect ───────────────────────────────────────────────────── */
  socket.on('disconnect', () => {
    const name = game.getPlayerName(socket.id);
    game.removePlayer(socket.id);
    io.emit('scoreboard', game.getScoreboard());
    console.log(`💤  disconnected: ${name} (${socket.id})`);
  });
});

/* ── start ──────────────────────────────────────────────────────────── */

server.listen(PORT, () => {
  console.log(`🚀  Quiz server running → http://localhost:${PORT}`);
});
