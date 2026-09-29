import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import StudioApp from './studio/StudioApp.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <StudioApp />
  </StrictMode>,
)