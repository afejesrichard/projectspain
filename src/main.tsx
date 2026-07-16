import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { HashRouter } from 'react-router-dom'
import './index.css'
import App from './App'

// Hash routing so the app works on GitHub Pages, which has no SPA server
// fallback: every route lives under index.html, deep links always resolve,
// and the shared public link never hits a 404.
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <HashRouter>
      <App />
    </HashRouter>
  </StrictMode>,
)
