import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

// Keep backend warm — prevent Vercel cold start
const BACKEND = import.meta.env.VITE_API_BASE_URL.replace('/api/v1', '');
const ping = () => fetch(`${BACKEND}/ping`).catch(() => {});
ping();
setInterval(ping, 4 * 60 * 1000); // every 4 minutes

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
