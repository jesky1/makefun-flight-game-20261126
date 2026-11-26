// Sky Courier — the renderer: a chase view over a real top-down map. The ground is
// painted once onto an offscreen map canvas (sea, islands, city, runway); each frame
// the visible ground is drawn as projected quads sampled from that map, the plane is
// drawn from behind, and the instruments are lit on the panel below.
import { CITY, ISLANDS, RUNWAY, heightAt } from './world.js';
import { WORLD } from './config.js';
import { createRandom } from './random.js';

export const SCREEN_TITLE = 0;
export const SCREEN_PLAY = 1;
export const SCREEN_PAUSED = 2;
export const SCREEN_OVER = 3;

const MAP_SIZE = 1024;
const MAP_SCALE = MAP_SIZE / WORLD; // pixels per metre
const FT_TO_M = 0.3048;

function mix(a, b, t) {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
}

export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');
  const map = document.createElement('canvas');
  map.width = MAP_SIZE;
  map.height = MAP_SIZE;
  const mapCtx = map.getContext('2d');
  const mapPixels = paintMap(mapCtx);
  const clouds = buildClouds();

  /** Paint the top-down world map; return its ImageData for colour sampling. */
  function paintMap(g) {
    const rnd = createRandom(20261126);
    // Sea: deep blue with a lighter swell speckle.
    g.fillStyle = '#14608c';
    g.fillRect(0, 0, MAP_SIZE, MAP_SIZE);
    g.fillStyle = 'rgba(255,255,255,0.05)';
    for (let i = 0; i < 900; i += 1) {
      const x = rnd() * MAP_SIZE;
      const y = rnd() * MAP_SIZE;
      g.fillRect(x, y, 2, 1);
    }
    // Beaches, then grass, then forest speckle, island by island.
    for (const [cx, cz, radius, peak] of ISLANDS) {
      const px = cx * MAP_SCALE;
      const pz = cz * MAP_SCALE;
      const pr = radius * MAP_SCALE;
      const beach = g.createRadialGradient(px, pz, pr * 0.55, px, pz, pr * 1.08);
      beach.addColorStop(0, '#5d8f4a');
      beach.addColorStop(0.72, '#7fae5c');
      beach.addColorStop(0.92, '#d9c48a');
      beach.addColorStop(1, 'rgba(217,196,138,0)');
      g.fillStyle = beach;
      g.beginPath();
      g.arc(px, pz, pr * 1.08, 0, Math.PI * 2);
      g.fill();
      // Forest clumps where the island is high.
      g.fillStyle = 'rgba(38,90,40,0.55)';
      for (let i = 0; i < peak; i += 1) {
        const a = rnd() * Math.PI * 2;
        const d = rnd() * pr * 0.7;
        g.beginPath();
        g.arc(px + Math.cos(a) * d, pz + Math.sin(a) * d, 1.5 + rnd() * 3, 0, Math.PI * 2);
        g.fill();
      }
    }
    paintCity(g);
    paintRunway(g);
    return g.getImageData(0, 0, MAP_SIZE, MAP_SIZE);
  }

  function paintCity(g) {
    const { x, z, half, blocks } = CITY;
    const px = x * MAP_SCALE;
    const pz = z * MAP_SCALE;
    const size = half * 2 * MAP_SCALE;
    const step = size / blocks;
    g.fillStyle = '#7d838c';
    g.fillRect(px - half * MAP_SCALE, pz - half * MAP_SCALE, size, size);
    const rnd = createRandom(77);
    for (let bx = 0; bx < blocks; bx += 1) {
      for (let bz = 0; bz < blocks; bz += 1) {
        const shade = 120 + Math.floor(rnd() * 50);
        g.fillStyle = `rgb(${shade},${shade + 4},${shade + 10})`;
        const m = 2.5;
        g.fillRect(px - half * MAP_SCALE + bx * step + m, pz - half * MAP_SCALE + bz * step + m, step - m * 2, step - m * 2);
      }
    }
    // Roads: darker grid lines, plus one diagonal avenue.
    g.strokeStyle = '#3a3f44';
    g.lineWidth = 3;
    for (let i = 0; i <= blocks; i += 1) {
      g.beginPath();
      g.moveTo(px - half * MAP_SCALE + i * step, pz - half * MAP_SCALE);
      g.lineTo(px - half * MAP_SCALE + i * step, pz + half * MAP_SCALE);
      g.stroke();
      g.beginPath();
      g.moveTo(px - half * MAP_SCALE, pz - half * MAP_SCALE + i * step);
      g.lineTo(px + half * MAP_SCALE, pz - half * MAP_SCALE + i * step);
      g.stroke();
    }
  }

  function paintRunway(g) {
    const px = RUNWAY.x * MAP_SCALE;
    const pz = RUNWAY.z * MAP_SCALE;
    const w = RUNWAY.width * MAP_SCALE;
    const l = RUNWAY.length * MAP_SCALE;
    g.fillStyle = '#2c2f33';
    g.fillRect(px - w / 2, pz - l / 2, w, l);
    g.fillStyle = '#f4f4f4';
    for (let d = -l / 2 + 14; d < l / 2 - 10; d += 18) {
      g.fillRect(px - 1, pz + d, 2, 9);
    }
    // Threshold bars at both ends.
    for (const end of [-1, 1]) {
      for (let b = -3; b <= 3; b += 1) {
        g.fillRect(px + b * 3.4 - 1.5, pz + end * (l / 2 - 10), 3, 8);
      }
    }
    // Apron and a tiny terminal block.
    g.fillStyle = '#565b61';
    g.fillRect(px + w / 2, pz - 20, 26, 40);
  }

  function buildClouds() {
    const rnd = createRandom(4242);
    const list = [];
    for (let i = 0; i < 16; i += 1) {
      list.push({
        x: 200 + rnd() * (WORLD - 400),
        z: 200 + rnd() * (WORLD - 400),
        y: (1400 + rnd() * 1400) * FT_TO_M, // metres
        r: 90 + rnd() * 160,
      });
    }
    return list;
  }

  /** Sample the painted map at world (x, z); returns [r, g, b]. */
  function sampleMap(x, z) {
    const px = Math.max(0, Math.min(MAP_SIZE - 1, Math.floor(x * MAP_SCALE)));
    const pz = Math.max(0, Math.min(MAP_SIZE - 1, Math.floor(z * MAP_SCALE)));
    const i = (pz * MAP_SIZE + px) * 4;
    return [mapPixels.data[i], mapPixels.data[i + 1], mapPixels.data[i + 2]];
  }

  function resize() {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const w = canvas.clientWidth || window.innerWidth;
    const h = canvas.clientHeight || window.innerHeight;
    if (canvas.width !== Math.floor(w * dpr) || canvas.height !== Math.floor(h * dpr)) {
      canvas.width = Math.floor(w * dpr);
      canvas.height = Math.floor(h * dpr);
    }
    return { w: canvas.width, h: canvas.height, dpr };
  }

  /** Project a world point into screen space; null when behind the camera. */
  function project(state, wx, wyM, wz, focal, cx, cy) {
    const dx = wx - state.x;
    const dz = wz - state.z;
    const dy = wyM - state.y * FT_TO_M;
    const sinH = Math.sin(state.heading);
    const cosH = Math.cos(state.heading);
    const fwd = dx * sinH - dz * cosH;
    const right = dx * cosH + dz * sinH;
    if (fwd < 2) return null;
    const cosP = Math.cos(state.pitch);
    const sinP = Math.sin(state.pitch);
    const f2 = fwd * cosP + dy * sinP;
    const up = -fwd * sinP + dy * cosP;
    if (f2 < 2) return null;
    // Roll: banking right tilts the head right, so the world turns the other way:
    // a horizon point on the right rises on screen. This matches the attitude
    // indicator, which rotates its horizon disc by -roll.
    const cosR = Math.cos(state.roll);
    const sinR = Math.sin(state.roll);
    const sx = right * cosR - up * sinR;
    const sy = right * sinR + up * cosR;
    const scale = focal / f2;
    return { x: cx + sx * scale, y: cy - sy * scale, scale, dist: fwd };
  }

  function drawSky(g, w, h, state, focal, cx, cy) {
    const horizonY = cy + Math.tan(state.pitch) * focal * 0.9;
    const sky = g.createLinearGradient(0, 0, 0, Math.max(horizonY, 1));
    sky.addColorStop(0, '#2f6fb4');
    sky.addColorStop(0.6, '#7fb2dd');
    sky.addColorStop(1, '#cfe4f2');
    g.fillStyle = sky;
    g.fillRect(0, 0, w, Math.max(horizonY, 0));
    // Sun, fixed in the north-west sky.
    const sunX = w * 0.78;
    const sunY = h * 0.14;
    const glow = g.createRadialGradient(sunX, sunY, 4, sunX, sunY, 90);
    glow.addColorStop(0, 'rgba(255,246,200,0.95)');
    glow.addColorStop(0.35, 'rgba(255,230,150,0.55)');
    glow.addColorStop(1, 'rgba(255,230,150,0)');
    g.fillStyle = glow;
    g.fillRect(sunX - 95, sunY - 95, 190, 190);
    g.fillStyle = '#fff7cf';
    g.beginPath();
    g.arc(sunX, sunY, 22, 0, Math.PI * 2);
    g.fill();
    return horizonY;
  }

  function drawTerrain(g, state, focal, cx, cy, horizonY) {
    const w = canvas.width;
    const h = canvas.height;
    // Base sea: everything below the horizon that no ground quad covers. Without
    // this the corners and the band under a banked horizon stay canvas-black.
    const base = g.createLinearGradient(0, Math.max(0, horizonY), 0, h);
    base.addColorStop(0, '#cfe4f2');
    base.addColorStop(0.3, '#7fa8c4');
    base.addColorStop(1, '#14608c');
    g.fillStyle = base;
    g.fillRect(0, Math.max(0, horizonY), w, h - Math.max(0, horizonY));
    const haze = [207, 228, 242];
    const depths = [];
    const NEAR = 45;
    const FAR = 2200;
    const RINGS = 26;
    for (let i = 0; i <= RINGS; i += 1) depths.push(NEAR * Math.pow(FAR / NEAR, i / RINGS));
    const COLS = 52;
    const HALF_FOV = 0.78; // must cover the screen's own half-FOV (~0.71 rad at 1280x860)
    // Ground points: ring i, column j.
    const pts = [];
    for (let i = 0; i <= RINGS; i += 1) {
      const row = [];
      for (let j = 0; j <= COLS; j += 1) {
        const ang = -HALF_FOV + (2 * HALF_FOV * j) / COLS;
        const d = depths[i];
        const wx = state.x + Math.sin(state.heading + ang) * d;
        const wz = state.z - Math.cos(state.heading + ang) * d;
        const wy = heightAt(Math.max(0, Math.min(WORLD, wx)), Math.max(0, Math.min(WORLD, wz))) * FT_TO_M;
        row.push(project(state, wx, wy, wz, focal, cx, cy));
      }
      pts.push(row);
    }
    for (let i = 0; i < RINGS; i += 1) {
      const fog = Math.min(0.85, depths[i] / FAR);
      for (let j = 0; j < COLS; j += 1) {
        const a = pts[i][j];
        const b = pts[i][j + 1];
        const c = pts[i + 1][j + 1];
        const d = pts[i + 1][j];
        if (!a || !b || !c || !d) continue;
        const mx = state.x + Math.sin(state.heading + (-HALF_FOV + (2 * HALF_FOV * (j + 0.5)) / COLS)) * depths[i];
        const mz = state.z - Math.cos(state.heading + (-HALF_FOV + (2 * HALF_FOV * (j + 0.5)) / COLS)) * depths[i];
        const col = mix(sampleMap(mx, mz), haze, fog);
        g.fillStyle = `rgb(${col[0] | 0},${col[1] | 0},${col[2] | 0})`;
        g.beginPath();
        g.moveTo(a.x, a.y);
        g.lineTo(b.x, b.y);
        g.lineTo(c.x, c.y);
        g.lineTo(d.x, d.y);
        g.closePath();
        g.fill();
      }
    }
  }

  function drawClouds(g, state, focal, cx, cy) {
    for (const cloud of clouds) {
      const p = project(state, cloud.x, cloud.y, cloud.z, focal, cx, cy);
      if (!p || p.dist > 2600) continue;
      const r = cloud.r * p.scale;
      if (r < 2) continue;
      g.fillStyle = 'rgba(255,255,255,0.85)';
      g.beginPath();
      g.ellipse(p.x, p.y, r, r * 0.42, 0, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = 'rgba(255,255,255,0.6)';
      g.beginPath();
      g.ellipse(p.x - r * 0.4, p.y + r * 0.1, r * 0.6, r * 0.3, 0, 0, Math.PI * 2);
      g.fill();
    }
  }

  function drawRings(g, state, rings, focal, cx, cy) {
    for (let i = 0; i < rings.length; i += 1) {
      const ring = rings[i];
      if (ring.passed) continue;
      const p = project(state, ring.x, ring.y * FT_TO_M, ring.z, focal, cx, cy);
      if (!p) continue;
      const radius = ring.radius * p.scale;
      if (radius < 3 || radius > 4000) continue;
      const next = i === state.ringsPassed;
      g.lineWidth = Math.max(2, radius * 0.09);
      g.strokeStyle = next ? '#ffb400' : 'rgba(120,200,255,0.85)';
      g.beginPath();
      g.ellipse(p.x, p.y, radius, radius * 0.96, 0, 0, Math.PI * 2);
      g.stroke();
      g.lineWidth = Math.max(1, radius * 0.02);
      g.strokeStyle = next ? '#7a5200' : 'rgba(255,255,255,0.5)';
      g.beginPath();
      g.ellipse(p.x, p.y, radius * 1.02, radius * 0.98, 0, 0, Math.PI * 2);
      g.stroke();
      if (next) {
        g.fillStyle = '#ffb400';
        g.font = `bold ${Math.max(13, radius * 0.22)}px system-ui, sans-serif`;
        g.textAlign = 'center';
        g.fillText(`RING ${i + 1}`, p.x, p.y - radius - 10);
      }
    }
  }

  /** The courier plane, seen from behind, banking with the roll. */
  function drawPlane(g, state, w, h) {
    const px = w / 2;
    const py = h * 0.62;
    const size = Math.min(w, h) * 0.16;
    g.save();
    g.translate(px, py);
    g.rotate(state.roll * 0.9);
    g.scale(size / 100, size / 100);
    // Prop blur discs, faint so they read as motion, not as parts.
    g.fillStyle = 'rgba(200,210,220,0.18)';
    g.beginPath();
    g.ellipse(-30, -4, 10, 10, 0, 0, Math.PI * 2);
    g.ellipse(30, -4, 10, 10, 0, 0, Math.PI * 2);
    g.fill();
    // Wings.
    g.fillStyle = '#ff7a1a';
    g.strokeStyle = '#7a2d00';
    g.lineWidth = 2.5;
    g.beginPath();
    g.moveTo(-72, -2);
    g.lineTo(-8, -12);
    g.lineTo(8, -12);
    g.lineTo(72, -2);
    g.lineTo(66, 6);
    g.lineTo(0, -2);
    g.lineTo(-66, 6);
    g.closePath();
    g.fill();
    g.stroke();
    // Fuselage, seen from the tail.
    g.fillStyle = '#f5f2ea';
    g.beginPath();
    g.moveTo(-13, -26);
    g.lineTo(13, -26);
    g.lineTo(16, 14);
    g.lineTo(9, 30);
    g.lineTo(-9, 30);
    g.lineTo(-16, 14);
    g.closePath();
    g.fill();
    g.stroke();
    // Tail fin + tailplane.
    g.fillStyle = '#ff7a1a';
    g.beginPath();
    g.moveTo(-3, -26);
    g.lineTo(-3, -52);
    g.lineTo(10, -40);
    g.lineTo(8, -26);
    g.closePath();
    g.fill();
    g.stroke();
    g.beginPath();
    g.moveTo(-26, 16);
    g.lineTo(26, 16);
    g.lineTo(20, 24);
    g.lineTo(-20, 24);
    g.closePath();
    g.fill();
    g.stroke();
    // Cabin windows + stripe.
    g.fillStyle = '#17324a';
    g.fillRect(-9, -20, 18, 7);
    g.fillStyle = '#ff7a1a';
    g.fillRect(-13, -4, 26, 4);
    g.restore();
  }

  function drawCompass(g, state, w) {
    const cx = w / 2;
    const y = 26;
    const heading = ((state.heading * 180) / Math.PI % 360 + 360) % 360;
    g.fillStyle = 'rgba(10,16,24,0.72)';
    g.fillRect(cx - 170, 8, 340, 34);
    g.strokeStyle = 'rgba(255,255,255,0.35)';
    g.strokeRect(cx - 170, 8, 340, 34);
    g.fillStyle = '#fff';
    g.font = 'bold 15px system-ui, sans-serif';
    g.textAlign = 'center';
    for (let off = -150; off <= 150; off += 30) {
      let deg = Math.round(heading + off / 5);
      deg = ((deg % 360) + 360) % 360;
      const label = deg % 90 === 0 ? ['N', 'E', 'S', 'W'][deg / 90] : String(deg).padStart(3, '0');
      g.fillText(label, cx + off, y + 5);
    }
    // Centre caret + digital heading.
    g.fillStyle = '#ffb400';
    g.beginPath();
    g.moveTo(cx - 7, 8);
    g.lineTo(cx + 7, 8);
    g.lineTo(cx, 18);
    g.closePath();
    g.fill();
  }

  function drawPanel(g, state, rings, w, h) {
    const panelH = Math.min(168, h * 0.22);
    const top = h - panelH;
    g.fillStyle = '#10161d';
    g.fillRect(0, top, w, panelH);
    g.fillStyle = '#2a3138';
    g.fillRect(0, top, w, 3);
    const cy = top + panelH / 2;
    drawAttitude(g, state, w * 0.16, cy, panelH * 0.36);
    drawDial(g, w * 0.38, cy, panelH * 0.36, 'ALT', Math.round(state.y), 'FT', 0, 3000);
    drawDial(g, w * 0.60, cy, panelH * 0.36, 'SPEED', Math.round(state.speed), 'KT', 0, 220);
    drawThrottle(g, state, w * 0.80, cy, panelH * 0.36);
    // Readout on a dark pill just above the panel, clear of the dial labels.
    const next = rings[state.ringsPassed];
    const dist = next ? Math.round(Math.hypot(state.x - next.x, state.z - next.z)) : 0;
    g.fillStyle = 'rgba(10,16,24,0.72)';
    const label = next ? `NEXT RING ${state.ringsPassed + 1}/${rings.length} — ${dist} m` : 'ALL RINGS DONE — LAND ON THE RUNWAY';
    g.font = '13px system-ui, sans-serif';
    const tw = g.measureText(label).width;
    g.fillRect(w * 0.5 - tw / 2 - 10, top - 24, tw + 20, 20);
    g.fillStyle = '#c8d2da';
    g.textAlign = 'center';
    g.fillText(label, w * 0.5, top - 10);
  }

  function drawAttitude(g, state, cx, cy, r) {
    g.save();
    g.beginPath();
    g.arc(cx, cy, r, 0, Math.PI * 2);
    g.clip();
    g.translate(cx, cy);
    g.rotate(-state.roll);
    g.translate(0, state.pitch * r * 1.6);
    g.fillStyle = '#3f8fd2';
    g.fillRect(-r, -r * 2, r * 2, r * 2);
    g.fillStyle = '#7a5230';
    g.fillRect(-r, 0, r * 2, r * 2);
    g.strokeStyle = '#fff';
    g.lineWidth = 2;
    g.beginPath();
    g.moveTo(-r, 0);
    g.lineTo(r, 0);
    g.stroke();
    g.restore();
    g.strokeStyle = '#e8eef2';
    g.lineWidth = 3;
    g.beginPath();
    g.arc(cx, cy, r, 0, Math.PI * 2);
    g.stroke();
    // Fixed wings marker.
    g.strokeStyle = '#ffb400';
    g.lineWidth = 3;
    g.beginPath();
    g.moveTo(cx - r * 0.55, cy);
    g.lineTo(cx - r * 0.15, cy);
    g.moveTo(cx + r * 0.15, cy);
    g.lineTo(cx + r * 0.55, cy);
    g.stroke();
    g.fillStyle = '#c8d2da';
    g.font = 'bold 11px system-ui, sans-serif';
    g.textAlign = 'center';
    g.fillText('ATTITUDE', cx, cy + r + 15);
  }

  function drawDial(g, cx, cy, r, label, value, unit, min, max) {
    g.fillStyle = '#0b0f13';
    g.beginPath();
    g.arc(cx, cy, r, 0, Math.PI * 2);
    g.fill();
    g.strokeStyle = '#3d4750';
    g.lineWidth = 2;
    g.beginPath();
    g.arc(cx, cy, r, 0, Math.PI * 2);
    g.stroke();
    // Ticks.
    g.strokeStyle = '#8b98a3';
    g.lineWidth = 1.5;
    for (let i = 0; i <= 10; i += 1) {
      const a = Math.PI * 0.75 + (i / 10) * Math.PI * 1.5;
      g.beginPath();
      g.moveTo(cx + Math.cos(a) * r * 0.82, cy + Math.sin(a) * r * 0.82);
      g.lineTo(cx + Math.cos(a) * r * 0.94, cy + Math.sin(a) * r * 0.94);
      g.stroke();
    }
    // Needle: green arc + white needle.
    const frac = Math.max(0, Math.min(1, (value - min) / (max - min)));
    const ang = Math.PI * 0.75 + frac * Math.PI * 1.5;
    g.strokeStyle = '#37d67a';
    g.lineWidth = 4;
    g.beginPath();
    g.arc(cx, cy, r * 0.7, Math.PI * 0.75, ang);
    g.stroke();
    g.strokeStyle = '#fff';
    g.lineWidth = 2.5;
    g.beginPath();
    g.moveTo(cx, cy);
    g.lineTo(cx + Math.cos(ang) * r * 0.88, cy + Math.sin(ang) * r * 0.88);
    g.stroke();
    g.fillStyle = '#fff';
    g.font = 'bold 19px system-ui, sans-serif';
    g.textAlign = 'center';
    g.fillText(String(value), cx, cy + 6);
    g.fillStyle = '#8b98a3';
    g.font = '11px system-ui, sans-serif';
    g.fillText(`${label} · ${unit}`, cx, cy + r + 15);
  }

  function drawThrottle(g, state, cx, cy, r) {
    const bw = 26;
    const bh = r * 1.7;
    const x = cx - bw / 2;
    const y = cy - bh / 2;
    g.fillStyle = '#0b0f13';
    g.fillRect(x, y, bw, bh);
    g.strokeStyle = '#3d4750';
    g.strokeRect(x, y, bw, bh);
    const fillH = bh * state.throttle;
    g.fillStyle = state.throttle > 0.85 ? '#ff5a3c' : '#37d67a';
    g.fillRect(x + 2, y + bh - fillH, bw - 4, fillH - 2);
    g.fillStyle = '#c8d2da';
    g.font = 'bold 11px system-ui, sans-serif';
    g.textAlign = 'center';
    g.fillText('THR', cx, cy + r + 15);
    g.fillText(`${Math.round(state.throttle * 100)}%`, cx, y - 8);
  }

  function drawHUD(g, state, rings, w, h) {
    g.textAlign = 'left';
    g.fillStyle = 'rgba(10,16,24,0.72)';
    g.fillRect(12, 8, 250, 84);
    g.strokeStyle = 'rgba(255,255,255,0.25)';
    g.strokeRect(12, 8, 250, 84);
    g.fillStyle = '#37d67a';
    g.font = 'bold 20px "SF Mono", ui-monospace, Menlo, monospace';
    const heading = Math.round(((state.heading * 180) / Math.PI % 360 + 360) % 360);
    g.fillText(`ALT ${String(Math.round(state.y)).padStart(5, '0')} FT`, 22, 34);
    g.fillText(`SPD ${String(Math.round(state.speed)).padStart(3, '0')} KT`, 22, 60);
    g.fillText(`HDG ${String(heading).padStart(3, '0')}°`, 22, 86);
    // Score block, top right.
    g.textAlign = 'right';
    g.fillStyle = 'rgba(10,16,24,0.72)';
    g.fillRect(w - 212, 8, 200, 84);
    g.strokeStyle = 'rgba(255,255,255,0.25)';
    g.strokeRect(w - 212, 8, 200, 84);
    g.fillStyle = '#ffb400';
    g.font = 'bold 20px "SF Mono", ui-monospace, Menlo, monospace';
    g.fillText(`SCORE ${state.score}`, w - 22, 34);
    g.fillStyle = '#fff';
    g.fillText(`RINGS ${state.ringsPassed}/${rings.length}`, w - 22, 60);
    const t = Math.max(0, Math.ceil(state.timeLeft));
    g.fillStyle = t < 30 ? '#ff5a3c' : '#fff';
    g.fillText(`TIME ${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`, w - 22, 86);
    drawCompass(g, state, w);
    // Centre message + stall warning.
    if (state.stallWarn && !state.crashed && !state.landed) {
      g.textAlign = 'center';
      g.fillStyle = '#ff5a3c';
      g.font = 'bold 22px system-ui, sans-serif';
      g.fillText('⚠ STALL — ADD THROTTLE', w / 2, h * 0.3);
    }
    if (state.messageT > 0 && state.message) {
      g.textAlign = 'center';
      g.fillStyle = '#ffb400';
      g.font = 'bold 26px system-ui, sans-serif';
      g.fillText(state.message, w / 2, h * 0.36);
    }
    void h;
  }

  function drawOverlay(g, screen, state, rings, best, w, h) {
    g.fillStyle = 'rgba(8,14,22,0.55)';
    g.fillRect(0, 0, w, h);
    g.textAlign = 'center';
    if (screen === SCREEN_TITLE) {
      g.fillStyle = '#ffb400';
      g.font = 'bold 64px system-ui, sans-serif';
      g.fillText('SKY COURIER', w / 2, h * 0.30);
      g.fillStyle = '#fff';
      g.font = '28px system-ui, sans-serif';
      g.fillText('Fly the island run. Thread all six rings, then land on the runway.', w / 2, h * 0.30 + 44);
      g.font = '19px system-ui, sans-serif';
      g.fillStyle = '#c8d2da';
      const lines = [
        '← → or A / D — bank and turn      ↑ ↓ or W / S — pitch',
        'Mouse — steer by pointing      SHIFT — throttle up      CTRL — throttle down',
        'Fly through a ring: +100 pts and +12 s. Land on the runway after the last ring: +500.',
        'Too slow and the wing stalls. The ground is not a suggestion.',
      ];
      lines.forEach((line, i) => g.fillText(line, w / 2, h * 0.30 + 92 + i * 30));
      g.fillStyle = '#37d67a';
      g.font = 'bold 24px system-ui, sans-serif';
      g.fillText('Press SPACE or click to fly', w / 2, h * 0.30 + 240);
      if (best > 0) {
        g.fillStyle = '#ffb400';
        g.font = '18px system-ui, sans-serif';
        g.fillText(`Best score: ${best}`, w / 2, h * 0.30 + 272);
      }
    } else if (screen === SCREEN_PAUSED) {
      g.fillStyle = '#fff';
      g.font = 'bold 48px system-ui, sans-serif';
      g.fillText('PAUSED', w / 2, h * 0.42);
      g.font = '20px system-ui, sans-serif';
      g.fillText('Press P or SPACE to keep flying', w / 2, h * 0.42 + 40);
    } else if (screen === SCREEN_OVER) {
      const landed = state.landed;
      g.fillStyle = landed ? '#37d67a' : '#ff5a3c';
      g.font = 'bold 56px system-ui, sans-serif';
      g.fillText(landed ? 'LANDED!' : state.message || 'CRASHED', w / 2, h * 0.36);
      g.fillStyle = '#fff';
      g.font = '26px system-ui, sans-serif';
      g.fillText(`Score ${state.score}   ·   Rings ${state.ringsPassed}/${rings.length}`, w / 2, h * 0.36 + 46);
      if (state.score > best) {
        g.fillStyle = '#ffb400';
        g.font = 'bold 22px system-ui, sans-serif';
        g.fillText('New best!', w / 2, h * 0.36 + 82);
      }
      g.fillStyle = '#c8d2da';
      g.font = '20px system-ui, sans-serif';
      g.fillText('Press SPACE or click to fly again', w / 2, h * 0.36 + 122);
    }
  }

  return {
    draw(state, rings, screen, best) {
      const { w, h } = resize();
      const focal = (h * 0.5) / Math.tan(0.52); // ~60 deg vertical FOV
      const cx = w / 2;
      const cy = h * 0.42;
      const horizonY = drawSky(ctx, w, h, state, focal, cx, cy);
      drawTerrain(ctx, state, focal, cx, cy, horizonY);
      drawClouds(ctx, state, focal, cx, cy);
      drawRings(ctx, state, rings, focal, cx, cy);
      drawPlane(ctx, state, w, h);
      drawHUD(ctx, state, rings, w, h);
      drawPanel(ctx, state, rings, w, h);
      if (screen !== SCREEN_PLAY) drawOverlay(ctx, screen, state, rings, best, w, h);
    },
  };
}
