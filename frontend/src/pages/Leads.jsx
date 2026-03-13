// FILE: frontend/src/pages/Leads.jsx
// ACTION: CREATE or REPLACE

import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import {
  Search, MapPin, AlertTriangle, ExternalLink, Plus, Download,
  ChevronDown, Zap, BarChart2, Users, Target, ArrowUpRight,
  CheckCircle2, Circle, MoreHorizontal,
} from 'lucide-react'
import NavbarDropdown from '../components/NavbarDropdown'

const MOCK_LEADS = [
  { id: 1, name: "Joe's Plumbing",      city: 'Sacramento, CA',     type: 'Plumbing',     phone: '(916) 555-0182', score: 94, status: 'NO WEBSITE',  pipeline: 'New Lead'  },
  { id: 2, name: 'Valley Auto Repair',  city: 'Elk Grove, CA',      type: 'Auto Repair',  phone: '(916) 555-0247', score: 87, status: 'NO WEBSITE',  pipeline: 'Contacted' },
  { id: 3, name: 'Green Thumb Lawn',    city: 'Roseville, CA',      type: 'Landscaping',  phone: '(916) 555-0391', score: 71, status: 'HAS WEBSITE', pipeline: 'New Lead'  },
  { id: 4, name: 'Sunrise HVAC Co',     city: 'Folsom, CA',         type: 'HVAC',         phone: '(916) 555-0458', score: 89, status: 'NO WEBSITE',  pipeline: 'New Lead'  },
  { id: 5, name: 'Quick Cut Barbers',   city: 'Sacramento, CA',     type: 'Barbershop',   phone: '(916) 555-0512', score: 82, status: 'NO WEBSITE',  pipeline: 'Closed'    },
  { id: 6, name: 'Peak Roofing Co',     city: 'Citrus Heights, CA', type: 'Roofing',      phone: '(916) 555-0634', score: 76, status: 'HAS WEBSITE', pipeline: 'Contacted' },
  { id: 7, name: "Maria's Nail Salon",  city: 'Rancho Cordova, CA', type: 'Nail Salon',   phone: '(916) 555-0719', score: 91, status: 'NO WEBSITE',  pipeline: 'New Lead'  },
  { id: 8, name: 'Titan Tree Service',  city: 'Auburn, CA',         type: 'Tree Service', phone: '(916) 555-0823', score: 85, status: 'NO WEBSITE',  pipeline: 'New Lead'  },
]

const STAGES = ['New Lead', 'Contacted', 'Closed']

const STAGE_STYLE = {
  'New Lead':  { bg: 'rgba(99,102,241,0.12)',  border: 'rgba(99,102,241,0.3)',  color: '#818cf8' },
  'Contacted': { bg: 'rgba(251,146,60,0.12)',  border: 'rgba(251,146,60,0.3)',  color: '#fb923c' },
  'Closed':    { bg: 'rgba(74,222,128,0.12)',  border: 'rgba(74,222,128,0.3)',  color: '#4ade80' },
}

const scoreColor = s => s >= 85 ? '#4ade80' : s >= 70 ? '#fb923c' : '#f87171'

function ParticleCanvas() {
  const ref = useRef(null)
  useEffect(() => {
    const canvas = ref.current
    const ctx = canvas.getContext('2d')
    let id
    const resize = () => { canvas.width = window.innerWidth; canvas.height = window.innerHeight }
    resize()
    window.addEventListener('resize', resize)
    const pts = Array.from({ length: 60 }, () => ({
      x: Math.random() * window.innerWidth,
      y: Math.random() * window.innerHeight,
      r: Math.random() * 1.0 + 0.2,
      s: Math.random() * 0.2 + 0.04,
      o: Math.random() * 0.15 + 0.03,
      hue: Math.random() > 0.5 ? '139,92,246' : '99,102,241',
    }))
    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      pts.forEach(p => {
        p.y -= p.s
        if (p.y < -2) { p.y = canvas.height + 2; p.x = Math.random() * canvas.width }
        ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2)
        ctx.fillStyle = `rgba(${p.hue},${p.o})`; ctx.fill()
      })
      id = requestAnimationFrame(draw)
    }
    draw()
    return () => { cancelAnimationFrame(id); window.removeEventListener('resize', resize) }
  }, [])
  return <canvas ref={ref} style={{ position: 'fixed', inset: 0, zIndex: 0, pointerEvents: 'none' }} />
}

function StageDropdown({ lead, onChange }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)
  const s = STAGE_STYLE[lead.pipeline]

  useEffect(() => {
    const h = e => { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [])

  return (
    <div ref={ref} style={{ position: 'relative', display: 'inline-block' }}>
      <div
        onClick={() => setOpen(o => !o)}
        style={{
          display: 'inline-flex', alignItems: 'center', gap: 5, cursor: 'pointer',
          background: s.bg, border: `1px solid ${s.border}`,
          borderRadius: 20, padding: '4px 10px',
          fontSize: 11, color: s.color,
          fontFamily: "'JetBrains Mono', monospace", userSelect: 'none',
        }}
      >
        {lead.pipeline}
        <ChevronDown size={10} style={{ transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />
      </div>
      {open && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 6px)', left: 0, zIndex: 50,
          background: '#111118', border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: 10, padding: 4, minWidth: 130,
          boxShadow: '0 20px 50px rgba(0,0,0,0.6)',
        }}>
          {STAGES.map(stage => {
            const c = STAGE_STYLE[stage]
            const active = stage === lead.pipeline
            return (
              <div
                key={stage}
                onClick={() => { onChange(lead.id, stage); setOpen(false) }}
                style={{
                  padding: '8px 12px', borderRadius: 7, fontSize: 12, cursor: 'pointer',
                  color: active ? c.color : '#71717a',
                  background: active ? c.bg : 'transparent',
                  fontFamily: "'JetBrains Mono', monospace",
                  display: 'flex', alignItems: 'center', gap: 8,
                  transition: 'background 0.15s',
                }}
                onMouseEnter={e => { if (!active) e.currentTarget.style.background = 'rgba(255,255,255,0.04)' }}
                onMouseLeave={e => { if (!active) e.currentTarget.style.background = 'transparent' }}
              >
                {active ? <CheckCircle2 size={11} /> : <Circle size={11} />}
                {stage}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

function StatCard({ icon: Icon, label, value, sub, accent }) {
  return (
    <div
      style={{
        background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)',
        borderRadius: 14, padding: '20px 22px', display: 'flex', flexDirection: 'column',
        gap: 12, position: 'relative', overflow: 'hidden', transition: 'border-color 0.2s, transform 0.2s',
      }}
      onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(139,92,246,0.25)'; e.currentTarget.style.transform = 'translateY(-2px)' }}
      onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.06)'; e.currentTarget.style.transform = 'translateY(0)' }}
    >
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 1, background: `linear-gradient(90deg, transparent, ${accent}50, transparent)` }} />
      <div style={{ width: 36, height: 36, borderRadius: 10, background: `${accent}18`, border: `1px solid ${accent}30`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Icon size={15} color={accent} strokeWidth={1.5} />
      </div>
      <div>
        <div style={{ fontSize: 24, fontWeight: 800, color: '#fafafa', letterSpacing: '-1px', fontFamily: "'JetBrains Mono', monospace" }}>{value}</div>
        <div style={{ fontSize: 11, color: '#52525b', marginTop: 3, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{label}</div>
      </div>
      {sub && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: '#4ade80', fontFamily: "'JetBrains Mono', monospace" }}>
          <ArrowUpRight size={11} />{sub}
        </div>
      )}
    </div>
  )
}

export default function Leads() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [leads, setLeads] = useState(MOCK_LEADS)
  const [search, setSearch] = useState('')
  const [filterStage, setFilterStage] = useState('All')
  const [filterSite, setFilterSite] = useState('All')
  const [focused, setFocused] = useState(false)

  const firstName = user?.full_name?.split(' ')[0] || user?.email?.split('@')[0] || 'there'
  const noSite    = leads.filter(l => l.status === 'NO WEBSITE').length
  const contacted = leads.filter(l => l.pipeline === 'Contacted').length
  const avgScore  = Math.round(leads.reduce((a, l) => a + l.score, 0) / leads.length)

  const filtered = leads.filter(l => {
    const q = search.toLowerCase()
    const matchQ = l.name.toLowerCase().includes(q) || l.city.toLowerCase().includes(q) || l.type.toLowerCase().includes(q)
    const matchS = filterStage === 'All' || l.pipeline === filterStage
    const matchW = filterSite === 'All' || (filterSite === 'No Website' && l.status === 'NO WEBSITE') || (filterSite === 'Has Website' && l.status === 'HAS WEBSITE')
    return matchQ && matchS && matchW
  })

  const changeStage = (id, stage) => setLeads(prev => prev.map(l => l.id === id ? { ...l, pipeline: stage } : l))

  return (
    <div style={{ minHeight: '100vh', background: '#09090f', color: '#fafafa', fontFamily: "'Outfit', sans-serif", overflowX: 'hidden' }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@400;500;600;700;800;900&family=JetBrains+Mono:wght@400;700&display=swap');
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        html, body { scrollbar-width: none; overflow-x: hidden; }
        html::-webkit-scrollbar { display: none; }
        @keyframes fadeUp { from{opacity:0;transform:translateY(16px)} to{opacity:1;transform:translateY(0)} }
        @keyframes pulse  { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:0.4;transform:scale(0.8)} }
        .f1{animation:fadeUp 0.5s cubic-bezier(0.16,1,0.3,1) 0.05s both}
        .f2{animation:fadeUp 0.5s cubic-bezier(0.16,1,0.3,1) 0.13s both}
        .f3{animation:fadeUp 0.5s cubic-bezier(0.16,1,0.3,1) 0.21s both}
        .f4{animation:fadeUp 0.5s cubic-bezier(0.16,1,0.3,1) 0.29s both}
        .fbtn { background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.07); border-radius: 8px; color: #71717a; font-family:'Outfit',sans-serif; font-size:13px; padding:7px 14px; cursor:pointer; transition:all 0.15s; }
        .fbtn:hover,.fbtn.on { background:rgba(139,92,246,0.1); border-color:rgba(139,92,246,0.35); color:#c4b5fd; }
        .add-btn { background:linear-gradient(135deg,#8b5cf6,#6366f1); border:none; border-radius:9px; color:#fff; font-family:'Outfit',sans-serif; font-size:13px; font-weight:700; padding:9px 18px; cursor:pointer; display:flex; align-items:center; gap:7px; transition:opacity 0.2s,transform 0.15s; }
        .add-btn:hover { opacity:0.88; transform:translateY(-1px); }
        .icon-btn { background:rgba(255,255,255,0.03); border:1px solid rgba(255,255,255,0.07); border-radius:9px; color:#71717a; padding:9px 14px; cursor:pointer; display:flex; align-items:center; gap:7px; font-family:'Outfit',sans-serif; font-size:13px; transition:all 0.15s; }
        .icon-btn:hover { border-color:rgba(255,255,255,0.14); color:#a1a1aa; }
        .nav-lnk { background:none; border:none; color:#3f3f46; font-size:14px; cursor:pointer; font-family:'Outfit',sans-serif; transition:color 0.2s; padding:0; }
        .nav-lnk:hover { color:#a1a1aa; }
        .row-wrap:hover { background: rgba(255,255,255,0.02) !important; }
      `}</style>

      <ParticleCanvas />

      <div style={{ position:'fixed',inset:0,zIndex:0,pointerEvents:'none',opacity:0.35,backgroundImage:'linear-gradient(rgba(139,92,246,0.045) 1px,transparent 1px),linear-gradient(90deg,rgba(139,92,246,0.045) 1px,transparent 1px)',backgroundSize:'72px 72px',maskImage:'radial-gradient(ellipse 100% 55% at 50% 0%,black 0%,transparent 100%)' }} />
      <div style={{ position:'fixed',top:-180,left:'50%',transform:'translateX(-50%)',width:900,height:500,zIndex:0,pointerEvents:'none',background:'radial-gradient(ellipse at center,rgba(139,92,246,0.09) 0%,transparent 70%)' }} />

      {/* NAV */}
      <nav style={{ position:'sticky',top:0,zIndex:100,display:'flex',justifyContent:'space-between',alignItems:'center',padding:'0 48px',height:64,background:'rgba(9,9,15,0.82)',backdropFilter:'blur(20px)',borderBottom:'1px solid rgba(255,255,255,0.04)' }}>
        <div style={{ display:'flex',alignItems:'center',gap:32 }}>
          <div style={{ display:'flex',alignItems:'center',gap:10,cursor:'pointer' }} onClick={() => navigate('/')}>
            <div style={{ width:28,height:28,borderRadius:8,background:'linear-gradient(135deg,#8b5cf6,#6366f1)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:'0.7rem',fontWeight:900,color:'#fff' }}>B</div>
            <span style={{ fontWeight:800,fontSize:'1rem',letterSpacing:'-0.5px',color:'#f4f4f5' }}>BizScout</span>
          </div>
          <div style={{ display:'flex',gap:24 }}>
            <button className="nav-lnk" style={{ color:'#fafafa',fontWeight:600 }}>Leads</button>
            <button className="nav-lnk">Pipeline</button>
            <button className="nav-lnk">Analytics</button>
          </div>
        </div>
        <NavbarDropdown />
      </nav>

      {/* CONTENT */}
      <div style={{ position:'relative',zIndex:1,maxWidth:1280,margin:'0 auto',padding:'48px 48px 80px' }}>

        {/* Header */}
        <div className="f1" style={{ marginBottom:36 }}>
          <div style={{ display:'inline-flex',alignItems:'center',gap:7,background:'rgba(139,92,246,0.08)',border:'1px solid rgba(139,92,246,0.18)',borderRadius:6,padding:'4px 12px',marginBottom:14 }}>
            <div style={{ width:5,height:5,borderRadius:'50%',background:'#8b5cf6',animation:'pulse 1.5s infinite' }} />
            <span style={{ color:'#a78bfa',fontSize:'0.64rem',fontWeight:700,letterSpacing:'2px',textTransform:'uppercase',fontFamily:"'JetBrains Mono',monospace" }}>Lead Dashboard</span>
          </div>
          <h1 style={{ fontSize:'clamp(1.8rem,3vw,2.6rem)',fontWeight:900,letterSpacing:'-1.5px',color:'#fafafa',marginBottom:6 }}>
            Welcome back, {firstName}.
          </h1>
          <p style={{ color:'#52525b',fontSize:15,lineHeight:1.6 }}>
            You have <span style={{ color:'#a78bfa',fontWeight:600 }}>{noSite} leads</span> without a website — ready to contact.
          </p>
        </div>

        {/* Stats */}
        <div className="f2" style={{ display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:14,marginBottom:36 }}>
          <StatCard icon={Users}     label="Total Leads"  value={leads.length} sub="+3 this week"        accent="#8b5cf6" />
          <StatCard icon={Target}    label="No Website"   value={noSite}       sub={`${Math.round(noSite/leads.length*100)}% of leads`} accent="#f87171" />
          <StatCard icon={Zap}       label="Contacted"    value={contacted}    sub="2 pending reply"     accent="#fb923c" />
          <StatCard icon={BarChart2} label="Avg AI Score" value={avgScore}     sub="Top score: 94"       accent="#4ade80" />
        </div>

        {/* Toolbar */}
        <div className="f3" style={{ display:'flex',alignItems:'center',gap:10,marginBottom:16,flexWrap:'wrap' }}>
          {/* Search */}
          <div style={{ display:'flex',alignItems:'center',gap:10,flex:1,minWidth:220,background:'rgba(255,255,255,0.03)',border:`1px solid ${focused ? 'rgba(139,92,246,0.5)' : 'rgba(255,255,255,0.07)'}`,borderRadius:9,padding:'0 14px',height:38,transition:'border-color 0.2s',boxShadow:focused ? '0 0 0 3px rgba(139,92,246,0.08)' : 'none' }}>
            <Search size={13} color="#3f3f46" />
            <input
              style={{ background:'none',border:'none',outline:'none',color:'#fafafa',fontSize:13,width:'100%',fontFamily:"'Outfit',sans-serif" }}
              placeholder="Search leads..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              onFocus={() => setFocused(true)}
              onBlur={() => setFocused(false)}
            />
          </div>

          {/* Stage filter */}
          <div style={{ display:'flex',gap:6 }}>
            {['All',...STAGES].map(s => (
              <button key={s} className={`fbtn${filterStage===s?' on':''}`} onClick={() => setFilterStage(s)}>{s}</button>
            ))}
          </div>

          {/* Site filter */}
          <div style={{ display:'flex',gap:6 }}>
            {['All','No Website','Has Website'].map(s => (
              <button key={s} className={`fbtn${filterSite===s?' on':''}`} onClick={() => setFilterSite(s)}>{s}</button>
            ))}
          </div>

          <div style={{ marginLeft:'auto',display:'flex',gap:8 }}>
            <button className="icon-btn"><Download size={13} />Export</button>
            <button className="add-btn" onClick={() => navigate('/add')}><Plus size={14} />Add Lead</button>
          </div>
        </div>

        {/* Table */}
        <div className="f4" style={{ background:'rgba(255,255,255,0.015)',border:'1px solid rgba(255,255,255,0.06)',borderRadius:16,overflow:'hidden',position:'relative' }}>
          <div style={{ position:'absolute',top:0,left:0,right:0,height:1,background:'linear-gradient(90deg,transparent,rgba(139,92,246,0.5),transparent)' }} />

          {/* Header row */}
          <div style={{ display:'grid',gridTemplateColumns:'2fr 1fr 1fr 1fr 1fr 1fr',gap:16,padding:'12px 20px',borderBottom:'1px solid rgba(255,255,255,0.05)',background:'rgba(255,255,255,0.02)' }}>
            {['Business','Type','Website','AI Score','Stage','Contact'].map(h => (
              <div key={h} style={{ fontSize:10,fontWeight:700,color:'#3f3f46',letterSpacing:'0.1em',textTransform:'uppercase',fontFamily:"'JetBrains Mono',monospace" }}>{h}</div>
            ))}
          </div>

          {/* Data rows */}
          {filtered.length > 0 ? filtered.map(lead => {
            const noSiteL = lead.status === 'NO WEBSITE'
            return (
              <div key={lead.id} className="row-wrap" style={{ display:'grid',gridTemplateColumns:'2fr 1fr 1fr 1fr 1fr 1fr',alignItems:'center',gap:16,padding:'14px 20px',borderBottom:'1px solid rgba(255,255,255,0.04)',background:'transparent',transition:'background 0.15s' }}>

                {/* Name */}
                <div style={{ display:'flex',alignItems:'center',gap:12,minWidth:0 }}>
                  <div style={{ width:36,height:36,borderRadius:10,flexShrink:0,background:noSiteL?'rgba(248,113,113,0.08)':'rgba(139,92,246,0.08)',border:`1px solid ${noSiteL?'rgba(248,113,113,0.18)':'rgba(139,92,246,0.18)'}`,display:'flex',alignItems:'center',justifyContent:'center' }}>
                    {noSiteL ? <AlertTriangle size={14} color="#f87171" strokeWidth={1.5} /> : <ExternalLink size={14} color="#8b5cf6" strokeWidth={1.5} />}
                  </div>
                  <div style={{ minWidth:0 }}>
                    <div style={{ fontSize:14,fontWeight:600,color:'#e4e4e7',whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis' }}>{lead.name}</div>
                    <div style={{ fontSize:11,color:'#52525b',marginTop:2,display:'flex',alignItems:'center',gap:4 }}><MapPin size={9}/>{lead.city}</div>
                  </div>
                </div>

                {/* Type */}
                <div style={{ fontSize:12,color:'#71717a' }}>{lead.type}</div>

                {/* Website badge */}
                <div>
                  <span style={{ fontSize:10,fontWeight:700,letterSpacing:'0.06em',padding:'3px 8px',borderRadius:20,background:noSiteL?'rgba(248,113,113,0.1)':'rgba(139,92,246,0.1)',border:`1px solid ${noSiteL?'rgba(248,113,113,0.22)':'rgba(139,92,246,0.22)'}`,color:noSiteL?'#f87171':'#a78bfa',fontFamily:"'JetBrains Mono',monospace" }}>
                    {noSiteL ? 'NO SITE' : 'HAS SITE'}
                  </span>
                </div>

                {/* Score */}
                <div style={{ display:'flex',alignItems:'center',gap:8 }}>
                  <div style={{ width:40,height:3,background:'rgba(255,255,255,0.06)',borderRadius:2 }}>
                    <div style={{ width:`${lead.score}%`,height:'100%',borderRadius:2,background:scoreColor(lead.score) }} />
                  </div>
                  <span style={{ fontSize:12,fontWeight:700,color:scoreColor(lead.score),fontFamily:"'JetBrains Mono',monospace",width:24 }}>{lead.score}</span>
                </div>

                {/* Stage */}
                <StageDropdown lead={lead} onChange={changeStage} />

                {/* Contact */}
                <div style={{ display:'flex',alignItems:'center',gap:8,justifyContent:'flex-end' }}>
                  <span style={{ fontSize:11,color:'#3f3f46',fontFamily:"'JetBrains Mono',monospace" }}>{lead.phone}</span>
                  <div style={{ width:28,height:28,borderRadius:7,cursor:'pointer',background:'rgba(255,255,255,0.03)',border:'1px solid rgba(255,255,255,0.06)',display:'flex',alignItems:'center',justifyContent:'center',transition:'background 0.15s' }}
                    onMouseEnter={e => e.currentTarget.style.background='rgba(139,92,246,0.1)'}
                    onMouseLeave={e => e.currentTarget.style.background='rgba(255,255,255,0.03)'}
                  >
                    <MoreHorizontal size={13} color="#52525b" />
                  </div>
                </div>
              </div>
            )
          }) : (
            <div style={{ padding:'60px 20px',textAlign:'center' }}>
              <div style={{ fontSize:13,color:'#3f3f46',fontFamily:"'JetBrains Mono',monospace" }}>No leads match your filters.</div>
            </div>
          )}

          {/* Footer */}
          <div style={{ padding:'12px 20px',borderTop:'1px solid rgba(255,255,255,0.04)',display:'flex',justifyContent:'space-between',alignItems:'center' }}>
            <span style={{ fontSize:11,color:'#3f3f46',fontFamily:"'JetBrains Mono',monospace" }}>Showing {filtered.length} of {leads.length} leads</span>
            <div style={{ display:'flex',alignItems:'center',gap:6 }}>
              <div style={{ width:5,height:5,borderRadius:'50%',background:'#8b5cf6',animation:'pulse 1.5s infinite' }} />
              <span style={{ fontSize:11,color:'#52525b',fontFamily:"'JetBrains Mono',monospace" }}>Live data</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}