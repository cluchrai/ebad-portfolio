import { useState } from 'react';
import { profile } from '../data/portfolio.js';

const API = import.meta.env.VITE_API_URL || '';
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

const empty = { name: '', email: '', subject: '', message: '', website: '' };

function validate(v) {
  const e = {};
  if (v.name.trim().length < 2) e.name = 'Enter your name (at least 2 characters).';
  if (!EMAIL_RE.test(v.email.trim())) e.email = 'Enter a valid email address, like name@example.com.';
  if (v.subject.trim().length < 3) e.subject = 'Add a subject (at least 3 characters).';
  if (v.message.trim().length < 10) e.message = 'Write a message of at least 10 characters.';
  if (v.message.length > 3000) e.message = 'Keep the message under 3000 characters.';
  return e;
}

export default function Contact() {
  const [values, setValues] = useState(empty);
  const [errors, setErrors] = useState({});
  const [status, setStatus] = useState({ state: 'idle', text: '' });

  const update = (k) => (e) => {
    setValues((v) => ({ ...v, [k]: e.target.value }));
    if (errors[k]) setErrors((er) => ({ ...er, [k]: undefined }));
  };

  async function onSubmit(e) {
    e.preventDefault();
    const found = validate(values);
    setErrors(found);
    if (Object.keys(found).length) {
      setStatus({ state: 'error', text: 'Fix the highlighted fields, then send again.' });
      return;
    }
    setStatus({ state: 'sending', text: 'Sending your message…' });
    try {
      const res = await fetch(`${API}/api/contact`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(values),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        if (data.fields) setErrors(data.fields);
        throw new Error(data.error || 'The message could not be sent.');
      }
      setValues(empty);
      setStatus({ state: 'success', text: 'Message sent. I usually reply within two days.' });
    } catch (err) {
      setStatus({
        state: 'error',
        text: `${err.message} Try again, or email me directly at ${profile.email}.`,
      });
    }
  }

  const field = (k, label, props = {}) => (
    <div className={`field${errors[k] ? ' has-error' : ''}`}>
      <label htmlFor={`c-${k}`}>{label}</label>
      {props.as === 'textarea' ? (
        <textarea
          id={`c-${k}`}
          rows={6}
          value={values[k]}
          onChange={update(k)}
          aria-invalid={!!errors[k]}
          aria-describedby={errors[k] ? `c-${k}-err` : undefined}
          maxLength={3000}
        />
      ) : (
        <input
          id={`c-${k}`}
          type={props.type || 'text'}
          autoComplete={props.autoComplete}
          value={values[k]}
          onChange={update(k)}
          aria-invalid={!!errors[k]}
          aria-describedby={errors[k] ? `c-${k}-err` : undefined}
        />
      )}
      {errors[k] && (
        <p className="field-error" id={`c-${k}-err`}>
          {errors[k]}
        </p>
      )}
    </div>
  );

  return (
    <section id="contact" className="scene">
      <div className="panel">
        <h2>Send a message</h2>
        <p className="lead">
          Internships, game jams, freelance work or a question about a project. It lands straight in my inbox.
        </p>
        <form className="mail" onSubmit={onSubmit} noValidate>
          <div className="field-row">
            {field('name', 'Name', { autoComplete: 'name' })}
            {field('email', 'Email', { type: 'email', autoComplete: 'email' })}
          </div>
          {field('subject', 'Subject')}
          {field('message', 'Message', { as: 'textarea' })}

          {/* Honeypot: hidden from people, bots fill it in */}
          <div className="hp" aria-hidden="true">
            <label htmlFor="c-website">Website</label>
            <input id="c-website" tabIndex={-1} autoComplete="off" value={values.website} onChange={update('website')} />
          </div>

          <div className="form-foot">
            <button type="submit" className="btn btn-holo" disabled={status.state === 'sending'}>
              <span>{status.state === 'sending' ? 'Sending…' : 'Send message'}</span>
            </button>
            <p className={`form-status is-${status.state}`} role="status" aria-live="polite">
              {status.text}
            </p>
          </div>
        </form>
        <ul className="direct">
          <li><a className="text-link" href={`mailto:${profile.email}`}>{profile.email}</a></li>
          <li><a className="text-link" href={profile.linkedin} target="_blank" rel="noreferrer">LinkedIn</a></li>
          <li>{profile.location}</li>
        </ul>
      </div>
    </section>
  );
}
