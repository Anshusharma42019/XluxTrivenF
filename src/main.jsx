import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

// Keep backend warm — prevent cold start
const ping = () => fetch('/ping').catch(() => {});
ping();
setInterval(ping, 4 * 60 * 1000); // every 4 minutes

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
