import { useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { prefersReducedMotion, sky } from '../state.js';

// seeded so the constellations never change between loads
function rng(seed) {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
}

function starPositions(count, radius, seed) {
  const r = rng(seed);
  const out = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    // mostly the upper sky, but a few below the horizon so cloud gaps are not empty
    const y = -0.3 + r() * 1.3;
    const a = r() * Math.PI * 2;
    const rad = Math.sqrt(Math.max(0, 1 - Math.min(1, y * y)));
    out[i * 3] = Math.cos(a) * rad * radius;
    out[i * 3 + 1] = Math.min(1, y) * radius;
    out[i * 3 + 2] = Math.sin(a) * rad * radius;
  }
  return out;
}

const streakTexture = () => {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 16;
  const g = c.getContext('2d');
  const along = g.createLinearGradient(0, 0, 256, 0);
  along.addColorStop(0, 'rgba(160, 190, 255, 0)');
  along.addColorStop(0.75, 'rgba(190, 210, 255, 0.45)');
  along.addColorStop(1, 'rgba(255, 255, 255, 1)');
  g.fillStyle = along;
  g.fillRect(0, 0, 256, 16);
  // taper the thickness towards the tail
  g.globalCompositeOperation = 'destination-in';
  const across = g.createLinearGradient(0, 0, 0, 16);
  across.addColorStop(0, 'rgba(0, 0, 0, 0)');
  across.addColorStop(0.5, 'rgba(0, 0, 0, 1)');
  across.addColorStop(1, 'rgba(0, 0, 0, 0)');
  g.fillStyle = across;
  g.fillRect(0, 0, 256, 16);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
};

// soft round dot so stars are not square pixels
const dotTexture = () => {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grad.addColorStop(0, 'rgba(255, 255, 255, 1)');
  grad.addColorStop(0.3, 'rgba(255, 255, 255, 0.85)');
  grad.addColorStop(1, 'rgba(255, 255, 255, 0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(c);
};

const SHOOT_DISTANCE = 18;

/** Twinkling stars plus an occasional shooting star. Fades in with the night value. */
export default function NightSky() {
  const stars = useRef();
  const layerA = useRef();
  const layerB = useRef();
  const shoot = useRef();
  const streak = useRef();
  const { camera } = useThree();
  const posA = useMemo(() => starPositions(4200, 45, 7), []);
  const posB = useMemo(() => starPositions(1500, 44, 21), []);
  const tex = useMemo(streakTexture, []);
  const dot = useMemo(dotTexture, []);
  const flight = useRef({ active: false, t: 0, dur: 1, next: 2, sx: 0, sy: 0, dx: 0, dy: 0, len: 0, angle: 0 });

  useFrame(({ clock, size }, dt) => {
    const n = sky.night;
    const on = n > 0.02;
    if (stars.current) {
      stars.current.visible = on;
      stars.current.position.copy(camera.position); // stars stay put in the world, only the viewpoint moves
    }
    if (shoot.current) {
      shoot.current.position.copy(camera.position);
      shoot.current.quaternion.copy(camera.quaternion);
    }
    if (!on) {
      if (streak.current) streak.current.visible = false;
      flight.current.active = false;
      flight.current.next = 1.5;
      return;
    }
    const t = clock.elapsedTime;
    if (layerA.current) layerA.current.material.opacity = n * 0.85;
    if (layerB.current) layerB.current.material.opacity = n * (prefersReducedMotion ? 0.8 : 0.55 + 0.45 * Math.sin(t * 1.9));

    // shooting star: only once the night has mostly arrived
    const f = flight.current;
    if (!streak.current || prefersReducedMotion) return;
    if (n < 0.85) {
      streak.current.visible = false;
      return;
    }
    const halfH = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * SHOOT_DISTANCE;
    const halfW = halfH * (size.width / size.height);
    if (!f.active) {
      f.next -= dt;
      if (f.next <= 0) {
        const rand = Math.random;
        f.active = true;
        f.t = 0;
        f.dur = 1.1 + rand() * 0.5;
        f.angle = Math.PI + 0.3 + rand() * 0.35; // heading down and to the left
        f.sx = halfW * (-0.5 + rand() * 1.4);
        f.sy = halfH * (0.45 + rand() * 0.5);
        f.len = halfW * (0.55 + rand() * 0.35);
        f.dx = Math.cos(f.angle);
        f.dy = Math.sin(f.angle);
      }
      streak.current.visible = false;
      return;
    }
    f.t += dt;
    const k = f.t / f.dur;
    if (k >= 1) {
      f.active = false;
      f.next = 3 + Math.random() * 5;
      streak.current.visible = false;
      return;
    }
    const travel = k * f.len;
    const tail = halfW * 0.36;
    streak.current.visible = true;
    streak.current.position.set(f.sx + f.dx * travel, f.sy + f.dy * travel, -SHOOT_DISTANCE);
    streak.current.rotation.z = f.angle;
    streak.current.scale.set(tail, tail * 0.06, 1);
    streak.current.material.opacity = Math.sin(k * Math.PI) * n;
  });

  return (
    <>
      <group ref={stars} visible={false}>
        <points ref={layerA} frustumCulled={false}>
          <bufferGeometry>
            <bufferAttribute attach="attributes-position" args={[posA, 3]} />
          </bufferGeometry>
          <pointsMaterial map={dot} color="#FFFFFF" size={0.42} sizeAttenuation transparent opacity={0} depthWrite={false} toneMapped={false} />
        </points>
        <points ref={layerB} frustumCulled={false}>
          <bufferGeometry>
            <bufferAttribute attach="attributes-position" args={[posB, 3]} />
          </bufferGeometry>
          <pointsMaterial map={dot} color="#CFE0FF" size={0.75} sizeAttenuation transparent opacity={0} depthWrite={false} toneMapped={false} />
        </points>
      </group>
      <group ref={shoot}>
        <mesh ref={streak} visible={false} frustumCulled={false}>
          <planeGeometry args={[1, 1]} />
          <meshBasicMaterial map={tex} transparent depthWrite={false} blending={THREE.AdditiveBlending} toneMapped={false} side={THREE.DoubleSide} />
        </mesh>
      </group>
    </>
  );
}
