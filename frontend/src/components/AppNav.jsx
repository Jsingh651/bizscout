// frontend/src/components/AppNav.jsx
// Shared navigation bar used across all authenticated pages.
// All links always visible regardless of current page.

import { useNavigate, useLocation } from 'react-router-dom'
import NavbarDropdown from './NavbarDropdown'

const NAV_LINKS = [
  { label: 'Leads',     path: '/leads'     },
  { label: 'Batches',   path: '/batches'   },
  { label: 'Pipeline',  path: '/pipeline'  },
  { label: 'Analytics', path: '/analytics' },
  { label: 'Meetings',  path: '/meetings'  },
  { label: 'Contracts', path: '/contracts' },
  { label: 'Payments',  path: '/payments'  },
//   { label: 'Domains', path: '/domains' },
]

export default function AppNav() {
  const navigate  = useNavigate()
  const location  = useLocation()

  return (
    <nav style={{
      position: 'sticky', top: 0, zIndex: 100,
      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      padding: '0 48px', height: 64,
      background: 'rgba(9,9,15,0.82)', backdropFilter: 'blur(20px)',
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

        {/* Links */}
        <div style={{ display: 'flex', gap: 24 }}>
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

      <NavbarDropdown />
    </nav>
  )
}