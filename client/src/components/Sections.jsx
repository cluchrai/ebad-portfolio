import { profile, skillGroups, journey, achievements, courses, showreel, recentSkills } from '../data/portfolio.js';

const glyph = (name) =>
  name
    .replace(/[^A-Za-z0-9 .]/g, ' ')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join('');

const RARITY = ['is-violet', 'is-mint', 'is-sun', 'is-blossom'];

export function CharacterSheet() {
  const stats = [
    ['Class', 'Game developer'],
    ['Subclass', 'Web & backend developer'],
    ['Origin', profile.location],
    ['Guild', 'NED University, BCIT'],
    ['Level', 'Year 4 of 4'],
    ['Specialty', 'Gaming & animation'],
  ];
  return (
    <section id="about" className="scene">
      <div className="panel">
        <h2>Character sheet</h2>
        <dl className="sheet">
          {stats.map(([k, v]) => (
            <div key={k}>
              <dt>{k}</dt>
              <dd>{v}</dd>
            </div>
          ))}
        </dl>
        <div className="prose">
          {profile.about.map((p, i) => (
            <p key={i}>{p}</p>
          ))}
        </div>
        <div className="row">
          {profile.cv && (
            <a className="btn btn-holo" href={profile.cv} download><span>Download CV</span></a>
          )}
          <a className="btn btn-glass" href={profile.linkedin} target="_blank" rel="noreferrer">LinkedIn</a>
          {profile.github && (
            <a className="btn btn-glass" href={profile.github} target="_blank" rel="noreferrer">GitHub</a>
          )}
        </div>
      </div>
    </section>
  );
}

export function Inventory() {
  return (
    <section id="skills" className="scene">
      <div className="panel panel-wide">
        <h2>Inventory</h2>
        <p className="lead">Two toolkits: one for building worlds, one for building products.</p>

        <div className="unlocked">
          <p className="unlocked-title">Recently unlocked</p>
          <ul>
            {recentSkills.map((s) => (
              <li key={s}><span className="badge-new">New</span>{s}</li>
            ))}
          </ul>
        </div>

        <div className="bags">
        {skillGroups.map((g, gi) => (
          <div key={g.title} className="bag">
            <h3>{g.title}</h3>
            <ul className={`slots ${RARITY[gi % RARITY.length]}`}>
              {g.items.map((s) => (
                <li key={s} className="slot">
                  <span className="slot-glyph" aria-hidden="true">{glyph(s)}</span>
                  <span className="slot-name">{s}</span>
                </li>
              ))}
            </ul>
          </div>
        ))}
        </div>
      </div>
    </section>
  );
}

export function SavePoints() {
  return (
    <section id="journey" className="scene">
      <div className="panel">
        <h2>Save points</h2>
        <p className="lead">Where the game was saved so far, newest first.</p>
        <ol className="saves">
          {journey.map((j) => (
            <li key={j.title} className={`save is-${j.kind}`}>
              <span className="save-flag" aria-hidden="true">
                <svg viewBox="0 0 24 24" width="18" height="18">
                  <path d="M6 3v18M6 4h11l-2.5 3.5L17 11H6" fill="currentColor" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
                </svg>
              </span>
              <p className="save-when">{j.when}</p>
              <h3>{j.title}</h3>
              <p className="save-place">{j.place}</p>
              <p>{j.text}</p>
            </li>
          ))}
        </ol>
        <h3 className="subhead">Side quests completed</h3>
        <ul className="side-quests">
          {courses.map((c) => (
            <li key={c.title}>
              <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
                <circle cx="12" cy="12" r="10" fill="#1FC7A9" />
                <path d="m7.5 12.5 3 3 6-6.5" stroke="#fff" strokeWidth="2.2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              <div>
                <strong>{c.title}</strong>
                <span>{c.by}</span>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

export function Trophies() {
  return (
    <section id="trophies" className="scene">
      <div className="panel">
        <h2>Trophies unlocked</h2>
        <div className="trophies">
          {achievements.map((a) => (
            <article key={a.title} className="trophy">
              <svg viewBox="0 0 48 48" width="52" height="52" aria-hidden="true">
                <defs>
                  <linearGradient id={`tg-${a.title.length}`} x1="0" y1="0" x2="1" y2="1">
                    <stop offset="0" stopColor="#FFE79A" />
                    <stop offset="0.5" stopColor="#FFB23F" />
                    <stop offset="1" stopColor="#E0841A" />
                  </linearGradient>
                </defs>
                <path d="M14 6h20v10a10 10 0 0 1-20 0z" fill={`url(#tg-${a.title.length})`} />
                <path d="M14 9H7v3a7 7 0 0 0 7 7M34 9h7v3a7 7 0 0 1-7 7" fill="none" stroke="#FFB23F" strokeWidth="3" />
                <path d="M21 26h6v8h-6zM15 36h18v5H15z" fill={`url(#tg-${a.title.length})`} />
              </svg>
              <div>
                <h3>{a.title}</h3>
                <p>{a.text}</p>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

export function Cutscene() {
  return (
    <section id="cutscene" className="scene">
      <div className="panel panel-wide">
        <h2>Cutscene</h2>
        <p className="lead">A one-minute introduction, animated in After Effects.</p>
        <div className="cine">
          {showreel.src ? (
            <video controls preload="metadata" poster={showreel.poster || undefined}>
              <source src={showreel.src} type="video/mp4" />
              Your browser can't play this video. <a href={showreel.src}>Download it instead.</a>
            </video>
          ) : (
            <div className="cine-empty">
              <svg viewBox="0 0 24 24" width="44" height="44" aria-hidden="true">
                <circle cx="12" cy="12" r="11" fill="rgba(255,255,255,.18)" />
                <path d="M10 8v8l6-4z" fill="#fff" />
              </svg>
              <p>The promo video is in production</p>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
