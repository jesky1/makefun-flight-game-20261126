// Sky Courier — the screenshot scenes behind ?shot=title|play|rings|land. Each scene
// sets the plane to a fixed, hand-placed state over the real course (seed 1), so the
// frame is what a real flight looks like and the same seed always gives the same frame.
import { SCREEN_OVER, SCREEN_PLAY, SCREEN_TITLE } from './render.js';

/** Point the plane at the next ring from a fixed spot; returns the state to draw. */
function place(state, x, z, y, headingDeg, speed, throttle) {
  state.x = x;
  state.z = z;
  state.y = y;
  state.heading = (headingDeg * Math.PI) / 180;
  state.pitch = 0;
  state.roll = 0;
  state.speed = speed;
  state.throttle = throttle;
  state.timeLeft = 187;
  state.message = '';
  state.messageT = 0;
  state.stallWarn = false;
}

export function stageShot(name, world) {
  const { state, rings } = world;
  world.reset();
  if (name === 'play') {
    // Mid-course, banking right toward ring 2 over the green island.
    place(state, 1450, 620, 780, 118, 155, 0.8);
    state.roll = 0.38;
    state.pitch = -0.05;
    state.ringsPassed = 1;
    rings[0].passed = true;
    state.score = 100;
    return { screen: SCREEN_PLAY, best: 0 };
  }
  if (name === 'rings') {
    // Seconds from ring 4, city blocks below, ring dead ahead.
    place(state, 2620, 1650, 640, 155, 150, 0.75);
    state.ringsPassed = 3;
    rings[0].passed = true;
    rings[1].passed = true;
    rings[2].passed = true;
    state.score = 300;
    state.message = 'RING 3 / 6  +100';
    state.messageT = 2.2;
    return { screen: SCREEN_PLAY, best: 300 };
  }
  if (name === 'land') {
    // On final: lined up with the runway, gear down low, threshold ahead.
    place(state, 1050, 2480, 130, 0, 96, 0.35);
    state.ringsPassed = 6;
    for (const ring of rings) ring.passed = true;
    state.score = 600;
    state.message = 'FINAL — LAND ON THE RUNWAY';
    state.messageT = 9;
    return { screen: SCREEN_PLAY, best: 600 };
  }
  if (name === 'over') {
    place(state, 1050, 1800, 12, 0, 0, 0);
    state.landed = true;
    state.score = 1100;
    state.ringsPassed = 6;
    for (const ring of rings) ring.passed = true;
    return { screen: SCREEN_OVER, best: 1100 };
  }
  // Default: the title scene, parked in the air over the home island with the
  // runway and the city ahead, so the title shows the world, not a blank sky.
  place(state, 700, 260, 900, 90, 140, 0.75);
  return { screen: SCREEN_TITLE, best: 0 };
}
