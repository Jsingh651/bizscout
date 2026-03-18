import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.jsx'
import './styles/mobile.css'
import { AuthProvider } from './context/AuthContext.jsx'
import { ScrapeProvider } from './context/ScrapeContext.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <AuthProvider>
      <ScrapeProvider>
        <App />
      </ScrapeProvider>
    </AuthProvider>
  </StrictMode>
)