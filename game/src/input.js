// Sky Courier — keyboard and mouse. Arrows or WASD fly the plane, Shift/Ctrl work
// the throttle, the mouse steers by where it points, Space/Enter confirms, P pauses.
export const ACTION_CONFIRM = 1;
export const ACTION_PAUSE = 2;

export function createInput(canvas) {
  const keys = new Set();
  const mouse = { x: 0.5, y: 0.5, active: false };
  let actions = 0;

  function keyDown(event) {
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(event.key)) {
      event.preventDefault();
    }
    if (event.repeat) return;
    keys.add(event.key.toLowerCase());
    if (event.key === ' ' || event.key === 'Enter') actions |= ACTION_CONFIRM;
    if (event.key.toLowerCase() === 'p' || event.key === 'Escape') actions |= ACTION_PAUSE;
  }

  function keyUp(event) {
    keys.delete(event.key.toLowerCase());
  }

  function pointerMove(event) {
    const rect = canvas.getBoundingClientRect();
    mouse.x = (event.clientX - rect.left) / rect.width;
    mouse.y = (event.clientY - rect.top) / rect.height;
    mouse.active = true;
  }

  function pointerDown(event) {
    pointerMove(event);
    actions |= ACTION_CONFIRM;
  }

  window.addEventListener('keydown', keyDown);
  window.addEventListener('keyup', keyUp);
  canvas.addEventListener('pointermove', pointerMove);
  canvas.addEventListener('pointerdown', pointerDown);

  function held(...names) {
    return names.some((name) => keys.has(name));
  }

  return {
    /** Drain queued one-shot actions (confirm / pause). */
    takeActions() {
      const out = actions;
      actions = 0;
      return out;
    },
    /** Steering for this frame: bank and pitch in [-1, 1], throttle in [-1, 1]. */
    control() {
      let bank = 0;
      let pitch = 0;
      if (held('arrowleft', 'a')) bank -= 1;
      if (held('arrowright', 'd')) bank += 1;
      if (held('arrowup', 'w')) pitch -= 1; // push forward: nose down
      if (held('arrowdown', 's')) pitch += 1; // pull back: nose up
      // The mouse steers too: point where you want the nose to go.
      if (mouse.active && bank === 0 && pitch === 0) {
        bank = (mouse.x - 0.5) * 2;
        pitch = (mouse.y - 0.5) * 2;
      }
      let throttle = 0;
      if (held('shift')) throttle += 1;
      if (held('control')) throttle -= 1;
      return { bank, pitch, throttle };
    },
  };
}
