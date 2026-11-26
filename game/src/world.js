// Sky Courier — the world: islands, a city, a runway, the ring course, and the
// flight model. Pure logic, no DOM: the renderer draws what this describes and
// the headless tests import it directly.
//
// The map is WORLD x WORLD metres, x east, z south. The sea is flat; islands are
// smooth bumps defined by circles, so heightAt() and the painted map always agree.
import { COURSE, PLANE, SEA_LEVEL, STEP, WORLD } from './config.js';
import { range } from './random.js';

export const EVENT_RING = 1;
export const EVENT_CRASH = 2;
export const EVENT_LANDED = 4;
export const EVENT_OVER = 8;
export const EVENT_STALL_WARN = 16;

/** Islands: [centreX, centreZ, radius, peakHeightFeet]. */
export const ISLANDS = [
  [1050, 1250, 520, 260], // home island, holds the city and the runway
  [2350, 900, 380, 320], // green twin peaks
  [2900, 2500, 430, 180], // low palm island
  [1500, 2900, 300, 210], // rocky islet south
  [3300, 1650, 210, 120], // sandbar
];

/** The city grid sits on the home island: [x, z, halfSize, blocksPerSide]. */
export const CITY = { x: 1050, z: 1150, half: 260, blocks: 7 };

/** Runway: a flat strip on the home island, heading north (towards -z). */
export const RUNWAY = {
  x: 1050, // centreline
  z: 1750, // centre
  length: 700, // metres along z
  width: 46,
  heading: 0, // landing heading: north, 000 degrees
};

/** How high the ground is at (x, z), in feet. */
export function heightAt(x, z) {
  let height = SEA_LEVEL;
  for (let i = 0; i < ISLANDS.length; i += 1) {
    const [cx, cz, radius, peak] = ISLANDS[i];
    const dx = x - cx;
    const dz = z - cz;
    const d = Math.sqrt(dx * dx + dz * dz);
    if (d >= radius) continue;
    const fall = 1 - d / radius;
    const bump = peak * fall * fall * (3 - 2 * fall); // smoothstep hump
    if (bump > height) height = bump;
  }
  // The runway and its apron are bulldozed flat at 12 ft.
  const rx = Math.abs(x - RUNWAY.x);
  const rz = Math.abs(z - RUNWAY.z);
  if (rx < RUNWAY.width * 2.2 && rz < RUNWAY.length / 2 + 60) return 12;
  return height;
}

/** True when (x, z) is over the city blocks (for the map painter). */
export function inCity(x, z) {
  return Math.abs(x - CITY.x) < CITY.half && Math.abs(z - CITY.z) < CITY.half;
}

/** True when (x, z) is on the runway strip. */
export function onRunway(x, z) {
  return Math.abs(x - RUNWAY.x) < RUNWAY.width / 2 && Math.abs(z - RUNWAY.z) < RUNWAY.length / 2;
}

/** Build the ring course for a seed: six rings, the last one on final approach. */
export function buildCourse(random) {
  const rings = [];
  const stops = [
    [900, 700, 260],
    [1500, 650, 420],
    [2250, 950, 350],
    [2750, 1900, 300],
    [1900, 2450, 380],
    [1050, 2350, 140], // on final: lined up with the runway, low
  ];
  for (let i = 0; i < stops.length; i += 1) {
    const [x, z, alt] = stops[i];
    rings.push({
      x: x + range(random, -60, 60),
      z: z + range(random, -60, 60),
      y: alt + range(random, -25, 25), // feet
      radius: COURSE.ringRadius,
      passed: false,
    });
  }
  // The final ring sits exactly on the runway centreline.
  rings[5].x = RUNWAY.x;
  rings[5].z = RUNWAY.z + RUNWAY.length / 2 + 260;
  rings[5].y = 130;
  return rings;
}

export function createWorld(random) {
  const rings = buildCourse(random);
  const state = freshState();
  const world = { state, rings };

  function freshState() {
    return {
      x: 700,
      z: 260,
      y: PLANE.startAltitude, // feet
      heading: Math.PI / 2, // east, towards the first ring
      pitch: 0,
      roll: 0,
      speed: PLANE.startSpeed, // knots
      throttle: 0.75,
      score: 0,
      ringsPassed: 0,
      timeLeft: COURSE.timeLimit,
      crashed: false,
      landed: false,
      stallWarn: false,
      message: '',
      messageT: 0,
    };
  }

  world.reset = function reset() {
    const next = freshState();
    for (const key of Object.keys(next)) state[key] = next[key];
    for (const ring of rings) ring.passed = false;
  };

  /**
   * Advance the world one fixed step. `ctl` is {bank, pitch, throttle, mouse}
   * with bank/pitch in [-1, 1]. Returns an event bitmask.
   */
  world.step = function step(dt, ctl) {
    if (state.crashed || state.landed) return 0;
    let events = 0;
    state.timeLeft -= dt;
    if (state.timeLeft <= 0) {
      state.timeLeft = 0;
      state.crashed = true;
      state.message = 'OUT OF TIME';
      return EVENT_OVER;
    }

    // --- controls: bank rolls the wings, pitch moves the nose ---
    const targetRoll = ctl.bank * PLANE.maxBank;
    state.roll += (targetRoll - state.roll) * Math.min(1, dt * 4);
    // Banking right (positive roll) turns the nose right: east -> south.
    state.heading += Math.sin(state.roll) * PLANE.turnRate * dt * 2.2;
    const targetPitch = ctl.pitch * PLANE.maxPitch;
    state.pitch += (targetPitch - state.pitch) * Math.min(1, dt * 3);

    // --- throttle and speed: drag grows with the square of speed ---
    state.throttle = Math.max(0, Math.min(1, state.throttle + ctl.throttle * dt * 0.5));
    const targetSpeed = PLANE.minSpeed + state.throttle * (PLANE.cruiseSpeed - PLANE.minSpeed);
    state.speed += (targetSpeed - state.speed) * Math.min(1, dt * 0.5);

    // --- climb and sink: pitch trades speed for altitude, throttle feeds it ---
    const climb = Math.sin(state.pitch) * PLANE.climbRate * 3 + (state.throttle - 0.55) * PLANE.climbRate;
    const stall = state.speed < PLANE.minSpeed + 12;
    state.stallWarn = stall;
    if (stall) events |= EVENT_STALL_WARN;
    const vertical = stall ? climb - PLANE.sinkRate * 0.7 : climb;
    state.y += vertical * dt;

    // --- move over the map: knots to m/s is 0.514, feet to metres 0.3048 ---
    const metresPerSecond = state.speed * 0.514;
    state.x += Math.sin(state.heading) * metresPerSecond * dt;
    state.z += -Math.cos(state.heading) * metresPerSecond * dt;
    // Soft walls: the sea goes on, but the course stays on the map.
    state.x = Math.max(120, Math.min(WORLD - 120, state.x));
    state.z = Math.max(120, Math.min(WORLD - 120, state.z));

    // --- rings: through the hole, not just near it ---
    for (let i = 0; i < rings.length; i += 1) {
      const ring = rings[i];
      if (ring.passed || i !== state.ringsPassed) continue;
      const dx = state.x - ring.x;
      const dz = state.z - ring.z;
      const dy = (state.y - ring.y) * 0.3048; // feet to metres
      const dist = Math.sqrt(dx * dx + dz * dz + dy * dy);
      if (dist < ring.radius) {
        ring.passed = true;
        state.ringsPassed += 1;
        state.score += COURSE.ringScore;
        state.timeLeft += COURSE.ringBonusTime;
        state.message = `RING ${state.ringsPassed} / ${rings.length}  +${COURSE.ringScore}`;
        state.messageT = 2.2;
        events |= EVENT_RING;
        break;
      }
    }
    if (state.messageT > 0) state.messageT -= dt;

    // --- landing: slow, low, lined up, over the strip ---
    const ground = heightAt(state.x, state.z);
    if (onRunway(state.x, state.z) && state.ringsPassed >= rings.length) {
      const aligned = Math.abs(headingDegrees(state.heading) - RUNWAY.heading) < 25
        || Math.abs(headingDegrees(state.heading) - 360) < 25;
      if (aligned && state.y < 55 && state.speed < 120 && Math.abs(vertical) < 18) {
        state.landed = true;
        state.y = 12;
        state.score += COURSE.landingBonus;
        state.message = `LANDED!  +${COURSE.landingBonus}`;
        return events | EVENT_LANDED | EVENT_OVER;
      }
    }

    // --- the ground is not a suggestion ---
    if (state.y <= ground + 2) {
      state.y = ground;
      state.crashed = true;
      state.message = state.y <= 2 ? 'DITCHED IN THE SEA' : 'TERRAIN! TERRAIN!';
      return events | EVENT_CRASH | EVENT_OVER;
    }
    return events;
  };

  world.reset();
  return world;
}

/** Heading in degrees, 0 = north, 90 = east. */
export function headingDegrees(heading) {
  let deg = (heading * 180) / Math.PI;
  deg = ((deg % 360) + 360) % 360;
  return deg;
}

/** Distance in metres from the plane to the next ring. */
export function nextRingDistance(state, rings) {
  const ring = rings[state.ringsPassed];
  if (!ring) return 0;
  const dx = state.x - ring.x;
  const dz = state.z - ring.z;
  return Math.sqrt(dx * dx + dz * dz);
}

export { STEP };
