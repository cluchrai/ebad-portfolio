import { Suspense, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { ContactShadows, Environment, Float, Lightformer, PerformanceMonitor, Sparkles } from '@react-three/drei';
import * as THREE from 'three';
import AvatarRig from './AvatarRig.jsx';
import { LevelUpFX, PendantFX, Petals } from './Effects.jsx';
import GameProps from './GameProps.jsx';
import Sun from './Sun.jsx';
import NightSky from './NightSky.jsx';
import { avatar } from '../data/portfolio.js';
import { emit, SECTIONS, prefersReducedMotion, sky } from '../state.js';

const AVATAR_POS = [0, 0.2, 0.45];

// ---------------------------------------------------------------- materials
function Iridescent(props) {
  return (
    <meshPhysicalMaterial
      color="#E9E4FF"
      metalness={0.2}
      roughness={0.08}
      iridescence={1}
      iridescenceIOR={1.6}
      iridescenceThicknessRange={[200, 900]}
      clearcoat={1}
      {...props}
    />
  );
}

// ---------------------------------------------------------------- island pieces
function IslandBase() {
  const rockGeo = useMemo(() => {
    const g = new THREE.ConeGeometry(3.3, 3.8, 14, 4);
    const pos = g.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const y = pos.getY(i);
      if (y < 1.85) {
        const k = 0.82 + Math.sin(i * 12.9898) * 0.5 * 0.36 + 0.18;
        pos.setX(i, pos.getX(i) * k);
        pos.setZ(i, pos.getZ(i) * k);
      }
    }
    g.computeVertexNormals();
    return g;
  }, []);
  return (
    <group>
      {/* grass top with a soft lip */}
      <mesh position={[0, 0, 0]} receiveShadow>
        <cylinderGeometry args={[3.25, 3.15, 0.36, 64]} />
        <meshStandardMaterial color="#8EDC9A" roughness={0.85} />
      </mesh>
      <mesh position={[0, -0.24, 0]}>
        <cylinderGeometry args={[3.17, 3.05, 0.16, 64]} />
        <meshStandardMaterial color="#C9A98B" roughness={0.9} />
      </mesh>
      {/* crystal-rock underside */}
      <mesh position={[0, -2.2, 0]} rotation={[Math.PI, 0, 0]} geometry={rockGeo}>
        <meshStandardMaterial color="#B9A7E8" roughness={0.55} flatShading />
      </mesh>
      {/* stone path to the platform */}
      {[[0.35, 1.45], [0.15, 2.05], [0.45, 2.6]].map(([x, z], i) => (
        <mesh key={i} position={[x, 0.185, z]} rotation={[-Math.PI / 2, 0, i]} receiveShadow>
          <circleGeometry args={[0.22, 7]} />
          <meshStandardMaterial color="#F2EADF" roughness={0.9} />
        </mesh>
      ))}
    </group>
  );
}

function Platform() {
  const ring = useRef();
  useFrame((_, dt) => {
    if (ring.current && !prefersReducedMotion) ring.current.rotation.z += dt * 0.4;
  });
  return (
    <group position={[AVATAR_POS[0], 0.18, AVATAR_POS[2]]}>
      <mesh receiveShadow>
        <cylinderGeometry args={[0.78, 0.86, 0.08, 48]} />
        <meshStandardMaterial color="#FFFFFF" roughness={0.35} />
      </mesh>
      <mesh ref={ring} position={[0, 0.05, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.8, 0.03, 16, 96]} />
        <Iridescent emissive="#8C6BFF" emissiveIntensity={0.6} />
      </mesh>
      <mesh position={[0, 0.045, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.5, 0.56, 64]} />
        <meshBasicMaterial color="#FFC24B" transparent opacity={0.55} toneMapped={false} />
      </mesh>
    </group>
  );
}

function BlossomTree({ position, scale = 1 }) {
  const blobs = [
    [0, 2.05, 0, 0.75, '#FFB3D1'],
    [-0.55, 1.8, 0.2, 0.55, '#FF8EBF'],
    [0.6, 1.85, -0.1, 0.6, '#FFC4DC'],
    [0.15, 2.5, -0.15, 0.5, '#FF9FC8'],
    [-0.25, 2.3, -0.45, 0.48, '#FFD2E4'],
    [0.35, 1.6, 0.45, 0.42, '#FF8EBF'],
  ];
  return (
    <group position={position} scale={scale}>
      <mesh position={[0, 0.8, 0]} rotation={[0, 0, 0.08]} castShadow>
        <cylinderGeometry args={[0.09, 0.16, 1.6, 10]} />
        <meshStandardMaterial color="#8B5E4A" roughness={0.9} />
      </mesh>
      <mesh position={[0.25, 1.35, 0]} rotation={[0, 0, -0.9]} castShadow>
        <cylinderGeometry args={[0.04, 0.07, 0.6, 8]} />
        <meshStandardMaterial color="#8B5E4A" roughness={0.9} />
      </mesh>
      {blobs.map(([x, y, z, r, c], i) => (
        <mesh key={i} position={[x, y, z]} castShadow>
          <icosahedronGeometry args={[r, 1]} />
          <meshStandardMaterial color={c} roughness={0.55} flatShading />
        </mesh>
      ))}
    </group>
  );
}

function Pond() {
  return (
    <group position={[1.75, 0.185, -0.7]}>
      <mesh rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[0.75, 40]} />
        <meshPhysicalMaterial color="#7CCBFF" roughness={0.05} metalness={0.1} clearcoat={1} transparent opacity={0.9} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.005, 0]}>
        <ringGeometry args={[0.72, 0.86, 40]} />
        <meshStandardMaterial color="#EDE4D8" roughness={0.9} />
      </mesh>
      {/* stream spilling over the edge */}
      <mesh position={[1.25, -1.2, 0.2]}>
        <boxGeometry args={[0.28, 2.6, 0.06]} />
        <meshStandardMaterial color="#A9DEFF" transparent opacity={0.55} emissive="#7CCBFF" emissiveIntensity={0.3} />
      </mesh>
      <Sparkles position={[1.25, -2.4, 0.2]} count={25} scale={[0.6, 0.5, 0.6]} size={3} speed={0.8} color="#E8F6FF" />
    </group>
  );
}

function Lantern({ position }) {
  const bulb = useRef();
  const light = useRef();
  // lanterns glow much brighter once the sun is down
  useFrame(() => {
    if (light.current) light.current.intensity = THREE.MathUtils.lerp(1.2, 4, sky.night);
    if (bulb.current) bulb.current.emissiveIntensity = THREE.MathUtils.lerp(1.6, 3, sky.night);
  });
  return (
    <group position={position}>
      <mesh position={[0, 0.45, 0]} castShadow>
        <cylinderGeometry args={[0.03, 0.04, 0.9, 8]} />
        <meshStandardMaterial color="#5C5470" roughness={0.6} />
      </mesh>
      <mesh position={[0, 0.98, 0]}>
        <sphereGeometry args={[0.1, 20, 20]} />
        <meshStandardMaterial ref={bulb} color="#FFE2A3" emissive="#FFC24B" emissiveIntensity={1.6} toneMapped={false} />
      </mesh>
      <pointLight ref={light} position={[0, 1, 0]} color="#FFC977" intensity={1.2} distance={2.2} />
    </group>
  );
}

function Mailbox({ position }) {
  return (
    <group position={position} rotation={[0, 0.5, 0]}>
      <mesh position={[0, 0.35, 0]} castShadow>
        <cylinderGeometry args={[0.035, 0.035, 0.7, 8]} />
        <meshStandardMaterial color="#8B5E4A" />
      </mesh>
      <mesh position={[0, 0.78, 0]} castShadow>
        <boxGeometry args={[0.42, 0.24, 0.28]} />
        <meshStandardMaterial color="#6C4DFF" roughness={0.35} />
      </mesh>
      <mesh position={[0, 0.9, 0]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.14, 0.14, 0.42, 20, 1, false, 0, Math.PI]} />
        <meshStandardMaterial color="#6C4DFF" roughness={0.35} side={THREE.DoubleSide} />
      </mesh>
      <mesh position={[0.23, 0.92, 0.06]}>
        <boxGeometry args={[0.02, 0.2, 0.08]} />
        <meshStandardMaterial color="#FF6FAE" />
      </mesh>
    </group>
  );
}

function Flowers() {
  const mesh = useRef();
  const items = useMemo(() => {
    const out = [];
    const colors = ['#FFFFFF', '#FFE07A', '#FF9FC8', '#B7A6FF'];
    for (let i = 0; i < 70; i++) {
      const a = i * 2.399;
      const r = 0.9 + ((i * 37) % 100) / 100 * 2.1;
      const x = Math.cos(a) * r, z = Math.sin(a) * r;
      if (Math.hypot(x - AVATAR_POS[0], z - AVATAR_POS[2]) < 1.0) continue;
      if (Math.hypot(x - 1.75, z + 0.7) < 0.95) continue;
      out.push([x, z, colors[i % colors.length]]);
    }
    return out;
  }, []);
  useLayoutEffect(() => {
    const m = mesh.current;
    if (!m) return;
    const dummy = new THREE.Object3D();
    const color = new THREE.Color();
    items.forEach(([x, z, c], i) => {
      dummy.position.set(x, 0.23, z);
      dummy.updateMatrix();
      m.setMatrixAt(i, dummy.matrix);
      m.setColorAt(i, color.set(c));
    });
    m.instanceMatrix.needsUpdate = true;
    m.instanceColor.needsUpdate = true;
  }, [items]);
  return (
    <instancedMesh ref={mesh} args={[undefined, undefined, items.length]}>
      <sphereGeometry args={[0.045, 8, 8]} />
      <meshStandardMaterial roughness={0.5} />
    </instancedMesh>
  );
}

function Crystals() {
  const refs = useRef([]);
  useFrame(({ clock }) => {
    refs.current.forEach((m, i) => {
      if (!m) return;
      m.rotation.y = clock.elapsedTime * (0.4 + i * 0.15);
    });
  });
  const spots = [
    [-2.4, 1.6, 0.9, 0.22],
    [2.6, 2.1, 0.6, 0.18],
    [-0.9, 3.0, -1.6, 0.16],
  ];
  return spots.map(([x, y, z, s], i) => (
    <Float key={i} speed={1.5} floatIntensity={0.8} rotationIntensity={0.3}>
      <mesh ref={(el) => (refs.current[i] = el)} position={[x, y, z]} castShadow>
        <octahedronGeometry args={[s, 0]} />
        <Iridescent emissive={i === 1 ? '#FFC24B' : '#3EDBC0'} emissiveIntensity={0.35} flatShading />
      </mesh>
    </Float>
  ));
}

const CLOUD_DAY = new THREE.Color('#FFFFFF');
const CLOUD_NIGHT = new THREE.Color('#7F8BD0');
const CLOUD_GLOW_DAY = new THREE.Color('#EAF2FF');
const CLOUD_GLOW_NIGHT = new THREE.Color('#3A4488');

function Cloud({ position, scale = 1, speed = 0.05 }) {
  const ref = useRef();
  const puffs = [
    [0, 0, 0, 0.9], [0.9, -0.1, 0.1, 0.7], [-0.85, -0.12, 0, 0.72], [0.35, 0.35, -0.1, 0.62], [-0.4, 0.3, 0.1, 0.55],
  ];
  useFrame(({ clock }) => {
    if (!ref.current) return;
    if (!prefersReducedMotion) ref.current.position.x = position[0] + Math.sin(clock.elapsedTime * speed) * 0.8;
    // clouds turn a dusky blue at night
    ref.current.children.forEach((m) => {
      m.material.color.lerpColors(CLOUD_DAY, CLOUD_NIGHT, sky.night);
      m.material.emissive.lerpColors(CLOUD_GLOW_DAY, CLOUD_GLOW_NIGHT, sky.night);
      m.material.emissiveIntensity = THREE.MathUtils.lerp(0.25, 0.35, sky.night);
    });
  });
  return (
    <group ref={ref} position={position} scale={scale}>
      {puffs.map(([x, y, z, r], i) => (
        <mesh key={i} position={[x, y, z]}>
          <sphereGeometry args={[r, 16, 16]} />
          <meshStandardMaterial color="#FFFFFF" roughness={1} emissive="#EAF2FF" emissiveIntensity={0.25} />
        </mesh>
      ))}
    </group>
  );
}

function MiniIsland({ position, scale }) {
  return (
    <Float speed={1.2} floatIntensity={0.7} rotationIntensity={0.15}>
      <group position={position} scale={scale}>
        <mesh>
          <cylinderGeometry args={[0.6, 0.55, 0.18, 24]} />
          <meshStandardMaterial color="#8EDC9A" />
        </mesh>
        <mesh position={[0, -0.55, 0]} rotation={[Math.PI, 0, 0]}>
          <coneGeometry args={[0.56, 0.95, 9]} />
          <meshStandardMaterial color="#B9A7E8" flatShading />
        </mesh>
        <mesh position={[0.1, 0.4, 0]}>
          <icosahedronGeometry args={[0.28, 1]} />
          <meshStandardMaterial color="#FFB3D1" flatShading />
        </mesh>
      </group>
    </Float>
  );
}

// ---------------------------------------------------------------- camera
// One shot per section. Desktop shots keep the avatar on the right; content sits on the left.
const SHOTS = {
  top: { pos: [0, 1.75, 7.6], look: [0, 1.15, 0] },
  about: { pos: [-0.4, 1.55, 4.3], look: [-1.25, 1.2, 0.2] },
  skills: { pos: [1.4, 1.5, 3.9], look: [-0.7, 1.15, 0.2] },
  projects: { pos: [3.2, 4.6, 10.5], look: [-3.2, 0.7, 0] },
  journey: { pos: [-3.0, 2.3, 6.8], look: [-2.1, 1.0, 0.6] },
  trophies: { pos: [0.6, 1.4, 3.4], look: [-0.75, 1.3, 0.3] },
  cutscene: { pos: [0, 6.5, 11], look: [0, 0.2, 0] },
  contact: { pos: [-1.9, 1.5, 4.6], look: [-1.95, 1.0, 0.8] },
};
// Portrait phones: the camera sits far enough back to fit the island's width, and `shift` slides the picture
// up (as a fraction of the screen height) so the island lives in the top half while the panels fill the rest.
const SHOTS_NARROW = {
  top: { pos: [0, 2.4, 14.5], look: [0, 1.2, 0], shift: 0.13 },
  default: { pos: [0, 2.2, 13.5], look: [0, 1.25, 0], shift: 0.24 },
};
const CUES = { about: 'Wave', skills: 'LevelUp', projects: 'GlassesPush', trophies: 'PendantGlow', contact: 'PeaceJump' };

function CameraRig() {
  const { camera, size } = useThree();
  const look = useRef(new THREE.Vector3(0, 1.15, 0));
  const current = useRef('');
  const vA = useMemo(() => new THREE.Vector3(), []);
  const vB = useMemo(() => new THREE.Vector3(), []);
  const lA = useMemo(() => new THREE.Vector3(), []);
  const lB = useMemo(() => new THREE.Vector3(), []);
  const first = useRef(true);
  const shift = useRef(0);

  useFrame((_, dt) => {
    const narrow = size.width < 820;
    const vh = window.innerHeight;
    let idx = 0;
    let t = 0;
    for (let i = 0; i < SECTIONS.length; i++) {
      const el = document.getElementById(SECTIONS[i]);
      if (!el) continue;
      const r = el.getBoundingClientRect();
      if (r.top <= vh * 0.5) {
        idx = i;
        t = THREE.MathUtils.clamp((vh * 0.5 - r.top) / Math.max(r.height, 1), 0, 1);
      }
    }
    const id = SECTIONS[idx];
    const nextId = SECTIONS[Math.min(idx + 1, SECTIONS.length - 1)];
    if (id !== current.current) {
      current.current = id;
      emit('section', id);
      if (CUES[id]) emit('avatar:cue', CUES[id]);
    }
    const shot = (k) => (narrow ? SHOTS_NARROW[k === 'top' ? 'top' : 'default'] : SHOTS[k]);
    const a = shot(id), b = shot(nextId);
    const k = THREE.MathUtils.smoothstep(t, 0.55, 1);
    vA.fromArray(a.pos).lerp(vB.fromArray(b.pos), k);
    lA.fromArray(a.look).lerp(lB.fromArray(b.look), k);
    // vertical fov is fixed, so on squarer screens pull back to keep the island in frame
    const aspect = size.width / size.height;
    if (!narrow && aspect < 1.6) {
      const fit = Math.min(1.45, 1.6 / aspect);
      vA.sub(lA).multiplyScalar(fit).add(lA);
    }
    const lambda = prefersReducedMotion ? 50 : 2.2;
    // start on the right shot for this screen instead of flying in from the desktop one
    if (first.current) {
      first.current = false;
      camera.position.copy(vA);
      look.current.copy(lA);
      shift.current = narrow ? THREE.MathUtils.lerp(a.shift, b.shift, k) : 0;
    }
    // slide the picture up on phones (see SHOTS_NARROW); plain camera on wider screens
    const wantShift = narrow ? THREE.MathUtils.lerp(a.shift, b.shift, k) : 0;
    shift.current = THREE.MathUtils.damp(shift.current, wantShift, lambda, dt);
    if (shift.current > 0.0005) {
      camera.setViewOffset(size.width, size.height, 0, size.height * shift.current, size.width, size.height);
    } else if (camera.view?.enabled) {
      camera.clearViewOffset();
    }
    camera.position.x = THREE.MathUtils.damp(camera.position.x, vA.x, lambda, dt);
    camera.position.y = THREE.MathUtils.damp(camera.position.y, vA.y, lambda, dt);
    camera.position.z = THREE.MathUtils.damp(camera.position.z, vA.z, lambda, dt);
    look.current.x = THREE.MathUtils.damp(look.current.x, lA.x, lambda, dt);
    look.current.y = THREE.MathUtils.damp(look.current.y, lA.y, lambda, dt);
    look.current.z = THREE.MathUtils.damp(look.current.z, lA.z, lambda, dt);
    camera.lookAt(look.current);
  });
  return null;
}

// ---------------------------------------------------------------- world
const SKY_DAY = new THREE.Color('#D6ECFF');
const SKY_NIGHT = new THREE.Color('#6F82D8');
const GROUND_DAY = new THREE.Color('#F7D9C4');
const GROUND_NIGHT = new THREE.Color('#2B2250');
const SUN_LIGHT = new THREE.Color('#FFF2DA');
const MOON_LIGHT = new THREE.Color('#9DB4FF');

function Scene({ onChat, pointer }) {
  const island = useRef();
  const hemi = useRef();
  const amb = useRef();
  const dirLight = useRef();
  useFrame(({ clock, scene }, dt) => {
    if (island.current && !prefersReducedMotion) island.current.position.y = Math.sin(clock.elapsedTime * 0.6) * 0.06;

    // ease day <-> night, then tint the lighting to match
    sky.night = THREE.MathUtils.damp(sky.night, sky.target, prefersReducedMotion ? 50 : 2.2, dt);
    if (Math.abs(sky.night - sky.target) < 0.002) sky.night = sky.target;
    const n = sky.night;
    if (hemi.current) {
      hemi.current.intensity = THREE.MathUtils.lerp(1.0, 0.5, n);
      hemi.current.color.lerpColors(SKY_DAY, SKY_NIGHT, n);
      hemi.current.groundColor.lerpColors(GROUND_DAY, GROUND_NIGHT, n);
    }
    if (amb.current) amb.current.intensity = THREE.MathUtils.lerp(0.25, 0.22, n);
    if (dirLight.current) {
      dirLight.current.intensity = THREE.MathUtils.lerp(2.3, 1.0, n);
      dirLight.current.color.lerpColors(SUN_LIGHT, MOON_LIGHT, n);
    }
    scene.environmentIntensity = THREE.MathUtils.lerp(1, 0.3, n);
  });
  return (
    <>
      <hemisphereLight ref={hemi} args={['#D6ECFF', '#F7D9C4', 1.0]} />
      <ambientLight ref={amb} intensity={0.25} />
      <directionalLight
        ref={dirLight}
        position={[5, 9, 5]}
        intensity={2.3}
        color="#FFF2DA"
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-camera-left={-5}
        shadow-camera-right={5}
        shadow-camera-top={5}
        shadow-camera-bottom={-5}
        shadow-bias={-0.0004}
      />
      <Environment resolution={256}>
        <Lightformer form="rect" intensity={2.5} position={[0, 5, -6]} scale={[12, 4, 1]} color="#FFFFFF" />
        <Lightformer form="circle" intensity={3} position={[-5, 3, 3]} scale={3} color="#FFD7EA" />
        <Lightformer form="circle" intensity={2} position={[5, 2, 2]} scale={3} color="#C9E6FF" />
        <Lightformer form="rect" intensity={1.2} position={[0, -4, 0]} rotation={[Math.PI / 2, 0, 0]} scale={[10, 10, 1]} color="#F3E6FF" />
      </Environment>

      <group ref={island}>
        <IslandBase />
        <Platform />
        <BlossomTree position={[-1.85, 0.18, -1.05]} scale={0.95} />
        <BlossomTree position={[2.35, 0.18, 0.9]} scale={0.6} />
        <Pond />
        <Lantern position={[-1.0, 0.18, 1.6]} />
        <Lantern position={[1.15, 0.18, 1.85]} />
        <Mailbox position={[-2.1, 0.18, 0.95]} />
        <Flowers />
        <Suspense fallback={null}>
          <group position={AVATAR_POS}>
            {avatar.url && <AvatarRig url={avatar.url} onChat={onChat} onPointer={pointer} />}
          </group>
        </Suspense>
        <ContactShadows position={[AVATAR_POS[0], 0.23, AVATAR_POS[2]]} opacity={0.4} scale={2.4} blur={2.2} far={1.5} />
        <LevelUpFX position={AVATAR_POS} />
        <PendantFX />
      </group>

      <Crystals />
      <Sun />
      <NightSky />
      <GameProps />
      <Petals />
      <Cloud position={[-5.5, -1.6, -2]} scale={1.3} />
      <Cloud position={[5.8, -0.6, -3.5]} scale={1.1} speed={0.04} />
      <Cloud position={[-3.5, 3.6, -6]} scale={0.9} speed={0.03} />
      <Cloud position={[-6.5, 4.4, -9]} scale={1.2} speed={0.06} />
      <Cloud position={[0.5, -3.6, 1.5]} scale={1.6} speed={0.03} />
      <MiniIsland position={[-5.2, 1.8, -3.5]} scale={1.1} />
      <MiniIsland position={[5.6, 2.8, -4.5]} scale={0.8} />
      <MiniIsland position={[-3.8, -2.4, -1.5]} scale={0.6} />
      <CameraRig />
    </>
  );
}

export default function World({ onChat }) {
  const pointer = useRef({ x: 0, y: 0 });
  useEffect(() => {
    const move = (e) => {
      pointer.current.x = (e.clientX / window.innerWidth) * 2 - 1;
      pointer.current.y = (e.clientY / window.innerHeight) * 2 - 1;
    };
    window.addEventListener('pointermove', move, { passive: true });
    return () => window.removeEventListener('pointermove', move);
  }, []);
  // Sharpness: use the screen's real pixel ratio (capped), and when the frame rate dips step down gently but never
  // below a floor. Dropping to 1x made everything look soft on phones, and bouncing up and down made it flicker.
  const native = window.devicePixelRatio || 1;
  const maxDpr = Math.min(native, window.innerWidth < 820 ? 2 : 1.75);
  const minDpr = Math.min(native, 1.25);
  const [dpr, setDpr] = useState(maxDpr);
  return (
    <div className="world" aria-hidden="false">
      <Canvas
        shadows
        dpr={dpr}
        gl={{ alpha: true, antialias: true }}
        camera={{ position: SHOTS.top.pos, fov: 40, near: 0.1, far: 80 }}
        aria-label="3D floating island with Ebad's avatar. Click the avatar to say hi."
      >
        <PerformanceMonitor onDecline={() => setDpr((d) => Math.max(minDpr, d - 0.25))} />
        <Scene onChat={onChat} pointer={pointer} />
      </Canvas>
    </div>
  );
}
