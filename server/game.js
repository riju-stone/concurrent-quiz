/**
 * Game state machine for the competitive math quiz.
 *
 * Manages rounds, scores, and — most importantly — the atomic
 * first-answer detection.  Node's single-threaded event loop guarantees
 * that `submitAnswer` executes without interleaving, so the simple
 * boolean `answered` flag acts as an unbreakable mutex.
 */

import { generate } from './questionGenerator.js';

/** Seconds between a round ending and the next question appearing. */
const ROUND_DELAY_SECONDS = 5;

/** Difficulty increases every N rounds. */
const ROUNDS_PER_DIFFICULTY = 2;
const MAX_DIFFICULTY = 5;

class Game {
  constructor() {
    this.roundNumber = 0;
    this.currentQuestion = null; // { question, answer }
    this.answered = false;
    this.winnerId = null;
    this.players = new Map();    // socketId → { name, score }
    this._roundTimer = null;
  }

  /* ── player management ───────────────────────────────────────────── */

  addPlayer(socketId, name) {
    this.players.set(socketId, { name, score: 0 });
  }

  removePlayer(socketId) {
    this.players.delete(socketId);
  }

  getPlayerName(socketId) {
    return this.players.get(socketId)?.name ?? 'Unknown';
  }

  /* ── round lifecycle ─────────────────────────────────────────────── */

  /**
   * Start a new round.
   * @returns {{ roundNumber: number, question: string }} — answer is NOT included.
   */
  startRound() {
    this.roundNumber += 1;
    this.answered = false;
    this.winnerId = null;

    const level = Math.min(
      MAX_DIFFICULTY,
      Math.ceil(this.roundNumber / ROUNDS_PER_DIFFICULTY),
    );
    this.currentQuestion = generate(level);

    return {
      roundNumber: this.roundNumber,
      question: this.currentQuestion.question,
    };
  }

  /**
   * Attempt to answer the current question.
   *
   * Because Node.js processes one callback at a time, the check on
   * `this.answered` and the subsequent assignment are effectively
   * atomic — no two callers can both read `false` and race past.
   *
   * @param {string} socketId
   * @param {number|string} answer — will be coerced to a number.
   * @returns {{ correct: boolean, first: boolean }}
   */
  submitAnswer(socketId, answer) {
    const numericAnswer = Number(answer);

    if (!this.currentQuestion || isNaN(numericAnswer)) {
      return { correct: false, first: false };
    }

    const isCorrect = numericAnswer === this.currentQuestion.answer;

    if (!isCorrect) {
      return { correct: false, first: false };
    }

    // ── critical section (safe: single-threaded) ──
    if (this.answered) {
      return { correct: true, first: false };
    }

    this.answered = true;
    this.winnerId = socketId;
    // ── end critical section ──

    const player = this.players.get(socketId);
    if (player) {
      player.score += 1;
    }

    return { correct: true, first: true };
  }

  /* ── scoreboard ──────────────────────────────────────────────────── */

  getScoreboard() {
    return Array.from(this.players.entries())
      .map(([id, { name, score }]) => ({ id, name, score }))
      .sort((a, b) => b.score - a.score);
  }

  /* ── cleanup ─────────────────────────────────────────────────────── */

  clearRoundTimer() {
    if (this._roundTimer) {
      clearTimeout(this._roundTimer);
      this._roundTimer = null;
    }
  }
}

export { Game, ROUND_DELAY_SECONDS };
