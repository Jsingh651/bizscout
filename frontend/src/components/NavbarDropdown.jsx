// FILE: frontend/src/components/NavbarDropdown.jsx
// ACTION: CREATE — also create the folder frontend/src/components/ if it doesn't exist

import { useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { LogOut, User, History, Settings, ChevronRight } from 'lucide-react'

export default function NavbarDropdown() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const timeoutRef = useRef(null)

  const handleMouseEnter = () => {
    clearTimeout(timeoutRef.current)
    setOpen(true)
  }

  const handleMouseLeave = () => {
    timeoutRef.current = setTimeout(() => setOpen(false), 200)
  }

  const handleLogout = () => {
    // navigate to home first so ProtectedRoute doesn't redirect to /login
    navigate('/')
    logout()
  }

  const initials = user?.full_name
    ? user.full_name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
    : user?.email?.[0]?.toUpperCase() || '?'

  const items = [
    { icon: <User size={13} />,     label: 'Manage Profile', action: () => navigate('/profile') },
    { icon: <History size={13} />,  label: 'Lead History',   action: () => navigate('/leads')   },
    { icon: <Settings size={13} />, label: 'Settings',       action: () => navigate('/profile') },
  ]

  return (
    <div style={{ position: 'relative', display: 'inline-block' }}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {/* Avatar */}
      <div style={{
        width: 34, height: 34, borderRadius: '50%',
        background: 'linear-gradient(135deg, #8b5cf6, #6366f1)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 13, fontWeight: 700, color: '#fff',
        cursor: 'pointer', userSelect: 'none',
        fontFamily: "'JetBrains Mono', monospace",
        border: '2px solid rgba(139,92,246,0.35)',
        letterSpacing: '-0.5px',
      }}>
        {initials}
      </div>

      {/* Dropdown */}
      {open && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 10px)', right: 0,
          background: '#111118',
          border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: 14, padding: 6, minWidth: 224,
          boxShadow: '0 20px 60px rgba(0,0,0,0.7), 0 0 0 1px rgba(139,92,246,0.06)',
          zIndex: 999,
        }}>
          {/* User info */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 10px 8px' }}>
            <div style={{
              width: 32, height: 32, borderRadius: '50%', flexShrink: 0,
              background: 'linear-gradient(135deg, #8b5cf6, #6366f1)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 12, fontWeight: 700, color: '#fff',
              fontFamily: "'JetBrains Mono', monospace",
            }}>
              {initials}
            </div>
            <div style={{ overflow: 'hidden' }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: '#fafafa', marginBottom: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {user?.full_name || 'User'}
              </div>
              <div style={{ fontSize: 11, color: '#c4c4cc', fontFamily: "'JetBrains Mono', monospace", whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {user?.email}
              </div>
            </div>
          </div>

          <div style={{ height: 1, background: 'rgba(255,255,255,0.05)', margin: '4px 0' }} />

          {items.map(item => (
            <div key={item.label}
              style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 10px', borderRadius: 8, cursor: 'pointer', transition: 'background 0.15s', background: 'transparent' }}
              onClick={item.action}
              onMouseEnter={e => e.currentTarget.style.background = 'rgba(139,92,246,0.08)'}
              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
            >
              <span style={{ color: '#c4c4cc', display: 'flex', alignItems: 'center' }}>{item.icon}</span>
              <span style={{ fontSize: 13, color: '#c4c4cc', fontFamily: "'Outfit', sans-serif" }}>{item.label}</span>
              <ChevronRight size={12} style={{ color: '#b8c2d4', marginLeft: 'auto' }} />
            </div>
          ))}

          <div style={{ height: 1, background: 'rgba(255,255,255,0.05)', margin: '4px 0' }} />

          {/* Logout */}
          <div
            style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 10px', borderRadius: 8, cursor: 'pointer', background: 'transparent', transition: 'background 0.15s' }}
            onClick={handleLogout}
            onMouseEnter={e => e.currentTarget.style.background = 'rgba(248,113,113,0.06)'}
            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
          >
            <span style={{ color: '#f87171', display: 'flex', alignItems: 'center' }}><LogOut size={13} /></span>
            <span style={{ fontSize: 13, color: '#f87171', fontFamily: "'Outfit', sans-serif" }}>Log out</span>
          </div>
        </div>
      )}
    </div>
  )
}