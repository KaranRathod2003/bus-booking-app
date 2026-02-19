import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.jsx'
import './styles/variables.css'
import './styles/reset.css'
import './styles/animations.css'
import './styles/layout.css'
import './styles/components.css'
import './styles/seat.css'
import './styles/ticket.css'
import './styles/toast.css'
import './styles/pages.css'
import './styles/theme-toggle.css'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
