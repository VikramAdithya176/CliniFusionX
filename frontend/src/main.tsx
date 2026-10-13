import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

// Initialize theme from localStorage immediately (defaulting to dark mode)
const initialTheme = localStorage.getItem('app_theme');
if (initialTheme !== 'light') {
  document.documentElement.classList.add('dark');
  if (!initialTheme) {
    localStorage.setItem('app_theme', 'dark');
  }
} else {
  document.documentElement.classList.remove('dark');
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
