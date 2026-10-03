import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import './styles/tokens.css'
import './styles/base.css'

// Screens manage their own scroll position (see ScrollManager).
if ('scrollRestoration' in history) history.scrollRestoration = 'manual'

// Ask the browser not to clear our data when the phone is low on space.
void navigator.storage?.persist?.()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
