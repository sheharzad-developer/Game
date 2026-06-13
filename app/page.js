'use client';

import { useRef } from 'react';
import { Canvas } from '@react-three/fiber';
import Scene from './components/Scene';
import Hud from './components/Hud';
import { createWorld } from './game/world';

export default function GamePage() {
  const worldRef = useRef(null);
  if (!worldRef.current) worldRef.current = createWorld();
  const world = worldRef.current;

  return (
    <div style={{ position: 'fixed', inset: 0, background: '#0d150d', cursor: 'crosshair' }}>
      <Canvas
        shadows
        dpr={[1, 2]}
        camera={{ position: [0, 26, 16], fov: 50, near: 0.1, far: 200 }}
      >
        <Scene world={world} />
      </Canvas>
      <Hud world={world} />
    </div>
  );
}
