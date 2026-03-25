// frontend/src/components/AppNav.jsx
import { useState, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { Menu, X } from 'lucide-react'
import NavbarDropdown from './NavbarDropdown'
import '../styles/mobile.css'

const NAV_LINKS = [
  { label: 'Leads',     path: '/leads'     },
  { label: 'Batches',   path: '/batches'   },
  { label: 'Pipeline',  path: '/pipeline'  },
  { label: 'Analytics', path: '/analytics' },
  { label: 'Meetings',  path: '/meetings'  },
  { label: 'Contracts', path: '/contracts' },
  { label: 'Payments',  path: '/payments'  },
]

export default function AppNav() {
  const navigate  = useNavigate()
  const location  = useLocation()
  const [open, setOpen] = useState(false)

  // Close drawer on route change
  useEffect(() => { setOpen(false) }, [location.pathname])

  // Close on outside click
  useEffect(() => {
    if (!open) return
    const handler = (e) => {
      if (!e.target.closest('nav') && !e.target.closest('.mobile-nav-drawer')) setOpen(false)
    }
    document.addEventListener('click', handler)
    return () => document.removeEventListener('click', handler)
  }, [open])

  return (
    <>
      <nav className="nav-padding" style={{
        position: 'sticky', top: 0, zIndex: 100,
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        padding: '0 48px', height: 64,
        background: 'rgba(9,9,15,0.95)', backdropFilter: 'blur(20px)',
        borderBottom: '1px solid rgba(255,255,255,0.04)',
      }}>
        {/* Logo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 32 }}>
          <div
            style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}
            onClick={() => navigate('/')}
          >
            <div style={{
              width: 28, height: 28, borderRadius: 8,
              background: 'linear-gradient(135deg,#8b5cf6,#6366f1)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '0.7rem', fontWeight: 900, color: '#fff',
            }}>B</div>
            <span style={{ fontWeight: 800, fontSize: '1rem', letterSpacing: '-0.5px', color: '#f4f4f5' }}>
              BizScout
            </span>
          </div>

          {/* Desktop links */}
          <div className="desktop-nav-links" style={{ display: 'flex', gap: 24 }}>
            {NAV_LINKS.map(link => {
              const active = location.pathname === link.path
              return (
                <button
                  key={link.path}
                  onClick={() => navigate(link.path)}
                  style={{
                    background: 'none', border: 'none',
                    color: active ? '#fafafa' : '#b8c2d4',
                    fontWeight: active ? 600 : 400,
                    fontSize: 14, cursor: 'pointer',
                    fontFamily: "'Outfit', sans-serif",
                    transition: 'color 0.2s', padding: 0,
                  }}
                  onMouseEnter={e => { if (!active) e.currentTarget.style.color = '#c4c4cc' }}
                  onMouseLeave={e => { if (!active) e.currentTarget.style.color = '#b8c2d4' }}
                >
                  {link.label}
                </button>
              )
            })}
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <NavbarDropdown />
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
        {NAV_LINKS.map(link => {
          const active = location.pathname === link.path
          return (
            <button
              key={link.path}
              className={`mobile-nav-link ${active ? 'active' : ''}`}
              onClick={() => navigate(link.path)}
            >
              {link.label}
            </button>
          )
        })}
      </div>
    </>
  )
}
