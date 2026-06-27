import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import './i18n'
import App from './App.jsx'

// Restore saved theme before React renders to avoid flash
;(function () {
  const t = localStorage.getItem('ctx_theme')
  if (t === 'dark') document.documentElement.classList.add('theme-dark')
  else if (t === 'light') document.documentElement.classList.add('theme-light')
})()

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
