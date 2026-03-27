/**
 * Upstash Redis helpers for the all-time top-3 leaderboard.
 *
 * Strategy: store the leaderboard as a JSON array under a single key using
 * only GET / SET, which are permitted on all Upstash tiers.  Ranking and
 * trimming happen in-process before the value is written back.
 *
 * Race condition note: the game's single-threaded answered flag guarantees
 * recordWin is called at most once per round, so no concurrent writes occur.
 */

import { Redis } from '@upstash/redis';

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN,
});

const TOP_SCORES_KEY = 'quiz:top3';
const TOP_N = 3;

/**
 * Increment a player's win count, keep only the top TOP_N entries, and
 * persist the result.  Returns the updated leaderboard.
 *
 * @param {string} name  Player display name.
 * @returns {Promise<Array<{name: string, score: number}>>}
 */
export async function recordWin(name) {
  const current = await fetchTopScores();

  const existing = current.find((e) => e.name === name);
  let updated;

  if (existing) {
    updated = current.map((e) =>
      e.name === name ? { name: e.name, score: e.score + 1 } : e,
    );
  } else {
    updated = [...current, { name, score: 1 }];
  }

  // Sort descending by score and keep only the top N.
  updated.sort((a, b) => b.score - a.score);
  updated = updated.slice(0, TOP_N);

  await redis.set(TOP_SCORES_KEY, JSON.stringify(updated));
  return updated;
}

/**
 * Return the current top-N from Redis without modifying the stored value.
 *
 * @returns {Promise<Array<{name: string, score: number}>>}
 */
export async function fetchTopScores() {
  const data = await redis.get(TOP_SCORES_KEY);
  if (!data) return [];
  // @upstash/redis auto-parses JSON responses; handle both array and string.
  return Array.isArray(data) ? data : JSON.parse(data);
}
