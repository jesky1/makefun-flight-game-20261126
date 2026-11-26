// Sky Courier — tunables in one place. All distances in metres, speeds in knots,
// altitudes in feet (the HUD shows feet, as a real cockpit does).
export const STEP = 1 / 60;
export const WORLD = 4096; // the top-down map is WORLD x WORLD metres
export const SEA_LEVEL = 0;

export const PLANE = {
  cruiseSpeed: 145, // knots at full throttle
  minSpeed: 55, // below this the wing stops flying and the nose drops
  maxSpeed: 210,
  climbRate: 22, // ft/s at full power, level
  sinkRate: 26, // ft/s at idle, level
  rollRate: 1.9, // rad/s of bank change
  maxBank: 1.05, // rad (~60 deg)
  turnRate: 0.55, // heading rad/s at full bank
  pitchRate: 0.6,
  maxPitch: 0.42,
  startAltitude: 900, // ft
  startSpeed: 140,
};

export const COURSE = {
  timeLimit: 240, // seconds
  ringScore: 100,
  ringBonusTime: 12, // seconds added per ring
  landingBonus: 500,
  ringRadius: 55, // metres; the ring's hole is generous on purpose
};

export const BEST_KEY = 'sky-courier-best';
export const SHOT_SEED = 1;
