'use client';
// HTML overlay HUD. Reads the mutable world each animation frame and mirrors a
// small snapshot into React state for display.

import { useEffect, useState } from 'react';
import { resetWorld, CONFIG } from '../game/world';

export default function Hud({ world }) {
  const [s, setS] = useState(snapshot(world));

  useEffect(() => {
    let raf;
    const tick = () => { setS(snapshot(world)); raf = requestAnimationFrame(tick); };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [world]);

  const hpRatio = s.hp / s.maxHp;
  const hpColor = hpRatio > 0.5 ? '#22cc44' : hpRatio > 0.25 ? '#ffaa00' : '#cc2222';

  return (
    <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', fontFamily: 'monospace', userSelect: 'none' }}>
      {/* health + ammo (bottom-left) */}
      <div style={panel({ left: 16, bottom: 16, width: 240 })}>
        <div style={{ color: '#aaa', fontSize: 12 }}>HEALTH</div>
        <div style={{ background: '#330000', borderRadius: 4, height: 16, marginTop: 4, overflow: 'hidden' }}>
          <div style={{ width: `${hpRatio * 100}%`, height: '100%', background: hpColor, transition: 'width 0.1s' }} />
        </div>
        <div style={{ textAlign: 'center', fontSize: 11, color: '#fff', marginTop: -14, fontWeight: 'bold' }}>
          {Math.ceil(s.hp)} / {s.maxHp}
        </div>
        <div style={{ color: '#aaa', fontSize: 12, marginTop: 8 }}>AMMO</div>
        {s.reloading ? (
          <div style={{ color: '#ffaa00', fontSize: 13, fontWeight: 'bold' }}>
            RELOADING… {Math.round((1 - s.reloadTimer / CONFIG.RELOAD_TIME) * 100)}%
          </div>
        ) : (
          <div style={{ fontSize: 18, color: '#4488ff', fontWeight: 'bold' }}>
            {s.ammo}<span style={{ color: '#667788', fontSize: 13 }}> / {s.reserve}</span>
          </div>
        )}
      </div>

      {/* wave / score (top-right) */}
      <div style={panel({ right: 16, top: 16, width: 170, textAlign: 'right' })}>
        <div style={{ color: '#ffcc00', fontSize: 20, fontWeight: 'bold' }}>WAVE {s.wave}</div>
        <div style={{ color: '#ccc', fontSize: 14, marginTop: 4 }}>KILLS: {s.kills}</div>
        <div style={{ color: '#ccc', fontSize: 14 }}>SCORE: {s.score}</div>
      </div>

      {/* next-wave countdown (top-center) */}
      {!s.waveActive && s.wave > 0 && s.gameState === 'playing' && (
        <div style={{ ...panel({ top: 16, width: 220 }), left: '50%', transform: 'translateX(-50%)', textAlign: 'center', color: '#88ff88', fontSize: 14 }}>
          Next wave in {Math.ceil(s.waveTimer)}s…
        </div>
      )}

      {/* controls hint (bottom-center) */}
      <div style={{ position: 'absolute', bottom: 14, left: '50%', transform: 'translateX(-50%)', color: 'rgba(255,255,255,0.4)', fontSize: 11 }}>
        WASD / Arrows move · Mouse aim · LMB shoot · R reload
      </div>

      {/* game over */}
      {s.gameState === 'gameover' && (
        <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.72)', display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'auto' }}>
          <div style={{ textAlign: 'center', color: '#fff' }}>
            <div style={{ color: '#ff3333', fontSize: 52, fontWeight: 'bold', textShadow: '0 0 30px #ff0000' }}>GAME OVER</div>
            <div style={{ fontSize: 20, marginTop: 12 }}>Wave reached: {s.wave}</div>
            <div style={{ fontSize: 20 }}>Kills: {s.kills}</div>
            <div style={{ fontSize: 20 }}>Final score: {s.score}</div>
            <button
              onClick={() => resetWorld(world)}
              style={{ marginTop: 24, padding: '12px 36px', fontSize: 20, fontWeight: 'bold', fontFamily: 'monospace', color: '#fff', background: '#226622', border: '2px solid #88ee88', borderRadius: 10, cursor: 'pointer' }}
            >
              RESTART
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function snapshot(w) {
  const p = w.player;
  return {
    hp: p.hp, maxHp: p.maxHp, ammo: p.ammo, reserve: p.reserve,
    reloading: p.reloading, reloadTimer: p.reloadTimer,
    wave: w.wave, kills: w.kills, score: w.score,
    waveActive: w.waveActive, waveTimer: w.waveTimer, gameState: w.gameState,
  };
}

function panel({ left, right, top, bottom, width, textAlign }) {
  return {
    position: 'absolute', left, right, top, bottom, width, textAlign,
    background: 'rgba(0,0,0,0.55)', borderRadius: 10, padding: 12,
  };
}
