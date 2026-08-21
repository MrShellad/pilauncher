import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './style/app.css'
import App from './App.tsx'
import { installStartupDiagnostics, markStartup } from './services/startupDiagnostics'

installStartupDiagnostics()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

markStartup('frontend.react_render_requested')
