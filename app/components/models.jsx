'use client';
// Character models. Each tries to load a real .glb from /public/models and
// falls back to a procedural mesh if the file is missing or fails to load.
// Drop `soldier.glb` / `zombie.glb` into public/models to use real models —
// no code changes needed.

import { Suspense, Component, useEffect, useState } from 'react';
import { useGLTF } from '@react-three/drei';

// Probe whether a model file actually exists, so a missing .glb is treated as
// "use the placeholder" (normal) rather than a thrown loader error (noisy).
const _availCache = new Map();
function useModelAvailable(url) {
  const [avail, setAvail] = useState(() => _availCache.get(url) ?? null);
  useEffect(() => {
    if (_availCache.has(url)) { setAvail(_availCache.get(url)); return; }
    let active = true;
    fetch(url, { method: 'HEAD' })
      .then((r) => { _availCache.set(url, r.ok); if (active) setAvail(r.ok); })
      .catch(() => { _availCache.set(url, false); if (active) setAvail(false); });
    return () => { active = false; };
  }, [url]);
  return avail;
}

// ─── Error boundary so a missing .glb falls back instead of crashing ─────────
class ModelBoundary extends Component {
  constructor(props) { super(props); this.state = { failed: false }; }
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch() { /* swallow — fallback handles it */ }
  render() {
    if (this.state.failed) return this.props.fallback;
    return this.props.children;
  }
}

function Gltf({ url, scale = 1 }) {
  const { scene } = useGLTF(url);
  // clone so multiple instances (zombies) don't share one object
  return <primitive object={scene.clone(true)} scale={scale} />;
}

function ModelWithFallback({ url, scale, fallback }) {
  const avail = useModelAvailable(url);
  // unknown or missing → show the procedural placeholder
  if (avail !== true) return fallback;
  return (
    <ModelBoundary fallback={fallback}>
      <Suspense fallback={fallback}>
        <Gltf url={url} scale={scale} />
      </Suspense>
    </ModelBoundary>
  );
}

// ─── Procedural soldier (faces +x at angle 0) ────────────────────────────────
function ProceduralSoldier() {
  return (
    <group>
      {/* body */}
      <mesh castShadow position={[0, 0.75, 0]}>
        <capsuleGeometry args={[0.45, 0.7, 6, 12]} />
        <meshStandardMaterial color="#4a7c59" roughness={0.8} />
      </mesh>
      {/* helmet */}
      <mesh castShadow position={[0, 1.5, 0]}>
        <sphereGeometry args={[0.42, 16, 16]} />
        <meshStandardMaterial color="#2d4a2d" roughness={0.6} />
      </mesh>
      {/* rifle, pointing +x */}
      <mesh castShadow position={[0.7, 0.95, 0.18]}>
        <boxGeometry args={[1.1, 0.14, 0.14]} />
        <meshStandardMaterial color="#5a4410" roughness={0.5} metalness={0.3} />
      </mesh>
    </group>
  );
}

// ─── Procedural zombie ───────────────────────────────────────────────────────
function ProceduralZombie({ variant = 0 }) {
  const skin = variant === 0 ? '#4a6a2a' : '#5a7a3a';
  return (
    <group>
      <mesh castShadow position={[0, 0.7, 0]}>
        <capsuleGeometry args={[0.42, 0.65, 6, 12]} />
        <meshStandardMaterial color={skin} roughness={0.9} />
      </mesh>
      <mesh castShadow position={[0, 1.35, 0]}>
        <sphereGeometry args={[0.38, 16, 16]} />
        <meshStandardMaterial color="#3a5a1a" roughness={0.8} />
      </mesh>
      {/* glowing eyes */}
      <mesh position={[0.32, 1.4, 0.14]}>
        <sphereGeometry args={[0.07, 8, 8]} />
        <meshStandardMaterial color="#ff2200" emissive="#ff2200" emissiveIntensity={2} />
      </mesh>
      <mesh position={[0.32, 1.4, -0.14]}>
        <sphereGeometry args={[0.07, 8, 8]} />
        <meshStandardMaterial color="#ff2200" emissive="#ff2200" emissiveIntensity={2} />
      </mesh>
      {/* outstretched arms */}
      <mesh castShadow position={[0.55, 0.95, 0.28]} rotation={[0, 0, -0.2]}>
        <boxGeometry args={[0.7, 0.18, 0.18]} />
        <meshStandardMaterial color={skin} roughness={0.9} />
      </mesh>
      <mesh castShadow position={[0.55, 0.95, -0.28]} rotation={[0, 0, -0.2]}>
        <boxGeometry args={[0.7, 0.18, 0.18]} />
        <meshStandardMaterial color={skin} roughness={0.9} />
      </mesh>
    </group>
  );
}

export function SoldierModel() {
  return (
    <ModelWithFallback url="/models/soldier.glb" scale={1} fallback={<ProceduralSoldier />} />
  );
}

export function ZombieModel({ variant }) {
  return (
    <ModelWithFallback
      url="/models/zombie.glb"
      scale={1}
      fallback={<ProceduralZombie variant={variant} />}
    />
  );
}
