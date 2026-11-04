import { useMemo, useState } from 'react';
import { projects, projectFilters } from '../data/portfolio.js';

const categoryLabel = { web: 'Web & backend', game: 'Game', xr: 'VR / XR' };

function Thumb({ project }) {
  if (project.image) return <img src={project.image} alt={`${project.title} screenshot`} loading="lazy" />;
  const initials = project.title.split(/\s+/).filter((w) => /[A-Za-z]/.test(w[0])).slice(0, 2).map((w) => w[0]).join('');
  return (
    <div className={`thumb-empty is-${project.category}`} aria-hidden="true">
      <span>{initials}</span>
    </div>
  );
}

export default function QuestLog() {
  const [filter, setFilter] = useState('all');
  const [query, setQuery] = useState('');

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return projects.filter((p) => {
      if (filter !== 'all' && p.category !== filter) return false;
      if (!q) return true;
      return [p.title, p.subtitle, p.description, p.role, ...p.tags].join(' ').toLowerCase().includes(q);
    });
  }, [filter, query]);

  return (
    <section id="projects" className="scene">
      <div className="panel panel-wide">
        <h2>Quest log</h2>
        <p className="lead">Games I helped build and products I shipped.</p>

        <div className="quest-tools">
          <div className="tabs" role="group" aria-label="Filter quests">
            {projectFilters.map((f) => (
              <button key={f.id} type="button" className={`tab${filter === f.id ? ' is-active' : ''}`}
                aria-pressed={filter === f.id} onClick={() => setFilter(f.id)}>
                {f.label}
              </button>
            ))}
          </div>
          <label className="search">
            <span className="visually-hidden">Search quests</span>
            <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
              <circle cx="11" cy="11" r="6.5" fill="none" stroke="currentColor" strokeWidth="2" />
              <path d="m16 16 4.5 4.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
            <input type="search" placeholder="Search by name or tech" value={query} onChange={(e) => setQuery(e.target.value)} />
          </label>
        </div>

        <p className="visually-hidden" aria-live="polite">{visible.length} quests shown</p>

        {visible.length === 0 ? (
          <div className="empty">
            <p>No quests match “{query}”.</p>
            <button type="button" className="btn btn-glass" onClick={() => { setQuery(''); setFilter('all'); }}>Show all quests</button>
          </div>
        ) : (
          <div className="quests">
            {visible.map((p) => (
              <article key={p.id} className="quest">
                <div className="quest-thumb">
                  <Thumb project={p} />
                  <span className="quest-cat">{categoryLabel[p.category]}</span>
                </div>
                <div className="quest-body">
                  <h3>{p.title}</h3>
                  <p className="quest-sub">{p.subtitle}</p>
                  {p.status && <p className="quest-status"><span aria-hidden="true" />{p.status}</p>}
                  <p>{p.description}</p>
                  <dl className="quest-meta">
                    {p.party && (<div><dt>Party</dt><dd>{p.party}</dd></div>)}
                    <div><dt>My part</dt><dd>{p.role}</dd></div>
                    {p.reward && (<div className="is-reward"><dt>Reward</dt><dd>{p.reward}</dd></div>)}
                  </dl>
                  <ul className="chips">
                    {p.tags.map((t) => <li key={t}>{t}</li>)}
                  </ul>
                  {p.links.length > 0 && (
                    <div className="row">
                      {p.links.map((l) => (
                        <a key={l.url} className="text-link" href={l.url} target="_blank" rel="noreferrer">{l.label}</a>
                      ))}
                    </div>
                  )}
                </div>
              </article>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
