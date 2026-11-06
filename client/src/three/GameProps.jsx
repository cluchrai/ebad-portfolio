import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Float, RoundedBox } from '@react-three/drei';
import * as THREE from 'three';
import { prefersReducedMotion } from '../state.js';

// Game-themed props hovering over the island, built from primitives and canvas textures.

function canvasTexture(size, draw, pixel = false) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  draw(c.getContext('2d'), size);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  if (pixel) {
    t.magFilter = THREE.NearestFilter;
    t.minFilter = THREE.NearestFilter;
    t.generateMipmaps = false;
  }
  return t;
}

// deterministic noise so the pixel textures look the same every load
const noise = (x, y, s = 0) => {
  const n = Math.sin(x * 127.1 + y * 311.7 + s * 74.7) * 43758.5453;
  return n - Math.floor(n);
};

// ---------------------------------------------------------------- "?" block
function QuestionBlock() {
  const tex = useMemo(
    () =>
      canvasTexture(128, (g, s) => {
        g.fillStyle = '#B9770E';
        g.fillRect(0, 0, s, s);
        g.fillStyle = '#F7C23A';
        g.fillRect(8, 8, s - 16, s - 16);
        g.fillStyle = '#FFE08A';
        g.fillRect(8, 8, s - 16, 6);
        g.fillRect(8, 8, 6, s - 16);
        g.fillStyle = '#8A4B00';
        [[14, 14], [s - 22, 14], [14, s - 22], [s - 22, s - 22]].forEach(([x, y]) => g.fillRect(x, y, 8, 8));
        g.font = '900 78px "Arial Black", Arial, sans-serif';
        g.textAlign = 'center';
        g.textBaseline = 'middle';
        g.fillStyle = '#7A3E00';
        g.fillText('?', s / 2 + 4, s / 2 + 8);
        g.fillStyle = '#FFF3C4';
        g.fillText('?', s / 2, s / 2 + 4);
      }),
    []
  );
  return (
    <mesh castShadow>
      <boxGeometry args={[0.7, 0.7, 0.7]} />
      <meshStandardMaterial map={tex} roughness={0.45} metalness={0.25} emissive="#F7C23A" emissiveIntensity={0.12} />
    </mesh>
  );
}

// ---------------------------------------------------------------- Minecraft-style grass block
function GrassBlock() {
  const mats = useMemo(() => {
    const dirt = (g, x, y, s) => {
      const k = noise(x, y, s);
      g.fillStyle = k > 0.66 ? '#6B4A2E' : k > 0.33 ? '#7A5536' : '#8B6240';
    };
    const make = (draw) => canvasTexture(16, draw, true);
    const side = make((g) => {
      for (let y = 0; y < 16; y++)
        for (let x = 0; x < 16; x++) {
          const green = y < 3 + (noise(x, 0, 3) > 0.6 ? 1 : 0);
          if (green) g.fillStyle = noise(x, y, 1) > 0.5 ? '#5DA83A' : '#4E9531';
          else dirt(g, x, y, 2);
          g.fillRect(x, y, 1, 1);
        }
    });
    const top = make((g) => {
      for (let y = 0; y < 16; y++)
        for (let x = 0; x < 16; x++) {
          const k = noise(x, y, 4);
          g.fillStyle = k > 0.66 ? '#4E9531' : k > 0.33 ? '#5DA83A' : '#6DB946';
          g.fillRect(x, y, 1, 1);
        }
    });
    const bottom = make((g) => {
      for (let y = 0; y < 16; y++)
        for (let x = 0; x < 16; x++) {
          dirt(g, x, y, 5);
          g.fillRect(x, y, 1, 1);
        }
    });
    const m = (map) => new THREE.MeshStandardMaterial({ map, roughness: 0.9 });
    const s = m(side);
    return [s, s, m(top), m(bottom), s, s];
  }, []);
  return (
    <mesh castShadow material={mats}>
      <boxGeometry args={[0.7, 0.7, 0.7]} />
    </mesh>
  );
}

// ---------------------------------------------------------------- mushroom
function Mushroom() {
  return (
    <group scale={0.95}>
      <mesh position={[0, -0.18, 0]} castShadow>
        <cylinderGeometry args={[0.17, 0.2, 0.36, 20]} />
        <meshStandardMaterial color="#FFF1D6" roughness={0.6} />
      </mesh>
      <mesh position={[0, -0.01, 0]} rotation={[Math.PI, 0, 0]}>
        <circleGeometry args={[0.4, 28]} />
        <meshStandardMaterial color="#FFF1D6" roughness={0.6} side={THREE.DoubleSide} />
      </mesh>
      <mesh position={[0, 0, 0]} castShadow>
        <sphereGeometry args={[0.42, 28, 18, 0, Math.PI * 2, 0, Math.PI / 2]} />
        <meshStandardMaterial color="#E5322D" roughness={0.45} side={THREE.DoubleSide} />
      </mesh>
      {[
        [0, 0.41, 0, 0.13],
        [0.26, 0.26, 0.12, 0.1],
        [-0.25, 0.27, 0.1, 0.1],
        [0.04, 0.24, 0.3, 0.1],
        [-0.04, 0.22, -0.3, 0.1],
      ].map(([x, y, z, r], i) => (
        <mesh key={i} position={[x, y, z]} scale={[1, 0.55, 1]}>
          <sphereGeometry args={[r, 16, 12]} />
          <meshStandardMaterial color="#FFFFFF" roughness={0.5} />
        </mesh>
      ))}
      {/* little eyes on the stem */}
      {[-0.06, 0.06].map((x) => (
        <mesh key={x} position={[x, -0.16, 0.18]} scale={[1, 1.6, 0.6]}>
          <sphereGeometry args={[0.03, 10, 10]} />
          <meshStandardMaterial color="#24262E" />
        </mesh>
      ))}
    </group>
  );
}

// ---------------------------------------------------------------- game controller
function Controller() {
  const BODY = '#5B4BFF';
  const DARK = '#24262E';
  return (
    <group scale={0.8}>
      <RoundedBox args={[1.1, 0.34, 0.5]} radius={0.14} smoothness={4} castShadow>
        <meshStandardMaterial color={BODY} roughness={0.35} metalness={0.1} />
      </RoundedBox>
      {[-1, 1].map((s) => (
        <RoundedBox key={s} args={[0.3, 0.5, 0.46]} radius={0.13} smoothness={4} position={[s * 0.48, -0.2, 0]} rotation={[0, 0, s * 0.3]} castShadow>
          <meshStandardMaterial color={BODY} roughness={0.35} metalness={0.1} />
        </RoundedBox>
      ))}
      {/* d-pad */}
      <group position={[-0.34, 0.18, 0.02]}>
        <mesh><boxGeometry args={[0.22, 0.06, 0.07]} /><meshStandardMaterial color={DARK} /></mesh>
        <mesh><boxGeometry args={[0.07, 0.06, 0.22]} /><meshStandardMaterial color={DARK} /></mesh>
      </group>
      {/* face buttons */}
      {[
        [0.34, 0.0, '#FF4D6D'],
        [0.42, 0.0, '#FFC24B'],
        [0.38, 0.07, '#3EDBC0'],
        [0.38, -0.07, '#4DA3FF'],
      ].map(([x, z, c], i) => (
        <mesh key={i} position={[x + 0.02, 0.18, z]}>
          <cylinderGeometry args={[0.04, 0.04, 0.05, 16]} />
          <meshStandardMaterial color={c} roughness={0.3} emissive={c} emissiveIntensity={0.2} />
        </mesh>
      ))}
      {/* sticks */}
      {[[-0.16, 0.12], [0.16, 0.12]].map(([x, z], i) => (
        <mesh key={i} position={[x, 0.2, z + 0.02]}>
          <cylinderGeometry args={[0.06, 0.07, 0.06, 18]} />
          <meshStandardMaterial color={DARK} roughness={0.5} />
        </mesh>
      ))}
    </group>
  );
}

// ---------------------------------------------------------------- spinning coin
function Coin() {
  const ref = useRef();
  useFrame((_, dt) => {
    if (ref.current && !prefersReducedMotion) ref.current.rotation.y += dt * 2.4;
  });
  return (
    <group ref={ref}>
      <mesh rotation={[Math.PI / 2, 0, 0]} castShadow>
        <cylinderGeometry args={[0.26, 0.26, 0.06, 32]} />
        <meshStandardMaterial color="#FFD43B" metalness={0.35} roughness={0.3} emissive="#FFC107" emissiveIntensity={0.55} />
      </mesh>
      <mesh>
        <torusGeometry args={[0.2, 0.018, 10, 32]} />
        <meshStandardMaterial color="#FFF0A8" metalness={0.3} roughness={0.3} emissive="#FFE066" emissiveIntensity={0.4} />
      </mesh>
    </group>
  );
}

function Prop({ position, phase = 0, sway = 0.45, children }) {
  const ref = useRef();
  useFrame(({ clock }) => {
    if (ref.current && sway && !prefersReducedMotion) ref.current.rotation.y = Math.sin(clock.elapsedTime * 0.7 + phase) * sway;
  });
  return (
    <Float speed={1.4} floatIntensity={0.7} rotationIntensity={0.1} position={position}>
      <group ref={ref}>{children}</group>
    </Float>
  );
}

/** Hovers over the island in the hero and shrinks away once the hero scrolls out of view. */
export default function GameProps() {
  const root = useRef();
  useFrame((_, dt) => {
    if (!root.current) return;
    // a touch smaller on phones so they stay clear of the name and the intro panel
    const full = window.innerWidth < 820 ? 0.85 : 1;
    const show = window.scrollY < window.innerHeight * 0.55 ? full : 0;
    const s = THREE.MathUtils.damp(root.current.scale.x, show, 4, dt);
    root.current.scale.setScalar(Math.max(s, 0.0001));
    root.current.visible = s > 0.01;
  });
  return (
    <group ref={root}>
      <Prop position={[-1.3, 2.15, 1.0]} phase={0}><QuestionBlock /></Prop>
      <Prop position={[0, 2.85, 0.2]} phase={1.7}><Controller /></Prop>
      <Prop position={[1.3, 2.15, 1.0]} phase={3.3}><GrassBlock /></Prop>
      <Prop position={[2.35, 1.45, 1.7]} phase={2.2}><Mushroom /></Prop>
      <Prop position={[-2.3, 1.55, 1.6]} phase={0.8} sway={0}><Coin /></Prop>
    </group>
  );
}
