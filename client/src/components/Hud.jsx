import { useEffect, useState } from 'react';
import { getTheme, on, SECTIONS, SECTION_LABELS, setTheme } from '../state.js';

/** Game-style HUD: logo, a quest-progress track with one checkpoint per section, and the AI button. */
export default function Hud({ onChat }) {
  const [active, setActive] = useState('top');
  const [progress, setProgress] = useState(0);
  const [night, setNight] = useState(() => getTheme() === 'night');

  useEffect(() => on('section', setActive), []);
  useEffect(() => on('theme', (t) => setNight(t === 'night')), []);
  useEffect(() => {
    const onScroll = () => {
      const max = document.documentElement.scrollHeight - window.innerHeight;
      setProgress(max > 0 ? window.scrollY / max : 0);
      // track the current section from the page itself (works even before the 3D world loads)
      let current = SECTIONS[0];
      for (const id of SECTIONS) {
        const el = document.getElementById(id);
        if (el && el.getBoundingClientRect().top <= window.innerHeight * 0.5) current = id;
      }
      setActive(current);
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const go = (id) => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });

  return (
    <header className="hud">
      <a href="#top" className="hud-mark" aria-label="Back to start">
        <svg viewBox="0 0 40 40" width="38" height="38" aria-hidden="true">
          <defs>
            <linearGradient id="hudg" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0" stopColor="#6A4CFF" />
              <stop offset="0.5" stopColor="#1FC7A9" />
              <stop offset="1" stopColor="#FFB23F" />
            </linearGradient>
          </defs>
          <path d="M20 2 36 11v18l-16 9-16-9V11z" fill="url(#hudg)" />
          <text x="20" y="25" textAnchor="middle" fontFamily="Unbounded, sans-serif" fontWeight="800" fontSize="12" fill="#fff">EH</text>
        </svg>
      </a>

      <nav className="hud-track" aria-label="Sections">
        <div className="hud-line"><span style={{ transform: `scaleX(${progress})` }} /></div>
        <ol>
          {SECTIONS.map((id) => (
            <li key={id}>
              <button
                type="button"
                className={`hud-point${active === id ? ' is-active' : ''}`}
                onClick={() => go(id)}
                aria-current={active === id ? 'true' : undefined}
              >
                <span className="hud-dot" aria-hidden="true" />
                <span className="hud-label">{SECTION_LABELS[id]}</span>
              </button>
            </li>
          ))}
        </ol>
      </nav>

      <button
        type="button"
        className="theme-toggle"
        onClick={() => setTheme(night ? 'day' : 'night')}
        aria-pressed={night}
        aria-label={night ? 'Switch to day mode' : 'Switch to night mode'}
        title={night ? 'Day mode' : 'Night mode'}
      >
        {night ? (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
            <circle cx="12" cy="12" r="4.2" fill="currentColor" />
            {[0, 45, 90, 135, 180, 225, 270, 315].map((a) => (
              <path key={a} d="M12 2.6v2.4" transform={`rotate(${a} 12 12)`} />
            ))}
          </svg>
        ) : (
          <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <path d="M20.5 14.6A8.5 8.5 0 0 1 9.4 3.5a.7.7 0 0 0-.9-.9A10 10 0 1 0 21.4 15.5a.7.7 0 0 0-.9-.9z" />
          </svg>
        )}
      </button>

      <button type="button" className="btn btn-holo hud-ai" onClick={onChat}>
        <span>Ask my AI</span>
      </button>
    </header>
  );
}
