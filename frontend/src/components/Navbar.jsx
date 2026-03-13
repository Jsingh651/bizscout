import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export default function Navbar() {
  const navigate = useNavigate()
  const { user, logout } = useAuth()

  const handleLogout = () => {
    // navigate to home first so ProtectedRoute doesn't redirect to /login
    navigate('/')
    logout()
  }

  return (
    <nav style={{
      position: 'fixed', top: 0, left: 0, right: 0, zIndex: 100,
      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      padding: '0 52px', height: '64px',
      background: 'rgba(9,9,15,0.82)', backdropFilter: 'blur(20px)',
      borderBottom: '1px solid rgba(255,255,255,0.04)',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
        <div style={{
          width: '28px', height: '28px', borderRadius: '8px',
          background: 'linear-gradient(135deg,#8b5cf6,#6366f1)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: '0.7rem', fontWeight: '900', color: '#fff', letterSpacing: '-0.5px',
        }}>B</div>
        <span style={{ fontWeight: '800', fontSize: '1rem', letterSpacing: '-0.5px', color: '#f4f4f5' }}>BizScout</span>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '36px' }}>
        <button className="nav-btn" onClick={() => navigate('/leads')}>Leads</button>
        <button className="nav-btn">Features</button>
        <button className="nav-btn">Pricing</button>
        <button className="nav-btn">Docs</button>
      </div>

      <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
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
            <button
              className="ghost-btn"
              style={{ padding: '8px 20px', fontSize: '0.82rem', borderRadius: '8px' }}
              onClick={() => navigate('/login')}
            >
              Log in
            </button>
            <button className="cta-btn" style={{ padding: '8px 20px', fontSize: '0.82rem', borderRadius: '8px' }} onClick={() => navigate('/leads')}>
              Get started →
            </button>
          </>
        )}
      </div>
    </nav>
  )
}
