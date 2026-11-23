import { useEffect, useMemo, useRef, useState } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { Html, useAnimations, useGLTF } from '@react-three/drei';
import * as THREE from 'three';
import { emit, on, prefersReducedMotion } from '../state.js';
import { recentSkills } from '../data/portfolio.js';

import ActivityProp from './ActivityProps.jsx';

const RANDOM_MOVES = ['GlassesPush', 'PendantGlow', 'LevelUp'];

// world position of the pendant, read by the effects
export const PENDANT_WORLD = new THREE.Vector3(0, 1.2, 0.1);
// where he stands now, as an offset from his home spot on the platform (read by the shadow and effects)
export const ACTOR = { x: 0, z: 0 };

// Where he walks to for each section activity (offsets from the platform; yaw 0 faces the camera). The page
// content covers the left of the screen on wide displays, so the spots stay on the visible side. Phones use a
// smaller range so he stays centred in the picture.
const SPOTS = {
  home: { x: 0, z: 0, yaw: 0 },
  Juggle: { x: 0.35, z: 0.25, yaw: 0 },
  PlayGame: { x: 0.75, z: 0.15, yaw: 0 },
  LiftTrophy: { x: -0.15, z: 0.25, yaw: 0 },
  Type: { x: -0.3, z: 0.3, yaw: 0 },
};
const WALK_SPEED = 0.85; // metres per second
// when the prop disappears, as a fraction of the clip (the clips lower their hands near the end)
const ACTIVITIES = { Juggle: 0.8, PlayGame: 0.72, LiftTrophy: 0.72, Type: 0.85 };
const SLEEP_AFTER_MS = 30000;
// Short label shown above his head so each move is easy to read (LevelUp has its own badge)
const CAPTIONS = {
  Wave: 'Waving hello',
  GlassesPush: 'Adjusting his glasses',
  PendantGlow: 'Powering up his star pendant',
  PeaceJump: 'Peace!',
  SitDown: 'Getting sleepy…',
  WakeUp: 'Whoa, I’m awake!',
  Juggle: 'Juggling some blocks',
  PlayGame: 'Playing a game',
  LiftTrophy: 'Champion!',
  Type: 'Typing a reply…',
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
  const narrowRef = useRef(narrow);
  narrowRef.current = narrow;

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
  const [prop, setProp] = useState(null);
  const propTok = useRef(0);
  const walk = useRef({ tx: 0, tz: 0, tyaw: 0, yaw: 0, token: 0, onArrive: null });
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
    if (s.sleeping || s.busy || s.walking || !actions[name]) return;
    play(name);
    if (ACTIVITIES[name]) {
      // the prop shows once his hands are in position and goes away before they drop
      const tk = ++propTok.current;
      const clip = actions[name].getClip();
      setTimeout(() => { if (propTok.current === tk && !s.walking) setProp(name); }, 350);
      setTimeout(() => { if (propTok.current === tk) setProp(null); }, clip.duration * ACTIVITIES[name] * 1000);
    }
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

  // Walk to the spot for a cue (or back to the platform for 'Home' and the plain gestures), then do the move.
  // A newer cue cancels the walk in progress.
  const cueTo = (name) => {
    const s = state.current;
    const w = walk.current;
    if (s.sleeping) return;
    const spot = SPOTS[name] || SPOTS.home;
    const k = narrowRef.current ? 0.45 : 1;
    w.tx = spot.x * k;
    w.tz = spot.z * k;
    w.tyaw = narrowRef.current ? 0 : spot.yaw;
    const token = ++w.token;
    propTok.current += 1;
    setProp(null);
    const arrive = () => {
      if (w.token === token && name !== 'Home') doMove(name);
    };
    const dist = Math.hypot(w.tx - ACTOR.x, w.tz - ACTOR.z);
    if (dist < 0.04 || prefersReducedMotion) {
      ACTOR.x = w.tx;
      ACTOR.z = w.tz;
      if (prefersReducedMotion) w.yaw = w.tyaw;
      s.walking = false;
      arrive();
      return;
    }
    s.walking = true;
    setCaption(null);
    play('Walk', { loop: true, fade: 0.25 });
    w.onArrive = () => {
      if (w.token !== token) return;
      s.walking = false;
      play('Idle', { loop: true, fade: 0.3 });
      arrive();
    };
  };

  const goToSleep = () => {
    const s = state.current;
    if (s.sleeping || s.busy || s.walking) return;
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

    const offCue = on('avatar:cue', (name) => cueTo(name));

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
  const headSt = useMemo(() => ({ base: new THREE.Quaternion(), applied: new THREE.Quaternion(0, 0, 0, 0) }), []);
  const spineSt = useMemo(() => ({ base: new THREE.Quaternion(), applied: new THREE.Quaternion(0, 0, 0, 0) }), []);
  const spine = useRef(null);
  const look = useRef({ x: 0, y: 0 });
  // body reactions: torso turns toward the page content, leans with scroll speed, glances at hovered cards
  const react = useRef({ turn: 0, lean: 0, glance: 0, lastY: typeof window !== 'undefined' ? window.scrollY : 0, vel: 0, section: 'top' });
  useEffect(() => {
    spine.current = scene.getObjectByName('spine');
    const offSection = on('section', (id) => { react.current.section = id; });
    const offHover = on('card:hover', (on_) => { state.current.hover = !!on_; });
    return () => { offSection(); offHover(); };
  }, [scene]);
  // If the mixer did not rewrite the bone this frame (clip has no track for it), our last offset is still on it:
  // restore the base first so it never accumulates.
  const applyOffset = (node, st, euler) => {
    const q = node.quaternion;
    if (q.equals(st.applied)) q.copy(st.base);
    else st.base.copy(q);
    tmpQ.setFromEuler(euler);
    q.multiply(tmpQ);
    st.applied.copy(q);
  };
  useFrame((_, dt) => {
    const s = state.current;
    const r = react.current;

    // walking: move toward the target spot, turning to face the way he goes, then settle facing the spot's yaw
    const w = walk.current;
    let wantYaw = w.tyaw;
    if (s.walking) {
      const dx = w.tx - ACTOR.x, dz = w.tz - ACTOR.z;
      const d = Math.hypot(dx, dz);
      const step = WALK_SPEED * dt;
      if (d <= step) {
        ACTOR.x = w.tx;
        ACTOR.z = w.tz;
        const done = w.onArrive;
        w.onArrive = null;
        done?.();
      } else {
        ACTOR.x += (dx / d) * step;
        ACTOR.z += (dz / d) * step;
        wantYaw = Math.atan2(dx, dz);
      }
    }
    if (!s.sleeping) {
      let diff = wantYaw - w.yaw;
      diff = Math.atan2(Math.sin(diff), Math.cos(diff));
      w.yaw += diff * (1 - Math.exp(-(s.walking ? 10 : 6) * dt));
    }
    if (group.current) {
      group.current.position.set(ACTOR.x, 0, ACTOR.z);
      group.current.rotation.y = w.yaw;
    }

    const p = onPointer?.current || { x: 0, y: 0 };
    look.current.x = THREE.MathUtils.damp(look.current.x, s.sleeping ? 0 : p.x, 4, dt);
    look.current.y = THREE.MathUtils.damp(look.current.y, s.sleeping ? 0 : p.y, 4, dt);

    // scroll speed (px/s) -> lean, smoothed so a fast flick doesn't snap him
    const y = window.scrollY;
    const v = dt > 0 ? (y - r.lastY) / dt : 0;
    r.lastY = y;
    r.vel = THREE.MathUtils.damp(r.vel, THREE.MathUtils.clamp(v / 2500, -1, 1), 6, dt);
    const awake = !s.sleeping && !prefersReducedMotion;
    // on wide screens the content sits to his left, so he faces it (except on the hero and video shots)
    const faceContent = !narrow && r.section !== 'top' && r.section !== 'cutscene' ? -0.22 : 0;
    r.turn = THREE.MathUtils.damp(r.turn, awake ? faceContent + p.x * 0.18 - (s.hover ? 0.18 : 0) : 0, 3, dt);
    r.lean = THREE.MathUtils.damp(r.lean, awake ? r.vel * 0.13 : 0, 5, dt);
    r.glance = THREE.MathUtils.damp(r.glance, awake && s.hover ? 1 : 0, 5, dt);

    if (head.current && !prefersReducedMotion) {
      tmpE.set(look.current.y * 0.18 + r.glance * (narrow ? 0.2 : 0.08), look.current.x * 0.35 - r.glance * (narrow ? 0 : 0.2), 0, 'YXZ');
      applyOffset(head.current, headSt, tmpE);
    }
    if (spine.current && !prefersReducedMotion) {
      tmpE.set(r.lean, r.turn, 0, 'YXZ');
      applyOffset(spine.current, spineSt, tmpE);
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
          if (!state.current.busy && !state.current.walking) play('PeaceJump');
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
      {prop && <ActivityProp name={prop} actions={actions} />}
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
