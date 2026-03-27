/**
 * Dynamic math question generator.
 *
 * Produces randomised arithmetic problems with verified integer answers.
 * Difficulty scales with the supplied `level` parameter (1–5).
 */

const OPERATIONS = [
  { type: 'addition',       symbol: '+',  fn: (a, b) => a + b },
  { type: 'subtraction',    symbol: '−',  fn: (a, b) => a - b },
  { type: 'multiplication', symbol: '×',  fn: (a, b) => a * b },
  { type: 'division',       symbol: '÷',  fn: (a, b) => a / b },
  { type: 'exponentiation', symbol: '^',  fn: (a, b) => a ** b },
];

/* ── helpers ────────────────────────────────────────────────────────── */

/** Random integer in [min, max] inclusive. */
function randInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

/** Pick a random element from an array. */
function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

/** Range boundaries that grow with difficulty level. */
function rangeForLevel(level) {
  const lo = 2;
  const hi = 10 + level * 8;        // level 1 → 18, level 5 → 50
  return { lo, hi };
}

/* ── generators per operation type ──────────────────────────────────── */

function generateAddition(level) {
  const { lo, hi } = rangeForLevel(level);
  const a = randInt(lo, hi);
  const b = randInt(lo, hi);
  return { question: `${a} + ${b}`, answer: a + b };
}

function generateSubtraction(level) {
  const { lo, hi } = rangeForLevel(level);
  let a = randInt(lo, hi);
  let b = randInt(lo, hi);
  if (a < b) [a, b] = [b, a];       // keep answer non-negative
  return { question: `${a} − ${b}`, answer: a - b };
}

function generateMultiplication(level) {
  const { lo, hi } = rangeForLevel(level);
  const a = randInt(lo, Math.min(hi, 15 + level * 5));
  const b = randInt(lo, Math.min(hi, 12 + level * 3));
  return { question: `${a} × ${b}`, answer: a * b };
}

function generateDivision(level) {
  const { lo, hi } = rangeForLevel(level);
  const b = randInt(lo, Math.min(hi, 12));
  const quotient = randInt(lo, hi);
  const a = b * quotient;            // guarantees integer answer
  return { question: `${a} ÷ ${b}`, answer: quotient };
}

function generateExponentiation(level) {
  const base = randInt(2, 6 + level);
  const exp  = randInt(2, Math.min(2 + Math.floor(level / 2), 4));
  return { question: `${base} ^ ${exp}`, answer: base ** exp };
}

const GENERATORS = [
  generateAddition,
  generateSubtraction,
  generateMultiplication,
  generateDivision,
  generateExponentiation,
];

/* ── public API ─────────────────────────────────────────────────────── */

/**
 * Generate a math question.
 * @param {number} [level=1] Difficulty level (1–5).
 * @returns {{ question: string, answer: number }}
 */
export function generate(level = 1) {
  const gen = pick(GENERATORS);
  return gen(Math.max(1, Math.min(5, level)));
}
