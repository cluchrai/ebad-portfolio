import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { Analytics } from '@vercel/analytics/react';
import App from './App.jsx';
import './styles.css';

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
    {/* Cookie-free page-view analytics. Only reports on Vercel, and only once Web Analytics is enabled there. */}
    <Analytics />
  </StrictMode>
);
