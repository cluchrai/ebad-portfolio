import { lazy, Suspense, useState } from 'react';
import Hud from './components/Hud.jsx';
import Hero from './components/Hero.jsx';
import { CharacterSheet, Inventory, SavePoints, Trophies, Cutscene } from './components/Sections.jsx';
import QuestLog from './components/QuestLog.jsx';
import Contact from './components/Contact.jsx';
import ChatWidget from './components/ChatWidget.jsx';
import { profile } from './data/portfolio.js';

const World = lazy(() => import('./three/World.jsx'));

export default function App() {
  const [chatOpen, setChatOpen] = useState(false);
  const openChat = () => setChatOpen(true);

  return (
    <>
      <a className="skip-link" href="#main">Skip to content</a>
      <div className="sky" aria-hidden="true" />
      <div className="sky-night" aria-hidden="true" />
      <div className="hero-word" aria-hidden="true">
        {'EBAD'.split('').map((ch, i) => (
          <span key={i} style={{ '--i': i }}>{ch}</span>
        ))}
      </div>
      <Suspense fallback={<div className="world-loading">Building the island…</div>}>
        <World onChat={openChat} />
      </Suspense>
      <Hud onChat={openChat} />
      <main id="main">
        <Hero onChat={openChat} />
        <CharacterSheet />
        <Inventory />
        <QuestLog />
        <SavePoints />
        <Trophies />
        <Cutscene />
        <Contact />
      </main>
      <footer className="footer">
        <div className="panel footer-panel">
          <p>© {new Date().getFullYear()} {profile.name}</p>
          <p>Built with React, Three.js and a code-built avatar.</p>
        </div>
      </footer>
      <ChatWidget open={chatOpen} onOpenChange={setChatOpen} />
    </>
  );
}
