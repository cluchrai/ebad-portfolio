import { profile } from '../data/portfolio.js';

export default function Hero({ onChat }) {
  return (
    <section id="top" className="scene scene-hero">
      <div className="hero-top">
        <h1 className="hero-name">{profile.name}</h1>
        <p className="hero-roles">Game developer, Karachi</p>
      </div>
      <div className="hero-bottom">
        <p className="hero-intro">{profile.intro}</p>
        <div className="hero-cta">
          <a className="btn btn-holo" href="#about"><span>Start the tour</span></a>
          <button type="button" className="btn btn-glass" onClick={onChat}>Ask my AI about me</button>
        </div>
      </div>
      <p className="hero-hint">
        <span className="hint-ping" aria-hidden="true" />
        Click the avatar to say hi. Leave him alone for 30 seconds and he falls asleep.
      </p>
    </section>
  );
}
