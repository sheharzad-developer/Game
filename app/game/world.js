// ─── Pure game logic (no React / no three.js) ───────────────────────────────
// Everything lives on the XZ ground plane: x = x, y = up (mostly 0), z = old 2D y.

// ─── Constants (world units, not pixels) ─────────────────────────────────────
export const FIELD = { hx: 28, hz: 18 };      // half-extents of the play field
const PLAYER_SPEED = 12;
const PLAYER_RADIUS = 0.9;
const BULLET_SPEED = 48;
const BULLET_RADIUS = 0.18;
const BULLET_DAMAGE = 40;
const ZOMBIE_RADIUS = 0.9;
const ZOMBIE_BASE_SPEED = 4.2;
const ZOMBIE_BASE_HP = 100;
const MAGAZINE_SIZE = 30;
const RELOAD_TIME = 2.0;
const ZOMBIE_DAMAGE = 20;        // dps while touching
const WAVE_DELAY = 4.0;
const HIT_EFFECT_DURATION = 0.15;
const FIRE_RATE = 0.1;
const MAX_PARTICLES = 140;

export const CONFIG = { MAGAZINE_SIZE, RELOAD_TIME };

// ─── Helpers ─────────────────────────────────────────────────────────────────
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const randRange = (lo, hi) => lo + Math.random() * (hi - lo);
function dist(ax, az, bx, bz) {
  const dx = ax - bx, dz = az - bz;
  return Math.sqrt(dx * dx + dz * dz);
}

let _id = 0;
const nextId = () => ++_id;

// ─── World factory ───────────────────────────────────────────────────────────
export function createWorld() {
  const world = {
    player: makePlayer(0, 0),
    bullets: [],
    zombies: [],
    particles: [],
    // input (written by the input controller each frame)
    input: { keys: {}, aim: { x: 1, z: 0 }, mouseDown: false },
    // wave / score state
    wave: 0,
    kills: 0,
    score: 0,
    waveTimer: 1.0,
    waveActive: false,
    zombiesLeft: 0,
    spawnTimer: 0,
    fireCooldown: 0,
    gameState: 'playing', // 'playing' | 'gameover'
    // revision counters — bumped on add/remove so the renderer knows when to
    // rebuild its React lists (positions are synced every frame via refs).
    rev: { zombies: 0, bullets: 0, particles: 0 },
  };
  return world;
}

export function resetWorld(world) {
  world.player = makePlayer(0, 0);
  world.bullets = [];
  world.zombies = [];
  world.particles = [];
  world.wave = 0;
  world.kills = 0;
  world.score = 0;
  world.waveTimer = 1.0;
  world.waveActive = false;
  world.zombiesLeft = 0;
  world.spawnTimer = 0;
  world.fireCooldown = 0;
  world.gameState = 'playing';
  world.rev.zombies++;
  world.rev.bullets++;
  world.rev.particles++;
}

function makePlayer(x, z) {
  return {
    x, z, angle: 0,
    hp: 100, maxHp: 100,
    ammo: MAGAZINE_SIZE, reserve: 270,
    reloading: false, reloadTimer: 0,
    radius: PLAYER_RADIUS, speed: PLAYER_SPEED,
  };
}

export function startReload(player) {
  if (!player.reloading && player.ammo < MAGAZINE_SIZE && player.reserve > 0) {
    player.reloading = true;
    player.reloadTimer = RELOAD_TIME;
  }
}

// ─── Spawning ────────────────────────────────────────────────────────────────
function spawnZombie(world) {
  const { hx, hz } = FIELD;
  const pad = 3;
  const side = Math.floor(Math.random() * 4);
  let x, z;
  if (side === 0)      { x = randRange(-hx, hx); z = -hz - pad; }
  else if (side === 1) { x = hx + pad;           z = randRange(-hz, hz); }
  else if (side === 2) { x = randRange(-hx, hx); z = hz + pad; }
  else                 { x = -hx - pad;          z = randRange(-hz, hz); }

  const speedMult = 1 + (world.wave - 1) * 0.12;
  world.zombies.push({
    id: nextId(), x, z, angle: 0,
    radius: ZOMBIE_RADIUS,
    speed: ZOMBIE_BASE_SPEED * speedMult,
    hp: ZOMBIE_BASE_HP, maxHp: ZOMBIE_BASE_HP,
    hitTimer: 0, alive: true,
    variant: Math.random() > 0.5 ? 0 : 1,
  });
  world.rev.zombies++;
}

function spawnBlood(world, x, z, count = 6) {
  for (let i = 0; i < count; i++) {
    const a = Math.random() * Math.PI * 2;
    const s = randRange(2.5, 9);
    world.particles.push({
      id: nextId(),
      x, y: 0.6, z,
      vx: Math.cos(a) * s,
      vy: randRange(2, 6),
      vz: Math.sin(a) * s,
      r: randRange(0.06, 0.18),
      life: 1,
      decay: randRange(1.5, 3.5),
    });
  }
  // trim oldest to keep the count bounded
  if (world.particles.length > MAX_PARTICLES) {
    world.particles.splice(0, world.particles.length - MAX_PARTICLES);
  }
  world.rev.particles++;
}

function startWave(world) {
  world.wave++;
  world.zombiesLeft = 5 + world.wave * 3;
  world.spawnTimer = 0;
  world.waveActive = true;
}

function shoot(world) {
  const p = world.player;
  // unlimited ammo: firing never depletes the magazine and never reloads
  const mx = p.x + Math.cos(p.angle) * (p.radius + 0.9);
  const mz = p.z + Math.sin(p.angle) * (p.radius + 0.9);
  world.bullets.push({
    id: nextId(),
    x: mx, z: mz,
    vx: Math.cos(p.angle) * BULLET_SPEED,
    vz: Math.sin(p.angle) * BULLET_SPEED,
    radius: BULLET_RADIUS, alive: true,
  });
  world.rev.bullets++;
}

// ─── Main update ─────────────────────────────────────────────────────────────
export function updateWorld(world, dt) {
  if (world.gameState !== 'playing') return;
  const p = world.player;
  const { keys, aim } = world.input;

  // movement
  let dx = 0, dz = 0;
  if (keys['w'] || keys['arrowup'])    dz -= 1;
  if (keys['s'] || keys['arrowdown'])  dz += 1;
  if (keys['a'] || keys['arrowleft'])  dx -= 1;
  if (keys['d'] || keys['arrowright']) dx += 1;
  const len = Math.hypot(dx, dz);
  if (len > 0) { dx /= len; dz /= len; }
  p.x = clamp(p.x + dx * p.speed * dt, -FIELD.hx, FIELD.hx);
  p.z = clamp(p.z + dz * p.speed * dt, -FIELD.hz, FIELD.hz);

  // aim toward the cursor's ground point
  p.angle = Math.atan2(aim.z - p.z, aim.x - p.x);

  // reload
  if (p.reloading) {
    p.reloadTimer -= dt;
    if (p.reloadTimer <= 0) {
      const take = Math.min(MAGAZINE_SIZE - p.ammo, p.reserve);
      p.ammo += take; p.reserve -= take;
      p.reloading = false;
    }
  }

  // auto-fire
  world.fireCooldown -= dt;
  if (world.input.mouseDown && world.fireCooldown <= 0) {
    const before = world.bullets.length;
    shoot(world);
    world.fireCooldown = world.bullets.length > before ? FIRE_RATE : 0.05;
  }

  // bullets
  let bulletsChanged = false;
  for (const b of world.bullets) {
    b.x += b.vx * dt; b.z += b.vz * dt;
    if (Math.abs(b.x) > FIELD.hx + 6 || Math.abs(b.z) > FIELD.hz + 6) {
      b.alive = false; bulletsChanged = true;
    }
  }

  // wave management
  if (!world.waveActive) {
    world.waveTimer -= dt;
    if (world.waveTimer <= 0) startWave(world);
  } else {
    const spawnInterval = Math.max(0.2, 1.2 - world.wave * 0.06);
    world.spawnTimer -= dt;
    if (world.zombiesLeft > 0 && world.spawnTimer <= 0) {
      spawnZombie(world);
      world.zombiesLeft--;
      world.spawnTimer = spawnInterval;
    }
    if (world.zombiesLeft === 0 && world.zombies.length === 0) {
      world.waveActive = false;
      world.waveTimer = WAVE_DELAY;
    }
  }

  // zombies chase
  for (const z of world.zombies) {
    const ddx = p.x - z.x, ddz = p.z - z.z;
    const d = Math.hypot(ddx, ddz);
    if (d > 0) {
      z.x += (ddx / d) * z.speed * dt;
      z.z += (ddz / d) * z.speed * dt;
      z.angle = Math.atan2(ddz, ddx);
    }
    if (z.hitTimer > 0) z.hitTimer -= dt;
  }

  // bullet ↔ zombie
  let zombiesChanged = false;
  for (const b of world.bullets) {
    if (!b.alive) continue;
    for (const z of world.zombies) {
      if (!z.alive || !b.alive) continue;
      if (dist(b.x, b.z, z.x, z.z) < b.radius + z.radius) {
        b.alive = false; bulletsChanged = true;
        z.hp -= BULLET_DAMAGE;
        z.hitTimer = HIT_EFFECT_DURATION;
        spawnBlood(world, b.x, b.z, 5);
        if (z.hp <= 0) {
          z.alive = false; zombiesChanged = true;
          spawnBlood(world, z.x, z.z, 12);
          world.kills++;
          world.score += 10 * world.wave;
        }
      }
    }
  }

  // zombie ↔ player (damage over time)
  for (const z of world.zombies) {
    if (dist(z.x, z.z, p.x, p.z) < z.radius + p.radius) {
      p.hp -= ZOMBIE_DAMAGE * dt;
    }
  }
  if (p.hp <= 0) { p.hp = 0; world.gameState = 'gameover'; }

  // particles
  for (const pt of world.particles) {
    pt.x += pt.vx * dt;
    pt.y += pt.vy * dt;
    pt.z += pt.vz * dt;
    pt.vy -= 14 * dt;            // gravity
    pt.vx *= 0.92; pt.vz *= 0.92;
    if (pt.y < 0.05) { pt.y = 0.05; pt.vy *= -0.3; pt.vx *= 0.6; pt.vz *= 0.6; }
    pt.life -= pt.decay * dt;
  }

  // cull dead entities
  if (bulletsChanged || world.bullets.some(b => !b.alive)) {
    world.bullets = world.bullets.filter(b => b.alive);
    world.rev.bullets++;
  }
  if (zombiesChanged) {
    world.zombies = world.zombies.filter(z => z.alive);
    world.rev.zombies++;
  }
  const liveParticles = world.particles.filter(pt => pt.life > 0);
  if (liveParticles.length !== world.particles.length) {
    world.particles = liveParticles;
    world.rev.particles++;
  }
}
