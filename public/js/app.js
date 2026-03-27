/**
 * Client-side logic for the Concurrent Quiz.
 *
 * Handles Socket.IO communication, DOM updates, and UI animations.
 * Relies on the Socket.IO client script loaded before this file.
 */

(function () {
  'use strict';

  /* ── DOM refs ──────────────────────────────────────────────────── */
  const nameOverlay   = document.getElementById('name-overlay');
  const nameForm      = document.getElementById('name-form');
  const nameInput     = document.getElementById('name-input');

  const appEl         = document.getElementById('app');
  const playerBadge   = document.getElementById('player-name-badge');

  const roundNumberEl = document.getElementById('round-number');
  const questionEl    = document.getElementById('question-display');
  const answerForm    = document.getElementById('answer-form');
  const answerInput   = document.getElementById('answer-input');
  const submitBtn     = document.getElementById('submit-btn');
  const feedbackEl    = document.getElementById('feedback');

  const statusSection = document.getElementById('status-section');
  const statusMessage = document.getElementById('status-message');
  const countdownEl   = document.getElementById('countdown');

  const scoreboardList = document.getElementById('scoreboard-list');
  const playerCountEl  = document.getElementById('player-count');
  const topScoresList  = document.getElementById('top-scores-list');

  /* ── state ─────────────────────────────────────────────────────── */
  let socket      = null;
  let playerName  = '';
  let mySocketId  = '';
  let countdownId = null; // interval id for the between-round timer

  /* ── helpers ───────────────────────────────────────────────────── */

  /** Set text content, sanitising by default (textContent, not innerHTML). */
  function setText(el, text) { el.textContent = text; }

  /** Remove a CSS class after a timeout (for one-shot animations). */
  function flashClass(el, cls, ms = 400) {
    el.classList.add(cls);
    setTimeout(() => el.classList.remove(cls), ms);
  }

  /** Enable / disable the answer form. */
  function setFormEnabled(enabled) {
    answerInput.disabled = !enabled;
    submitBtn.disabled   = !enabled;
  }

  /** Stop countdown interval if running. */
  function clearCountdown() {
    if (countdownId !== null) {
      clearInterval(countdownId);
      countdownId = null;
    }
  }

  /* ── name prompt ───────────────────────────────────────────────── */

  // Restore name from sessionStorage so page refreshes skip the prompt.
  const storedName = sessionStorage.getItem('quiz-player-name');
  if (storedName) {
    playerName = storedName;
    showApp();
  }

  nameForm.addEventListener('submit', (e) => {
    e.preventDefault();
    playerName = nameInput.value.trim().slice(0, 20) || 'Anon';
    sessionStorage.setItem('quiz-player-name', playerName);
    showApp();
  });

  function showApp() {
    nameOverlay.classList.add('hidden');
    appEl.classList.remove('hidden');
    setText(playerBadge, playerName);
    connectSocket();
  }

  /* ── socket connection ─────────────────────────────────────────── */

  function connectSocket() {
    socket = io({ reconnection: true, reconnectionDelay: 500 });
    mySocketId = '';

    socket.on('connect', () => {
      mySocketId = socket.id;
      socket.emit('register', playerName);
    });

    /* ── new question ───────────────────────────────────────────── */
    socket.on('new-question', (data) => {
      clearCountdown();
      statusSection.classList.add('hidden');

      roundNumberEl.textContent = data.roundNumber;
      questionEl.textContent    = data.question;

      feedbackEl.textContent = '';
      feedbackEl.className   = 'feedback';

      if (data.answered) {
        // Joined mid-round after answer was already given — wait for next round.
        setFormEnabled(false);
        setText(feedbackEl, 'Round already answered — waiting for next question…');
        feedbackEl.classList.add('late');
      } else {
        setFormEnabled(true);
        answerInput.value = '';
        answerInput.focus();
      }
    });

    /* ── personal feedback after submitting ──────────────────────── */
    socket.on('answer-feedback', (result) => {
      feedbackEl.className = 'feedback';

      if (result.correct && result.first) {
        setText(feedbackEl, '🎉 Correct — you won this round!');
        feedbackEl.classList.add('correct');
        flashClass(questionEl, 'pulse', 600);
        setFormEnabled(false);
      } else if (result.correct && !result.first) {
        setText(feedbackEl, 'Correct, but someone beat you to it!');
        feedbackEl.classList.add('late');
        setFormEnabled(false);
      } else {
        setText(feedbackEl, 'Incorrect — try again!');
        feedbackEl.classList.add('wrong');
        flashClass(answerInput, 'shake', 400);
        // keep form enabled so the player can retry
        answerInput.value = '';
        answerInput.focus();
      }
    });

    /* ── round result (broadcast to everyone) ───────────────────── */
    socket.on('round-result', (data) => {
      setFormEnabled(false);
      statusSection.classList.remove('hidden');

      const isMe = data.winnerId === mySocketId;
      const who  = isMe ? 'You' : data.winnerName;

      setText(statusMessage, `${who} won! Answer: ${data.answer}`);
    });

    /* ── countdown between rounds ───────────────────────────────── */
    socket.on('round-countdown', ({ seconds }) => {
      statusSection.classList.remove('hidden');
      let remaining = seconds;

      const tick = () => {
        setText(countdownEl, `Next question in ${remaining}s…`);
        remaining -= 1;
      };

      tick(); // show immediately
      clearCountdown();
      countdownId = setInterval(() => {
        if (remaining < 0) {
          clearCountdown();
          setText(countdownEl, '');
        } else {
          tick();
        }
      }, 1000);
    });

    /* ── scoreboard update ──────────────────────────────────────── */
    socket.on('scoreboard', (scores) => {
      scoreboardList.innerHTML = '';
      scores.forEach((entry, i) => {
        const li = document.createElement('li');
        if (entry.id === mySocketId) li.classList.add('highlight');

        li.innerHTML =
          `<span class="rank">${i + 1}.</span>` +
          `<span class="name">${escapeHtml(entry.name)}</span>` +
          `<span class="score">${entry.score}</span>`;

        scoreboardList.appendChild(li);
      });

      setText(playerCountEl, `${scores.length} player${scores.length !== 1 ? 's' : ''} online`);
    });
    /* ── all-time top-3 update ───────────────────────────────── */
    socket.on('top-scores', renderTopScores);
    /* ── reconnection handling ──────────────────────────────────── */
    socket.on('disconnect', () => {
      setText(feedbackEl, 'Connection lost — reconnecting…');
      feedbackEl.className = 'feedback wrong';
    });

    socket.on('reconnect', () => {
      socket.emit('register', playerName);
    });
  }

  /* ── answer submission ─────────────────────────────────────────── */

  answerForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const val = answerInput.value.trim();
    if (val === '' || !socket?.connected) return;
    socket.emit('submit-answer', Number(val));
  });

  /* ── XSS-safe helper ───────────────────────────────────────────── */

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }
  /* ── top-scores renderer ─────────────────────────────────── */

  const MEDALS = ['🥇', '🥈', '🥉'];

  function renderTopScores(entries) {
    topScoresList.innerHTML = '';

    if (!entries || entries.length === 0) {
      const li = document.createElement('li');
      li.className = 'placeholder';
      li.textContent = 'No scores yet…';
      topScoresList.appendChild(li);
      return;
    }

    entries.forEach((entry, i) => {
      const li = document.createElement('li');
      li.className = 'new-entry';
      li.innerHTML =
        `<span class="medal">${MEDALS[i] ?? i + 1 + '.'}</span>` +
        `<span class="ts-name">${escapeHtml(entry.name)}</span>` +
        `<span class="ts-score">${entry.score} win${entry.score !== 1 ? 's' : ''}</span>`;
      topScoresList.appendChild(li);
    });
  }})();
