// A tiny deterministic RNG (mulberry32) so a seed always builds the same course
// and the same screenshots, while a fresh game still feels different.
export function createRandom(seed) {
  let state = seed >>> 0;
  return function next() {
    state |= 0;
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Integer in [min, max] from the seeded stream. */
export function range(random, min, max) {
  return min + random() * (max - min);
}
