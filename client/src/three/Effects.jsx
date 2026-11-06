import { useEffect, useMemo, useRef, useState } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { Html, Sparkles } from '@react-three/drei';
import * as THREE from 'three';
import { on } from '../state.js';
import { PENDANT_WORLD } from './AvatarRig.jsx';

/** Golden rings climb the avatar, then a LEVEL UP badge with the newest skill. */
export function LevelUpFX({ position = [0, 0, 0] }) {
  const [run, setRun] = useState(null); // { skill, id }
  const narrow = useThree((s) => s.size.width < 820);
  const rings = useRef([]);
  const start = useRef(0);

  useEffect(() => on('fx:levelup', ({ skill }) => {
    start.current = performance.now();
    setRun({ skill, id: Math.random() });
  }), []);

  useEffect(() => {
    if (!run) return undefined;
    const t = setTimeout(() => setRun(null), 3200);
    return () => clearTimeout(t);
  }, [run]);

  useFrame(() => {
    if (!run) return;
    const t = (performance.now() - start.current) / 1000;
    rings.current.forEach((m, i) => {
      if (!m) return;
      const k = THREE.MathUtils.clamp((t - i * 0.18) / 1.3, 0, 1);
      m.position.y = 0.05 + k * 2.1;
      const s = 0.55 + Math.sin(k * Math.PI) * 0.25;
      m.scale.setScalar(s);
      m.material.opacity = Math.sin(k * Math.PI) * 0.9;
      m.rotation.z += 0.04;
    });
  });

  if (!run) return null;
  return (
    <group position={position}>
      {[0, 1, 2].map((i) => (
        <mesh key={i} ref={(el) => (rings.current[i] = el)} rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[0.55, 0.025, 12, 64]} />
          <meshBasicMaterial color={i === 1 ? '#8C6BFF' : '#FFC24B'} transparent opacity={0} toneMapped={false} />
        </mesh>
      ))}
      <Sparkles count={40} scale={[1.4, 2.4, 1.4]} position={[0, 1.1, 0]} size={5} speed={1.4} color="#FFD36E" />
      <Html key={run.id} position={[0, 2.25, 0]} center distanceFactor={narrow ? undefined : 6} zIndexRange={[30, 20]}>
        <div className="levelup" role="status">
          <p className="levelup-title">LEVEL UP!</p>
          <div className="levelup-bar"><span /></div>
          <p className="levelup-skill">+1 {run.skill}</p>
        </div>
      </Html>
    </group>
  );
}

/** Star burst from the pendant. */
export function PendantFX() {
  const [active, setActive] = useState(0);
  const group = useRef();
  const light = useRef();
  const start = useRef(0);

  useEffect(() => on('fx:pendant', () => {
    start.current = performance.now();
    setActive((a) => a + 1);
  }), []);

  useFrame(() => {
    if (!active || !group.current) return;
    group.current.position.copy(PENDANT_WORLD);
    const t = (performance.now() - start.current) / 1000;
    if (light.current) light.current.intensity = Math.max(0, 3 - t * 1.2) * 2;
  });

  if (!active) return null;
  return (
    <group ref={group}>
      <pointLight ref={light} color="#FFD36E" distance={2.5} intensity={6} />
      <Sparkles key={active} count={36} scale={0.7} size={6} speed={2.2} color="#FFF1B8" noise={1.5} />
    </group>
  );
}

/** Blossom petals drifting down around the island. Instanced, cheap. */
export function Petals({ count = 70, area = 7 }) {
  const mesh = useRef();
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const data = useMemo(
    () =>
      Array.from({ length: count }, () => ({
        x: (Math.random() - 0.5) * area,
        y: Math.random() * 5,
        z: (Math.random() - 0.5) * area,
        s: 0.04 + Math.random() * 0.05,
        sp: 0.15 + Math.random() * 0.25,
        r: Math.random() * Math.PI,
      })),
    [count, area]
  );
  useFrame((_, dt) => {
    if (!mesh.current) return;
    data.forEach((p, i) => {
      p.y -= p.sp * dt;
      p.r += dt * 1.5;
      if (p.y < -1.5) p.y = 4.5;
      dummy.position.set(p.x + Math.sin(p.r) * 0.25, p.y, p.z + Math.cos(p.r * 0.7) * 0.2);
      dummy.rotation.set(p.r, p.r * 0.6, p.r * 0.3);
      dummy.scale.setScalar(p.s);
      dummy.updateMatrix();
      mesh.current.setMatrixAt(i, dummy.matrix);
    });
    mesh.current.instanceMatrix.needsUpdate = true;
  });
  return (
    <instancedMesh ref={mesh} args={[undefined, undefined, count]}>
      <circleGeometry args={[1, 5]} />
      <meshStandardMaterial color="#FFA8CF" side={THREE.DoubleSide} roughness={0.6} />
    </instancedMesh>
  );
}
