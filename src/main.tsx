import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
// Fonts ship with the app (no Google Fonts request). Each file covers one alphabet; browsers fetch only the ones a page uses.
import '@fontsource-variable/manrope/wght.css'
import '@fontsource/barlow-condensed/600.css'
import '@fontsource/barlow-condensed/700.css'
import './index.css'
import App from './App.tsx'
import { initTheme } from './lib/theme'

initTheme()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
