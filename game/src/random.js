// A small seeded random number generator: the same seed gives the same game, which is
// what makes the screenshot scenes repeatable and the two harness runs byte-identical.
// Mulberry32 — a tiny 32-bit generator with a full period for its state size.

export function createRandom(seed) {
  let state = (seed | 0) >>> 0;
  return function random() {
    state = (state + 0x6d2b79f5) >>> 0;
    let mixed = state;
    mixed = Math.imul(mixed ^ (mixed >>> 15), mixed | 1);
    mixed ^= mixed + Math.imul(mixed ^ (mixed >>> 7), mixed | 61);
    return ((mixed ^ (mixed >>> 14)) >>> 0) / 4294967296;
  };
}

// Pick an integer in [min, max) from a seeded random.
export function randomInt(random, min, max) {
  return min + Math.floor(random() * (max - min));
}
