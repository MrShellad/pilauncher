import { lazy, StrictMode, Suspense } from 'react'
import { createRoot } from 'react-dom/client'
import { installStartupDiagnostics, markStartup } from './services/startupDiagnostics'

const App = lazy(() => import('./App.tsx'))

installStartupDiagnostics()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Suspense
      fallback={
        <div
          style={{
            display: 'grid',
            minHeight: '100vh',
            placeItems: 'center',
            background: '#0b0e13',
            color: '#dce4ed',
            fontFamily: 'system-ui, sans-serif',
          }}
        >
          正在启动…
        </div>
      }
    >
      <App />
    </Suspense>
  </StrictMode>,
)

markStartup('frontend.react_render_requested')
