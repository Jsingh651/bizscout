import { useState, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { Menu, X } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import '../styles/mobile.css'

export default function Navbar() {
  const navigate = useNavigate()
  const location = useLocation()
  const { user, logout } = useAuth()
  const [open, setOpen] = useState(false)

  useEffect(() => { setOpen(false) }, [location.pathname])

  useEffect(() => {
    if (!open) return
    const handler = (e) => {
      if (!e.target.closest('nav') && !e.target.closest('.mobile-nav-drawer')) setOpen(false)
    }
    document.addEventListener('click', handler)
    return () => document.removeEventListener('click', handler)
  }, [open])

  const handleLogout = () => {
    navigate('/')
    logout()
  }

  return (
    <>
      <nav className="nav-padding" style={{
        position: 'fixed', top: 0, left: 0, right: 0, zIndex: 100,
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        padding: '0 52px', height: '64px',
        background: 'rgba(9,9,15,0.82)', backdropFilter: 'blur(20px)',
        borderBottom: '1px solid rgba(255,255,255,0.04)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer' }} onClick={() => navigate('/')}>
          <div style={{
            width: '28px', height: '28px', borderRadius: '8px',
            background: 'linear-gradient(135deg,#8b5cf6,#6366f1)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '0.7rem', fontWeight: '900', color: '#fff', letterSpacing: '-0.5px',
          }}>B</div>
          <span style={{ fontWeight: '800', fontSize: '1rem', letterSpacing: '-0.5px', color: '#f4f4f5' }}>BizScout</span>
        </div>

        <div className="desktop-nav-links" style={{ display: 'flex', alignItems: 'center', gap: '36px' }}>
          <button className="nav-btn" onClick={() => navigate('/leads')}>Leads</button>
          <button className="nav-btn">Features</button>
          <button className="nav-btn">Pricing</button>
          <button className="nav-btn">Docs</button>
        </div>

        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          <div className="desktop-nav-links" style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
            {user ? (
              <>
                <button className="ghost-btn" style={{ padding: '8px 20px', fontSize: '0.82rem', borderRadius: '8px' }} onClick={() => navigate('/add')}>
                  + Add Lead
                </button>
                <button className="ghost-btn" style={{ padding: '8px 20px', fontSize: '0.82rem', borderRadius: '8px' }} onClick={handleLogout}>
                  Log out
                </button>
              </>
            ) : (
              <>
                <button className="ghost-btn" style={{ padding: '8px 20px', fontSize: '0.82rem', borderRadius: '8px' }} onClick={() => navigate('/login')}>
                  Log in
                </button>
                <button className="cta-btn" style={{ padding: '8px 20px', fontSize: '0.82rem', borderRadius: '8px' }} onClick={() => navigate('/leads')}>
                  Get started →
                </button>
              </>
            )}
          </div>
          {/* Hamburger — mobile only */}
          <button
            className="mobile-menu-btn"
            onClick={() => setOpen(o => !o)}
            aria-label="Toggle menu"
          >
            {open ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
      </nav>

      {/* Mobile drawer */}
      <div className={`mobile-nav-drawer ${open ? 'open' : ''}`}>
        <button className="mobile-nav-link" onClick={() => navigate('/leads')}>Leads</button>
        <button className="mobile-nav-link">Features</button>
        <button className="mobile-nav-link">Pricing</button>
        <button className="mobile-nav-link">Docs</button>
        {user ? (
          <>
            <button className="mobile-nav-link" onClick={() => navigate('/add')}>+ Add Lead</button>
            <button className="mobile-nav-link" onClick={handleLogout}>Log out</button>
          </>
        ) : (
          <>
            <button className="mobile-nav-link" onClick={() => navigate('/login')}>Log in</button>
            <button className="mobile-nav-link" onClick={() => navigate('/leads')}>Get started →</button>
          </>
        )}
      </div>
    </>
  )
}
