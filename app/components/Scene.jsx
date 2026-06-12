'use client';
// The 3D scene: lights, ground, entities, camera rig, input, and game loop.

import { useRef, useState, useEffect } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { Grid } from '@react-three/drei';
import * as THREE from 'three';
import { updateWorld, startReload, FIELD } from '../game/world';
import { SoldierModel, ZombieModel } from './models';

// ─── Player ──────────────────────────────────────────────────────────────────
function Player({ world }) {
  const ref = useRef();
  useFrame(() => {
    const p = world.player;
    if (!ref.current) return;
    ref.current.position.set(p.x, 0, p.z);
    // model faces +x at angle 0; three rotates about +y
    ref.current.rotation.y = -p.angle;
  });
  return <group ref={ref}><SoldierModel /></group>;
}

// ─── Zombie ──────────────────────────────────────────────────────────────────
function Zombie({ z }) {
  const ref = useRef();
  useFrame(() => {
    if (!ref.current) return;
    ref.current.position.set(z.x, 0, z.z);
    ref.current.rotation.y = -z.angle;
    const pop = z.hitTimer > 0 ? 1 + z.hitTimer * 1.2 : 1;
    ref.current.scale.setScalar(pop);
  });
  return <group ref={ref}><ZombieModel variant={z.variant} /></group>;
}

// ─── Bullet ──────────────────────────────────────────────────────────────────
function Bullet({ b }) {
  const ref = useRef();
  useFrame(() => {
    if (ref.current) ref.current.position.set(b.x, 0.95, b.z);
  });
  return (
    <mesh ref={ref}>
      <sphereGeometry args={[0.18, 8, 8]} />
      <meshStandardMaterial color="#ffe066" emissive="#ffcc00" emissiveIntensity={2.5} />
    </mesh>
  );
}

// ─── Blood particle ──────────────────────────────────────────────────────────
function Particle({ p }) {
  const ref = useRef();
  useFrame(() => {
    if (!ref.current) return;
    ref.current.position.set(p.x, p.y, p.z);
    ref.current.scale.setScalar(Math.max(0.001, p.life));
  });
  return (
    <mesh ref={ref}>
      <sphereGeometry args={[p.r, 6, 6]} />
      <meshStandardMaterial color="#cc0000" roughness={1} />
    </mesh>
  );
}

// ─── Generic list that only re-renders when world.rev[key] changes ───────────
function EntityList({ world, listKey, getItems, render }) {
  const [items, setItems] = useState(() => getItems());
  const lastRev = useRef(world.rev[listKey]);
  useFrame(() => {
    if (world.rev[listKey] !== lastRev.current) {
      lastRev.current = world.rev[listKey];
      setItems(getItems());
    }
  });
  return items.map(render);
}

// ─── Camera that follows the player from a tilted top-down angle ─────────────
function CameraRig({ world }) {
  const { camera } = useThree();
  const target = useRef(new THREE.Vector3());
  useFrame(() => {
    const p = world.player;
    // desired camera position: above and slightly toward +z (south)
    const desired = new THREE.Vector3(p.x, 26, p.z + 16);
    camera.position.lerp(desired, 0.12);
    target.current.set(p.x, 0, p.z);
    camera.lookAt(target.current);
  });
  return null;
}

// ─── Input: keyboard movement/reload + raycast aim + shooting ────────────────
function InputController({ world }) {
  const { camera, gl } = useThree();
  const raycaster = useRef(new THREE.Raycaster());
  const groundPlane = useRef(new THREE.Plane(new THREE.Vector3(0, 1, 0), 0));
  const ndc = useRef(new THREE.Vector2());
  const hit = useRef(new THREE.Vector3());

  useEffect(() => {
    const MOVE = ['arrowup', 'arrowdown', 'arrowleft', 'arrowright', ' '];
    const onKeyDown = (e) => {
      const k = e.key.toLowerCase();
      if (MOVE.includes(k)) e.preventDefault();
      world.input.keys[k] = true;
      if (k === 'r') startReload(world.player);
    };
    const onKeyUp = (e) => { world.input.keys[e.key.toLowerCase()] = false; };

    const updateAim = (e) => {
      const rect = gl.domElement.getBoundingClientRect();
      ndc.current.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      ndc.current.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.current.setFromCamera(ndc.current, camera);
      if (raycaster.current.ray.intersectPlane(groundPlane.current, hit.current)) {
        world.input.aim.x = hit.current.x;
        world.input.aim.z = hit.current.z;
      }
    };
    const onDown = (e) => { if (e.button === 0) world.input.mouseDown = true; };
    const onUp = (e) => { if (e.button === 0) world.input.mouseDown = false; };
    const onContext = (e) => e.preventDefault();

    const el = gl.domElement;
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    el.addEventListener('pointermove', updateAim);
    el.addEventListener('pointerdown', onDown);
    el.addEventListener('pointerup', onUp);
    el.addEventListener('contextmenu', onContext);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      el.removeEventListener('pointermove', updateAim);
      el.removeEventListener('pointerdown', onDown);
      el.removeEventListener('pointerup', onUp);
      el.removeEventListener('contextmenu', onContext);
    };
  }, [camera, gl, world]);

  return null;
}

// ─── The game loop driver ────────────────────────────────────────────────────
function GameLoop({ world }) {
  useFrame((_, dt) => updateWorld(world, Math.min(dt, 0.05)));
  return null;
}

// ─── Ground ──────────────────────────────────────────────────────────────────
function Ground() {
  return (
    <>
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow position={[0, -0.01, 0]}>
        <planeGeometry args={[FIELD.hx * 2 + 12, FIELD.hz * 2 + 12]} />
        <meshStandardMaterial color="#1a2a1a" roughness={1} />
      </mesh>
      <Grid
        args={[FIELD.hx * 2, FIELD.hz * 2]}
        cellSize={2}
        cellColor="#1f301f"
        sectionSize={10}
        sectionColor="#2a4a2a"
        fadeDistance={70}
        infiniteGrid={false}
        position={[0, 0, 0]}
      />
      {/* field border markers */}
      <mesh position={[0, 0.02, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[Math.hypot(FIELD.hx, FIELD.hz) - 0.1, Math.hypot(FIELD.hx, FIELD.hz), 64]} />
        <meshBasicMaterial color="#2a4a2a" transparent opacity={0} />
      </mesh>
    </>
  );
}

export default function Scene({ world }) {
  return (
    <>
      <ambientLight intensity={0.5} />
      <hemisphereLight args={['#88aaff', '#223322', 0.4]} />
      <directionalLight
        position={[20, 35, 15]}
        intensity={1.4}
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-camera-left={-50}
        shadow-camera-right={50}
        shadow-camera-top={50}
        shadow-camera-bottom={-50}
      />
      <fog attach="fog" args={['#0d150d', 50, 110]} />

      <Ground />
      <Player world={world} />

      <EntityList
        world={world} listKey="zombies"
        getItems={() => world.zombies.slice()}
        render={(z) => <Zombie key={z.id} z={z} />}
      />
      <EntityList
        world={world} listKey="bullets"
        getItems={() => world.bullets.slice()}
        render={(b) => <Bullet key={b.id} b={b} />}
      />
      <EntityList
        world={world} listKey="particles"
        getItems={() => world.particles.slice()}
        render={(p) => <Particle key={p.id} p={p} />}
      />

      <CameraRig world={world} />
      <InputController world={world} />
      <GameLoop world={world} />
    </>
  );
}
