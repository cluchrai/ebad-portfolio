import { useEffect, useRef, useState } from 'react';
import { profile } from '../data/portfolio.js';

const API = import.meta.env.VITE_API_URL || '';
const SUGGESTIONS = [
  'What games has Ebad worked on?',
  'Tell me about his SaaS project',
  'What did he win at GameCon?',
  'Ebad kaunsi technologies use karta hai?',
];

const SpeechRecognition =
  typeof window !== 'undefined' ? window.SpeechRecognition || window.webkitSpeechRecognition : null;

export default function ChatWidget({ open, onOpenChange }) {
  const [messages, setMessages] = useState([
    {
      role: 'assistant',
      text: `Hi! I'm ${profile.shortName}'s portfolio assistant. Ask me about his projects, skills, education or experience. I answer only from his portfolio and CV.`,
    },
  ]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [listening, setListening] = useState(false);
  const listRef = useRef(null);
  const inputRef = useRef(null);
  const recRef = useRef(null);

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 50);
  }, [open]);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, busy]);

  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onOpenChange(false);
    if (open) window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onOpenChange]);

  async function ask(question) {
    const q = question.trim();
    if (!q || busy) return;
    setInput('');
    const history = messages.slice(-6).map((m) => ({ role: m.role, text: m.text }));
    setMessages((m) => [...m, { role: 'user', text: q }]);
    setBusy(true);
    try {
      const res = await fetch(`${API}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: q, history }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'The assistant is unavailable right now.');
      setMessages((m) => [...m, { role: 'assistant', text: data.answer, sources: data.sources || [] }]);
    } catch (err) {
      setMessages((m) => [...m, { role: 'assistant', text: `${err.message} Try again in a moment.`, error: true }]);
    } finally {
      setBusy(false);
    }
  }

  function toggleVoice() {
    if (!SpeechRecognition) return;
    if (listening) {
      recRef.current?.stop();
      return;
    }
    const rec = new SpeechRecognition();
    rec.lang = 'en-US';
    rec.interimResults = false;
    rec.onresult = (e) => ask(e.results[0][0].transcript);
    rec.onend = () => setListening(false);
    rec.onerror = () => setListening(false);
    recRef.current = rec;
    setListening(true);
    rec.start();
  }

  function goToSource(anchor) {
    document.getElementById(anchor)?.scrollIntoView({ behavior: 'smooth' });
  }

  return (
    <>
      <button
        type="button"
        className={`chat-fab${open ? ' is-hidden' : ''}`}
        onClick={() => onOpenChange(true)}
        aria-label="Open the portfolio assistant"
      >
        <svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true">
          <path d="M12 2 20 7v10l-8 5-8-5V7z" fill="currentColor" />
          <circle cx="9" cy="12" r="1.3" fill="var(--ink)" />
          <circle cx="15" cy="12" r="1.3" fill="var(--ink)" />
        </svg>
        <span>Ask my AI</span>
      </button>

      <div className={`chat-panel${open ? ' is-open' : ''}`} role="dialog" aria-modal="false" aria-label="Portfolio assistant" aria-hidden={!open}>
        <div className="chat-head">
          <div>
            <p className="chat-title">Ask about {profile.shortName}</p>
            <p className="chat-sub">Answers come from his CV and portfolio</p>
          </div>
          <button type="button" className="icon-btn" onClick={() => onOpenChange(false)} aria-label="Close assistant" tabIndex={open ? 0 : -1}>
            <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
              <path d="M6 6l12 12M18 6 6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        <div className="chat-list" ref={listRef} aria-live="polite">
          {messages.map((m, i) => (
            <div key={i} className={`msg is-${m.role}${m.error ? ' is-error' : ''}`}>
              <p>{m.text}</p>
              {m.sources?.length > 0 && (
                <div className="msg-sources">
                  <span>Sources:</span>
                  {m.sources.map((s) => (
                    <button key={s.anchor + s.title} type="button" onClick={() => goToSource(s.anchor)} tabIndex={open ? 0 : -1}>
                      {s.title}
                    </button>
                  ))}
                </div>
              )}
            </div>
          ))}
          {busy && (
            <div className="msg is-assistant is-typing" aria-label="Assistant is typing">
              <span /><span /><span />
            </div>
          )}
          {messages.length === 1 && (
            <div className="chat-suggest">
              {SUGGESTIONS.map((s) => (
                <button key={s} type="button" onClick={() => ask(s)} tabIndex={open ? 0 : -1}>
                  {s}
                </button>
              ))}
            </div>
          )}
        </div>

        <form
          className="chat-input"
          onSubmit={(e) => {
            e.preventDefault();
            ask(input);
          }}
        >
          <label className="visually-hidden" htmlFor="chat-q">Your question</label>
          <input
            id="chat-q"
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={listening ? 'Listening…' : 'Ask in English or Urdu'}
            maxLength={500}
            tabIndex={open ? 0 : -1}
            autoComplete="off"
          />
          {SpeechRecognition && (
            <button
              type="button"
              className={`icon-btn${listening ? ' is-live' : ''}`}
              onClick={toggleVoice}
              aria-label={listening ? 'Stop voice input' : 'Ask with your voice'}
              tabIndex={open ? 0 : -1}
            >
              <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
                <rect x="9" y="3" width="6" height="11" rx="3" fill="currentColor" />
                <path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" />
              </svg>
            </button>
          )}
          <button type="submit" className="btn btn-holo btn-sm" disabled={busy || !input.trim()} tabIndex={open ? 0 : -1}>
            <span>Ask</span>
          </button>
        </form>
      </div>
    </>
  );
}
