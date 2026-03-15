import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { CalendarClock, Phone, MapPin, User, Video, ArrowRight } from 'lucide-react'
import NavbarDropdown from '../components/NavbarDropdown'

const API = 'http://127.0.0.1:8000'

export default function Meetings() {
  const navigate = useNavigate()
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch(`${API}/meetings/upcoming`, { credentials: 'include' })
      .then(r => r.json())
      .then(data => {
        setItems(Array.isArray(data) ? data : [])
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [])

  const formatTime = iso => {
    if (!iso) return '—'
    const d = new Date(iso)
    return d.toLocaleString(undefined, {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    })
  }

  return (
    <div style={{ minHeight: '100vh', background: '#09090f', color: '#fafafa', fontFamily: "'Outfit', sans-serif" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@400;500;600;700;800;900&family=JetBrains+Mono:wght@400;700&display=swap');
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        html, body { scrollbar-width: none; }
        html::-webkit-scrollbar { display: none; }
        @keyframes fadeUp { from{opacity:0;transform:translateY(16px)} to{opacity:1;transform:translateY(0)} }
        @keyframes spin { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }
        .nav-link { background:none;border:none;color:#b8c2d4;font-size:14px;cursor:pointer;font-family:'Outfit',sans-serif;transition:color 0.2s;padding:0; }
        .nav-link:hover { color:#c4c4cc; }
        .nav-link.active { color:#fafafa;font-weight:600; }
      `}</style>

      {/* NAV */}
      <nav style={{ position:'sticky',top:0,zIndex:100,display:'flex',justifyContent:'space-between',alignItems:'center',padding:'0 48px',height:64,background:'rgba(9,9,15,0.82)',backdropFilter:'blur(20px)',borderBottom:'1px solid rgba(255,255,255,0.04)' }}>
        <div style={{ display:'flex',alignItems:'center',gap:32 }}>
          <div style={{ display:'flex',alignItems:'center',gap:10,cursor:'pointer' }} onClick={() => navigate('/')}>
            <div style={{ width:28,height:28,borderRadius:8,background:'linear-gradient(135deg,#8b5cf6,#6366f1)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:'0.7rem',fontWeight:900,color:'#fff' }}>B</div>
            <span style={{ fontWeight:800,fontSize:'1rem',letterSpacing:'-0.5px',color:'#f4f4f5' }}>BizScout</span>
          </div>
          <div style={{ display:'flex',gap:24 }}>
            <button className="nav-link" onClick={() => navigate('/leads')}>Leads</button>
            <button className="nav-link" onClick={() => navigate('/batches')}>Batches</button>
            <button className="nav-link" onClick={() => navigate('/pipeline')}>Pipeline</button>
            <button className="nav-link" onClick={() => navigate('/analytics')}>Analytics</button>
            <button className="nav-link active">Meetings</button>
          </div>
        </div>
        <NavbarDropdown />
      </nav>

      <div style={{ position:'relative',zIndex:1,maxWidth:960,margin:'0 auto',padding:'40px 48px 80px' }}>
        {/* Header */}
        <div style={{ marginBottom:28,animation:'fadeUp 0.5s cubic-bezier(0.16,1,0.3,1) 0.05s both' }}>
          <div style={{ display:'inline-flex',alignItems:'center',gap:7,background:'rgba(139,92,246,0.08)',border:'1px solid rgba(139,92,246,0.18)',borderRadius:6,padding:'4px 12px',marginBottom:14 }}>
            <div style={{ width:5,height:5,borderRadius:'50%',background:'#8b5cf6',animation:'spin 1.5s linear infinite' }} />
            <span style={{ color:'#a78bfa',fontSize:'0.64rem',fontWeight:700,letterSpacing:'2px',textTransform:'uppercase',fontFamily:"'JetBrains Mono',monospace" }}>Schedule</span>
          </div>
          <h1 style={{ fontSize:'clamp(1.8rem,3vw,2.4rem)',fontWeight:900,letterSpacing:'-1.5px',color:'#fafafa',marginBottom:4 }}>Upcoming meetings</h1>
          <p style={{ color:'#c4c4cc',fontSize:14 }}>
            {items.length === 0 ? 'No upcoming demos scheduled.' : `${items.length} upcoming meeting${items.length === 1 ? '' : 's'}.`}
          </p>
        </div>

        {loading ? (
          <div style={{ display:'flex',justifyContent:'center',paddingTop:60 }}>
            <div style={{ width:18,height:18,border:'2px solid rgba(139,92,246,0.3)',borderTopColor:'#8b5cf6',borderRadius:'50%',animation:'spin 0.8s linear infinite' }} />
          </div>
        ) : items.length === 0 ? (
          <div style={{ textAlign:'center',paddingTop:60,fontSize:13,color:'#b8c2d4',fontFamily:"'JetBrains Mono',monospace" }}>
            — No upcoming meetings — schedule one from a lead page —
          </div>
        ) : (
          <div style={{ display:'flex',flexDirection:'column',gap:10 }}>
            {items.map(m => {
              const lead = m.lead || {}
              return (
                <div
                  key={m.id}
                  style={{
                    background:'rgba(255,255,255,0.02)',
                    border:'1px solid rgba(255,255,255,0.06)',
                    borderRadius:14,
                    padding:'14px 16px',
                    display:'flex',
                    alignItems:'center',
                    gap:14,
                    cursor:'pointer',
                    transition:'background 0.15s, border-color 0.15s',
                  }}
                  onClick={() => navigate(`/leads/${m.lead_id}`)}
                  onMouseEnter={e => { e.currentTarget.style.background='rgba(255,255,255,0.03)'; e.currentTarget.style.borderColor='rgba(139,92,246,0.3)' }}
                  onMouseLeave={e => { e.currentTarget.style.background='rgba(255,255,255,0.02)'; e.currentTarget.style.borderColor='rgba(255,255,255,0.06)' }}
                >
                  <div style={{ width:32,height:32,borderRadius:10,background:'rgba(37,99,235,0.14)',border:'1px solid rgba(37,99,235,0.4)',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0 }}>
                    <CalendarClock size={16} color="#60a5fa" />
                  </div>
                  <div style={{ flex:1,minWidth:0 }}>
                    <div style={{ display:'flex',alignItems:'center',justifyContent:'space-between',gap:10,marginBottom:4 }}>
                      <div style={{ fontSize:14,fontWeight:600,color:'#e4e4e7',whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis' }}>
                        {lead.name || 'Lead'} · {m.prospect_name || 'Prospect'}
                      </div>
                      <div style={{ fontSize:12,color:'#a5b4fc',fontFamily:"'JetBrains Mono',monospace" }}>
                        {formatTime(m.start_time)}
                      </div>
                    </div>
                    <div style={{ display:'flex',alignItems:'center',gap:10,fontSize:11,color:'#c4c4cc' }}>
                      {lead.city && (
                        <span style={{ display:'inline-flex',alignItems:'center',gap:4 }}>
                          <MapPin size={11} />{lead.city}
                        </span>
                      )}
                      {lead.phone && (
                        <span style={{ display:'inline-flex',alignItems:'center',gap:4 }}>
                          <Phone size={11} />{lead.phone}
                        </span>
                      )}
                      {m.email && (
                        <span style={{ display:'inline-flex',alignItems:'center',gap:4 }}>
                          <User size={11} />{m.email}
                        </span>
                      )}
                    </div>
                  </div>
                  <div style={{ display:'flex',flexDirection:'column',gap:6,alignItems:'flex-end' }}>
                    {m.zoom_join_url && (
                      <a
                        href={m.zoom_join_url}
                        onClick={e => e.stopPropagation()}
                        target="_blank"
                        rel="noreferrer"
                        style={{
                          display:'inline-flex',
                          alignItems:'center',
                          gap:6,
                          background:'rgba(37,99,235,0.18)',
                          border:'1px solid rgba(37,99,235,0.45)',
                          borderRadius:999,
                          padding:'6px 11px',
                          fontSize:11,
                          color:'#bfdbfe',
                          textDecoration:'none',
                          fontWeight:600,
                        }}
                      >
                        <Video size={12} /> Join
                      </a>
                    )}
                    <button
                      onClick={e => { e.stopPropagation(); navigate(`/leads/${m.lead_id}`) }}
                      style={{
                        display:'inline-flex',
                        alignItems:'center',
                        gap:4,
                        background:'none',
                        border:'none',
                        color:'#b8c2d4',
                        fontSize:11,
                        cursor:'pointer',
                      }}
                    >
                      View lead <ArrowRight size={11} />
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

