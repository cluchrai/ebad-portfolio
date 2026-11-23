import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { RoundedBox } from '@react-three/drei';
import * as THREE from 'three';

/**
 * Props the avatar uses during a section activity. They are children of the avatar's group, so they walk with him.
 * Positions are in avatar space (he faces +z; units are metres, feet at y = 0) and match the hand targets of the
 * Juggle, PlayGame, LiftTrophy and Type clips in blender/build_avatar.py.
 */

function Controller() {
  return (
    <group position={[0, 0.975, 0.32]} rotation={[-0.3, 0, 0]}>
      <RoundedBox args={[0.26, 0.1, 0.1]} radius={0.04} smoothness={3} castShadow>
        <meshStandardMaterial color="#6C4DFF" roughness={0.35} />
      </RoundedBox>
      {[-1, 1].map((s) => (
        <mesh key={s} position={[s * 0.1, -0.05, 0]} rotation={[0, 0, s * 0.3]} castShadow>
          <capsuleGeometry args={[0.04, 0.07, 4, 10]} />
          <meshStandardMaterial color="#5A3FE0" roughness={0.4} />
        </mesh>
      ))}
      {[['#FFC24B', 0.1, 0.012], ['#FF6FAE', 0.13, -0.012]].map(([c, x, z], i) => (
        <mesh key={i} position={[x, 0.055, z]}>
          <sphereGeometry args={[0.013, 10, 10]} />
          <meshStandardMaterial color={c} emissive={c} emissiveIntensity={0.6} />
        </mesh>
      ))}
    </group>
  );
}

function LaptopDesk() {
  return (
    <group position={[0, -0.08, 0.42]}>
      <mesh position={[0, 0.43, 0]} castShadow>
        <cylinderGeometry args={[0.05, 0.12, 0.86, 12]} />
        <meshStandardMaterial color="#5C5470" roughness={0.6} />
      </mesh>
      <mesh position={[0, 0.88, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[0.3, 0.3, 0.04, 28]} />
        <meshStandardMaterial color="#F2EADF" roughness={0.7} />
      </mesh>
      <mesh position={[0, 0.915, -0.02]} castShadow>
        <boxGeometry args={[0.36, 0.02, 0.25]} />
        <meshStandardMaterial color="#B8B4C8" metalness={0.4} roughness={0.4} />
      </mesh>
      <group position={[0, 0.925, 0.1]} rotation={[0.28, 0, 0]}>
        <mesh position={[0, 0.12, 0]} castShadow>
          <boxGeometry args={[0.36, 0.24, 0.015]} />
          <meshStandardMaterial color="#B8B4C8" metalness={0.4} roughness={0.4} />
        </mesh>
        <mesh position={[0, 0.12, -0.009]}>
          <planeGeometry args={[0.32, 0.2]} />
          <meshBasicMaterial color="#8C6BFF" toneMapped={false} side={THREE.BackSide} />
        </mesh>
      </group>
    </group>
  );
}

function Trophy() {
  const gold = { color: '#FFC24B', metalness: 0.85, roughness: 0.22, emissive: '#FF9F1C', emissiveIntensity: 0.25 };
  return (
    <group position={[0, 1.84, 0.13]} scale={0.9}>
      <mesh position={[0, 0.02, 0]} castShadow>
        <boxGeometry args={[0.18, 0.04, 0.12]} />
        <meshStandardMaterial {...gold} />
      </mesh>
      <mesh position={[0, 0.1, 0]} castShadow>
        <cylinderGeometry args={[0.02, 0.03, 0.12, 10]} />
        <meshStandardMaterial {...gold} />
      </mesh>
      <mesh position={[0, 0.26, 0]} castShadow>
        <cylinderGeometry args={[0.1, 0.045, 0.2, 18]} />
        <meshStandardMaterial {...gold} />
      </mesh>
      {[-1, 1].map((s) => (
        <mesh key={s} position={[s * 0.115, 0.27, 0]} rotation={[0, 0, 0]}>
          <torusGeometry args={[0.045, 0.012, 8, 16]} />
          <meshStandardMaterial {...gold} />
        </mesh>
      ))}
    </group>
  );
}

const BLOCK_COLORS = ['#FFC24B', '#FF6FAE', '#3EDBC0'];

// three blocks tossed in an arc between his hands, in step with the Juggle clip
function JuggleBlocks({ actions }) {
  const refs = useRef([]);
  useFrame(() => {
    const t = actions?.Juggle?.time ?? 0;
    const ph = ((t * 30 - 12) / 24) * Math.PI * 2;
    refs.current.forEach((m, i) => {
      if (!m) return;
      const th = ph + (i * Math.PI * 2) / 3;
      m.position.set(0.21 * Math.cos(th), 0.98 + 0.34 * Math.abs(Math.sin(th)), 0.34);
      m.rotation.set(th, th * 0.7, 0);
    });
  });
  return BLOCK_COLORS.map((c, i) => (
    <mesh key={i} ref={(el) => (refs.current[i] = el)} castShadow>
      <boxGeometry args={[0.1, 0.1, 0.1]} />
      <meshStandardMaterial color={c} roughness={0.4} />
    </mesh>
  ));
}

export default function ActivityProp({ name, actions }) {
  const wrap = useRef();
  // pop in instead of appearing at full size
  useFrame((_, dt) => {
    if (wrap.current) wrap.current.scale.setScalar(THREE.MathUtils.damp(wrap.current.scale.x, 1, 9, dt));
  });
  return (
    <group ref={wrap} scale={0.01}>
      {name === 'PlayGame' && <Controller />}
      {name === 'Type' && <LaptopDesk />}
      {name === 'LiftTrophy' && <Trophy />}
      {name === 'Juggle' && <JuggleBlocks actions={actions} />}
    </group>
  );
}
