// Tiny event bus shared by the page (DOM) and the 3D world (canvas).
const listeners = new Map();

export function on(event, fn) {
  if (!listeners.has(event)) listeners.set(event, new Set());
  listeners.get(event).add(fn);
  return () => listeners.get(event).delete(fn);
}

export function emit(event, payload) {
  listeners.get(event)?.forEach((fn) => fn(payload));
}

// Section ids in page order; the camera has one shot per section
export const SECTIONS = ['top', 'about', 'skills', 'projects', 'journey', 'trophies', 'cutscene', 'contact'];

export const SECTION_LABELS = {
  top: 'Start',
  about: 'Character',
  skills: 'Inventory',
  projects: 'Quests',
  journey: 'Save points',
  trophies: 'Trophies',
  cutscene: 'Cutscene',
  contact: 'Message',
};

// ---- day / night theme ----
// <html data-theme="night"> drives the CSS; `sky.night` (0 = day, 1 = night) is eased by the 3D world.
const THEME_KEY = 'portfolio-theme';

function savedTheme() {
  try {
    return localStorage.getItem(THEME_KEY) === 'night' ? 'night' : 'day';
  } catch {
    return 'day';
  }
}

export const getTheme = () => (document.documentElement.dataset.theme === 'night' ? 'night' : 'day');

export function setTheme(theme) {
  document.documentElement.dataset.theme = theme;
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', theme === 'night' ? '#0B1033' : '#A9D8FF');
  try {
    localStorage.setItem(THEME_KEY, theme);
  } catch {
    /* private mode: the choice just will not persist */
  }
  emit('theme', theme);
}

export const sky = { night: 0, target: 0 };
if (typeof document !== 'undefined') {
  const initial = savedTheme();
  document.documentElement.dataset.theme = initial;
  sky.night = sky.target = initial === 'night' ? 1 : 0;
  on('theme', (t) => { sky.target = t === 'night' ? 1 : 0; });
}

export const prefersReducedMotion =
  typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
