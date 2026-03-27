# ⚡ Concurrent Quiz — Competitive Math

A real-time competitive math quiz where multiple users race to answer dynamically generated problems. The first correct answer wins the round.

## Quick Start

```bash
npm install
npm start          # → http://localhost:3000
```

Open the URL in **two or more browser tabs** (or on different devices on the same network) to play head-to-head.

## How It Works

| Layer | Technology | Purpose |
|-------|-----------|---------|
| Server | Node.js + Express | Serves the static front-end |
| Real-time | Socket.IO | WebSocket transport with auto-reconnection & long-polling fallback |
| Game logic | In-memory state machine | Atomic first-answer detection via Node's single-threaded event loop |
| Client | Vanilla HTML/CSS/JS | No framework — lightweight and fast |

### Concurrency & Fairness

- The server holds a boolean `answered` lock per round.
- When an answer arrives, the server synchronously checks-and-sets this flag. Node's event loop guarantees no two callbacks can interleave — this is an atomic operation without needing an external lock.
- **Server arrival order** is the sole source of truth. Client timestamps are never used, so clock skew and network jitter cannot game the result.
- Socket.IO transparently handles reconnection and falls back to HTTP long-polling when WebSocket is blocked.

### Dynamic Questions

`server/questionGenerator.js` produces randomised math problems across five operation types (addition, subtraction, multiplication, integer division, exponentiation). Difficulty scales automatically with the round number.

## Project Structure

```
concurrent-quiz/
├── package.json
├── server/
│   ├── index.js              # Express + Socket.IO bootstrap
│   ├── game.js               # Round state machine & concurrency lock
│   └── questionGenerator.js  # Dynamic math problem factory
└── public/
    ├── index.html
    ├── css/style.css
    └── js/app.js
```

## Configuration

| Environment Variable | Default | Description |
|---------------------|---------|-------------|
| `PORT` | `3000` | HTTP server port |

## License

MIT