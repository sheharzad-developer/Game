'use client';

import { useEffect, useRef } from 'react';

// ─── Constants ────────────────────────────────────────────────────────────────
const PLAYER_SPEED = 200;          // px/s
const PLAYER_RADIUS = 16;
const BULLET_SPEED = 600;
const BULLET_RADIUS = 4;
const BULLET_DAMAGE = 40;
const ZOMBIE_RADIUS = 16;
const ZOMBIE_BASE_SPEED = 70;
const ZOMBIE_BASE_HP = 100;
const MAGAZINE_SIZE = 30;
const RELOAD_TIME = 2.0;           // seconds
const ZOMBIE_DAMAGE = 20;          // damage per second while touching
const WAVE_DELAY = 4.0;            // seconds between waves
const HIT_EFFECT_DURATION = 0.15; // seconds

// ─── Colour palette ───────────────────────────────────────────────────────────
const C = {
  ground:      '#1a2a1a',
  gridLine:    '#1f301f',
  player:      '#4a7c59',
  helmet:      '#2d4a2d',
  rifle:       '#8b6914',
  rifleDark:   '#5a4410',
  zombie:      '#5a7a3a',
  zombieDark:  '#3a5a1a',
  zombieEye:   '#ff2200',
  blood:       '#cc0000',
  bullet:      '#ffe066',
  hud:         'rgba(0,0,0,0.55)',
  healthGreen: '#22cc44',
  healthRed:   '#cc2222',
  ammoBlue:    '#4488ff',
  waveText:    '#ffcc00',
};

// ─── Utility helpers ──────────────────────────────────────────────────────────
function lerp(a, b, t) { return a + (b - a) * t; }
function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }
function dist(ax, ay, bx, by) {
  const dx = ax - bx, dy = ay - by;
  return Math.sqrt(dx * dx + dy * dy);
}
function randRange(lo, hi) { return lo + Math.random() * (hi - lo); }

// ─── Player ───────────────────────────────────────────────────────────────────
class Player {
  constructor(x, y) {
    this.x = x; this.y = y;
    this.angle = 0;          // radians, pointing toward mouse
    this.hp = 100;
    this.maxHp = 100;
    this.ammo = MAGAZINE_SIZE;
    this.reserve = 270;
    this.reloading = false;
    this.reloadTimer = 0;
    this.radius = PLAYER_RADIUS;
    this.speed = PLAYER_SPEED;
  }

  update(dt, keys, mouseAngle, canvas) {
    // movement
    let dx = 0, dy = 0;
    if (keys['w'] || keys['arrowup'])    dy -= 1;
    if (keys['s'] || keys['arrowdown'])  dy += 1;
    if (keys['a'] || keys['arrowleft'])  dx -= 1;
    if (keys['d'] || keys['arrowright']) dx += 1;
    const len = Math.sqrt(dx * dx + dy * dy);
    if (len > 0) { dx /= len; dy /= len; }
    this.x = clamp(this.x + dx * this.speed * dt, this.radius, canvas.width  - this.radius);
    this.y = clamp(this.y + dy * this.speed * dt, this.radius, canvas.height - this.radius);

    this.angle = mouseAngle;

    // reload
    if (this.reloading) {
      this.reloadTimer -= dt;
      if (this.reloadTimer <= 0) {
        const needed = MAGAZINE_SIZE - this.ammo;
        const take   = Math.min(needed, this.reserve);
        this.ammo    += take;
        this.reserve -= take;
        this.reloading = false;
      }
    }
  }

  startReload() {
    if (!this.reloading && this.ammo < MAGAZINE_SIZE && this.reserve > 0) {
      this.reloading   = true;
      this.reloadTimer = RELOAD_TIME;
    }
  }

  shoot() {
    if (this.reloading || this.ammo <= 0) return null;
    this.ammo--;
    if (this.ammo === 0 && this.reserve > 0) this.startReload();
    const muzzleX = this.x + Math.cos(this.angle) * (this.radius + 18);
    const muzzleY = this.y + Math.sin(this.angle) * (this.radius + 18);
    return new Bullet(muzzleX, muzzleY, this.angle);
  }

  draw(ctx) {
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(this.angle);

    // rifle (behind body)
    ctx.fillStyle = C.rifleDark;
    ctx.fillRect(10, -3, 22, 6);
    ctx.fillStyle = C.rifle;
    ctx.fillRect(12, -2, 18, 4);

    // body
    ctx.beginPath();
    ctx.arc(0, 0, this.radius, 0, Math.PI * 2);
    ctx.fillStyle = C.player;
    ctx.fill();

    // shoulder pads
    ctx.fillStyle = C.helmet;
    ctx.beginPath(); ctx.arc(-8, -10, 6, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(-8,  10, 6, 0, Math.PI * 2); ctx.fill();

    // helmet
    ctx.beginPath();
    ctx.arc(0, 0, 10, 0, Math.PI * 2);
    ctx.fillStyle = C.helmet;
    ctx.fill();
    ctx.strokeStyle = '#1a301a';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // helmet highlight
    ctx.beginPath();
    ctx.arc(-2, -2, 4, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255,255,255,0.1)';
    ctx.fill();

    ctx.restore();
  }
}

// ─── Bullet ───────────────────────────────────────────────────────────────────
class Bullet {
  constructor(x, y, angle) {
    this.x = x; this.y = y;
    this.vx = Math.cos(angle) * BULLET_SPEED;
    this.vy = Math.sin(angle) * BULLET_SPEED;
    this.radius = BULLET_RADIUS;
    this.alive = true;
    this.trail = [];
  }

  update(dt, canvas) {
    this.trail.push({ x: this.x, y: this.y });
    if (this.trail.length > 5) this.trail.shift();

    this.x += this.vx * dt;
    this.y += this.vy * dt;
    if (this.x < 0 || this.x > canvas.width || this.y < 0 || this.y > canvas.height) {
      this.alive = false;
    }
  }

  draw(ctx) {
    // trail
    for (let i = 0; i < this.trail.length; i++) {
      const alpha = (i / this.trail.length) * 0.4;
      ctx.beginPath();
      ctx.arc(this.trail[i].x, this.trail[i].y, this.radius * 0.6, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(255,220,50,${alpha})`;
      ctx.fill();
    }
    // core
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
    ctx.fillStyle = C.bullet;
    ctx.fill();
    ctx.beginPath();
    ctx.arc(this.x - 1, this.y - 1, this.radius * 0.5, 0, Math.PI * 2);
    ctx.fillStyle = '#fff';
    ctx.fill();
  }
}

// ─── Blood particle ───────────────────────────────────────────────────────────
class BloodParticle {
  constructor(x, y) {
    const angle = Math.random() * Math.PI * 2;
    const speed = randRange(30, 130);
    this.x = x; this.y = y;
    this.vx = Math.cos(angle) * speed;
    this.vy = Math.sin(angle) * speed;
    this.radius = randRange(2, 5);
    this.life = 1;
    this.decay = randRange(1.5, 3.5);
  }

  update(dt) {
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    this.vx *= 0.9;
    this.vy *= 0.9;
    this.life -= this.decay * dt;
  }

  draw(ctx) {
    ctx.globalAlpha = Math.max(0, this.life);
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
    ctx.fillStyle = C.blood;
    ctx.fill();
    ctx.globalAlpha = 1;
  }
}

// ─── Zombie ───────────────────────────────────────────────────────────────────
class Zombie {
  constructor(x, y, wave) {
    this.x = x; this.y = y;
    this.radius = ZOMBIE_RADIUS;
    const speedMult = 1 + (wave - 1) * 0.12;
    this.speed = ZOMBIE_BASE_SPEED * speedMult;
    this.maxHp = ZOMBIE_BASE_HP;
    this.hp = this.maxHp;
    this.alive = true;
    this.hitTimer = 0;
    this.angle = 0;
    // visual variety
    this.colorVariant = Math.random() > 0.5 ? '#4a6a2a' : '#5a7a3a';
    this.eyeOffset = (Math.random() - 0.5) * 4;
  }

  update(dt, player) {
    const dx = player.x - this.x;
    const dy = player.y - this.y;
    const d  = Math.sqrt(dx * dx + dy * dy);
    if (d > 0) {
      this.x += (dx / d) * this.speed * dt;
      this.y += (dy / d) * this.speed * dt;
      this.angle = Math.atan2(dy, dx);
    }
    if (this.hitTimer > 0) this.hitTimer -= dt;
  }

  hit() {
    this.hp -= BULLET_DAMAGE;
    this.hitTimer = HIT_EFFECT_DURATION;
    if (this.hp <= 0) this.alive = false;
  }

  draw(ctx) {
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(this.angle);

    const flashing = this.hitTimer > 0;

    // body
    ctx.beginPath();
    ctx.arc(0, 0, this.radius, 0, Math.PI * 2);
    ctx.fillStyle = flashing ? '#ff6666' : this.colorVariant;
    ctx.fill();
    ctx.strokeStyle = '#2a4a1a';
    ctx.lineWidth = 2;
    ctx.stroke();

    // head
    ctx.beginPath();
    ctx.arc(0, 0, 9, 0, Math.PI * 2);
    ctx.fillStyle = flashing ? '#ff4444' : '#3a5a1a';
    ctx.fill();

    // eyes
    const eyePositions = [
      { x: 4, y: -3 + this.eyeOffset },
      { x: 4, y:  3 + this.eyeOffset },
    ];
    eyePositions.forEach(pos => {
      ctx.beginPath();
      ctx.arc(pos.x, pos.y, 2.5, 0, Math.PI * 2);
      ctx.fillStyle = C.zombieEye;
      ctx.fill();
      ctx.beginPath();
      ctx.arc(pos.x + 0.5, pos.y - 0.5, 1, 0, Math.PI * 2);
      ctx.fillStyle = '#ff8866';
      ctx.fill();
    });

    // arms
    ctx.fillStyle = flashing ? '#ff6666' : this.colorVariant;
    ctx.beginPath(); ctx.arc(-6, -12, 5, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(-6,  12, 5, 0, Math.PI * 2); ctx.fill();

    ctx.restore();

    // hp bar (only if damaged)
    if (this.hp < this.maxHp) {
      const bw = this.radius * 2;
      const bx = this.x - this.radius;
      const by = this.y - this.radius - 10;
      ctx.fillStyle = '#440000';
      ctx.fillRect(bx, by, bw, 4);
      ctx.fillStyle = '#cc2222';
      ctx.fillRect(bx, by, bw * (this.hp / this.maxHp), 4);
    }
  }
}

// ─── Wave text effect ─────────────────────────────────────────────────────────
class WaveAnnouncement {
  constructor(text) {
    this.text  = text;
    this.timer = 2.5;
    this.maxTimer = 2.5;
  }
  update(dt) { this.timer -= dt; }
  get alive() { return this.timer > 0; }
  draw(ctx, canvas) {
    const alpha = Math.min(1, this.timer / 0.5, (this.maxTimer - this.timer) / 0.3 + 0.1);
    const scale = lerp(1.4, 1.0, clamp((this.maxTimer - this.timer) / 0.4, 0, 1));
    ctx.save();
    ctx.globalAlpha = Math.max(0, alpha);
    ctx.translate(canvas.width / 2, canvas.height / 2 - 60);
    ctx.scale(scale, scale);
    ctx.font = 'bold 48px monospace';
    ctx.textAlign = 'center';
    ctx.fillStyle = C.waveText;
    ctx.shadowColor = '#ff8800';
    ctx.shadowBlur = 20;
    ctx.fillText(this.text, 0, 0);
    ctx.restore();
  }
}

// ─── Main game component ──────────────────────────────────────────────────────
export default function GamePage() {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx    = canvas.getContext('2d');

    // resize
    function resize() {
      canvas.width  = window.innerWidth;
      canvas.height = window.innerHeight;
    }
    resize();
    window.addEventListener('resize', resize);

    // ── Game state ────────────────────────────────────────────────────────────
    let player;
    let bullets      = [];
    let zombies      = [];
    let particles    = [];
    let announcements = [];
    let keys         = {};
    let mouseAngle   = 0;
    let mouseDown    = false;
    let fireCooldown = 0;
    const FIRE_RATE  = 0.1; // seconds between shots

    let wave        = 0;
    let kills       = 0;
    let score       = 0;
    let waveTimer   = 0;  // countdown to next wave
    let waveActive  = false;
    let zombiesLeft = 0;  // zombies still to spawn this wave
    let spawnTimer  = 0;
    let gameState   = 'playing'; // 'playing' | 'gameover'
    let lastTime    = performance.now();

    // ground decoration (static dots/debris)
    const groundDots = Array.from({ length: 120 }, () => ({
      x: Math.random() * 3000,
      y: Math.random() * 3000,
      r: randRange(1, 3),
      c: `rgba(${30 + Math.random() * 20|0},${50 + Math.random() * 20|0},${30 + Math.random() * 20|0},0.7)`,
    }));

    function initGame() {
      player       = new Player(canvas.width / 2, canvas.height / 2);
      bullets      = [];
      zombies      = [];
      particles    = [];
      announcements = [];
      keys         = {};
      fireCooldown = 0;
      wave         = 0;
      kills        = 0;
      score        = 0;
      waveTimer    = 1.0;
      waveActive   = false;
      zombiesLeft  = 0;
      spawnTimer   = 0;
      gameState    = 'playing';
    }

    // ── Input ─────────────────────────────────────────────────────────────────
    const MOVE_KEYS = ['arrowup', 'arrowdown', 'arrowleft', 'arrowright', ' '];
    function onKeyDown(e) {
      const k = e.key.toLowerCase();
      // stop arrow keys / space from scrolling the page
      if (MOVE_KEYS.includes(k)) e.preventDefault();
      keys[k] = true;
      if (k === 'r') player?.startReload();
    }
    function onKeyUp(e) { keys[e.key.toLowerCase()] = false; }

    function onMouseMove(e) {
      const rect = canvas.getBoundingClientRect();
      const mx   = e.clientX - rect.left;
      const my   = e.clientY - rect.top;
      mouseAngle = Math.atan2(my - player?.y ?? 0, mx - player?.x ?? 0);
    }
    function onMouseDown(e) { if (e.button === 0) mouseDown = true; }
    function onMouseUp(e)   { if (e.button === 0) mouseDown = false; }

    canvas.addEventListener('mousemove', onMouseMove);
    canvas.addEventListener('mousedown', onMouseDown);
    canvas.addEventListener('mouseup',   onMouseUp);
    window.addEventListener('keydown',   onKeyDown);
    window.addEventListener('keyup',     onKeyUp);
    canvas.addEventListener('contextmenu', e => e.preventDefault());

    // ── Wave logic ────────────────────────────────────────────────────────────
    function startWave() {
      wave++;
      const count    = 5 + wave * 3;
      zombiesLeft    = count;
      spawnTimer     = 0;
      waveActive     = true;
      announcements.push(new WaveAnnouncement(`WAVE ${wave}`));
    }

    function spawnZombie() {
      const side = Math.floor(Math.random() * 4);
      let x, y;
      const pad = 30;
      if (side === 0) { x = Math.random() * canvas.width;  y = -pad; }
      else if (side === 1) { x = canvas.width  + pad; y = Math.random() * canvas.height; }
      else if (side === 2) { x = Math.random() * canvas.width;  y = canvas.height + pad; }
      else                 { x = -pad;                          y = Math.random() * canvas.height; }
      zombies.push(new Zombie(x, y, wave));
    }

    function spawnBlood(x, y, count = 6) {
      for (let i = 0; i < count; i++) particles.push(new BloodParticle(x, y));
    }

    // ── Update ────────────────────────────────────────────────────────────────
    function update(dt) {
      if (gameState !== 'playing') return;

      player.update(dt, keys, mouseAngle, canvas);

      // auto-fire
      fireCooldown -= dt;
      if (mouseDown && fireCooldown <= 0) {
        const b = player.shoot();
        if (b) { bullets.push(b); fireCooldown = FIRE_RATE; }
        else     fireCooldown = 0.05;
      }

      // bullets
      bullets.forEach(b => b.update(dt, canvas));
      bullets = bullets.filter(b => b.alive);

      // wave management
      if (!waveActive) {
        waveTimer -= dt;
        if (waveTimer <= 0) startWave();
      } else {
        // spawn pending zombies
        const spawnInterval = Math.max(0.2, 1.2 - wave * 0.06);
        spawnTimer -= dt;
        if (zombiesLeft > 0 && spawnTimer <= 0) {
          spawnZombie();
          zombiesLeft--;
          spawnTimer = spawnInterval;
        }
        if (zombiesLeft === 0 && zombies.length === 0) {
          waveActive = false;
          waveTimer  = WAVE_DELAY;
        }
      }

      // zombies
      zombies.forEach(z => z.update(dt, player));

      // bullet ↔ zombie collision
      bullets.forEach(b => {
        if (!b.alive) return;
        zombies.forEach(z => {
          if (!z.alive || !b.alive) return;
          if (dist(b.x, b.y, z.x, z.y) < b.radius + z.radius) {
            b.alive = false;
            z.hit();
            spawnBlood(b.x, b.y, 5);
            if (!z.alive) {
              spawnBlood(z.x, z.y, 12);
              kills++;
              score += 10 * wave;
            }
          }
        });
      });

      // zombie ↔ player collision (damage over time)
      zombies.forEach(z => {
        if (dist(z.x, z.y, player.x, player.y) < z.radius + player.radius) {
          player.hp -= ZOMBIE_DAMAGE * dt;
        }
      });

      if (player.hp <= 0) {
        player.hp = 0;
        gameState = 'gameover';
      }

      // clean up
      bullets  = bullets.filter(b => b.alive);
      zombies  = zombies.filter(z => z.alive);
      particles = particles.filter(p => p.life > 0);
      announcements = announcements.filter(a => a.alive);

      particles.forEach(p => p.update(dt));
      announcements.forEach(a => a.update(dt));
    }

    // ── Draw helpers ──────────────────────────────────────────────────────────
    function drawGround() {
      ctx.fillStyle = C.ground;
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // subtle grid
      ctx.strokeStyle = C.gridLine;
      ctx.lineWidth   = 1;
      const gs = 60;
      for (let x = 0; x < canvas.width; x += gs) {
        ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, canvas.height); ctx.stroke();
      }
      for (let y = 0; y < canvas.height; y += gs) {
        ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(canvas.width, y); ctx.stroke();
      }

      // ground scatter
      groundDots.forEach(d => {
        if (d.x < canvas.width + 10 && d.y < canvas.height + 10) {
          ctx.beginPath();
          ctx.arc(d.x % canvas.width, d.y % canvas.height, d.r, 0, Math.PI * 2);
          ctx.fillStyle = d.c;
          ctx.fill();
        }
      });
    }

    function drawHUD() {
      const pad  = 16;
      const panelW = 220;
      const panelH = 120;

      // main HUD panel (bottom-left)
      ctx.fillStyle = C.hud;
      roundRect(ctx, pad, canvas.height - panelH - pad, panelW, panelH, 10);
      ctx.fill();

      // HP label
      ctx.fillStyle = '#aaa';
      ctx.font = '12px monospace';
      ctx.textAlign = 'left';
      ctx.fillText('HEALTH', pad + 12, canvas.height - panelH - pad + 22);

      // HP bar background
      const hbX  = pad + 12;
      const hbY  = canvas.height - panelH - pad + 30;
      const hbW  = panelW - 24;
      const hbH  = 16;
      ctx.fillStyle = '#330000';
      roundRect(ctx, hbX, hbY, hbW, hbH, 4); ctx.fill();

      const hpRatio = player.hp / player.maxHp;
      const hpColor = hpRatio > 0.5 ? C.healthGreen : hpRatio > 0.25 ? '#ffaa00' : C.healthRed;
      ctx.fillStyle = hpColor;
      roundRect(ctx, hbX, hbY, hbW * hpRatio, hbH, 4); ctx.fill();

      ctx.fillStyle = '#fff';
      ctx.font = 'bold 11px monospace';
      ctx.textAlign = 'center';
      ctx.fillText(`${Math.ceil(player.hp)} / ${player.maxHp}`, hbX + hbW / 2, hbY + 12);

      // Ammo
      ctx.textAlign = 'left';
      ctx.fillStyle = '#aaa';
      ctx.font = '12px monospace';
      ctx.fillText('AMMO', pad + 12, canvas.height - panelH - pad + 66);

      if (player.reloading) {
        ctx.fillStyle = '#ffaa00';
        ctx.font = 'bold 14px monospace';
        const pct = 1 - player.reloadTimer / RELOAD_TIME;
        ctx.fillText(`RELOADING... ${(pct * 100) | 0}%`, pad + 12, canvas.height - panelH - pad + 84);

        // reload progress bar
        const rbX = pad + 12, rbY = canvas.height - panelH - pad + 89;
        const rbW = panelW - 24, rbH = 8;
        ctx.fillStyle = '#553300';
        roundRect(ctx, rbX, rbY, rbW, rbH, 3); ctx.fill();
        ctx.fillStyle = '#ffaa00';
        roundRect(ctx, rbX, rbY, rbW * pct, rbH, 3); ctx.fill();
      } else {
        // ammo pips
        const pipW = 8, pipH = 14, pipGap = 4;
        const cols  = 10;
        for (let i = 0; i < MAGAZINE_SIZE; i++) {
          const col  = i % cols;
          const row  = Math.floor(i / cols);
          const px   = pad + 12 + col * (pipW + pipGap);
          const py   = canvas.height - panelH - pad + 72 + row * (pipH + 3);
          ctx.fillStyle = i < player.ammo ? C.ammoBlue : '#223344';
          roundRect(ctx, px, py, pipW, pipH, 2); ctx.fill();
        }
        ctx.fillStyle = '#667788';
        ctx.font = '11px monospace';
        ctx.textAlign = 'right';
        ctx.fillText(`RSV: ${player.reserve}`, pad + panelW - 12, canvas.height - panelH - pad + 100);
      }

      // Score / wave / kills panel (top-right)
      const sp = 16;
      const sw = 180, sh = 90;
      ctx.fillStyle = C.hud;
      roundRect(ctx, canvas.width - sw - sp, sp, sw, sh, 10);
      ctx.fill();

      ctx.fillStyle = C.waveText;
      ctx.font = 'bold 20px monospace';
      ctx.textAlign = 'right';
      ctx.fillText(`WAVE ${wave}`, canvas.width - sp - 12, sp + 30);

      ctx.fillStyle = '#ccc';
      ctx.font = '14px monospace';
      ctx.fillText(`KILLS: ${kills}`, canvas.width - sp - 12, sp + 54);
      ctx.fillText(`SCORE: ${score}`, canvas.width - sp - 12, sp + 74);

      // wave countdown (top center)
      if (!waveActive && wave > 0) {
        const secs = Math.ceil(waveTimer);
        ctx.fillStyle = C.hud;
        const tw = 220, th = 44;
        roundRect(ctx, (canvas.width - tw) / 2, sp, tw, th, 10);
        ctx.fill();
        ctx.fillStyle = '#88ff88';
        ctx.font = '14px monospace';
        ctx.textAlign = 'center';
        ctx.fillText(`Next wave in ${secs}s...`, canvas.width / 2, sp + 28);
      }

      // crosshair hint
      ctx.fillStyle = 'rgba(255,255,255,0.35)';
      ctx.font = '11px monospace';
      ctx.textAlign = 'center';
      ctx.fillText('WASD / Arrows move  •  Mouse aim  •  LMB shoot  •  R reload', canvas.width / 2, canvas.height - 14);
    }

    function drawGameOver() {
      ctx.fillStyle = 'rgba(0,0,0,0.75)';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      const cx = canvas.width / 2, cy = canvas.height / 2;

      ctx.fillStyle = C.hud;
      roundRect(ctx, cx - 200, cy - 130, 400, 280, 18); ctx.fill();

      ctx.fillStyle = '#ff3333';
      ctx.font = 'bold 52px monospace';
      ctx.textAlign = 'center';
      ctx.shadowColor = '#ff0000';
      ctx.shadowBlur  = 30;
      ctx.fillText('GAME OVER', cx, cy - 60);
      ctx.shadowBlur = 0;

      ctx.fillStyle = '#eee';
      ctx.font = '20px monospace';
      ctx.fillText(`Wave reached: ${wave}`, cx, cy - 10);
      ctx.fillText(`Kills: ${kills}`, cx, cy + 22);
      ctx.fillText(`Final score: ${score}`, cx, cy + 54);

      // restart button
      const bx = cx - 90, by = cy + 80, bw = 180, bh = 48;
      const hovered = restartHovered;
      ctx.fillStyle = hovered ? '#44aa44' : '#226622';
      roundRect(ctx, bx, by, bw, bh, 10); ctx.fill();
      ctx.strokeStyle = '#88ee88';
      ctx.lineWidth = 2;
      roundRect(ctx, bx, by, bw, bh, 10); ctx.stroke();
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 22px monospace';
      ctx.fillText('RESTART', cx, by + 32);
    }

    function roundRect(ctx, x, y, w, h, r) {
      ctx.beginPath();
      ctx.moveTo(x + r, y);
      ctx.lineTo(x + w - r, y);
      ctx.arcTo(x + w, y, x + w, y + r, r);
      ctx.lineTo(x + w, y + h - r);
      ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
      ctx.lineTo(x + r, y + h);
      ctx.arcTo(x, y + h, x, y + h - r, r);
      ctx.lineTo(x, y + r);
      ctx.arcTo(x, y, x + r, y, r);
      ctx.closePath();
    }

    // ── Restart button hit test ───────────────────────────────────────────────
    let restartHovered = false;
    function getRestartBounds() {
      const cx = canvas.width / 2, cy = canvas.height / 2;
      return { x: cx - 90, y: cy + 80, w: 180, h: 48 };
    }

    function onCanvasMouseMove2(e) {
      if (gameState !== 'gameover') return;
      const rect = canvas.getBoundingClientRect();
      const mx = e.clientX - rect.left, my = e.clientY - rect.top;
      const b  = getRestartBounds();
      restartHovered = mx >= b.x && mx <= b.x + b.w && my >= b.y && my <= b.y + b.h;
    }
    function onCanvasClick(e) {
      if (gameState !== 'gameover') return;
      const rect = canvas.getBoundingClientRect();
      const mx = e.clientX - rect.left, my = e.clientY - rect.top;
      const b  = getRestartBounds();
      if (mx >= b.x && mx <= b.x + b.w && my >= b.y && my <= b.y + b.h) {
        initGame();
      }
    }

    canvas.addEventListener('mousemove', onCanvasMouseMove2);
    canvas.addEventListener('click', onCanvasClick);

    // ── Game loop ─────────────────────────────────────────────────────────────
    let rafId;
    function loop(now) {
      const dt = Math.min((now - lastTime) / 1000, 0.05);
      lastTime = now;

      update(dt);

      // render
      drawGround();
      particles.forEach(p => p.draw(ctx));
      bullets.forEach(b => b.draw(ctx));
      zombies.forEach(z => z.draw(ctx));
      if (player) player.draw(ctx);
      announcements.forEach(a => a.draw(ctx, canvas));

      if (gameState === 'playing') drawHUD();
      if (gameState === 'gameover') drawGameOver();

      rafId = requestAnimationFrame(loop);
    }

    initGame();
    rafId = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(rafId);
      window.removeEventListener('resize',    resize);
      window.removeEventListener('keydown',   onKeyDown);
      window.removeEventListener('keyup',     onKeyUp);
      canvas.removeEventListener('mousemove', onMouseMove);
      canvas.removeEventListener('mousemove', onCanvasMouseMove2);
      canvas.removeEventListener('mousedown', onMouseDown);
      canvas.removeEventListener('mouseup',   onMouseUp);
      canvas.removeEventListener('click',     onCanvasClick);
      canvas.removeEventListener('contextmenu', e => e.preventDefault());
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      style={{ display: 'block', cursor: 'crosshair' }}
    />
  );
}
