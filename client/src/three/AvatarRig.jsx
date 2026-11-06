import { useEffect, useMemo, useRef, useState } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { Html, useAnimations, useGLTF } from '@react-three/drei';
import * as THREE from 'three';
import { emit, on, prefersReducedMotion } from '../state.js';
import { recentSkills } from '../data/portfolio.js';

const RANDOM_MOVES = ['GlassesPush', 'PendantGlow', 'LevelUp'];

// world position of the pendant, read by the effects
export const PENDANT_WORLD = new THREE.Vector3(0, 1.2, 0.1);
const SLEEP_AFTER_MS = 30000;
// Short label shown above his head so each move is easy to read (LevelUp has its own badge)
const CAPTIONS = {
  Wave: 'Waving hello',
  GlassesPush: 'Adjusting his glasses',
  PendantGlow: 'Powering up his star pendant',
  PeaceJump: 'Peace!',
  SitDown: 'Getting sleepy…',
  WakeUp: 'Whoa, I’m awake!',
};
// the small gestures read better a little slower
const SPEED = { GlassesPush: 0.8, PendantGlow: 0.85 };
const EYE_CLIPS =new Set(['Blink', 'SitDown', 'Sleep', 'WakeUp', 'RubEyes']);

/**
 * The avatar and its behaviour:
 * - Idle loop with random blinks
 * - every 9–15 s a random move (glasses push, pendant power-up, level up)
 * - click: peace-sign jump + speech bubble that opens the chat
 * - 30 s without any visitor activity: sits down and sleeps; any activity wakes him up
 * - "avatar:cue" events from the page play a named move (section reactions)
 */
export default function AvatarRig({ url, onChat, onPointer }) {
  const group = useRef();
  const { scene, animations } = useGLTF(url);
  const narrow = useThree((s) => s.size.width < 820);

  // Blink must only touch the eyes so it can play on top of everything else
  const clips = useMemo(
    () =>
      animations.map((clip) => {
        const c = clip.clone();
        if (c.name === 'Blink') c.tracks = c.tracks.filter((t) => t.name.startsWith('eyes.'));
        else if (!EYE_CLIPS.has(c.name)) c.tracks = c.tracks.filter((t) => !t.name.startsWith('eyes.'));
        return c;
      }),
    [animations]
  );
  const { actions, mixer } = useAnimations(clips, group);

  const state = useRef({ base: 'Idle', busy: null, sleeping: false, lastActivity: performance.now(), skillIdx: 0 });
  const [bubble, setBubble] = useState(false);
  const [zzz, setZzz] = useState(false);
  const [caption, setCaption] = useState(null);
  const pendantMat = useRef(null);
  const pendantGlow = useRef(0);
  const head = useRef(null);
  const pendantNode = useRef(null);

  // ---------- materials: a little extra shine, find the pendant ----------
  useEffect(() => {
    scene.traverse((o) => {
      if (o.isMesh) {
        o.castShadow = true;
        o.receiveShadow = true;
        const mats = Array.isArray(o.material) ? o.material : [o.material];
        mats.forEach((m) => {
          m.envMapIntensity = 0.9;
          if (m.name === 'Star') {
            const clone = m.clone();
            clone.emissive = new THREE.Color('#FFD36E');
            clone.emissiveIntensity = 0;
            o.material = clone;
            pendantMat.current = clone;
          }
          if (m.name === 'Lens') {
            m.transparent = true;
            m.depthWrite = false;
          }
        });
      }
    });
    head.current = scene.getObjectByName('head');
    pendantNode.current = scene.getObjectByName('pendant');
  }, [scene]);

  // ---------- playback helpers ----------
  const play = (name, { loop = false, fade = 0.3, onDone } = {}) => {
    const a = actions[name];
    if (!a) return false;
    const s = state.current;
    const prev = s.busy ? actions[s.busy] : actions[s.base];
    a.reset();
    a.setLoop(loop ? THREE.LoopRepeat : THREE.LoopOnce, loop ? Infinity : 1);
    a.clampWhenFinished = !loop;
    a.timeScale = SPEED[name] ?? 1;
    a.fadeIn(fade).play();
    if (prev && prev !== a) prev.fadeOut(fade);
    if (!loop) {
      s.busy = name;
      setCaption(CAPTIONS[name] || null);
      const handler = (e) => {
        if (e.action !== a) return;
        mixer.removeEventListener('finished', handler);
        setCaption(null);
        if (s.busy === name) s.busy = null;
        if (onDone) onDone();
        else {
          const base = actions[s.base];
          base.reset().fadeIn(fade).play();
          a.fadeOut(fade);
        }
      };
      mixer.addEventListener('finished', handler);
    } else {
      s.base = name;
      s.busy = null;
    }
    return true;
  };

  const doMove = (name) => {
    const s = state.current;
    if (s.sleeping || s.busy || !actions[name]) return;
    play(name);
    if (name === 'LevelUp') {
      const skill = recentSkills[s.skillIdx % recentSkills.length];
      s.skillIdx += 1;
      setTimeout(() => emit('fx:levelup', { skill }), 450);
    }
    if (name === 'PendantGlow') {
      setTimeout(() => {
        pendantGlow.current = 1;
        emit('fx:pendant');
      }, 550);
    }
  };

  const goToSleep = () => {
    const s = state.current;
    if (s.sleeping || s.busy) return;
    s.sleeping = true;
    play('SitDown', {
      onDone: () => {
        if (s.waking) return; // woken while still sitting down
        play('Sleep', { loop: true, fade: 0.25 });
        actions.SitDown?.fadeOut(0.25);
        setZzz(true);
      },
    });
  };

  const wakeUp = () => {
    const s = state.current;
    if (!s.sleeping || s.waking) return;
    s.waking = true;
    setZzz(false);
    actions.Sleep?.fadeOut(0.15);
    s.base = 'Idle';
    play('WakeUp', {
      fade: 0.15,
      onDone: () => {
        s.sleeping = false;
        s.waking = false;
        actions.Idle.reset().fadeIn(0.3).play();
        actions.WakeUp?.fadeOut(0.3);
      },
    });
  };

  // ---------- lifecycle ----------
  useEffect(() => {
    if (!actions.Idle) return undefined;
    actions.Idle.play();
    const s = state.current;
    const timers = [];
    // welcome wave
    timers.push(setTimeout(() => doMove('Wave'), 900));

    // random moves every 9–15 s
    let randomTimer;
    let last = '';
    const scheduleRandom = () => {
      randomTimer = setTimeout(() => {
        if (!prefersReducedMotion && document.visibilityState === 'visible') {
          const options = RANDOM_MOVES.filter((m) => m !== last);
          const pick = options[Math.floor(Math.random() * options.length)];
          last = pick;
          doMove(pick);
        }
        scheduleRandom();
      }, 9000 + Math.random() * 6000);
    };
    scheduleRandom();

    // blinking
    let blinkTimer;
    const scheduleBlink = () => {
      blinkTimer = setTimeout(() => {
        const b = actions.Blink;
        if (b && !s.sleeping && !EYE_CLIPS.has(s.busy || '')) {
          b.reset().setLoop(THREE.LoopOnce, 1).play();
        }
        scheduleBlink();
      }, 2200 + Math.random() * 3200);
    };
    scheduleBlink();

    // sleep when the visitor is inactive
    const activity = () => {
      s.lastActivity = performance.now();
      if (s.sleeping) wakeUp();
    };
    const events = ['pointermove', 'pointerdown', 'keydown', 'scroll', 'wheel', 'touchstart'];
    events.forEach((ev) => window.addEventListener(ev, activity, { passive: true }));
    const sleepCheck = setInterval(() => {
      if (!s.sleeping && performance.now() - s.lastActivity > SLEEP_AFTER_MS) goToSleep();
    }, 1000);

    const offCue = on('avatar:cue', (name) => doMove(name));

    return () => {
      timers.forEach(clearTimeout);
      clearTimeout(randomTimer);
      clearTimeout(blinkTimer);
      clearInterval(sleepCheck);
      events.forEach((ev) => window.removeEventListener(ev, activity));
      offCue();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [actions]);

  // ---------- per frame: head follows the cursor, pendant glow, FX anchor ----------
  const tmpQ = useMemo(() => new THREE.Quaternion(), []);
  const tmpE = useMemo(() => new THREE.Euler(), []);
  const headBase = useMemo(() => new THREE.Quaternion(), []);
  const headApplied = useMemo(() => new THREE.Quaternion(0, 0, 0, 0), []);
  const look = useRef({ x: 0, y: 0 });
  useFrame((_, dt) => {
    const s = state.current;
    const p = onPointer?.current || { x: 0, y: 0 };
    look.current.x = THREE.MathUtils.damp(look.current.x, s.sleeping ? 0 : p.x, 4, dt);
    look.current.y = THREE.MathUtils.damp(look.current.y, s.sleeping ? 0 : p.y, 4, dt);
    if (head.current && !prefersReducedMotion) {
      // If the mixer did not rewrite the head this frame (clip has no head track),
      // our last offset is still on it: restore the base first so it never accumulates.
      const hq = head.current.quaternion;
      if (hq.equals(headApplied)) hq.copy(headBase);
      else headBase.copy(hq);
      tmpE.set(look.current.y * 0.18, look.current.x * 0.35, 0, 'YXZ');
      tmpQ.setFromEuler(tmpE);
      hq.multiply(tmpQ);
      headApplied.copy(hq);
    }
    if (pendantMat.current) {
      pendantGlow.current = Math.max(0, pendantGlow.current - dt * 0.4);
      pendantMat.current.emissiveIntensity = pendantGlow.current * 3;
    }
    if (pendantNode.current) {
      pendantNode.current.getWorldPosition(PENDANT_WORLD);
    }
  });

  return (
    <group ref={group}>
      <primitive
        object={scene}
        onClick={(e) => {
          e.stopPropagation();
          state.current.lastActivity = performance.now();
          if (state.current.sleeping) {
            wakeUp();
            return;
          }
          if (!state.current.busy) play('PeaceJump');
          setBubble(true);
          setTimeout(() => setBubble(false), 4500);
        }}
        onPointerOver={(e) => {
          e.stopPropagation();
          document.body.style.cursor = 'pointer';
        }}
        onPointerOut={() => {
          document.body.style.cursor = '';
        }}
      />
      {caption && !bubble && (
        // beside the shoulder on wide screens; centred above the head (and allowed to wrap) on phones
        <Html position={narrow ? [0, 2.4, 0] : [0.7, 1.55, 0]} center={narrow} zIndexRange={[20, 10]}>
          <div className={`caption${narrow ? ' is-centered' : ''}`} role="status" aria-live="polite">{caption}</div>
        </Html>
      )}
      {bubble && (
        <Html position={[0.35, 1.95, 0]} center distanceFactor={narrow ? undefined : 6} zIndexRange={[20, 10]}>
          <button type="button" className="speech" onClick={() => { setBubble(false); onChat?.(); }}>
            Ask me anything!
          </button>
        </Html>
      )}
      {zzz && (
        <Html position={[0.25, 1.15, 0]} center distanceFactor={narrow ? undefined : 6} zIndexRange={[20, 10]}>
          <div className="zzz" aria-hidden="true"><span>z</span><span>z</span><span>Z</span></div>
        </Html>
      )}
    </group>
  );
}

useGLTF.preload('/models/avatar.glb');
