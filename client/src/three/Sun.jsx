import { useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { prefersReducedMotion, sky } from '../state.js';

const DISTANCE = 16;

const glowTexture = (stops) => {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(128, 128, 0, 128, 128, 128);
  stops.forEach(([at, color]) => grad.addColorStop(at, color));
  g.fillStyle = grad;
  g.fillRect(0, 0, 256, 256);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
};

// deterministic noise so the moon looks the same every load
const noise = (x, s = 0) => {
  const n = Math.sin(x * 127.1 + s * 311.7) * 43758.5453;
  return n - Math.floor(n);
};

const moonTexture = () => {
  const S = 256;
  const c = document.createElement('canvas');
  c.width = c.height = S;
  const g = c.getContext('2d');
  g.save();
  g.beginPath();
  g.arc(S / 2, S / 2, S / 2 - 1, 0, Math.PI * 2);
  g.clip();
  const base = g.createRadialGradient(S * 0.4, S * 0.38, 10, S / 2, S / 2, S / 2);
  base.addColorStop(0, '#FBFCFF');
  base.addColorStop(1, '#D5DBF4');
  g.fillStyle = base;
  g.fillRect(0, 0, S, S);
  // soft, blurred "seas" so the face reads as a moon rather than bubbles
  g.filter = 'blur(10px)';
  g.fillStyle = 'rgba(150, 160, 205, 0.3)';
  [[0.36, 0.34, 46, 34], [0.62, 0.5, 38, 46], [0.44, 0.68, 30, 22], [0.7, 0.28, 24, 20]].forEach(([x, y, rx, ry]) => {
    g.beginPath();
    g.ellipse(x * S, y * S, rx, ry, 0.5, 0, Math.PI * 2);
    g.fill();
  });
  // small, faint craters
  g.filter = 'blur(2px)';
  g.fillStyle = 'rgba(150, 160, 205, 0.22)';
  for (let i = 0; i < 18; i++) {
    const x = (0.12 + noise(i, 1) * 0.76) * S;
    const y = (0.12 + noise(i, 2) * 0.76) * S;
    const r = 3 + noise(i, 3) * 8;
    g.beginPath();
    g.arc(x, y, r, 0, Math.PI * 2);
    g.fill();
  }
  g.filter = 'none';
  g.restore();
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
};

const ease = (k) => k * k * (3 - 2 * k);

/**
 * The sun by day and the moon by night. Both are fixed to the screen (they follow the camera's position
 * and rotation) and drift a little as the page scrolls. Switching theme sets one and raises the other.
 */
export default function Sun() {
  const root = useRef();
  const sunRef = useRef();
  const moonRef = useRef();
  const rays = useRef();
  const drift = useRef(0);
  const { camera } = useThree();
  const sunGlow = useMemo(
    () => glowTexture([[0, 'rgba(255, 244, 200, 0.95)'], [0.25, 'rgba(255, 220, 140, 0.55)'], [0.6, 'rgba(255, 190, 120, 0.15)'], [1, 'rgba(255, 190, 120, 0)']]),
    []
  );
  const moonGlow = useMemo(
    () => glowTexture([[0, 'rgba(225, 233, 255, 0.85)'], [0.3, 'rgba(170, 190, 255, 0.4)'], [0.65, 'rgba(120, 140, 230, 0.12)'], [1, 'rgba(120, 140, 230, 0)']]),
    []
  );
  const moonMap = useMemo(moonTexture, []);
  const rayAngles = useMemo(() => Array.from({ length: 14 }, (_, i) => (i / 14) * Math.PI * 2), []);

  useFrame(({ clock, size }, dt) => {
    if (!root.current || !sunRef.current || !moonRef.current) return;
    root.current.position.copy(camera.position);
    root.current.quaternion.copy(camera.quaternion);

    // scroll progress 0..1, eased so the drift stays gentle
    const max = document.documentElement.scrollHeight - window.innerHeight;
    const p = max > 0 ? THREE.MathUtils.clamp(window.scrollY / max, 0, 1) : 0;
    drift.current = THREE.MathUtils.damp(drift.current, p, prefersReducedMotion ? 50 : 2, dt);
    const d = drift.current;

    // base spot: ~78% right, ~56% up, sliding toward the centre and lower as you scroll
    const halfH = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * DISTANCE;
    const halfW = halfH * (size.width / size.height);
    const bob = prefersReducedMotion ? 0 : Math.sin(clock.elapsedTime * 0.4) * 0.12;
    const x = halfW * (0.78 - 0.2 * d);
    const y = halfH * (0.56 - 0.2 * d) + bob + Math.sin(d * Math.PI) * halfH * 0.05;

    const n = sky.night;
    const sunUp = ease(THREE.MathUtils.clamp(1 - n * 1.6, 0, 1)); // sun sets quickly, moon rises after
    const moonUp = ease(THREE.MathUtils.clamp(n * 1.6 - 0.6, 0, 1));
    sunRef.current.position.set(x, y - (1 - sunUp) * halfH * 1.1, -DISTANCE);
    moonRef.current.position.set(x, y - (1 - moonUp) * halfH * 1.1, -DISTANCE);
    sunRef.current.visible = sunUp > 0.01;
    moonRef.current.visible = moonUp > 0.01;
    if (rays.current && !prefersReducedMotion) rays.current.rotation.z = clock.elapsedTime * 0.05;
  });

  return (
    <group ref={root}>
      <group ref={sunRef}>
        <sprite scale={[8, 8, 1]}>
          <spriteMaterial map={sunGlow} transparent depthWrite={false} blending={THREE.AdditiveBlending} toneMapped={false} />
        </sprite>
        <group ref={rays}>
          {rayAngles.map((a, i) => (
            <mesh key={i} rotation={[0, 0, a]}>
              <planeGeometry args={[0.28, i % 2 ? 6.8 : 5.2]} />
              <meshBasicMaterial color="#FFE7A0" transparent opacity={0.22} depthWrite={false} toneMapped={false} side={THREE.DoubleSide} />
            </mesh>
          ))}
        </group>
        <mesh>
          <sphereGeometry args={[1.5, 32, 32]} />
          <meshBasicMaterial color="#FFE27A" toneMapped={false} />
        </mesh>
        <mesh position={[0, 0, 0.01]}>
          <circleGeometry args={[1.18, 32]} />
          <meshBasicMaterial color="#FFF6C9" toneMapped={false} />
        </mesh>
      </group>

      <group ref={moonRef}>
        <sprite scale={[8.5, 8.5, 1]}>
          <spriteMaterial map={moonGlow} transparent depthWrite={false} blending={THREE.AdditiveBlending} toneMapped={false} />
        </sprite>
        <mesh>
          <circleGeometry args={[1.35, 64]} />
          <meshBasicMaterial map={moonMap} transparent toneMapped={false} />
        </mesh>
      </group>
    </group>
  );
}
