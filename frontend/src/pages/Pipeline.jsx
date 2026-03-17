import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { MapPin, AlertTriangle, ExternalLink, Phone, Star, ChevronDown, CheckCircle2, Circle, StickyNote, X, Check } from 'lucide-react'
import NavbarDropdown from '../components/NavbarDropdown'
import ReactDOM from 'react-dom'
const API = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000'

const STAGES = ['New Lead', 'Contacted', 'Interested', 'Proposal Sent', 'Closed Won', 'Closed Lost']
const STAGE_CONFIG = {
  'New Lead':      { color: '#818cf8', bg: 'rgba(99,102,241,0.08)',   border: 'rgba(99,102,241,0.2)',   glow: 'rgba(99,102,241,0.15)'  },
  'Contacted':     { color: '#fb923c', bg: 'rgba(251,146,60,0.08)',   border: 'rgba(251,146,60,0.2)',   glow: 'rgba(251,146,60,0.15)'  },
  'Interested':    { color: '#eab308', bg: 'rgba(234,179,8,0.08)',    border: 'rgba(234,179,8,0.2)',    glow: 'rgba(234,179,8,0.15)'   },
  'Proposal Sent': { color: '#a78bfa', bg: 'rgba(139,92,246,0.08)',   border: 'rgba(139,92,246,0.2)',   glow: 'rgba(139,92,246,0.15)'  },
  'Closed Won':    { color: '#4ade80', bg: 'rgba(74,222,128,0.08)',   border: 'rgba(74,222,128,0.2)',   glow: 'rgba(74,222,128,0.15)'  },
  'Closed Lost':   { color: '#f87171', bg: 'rgba(248,113,113,0.08)',  border: 'rgba(248,113,113,0.2)',  glow: 'rgba(248,113,113,0.15)' },
}
const scoreColor = s => s >= 75 ? '#4ade80' : s >= 50 ? '#fb923c' : '#f87171'

function ParticleCanvas() {
  const ref = useRef(null)
  useEffect(() => {
    const canvas = ref.current; const ctx = canvas.getContext('2d'); let id
    const resize = () => { canvas.width = window.innerWidth; canvas.height = window.innerHeight }
    resize(); window.addEventListener('resize', resize)
    const pts = Array.from({ length: 40 }, () => ({
      x: Math.random() * window.innerWidth, y: Math.random() * window.innerHeight,
      r: Math.random() * 0.8 + 0.2, s: Math.random() * 0.15 + 0.03,
      o: Math.random() * 0.1 + 0.02, hue: Math.random() > 0.5 ? '139,92,246' : '99,102,241',
    }))
    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      pts.forEach(p => {
        p.y -= p.s; if (p.y < -2) { p.y = canvas.height + 2; p.x = Math.random() * canvas.width }
        ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2)
        ctx.fillStyle = `rgba(${p.hue},${p.o})`; ctx.fill()
      }); id = requestAnimationFrame(draw)
    }
    draw(); return () => { cancelAnimationFrame(id); window.removeEventListener('resize', resize) }
  }, [])
  return <canvas ref={ref} style={{ position: 'fixed', inset: 0, zIndex: 0, pointerEvents: 'none' }} />
}

// ─── Notes modal ──────────────────────────────────────────────────────────────
function NotesModal({ lead, onClose, onSave }) {
  const [text, setText] = useState(lead.notes || '')
  const [saving, setSaving] = useState(false)

  const save = async () => {
    setSaving(true)
    await fetch(`${API}/leads/${lead.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ notes: text }),
    }).catch(() => {})
    onSave(lead.id, text)
    setSaving(false)
    onClose()
  }

  return (
    <div style={{ position:'fixed',inset:0,zIndex:1000,display:'flex',alignItems:'center',justifyContent:'center',background:'rgba(0,0,0,0.7)',backdropFilter:'blur(6px)' }} onClick={onClose}>
      <div style={{ width:480,background:'#111118',border:'1px solid rgba(255,255,255,0.1)',borderRadius:16,padding:24,position:'relative',boxShadow:'0 40px 80px rgba(0,0,0,0.8)' }} onClick={e=>e.stopPropagation()}>
        <div style={{ position:'absolute',top:0,left:0,right:0,height:1,background:'linear-gradient(90deg,transparent,rgba(139,92,246,0.6),transparent)',borderRadius:'16px 16px 0 0' }} />
        <div style={{ display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:16 }}>
          <div>
            <div style={{ fontSize:14,fontWeight:700,color:'#fafafa' }}>Notes</div>
            <div style={{ fontSize:11,color:'#c4c4cc',marginTop:2 }}>{lead.name}</div>
          </div>
          <button onClick={onClose} style={{ background:'none',border:'none',cursor:'pointer',color:'#b8c2d4',padding:4,display:'flex' }} onMouseEnter={e=>e.currentTarget.style.color='#c4c4cc'} onMouseLeave={e=>e.currentTarget.style.color='#b8c2d4'}>
            <X size={14} />
          </button>
        </div>
        <textarea
          autoFocus
          value={text}
          onChange={e=>setText(e.target.value)}
          placeholder="Add notes about this lead..."
          style={{ width:'100%',height:140,background:'rgba(255,255,255,0.03)',border:'1px solid rgba(255,255,255,0.08)',borderRadius:10,padding:'12px 14px',color:'#e4e4e7',fontSize:13,fontFamily:"'Outfit',sans-serif",resize:'none',outline:'none',lineHeight:1.6,transition:'border-color 0.2s' }}
          onFocus={e=>e.currentTarget.style.borderColor='rgba(139,92,246,0.5)'}
          onBlur={e=>e.currentTarget.style.borderColor='rgba(255,255,255,0.08)'}
        />
        <div style={{ display:'flex',justifyContent:'flex-end',gap:8,marginTop:12 }}>
          <button onClick={onClose} style={{ background:'rgba(255,255,255,0.03)',border:'1px solid rgba(255,255,255,0.07)',borderRadius:8,padding:'7px 16px',color:'#c4c4cc',fontSize:13,cursor:'pointer',fontFamily:"'Outfit',sans-serif" }}>Cancel</button>
          <button onClick={save} disabled={saving} style={{ background:'linear-gradient(135deg,#8b5cf6,#6366f1)',border:'none',borderRadius:8,padding:'7px 16px',color:'#fff',fontSize:13,fontWeight:700,cursor:'pointer',fontFamily:"'Outfit',sans-serif",display:'flex',alignItems:'center',gap:6,opacity:saving?0.6:1 }}>
            <Check size={12} /> {saving ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Stage dropdown (inline on card) ─────────────────────────────────────────
function StageDropdown({ lead, onChange }) {
  const [open, setOpen] = useState(false)
  const [pos, setPos] = useState({ top: 0, left: 0 })
  const triggerRef = useRef(null)
  const ref = useRef(null)

  useEffect(() => {
    const h = e => { if (ref.current && !ref.current.contains(e.target) && !triggerRef.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', h); return () => document.removeEventListener('mousedown', h)
  }, [])

  const handleOpen = (e) => {
    e.stopPropagation()
    if (!open) {
      const rect = triggerRef.current.getBoundingClientRect()
      setPos({ top: rect.bottom + window.scrollY + 5, left: rect.left + window.scrollX })
    }
    setOpen(o => !o)
  }

  const cfg = STAGE_CONFIG[lead.pipeline_stage] || STAGE_CONFIG['New Lead']

  return (
    <div>
      <div ref={triggerRef} onClick={handleOpen}
        style={{ display:'inline-flex',alignItems:'center',gap:4,cursor:'pointer',background:cfg.bg,border:`1px solid ${cfg.border}`,borderRadius:20,padding:'3px 8px',fontSize:10,color:cfg.color,fontFamily:"'JetBrains Mono',monospace",userSelect:'none',whiteSpace:'nowrap' }}>
        {lead.pipeline_stage}
        <ChevronDown size={9} style={{ transform:open?'rotate(180deg)':'none',transition:'transform 0.2s' }} />
      </div>

      {open && typeof document !== 'undefined' && ReactDOM.createPortal(
        <div ref={ref} style={{ position:'absolute',top:pos.top,left:pos.left,zIndex:9999,background:'#111118',border:'1px solid rgba(255,255,255,0.08)',borderRadius:10,padding:4,minWidth:150,boxShadow:'0 20px 50px rgba(0,0,0,0.8)' }}>
          {STAGES.map(stage => {
            const c = STAGE_CONFIG[stage]; const active = stage === lead.pipeline_stage
            return (
              <div key={stage} onClick={e=>{e.stopPropagation();onChange(lead.id,stage);setOpen(false)}}
                style={{ padding:'7px 10px',borderRadius:6,fontSize:11,cursor:'pointer',color:active?c.color:'#c4c4cc',background:active?c.bg:'transparent',fontFamily:"'JetBrains Mono',monospace",display:'flex',alignItems:'center',gap:7,transition:'background 0.12s' }}
                onMouseEnter={e=>{if(!active)e.currentTarget.style.background='rgba(255,255,255,0.04)'}}
                onMouseLeave={e=>{if(!active)e.currentTarget.style.background='transparent'}}>
                {active?<CheckCircle2 size={10}/>:<Circle size={10}/>} {stage}
              </div>
            )
          })}
        </div>,
        document.body
      )}
    </div>
  )
}

// ─── Lead card ────────────────────────────────────────────────────────────────
function LeadCard({ lead, onStageChange, onNoteClick }) {
  const noSite = lead.website_status === 'NO WEBSITE'
  const filled = Math.round(((lead.score||0)/100)*5)
  const color  = scoreColor(lead.score||0)

  return (
    <div style={{ background:'rgba(255,255,255,0.025)',border:'1px solid rgba(255,255,255,0.06)',borderRadius:12,padding:'12px 14px',marginBottom:8,cursor:'default',transition:'border-color 0.2s,transform 0.15s,box-shadow 0.15s',position:'relative',overflow:'hidden' }}
      onMouseEnter={e=>{e.currentTarget.style.borderColor='rgba(255,255,255,0.12)';e.currentTarget.style.transform='translateY(-1px)';e.currentTarget.style.boxShadow='0 8px 24px rgba(0,0,0,0.4)'}}
      onMouseLeave={e=>{e.currentTarget.style.borderColor='rgba(255,255,255,0.06)';e.currentTarget.style.transform='translateY(0)';e.currentTarget.style.boxShadow='none'}}>

      {/* Icon + name */}
      <div style={{ display:'flex',alignItems:'flex-start',gap:9,marginBottom:10 }}>
        <div style={{ width:30,height:30,borderRadius:8,flexShrink:0,background:noSite?'rgba(248,113,113,0.08)':'rgba(139,92,246,0.08)',border:`1px solid ${noSite?'rgba(248,113,113,0.18)':'rgba(139,92,246,0.18)'}`,display:'flex',alignItems:'center',justifyContent:'center' }}>
          {noSite?<AlertTriangle size={12} color="#f87171" strokeWidth={1.5}/>:<ExternalLink size={12} color="#8b5cf6" strokeWidth={1.5}/>}
        </div>
        <div style={{ flex:1,minWidth:0 }}>
          <div style={{ fontSize:12,fontWeight:700,color:'#e4e4e7',whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis',lineHeight:1.3 }}>{lead.name}</div>
          <div style={{ fontSize:10,color:'#b8c2d4',marginTop:2,display:'flex',alignItems:'center',gap:3 }}><MapPin size={8}/>{lead.city}</div>
        </div>
      </div>

      {/* Stars + score */}
      <div style={{ display:'flex',alignItems:'center',gap:4,marginBottom:10 }}>
        {[1,2,3,4,5].map(i=>(
          <Star key={i} size={10} strokeWidth={1.5} style={{ color:i<=filled?color:'rgba(255,255,255,0.08)',fill:i<=filled?color:'transparent' }} />
        ))}
        <span style={{ fontSize:10,color,fontFamily:"'JetBrains Mono',monospace",fontWeight:700,marginLeft:2 }}>{lead.score||0}</span>
        <span style={{ marginLeft:'auto',fontSize:9,fontWeight:700,padding:'2px 7px',borderRadius:20,background:noSite?'rgba(248,113,113,0.1)':'rgba(139,92,246,0.1)',border:`1px solid ${noSite?'rgba(248,113,113,0.22)':'rgba(139,92,246,0.22)'}`,color:noSite?'#f87171':'#a78bfa',fontFamily:"'JetBrains Mono',monospace" }}>
          {noSite?'NO SITE':'HAS SITE'}
        </span>
      </div>

      {/* Phone */}
      {lead.phone && (
        <div style={{ fontSize:10,color:'#c4c4cc',fontFamily:"'JetBrains Mono',monospace",marginBottom:10,display:'flex',alignItems:'center',gap:4 }}>
          <Phone size={9}/>{lead.phone}
        </div>
      )}

      {/* Notes preview */}
      {lead.notes && (
        <div style={{ fontSize:10,color:'#c4c4cc',background:'rgba(255,255,255,0.02)',border:'1px solid rgba(255,255,255,0.05)',borderRadius:6,padding:'5px 8px',marginBottom:10,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap' }}>
          {lead.notes}
        </div>
      )}

      {/* Actions row */}
      <div style={{ display:'flex',alignItems:'center',justifyContent:'space-between',gap:6 }}>
        <StageDropdown lead={lead} onChange={onStageChange} />
        <button onClick={e=>{e.stopPropagation();onNoteClick(lead)}}
          style={{ display:'flex',alignItems:'center',gap:4,background:lead.notes?'rgba(139,92,246,0.08)':'rgba(255,255,255,0.03)',border:`1px solid ${lead.notes?'rgba(139,92,246,0.2)':'rgba(255,255,255,0.06)'}`,borderRadius:7,padding:'4px 8px',color:lead.notes?'#a78bfa':'#b8c2d4',fontSize:10,cursor:'pointer',fontFamily:"'Outfit',sans-serif",transition:'all 0.15s' }}
          onMouseEnter={e=>{e.currentTarget.style.background='rgba(139,92,246,0.1)';e.currentTarget.style.color='#a78bfa'}}
          onMouseLeave={e=>{e.currentTarget.style.background=lead.notes?'rgba(139,92,246,0.08)':'rgba(255,255,255,0.03)';e.currentTarget.style.color=lead.notes?'#a78bfa':'#b8c2d4'}}>
          <StickyNote size={9}/>{lead.notes?'Edit note':'Add note'}
        </button>
      </div>
    </div>
  )
}

// ─── Kanban column ────────────────────────────────────────────────────────────
function KanbanColumn({ stage, leads, onStageChange, onNoteClick }) {
  const cfg   = STAGE_CONFIG[stage]
  const total = leads.length
  const [collapsed, setCollapsed] = useState(false)

  return (
    <div style={{ minWidth:220,width:220,flexShrink:0,display:'flex',flexDirection:'column' }}>
      {/* Column header */}
      <div onClick={()=>setCollapsed(c=>!c)}
        style={{ display:'flex',alignItems:'center',justifyContent:'space-between',padding:'10px 12px',marginBottom:8,background:cfg.bg,border:`1px solid ${cfg.border}`,borderRadius:10,cursor:'pointer',userSelect:'none',transition:'all 0.15s' }}
        onMouseEnter={e=>e.currentTarget.style.background=cfg.glow}
        onMouseLeave={e=>e.currentTarget.style.background=cfg.bg}>
        <div style={{ display:'flex',alignItems:'center',gap:7 }}>
          <div style={{ width:7,height:7,borderRadius:'50%',background:cfg.color }} />
          <span style={{ fontSize:12,fontWeight:700,color:cfg.color,fontFamily:"'JetBrains Mono',monospace",whiteSpace:'nowrap' }}>{stage}</span>
        </div>
        <span style={{ fontSize:11,background:`${cfg.color}18`,border:`1px solid ${cfg.color}30`,borderRadius:20,padding:'1px 7px',color:cfg.color,fontFamily:"'JetBrains Mono',monospace",fontWeight:700 }}>{total}</span>
      </div>

      {/* Cards */}
      {!collapsed && (
        <div style={{ flex:1,minHeight:80 }}>
          {leads.length === 0 ? (
            <div style={{ border:'1px dashed rgba(255,255,255,0.05)',borderRadius:10,padding:'20px 12px',textAlign:'center',fontSize:11,color:'#b8c2d4',fontFamily:"'JetBrains Mono',monospace" }}>empty</div>
          ) : leads.map(lead=>(
            <LeadCard key={lead.id} lead={lead} onStageChange={onStageChange} onNoteClick={onNoteClick} />
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Main ─────────────────────────────────────────────────────────────────────
export default function Pipeline() {
  const navigate  = useNavigate()
  const [leads, setLeads]       = useState([])
  const [loading, setLoading]   = useState(true)
  const [noteModal, setNoteModal] = useState(null) // lead object

  useEffect(() => {
    // Fetch all batches then all leads
    fetch(`${API}/batches`, { credentials:'include' })
      .then(r=>r.json())
      .then(async batches => {
        if (!Array.isArray(batches)) { setLoading(false); return }
        const arrays = await Promise.all(
          batches.map(b => fetch(`${API}/batches/${b.id}/leads`,{credentials:'include'})
            .then(r=>r.json()).then(d=>d.leads||[]).catch(()=>[]))
        )
        setLeads(arrays.flat())
        setLoading(false)
      })
      .catch(()=>setLoading(false))
  }, [])

  const handleStageChange = (leadId, stage) => {
    setLeads(prev => prev.map(l => l.id===leadId ? {...l,pipeline_stage:stage} : l))
    fetch(`${API}/leads/${leadId}`,{
      method:'PATCH',headers:{'Content-Type':'application/json'},credentials:'include',
      body:JSON.stringify({pipeline_stage:stage}),
    }).catch(()=>{})
  }

  const handleNoteSave = (leadId, notes) => {
    setLeads(prev => prev.map(l => l.id===leadId ? {...l,notes} : l))
  }

  const leadsByStage = STAGES.reduce((acc,s)=>{
    acc[s] = leads.filter(l=>(l.pipeline_stage||'New Lead')===s)
    return acc
  },{})

  const totalLeads   = leads.length
  const closedWon    = leadsByStage['Closed Won']?.length || 0
  const inProgress   = leads.filter(l=>!['New Lead','Closed Won','Closed Lost'].includes(l.pipeline_stage||'New Lead')).length
  const convRate     = totalLeads ? Math.round((closedWon/totalLeads)*100) : 0

  return (
    <div style={{ minHeight:'100vh',background:'#09090f',color:'#fafafa',fontFamily:"'Outfit',sans-serif",overflowX:'hidden' }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@400;500;600;700;800;900&family=JetBrains+Mono:wght@400;700&display=swap');
        *, *::before, *::after { box-sizing:border-box;margin:0;padding:0; }
        html, body { scrollbar-width:none; }
        html::-webkit-scrollbar { display:none; }
        @keyframes fadeUp { from{opacity:0;transform:translateY(16px)} to{opacity:1;transform:translateY(0)} }
        @keyframes pulse  { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:0.4;transform:scale(0.8)} }
        @keyframes spin   { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }
        .nav-link { background:none;border:none;color:#b8c2d4;font-size:14px;cursor:pointer;font-family:'Outfit',sans-serif;transition:color 0.2s;padding:0; }
        .nav-link:hover { color:#c4c4cc; }
        .nav-link.active { color:#fafafa;font-weight:600; }
      `}</style>

      <ParticleCanvas />
      <div style={{ position:'fixed',inset:0,zIndex:0,pointerEvents:'none',opacity:0.3,backgroundImage:'linear-gradient(rgba(139,92,246,0.04) 1px,transparent 1px),linear-gradient(90deg,rgba(139,92,246,0.04) 1px,transparent 1px)',backgroundSize:'72px 72px',maskImage:'radial-gradient(ellipse 100% 55% at 50% 0%,black 0%,transparent 100%)' }} />

      {/* NAV */}
      <nav style={{ position:'sticky',top:0,zIndex:100,display:'flex',justifyContent:'space-between',alignItems:'center',padding:'0 48px',height:64,background:'rgba(9,9,15,0.82)',backdropFilter:'blur(20px)',borderBottom:'1px solid rgba(255,255,255,0.04)' }}>
        <div style={{ display:'flex',alignItems:'center',gap:32 }}>
          <div style={{ display:'flex',alignItems:'center',gap:10,cursor:'pointer' }} onClick={()=>navigate('/')}>
            <div style={{ width:28,height:28,borderRadius:8,background:'linear-gradient(135deg,#8b5cf6,#6366f1)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:'0.7rem',fontWeight:900,color:'#fff' }}>B</div>
            <span style={{ fontWeight:800,fontSize:'1rem',letterSpacing:'-0.5px',color:'#f4f4f5' }}>BizScout</span>
          </div>
          <div style={{ display:'flex',gap:24 }}>
            <button className="nav-link" onClick={()=>navigate('/leads')}>Leads</button>
            <button className="nav-link" onClick={()=>navigate('/batches')}>Batches</button>
            <button className="nav-link active">Pipeline</button>
            <button className="nav-link" onClick={()=>navigate('/analytics')}>Analytics</button>
            <button className="nav-link" onClick={()=>navigate('/meetings')}>Meetings</button>
          </div>
        </div>
        <NavbarDropdown />
      </nav>

      <div style={{ position:'relative',zIndex:1,padding:'40px 48px 80px' }}>
        {/* Header */}
        <div style={{ marginBottom:28,animation:'fadeUp 0.5s cubic-bezier(0.16,1,0.3,1) 0.05s both' }}>
          <div style={{ display:'inline-flex',alignItems:'center',gap:7,background:'rgba(139,92,246,0.08)',border:'1px solid rgba(139,92,246,0.18)',borderRadius:6,padding:'4px 12px',marginBottom:14 }}>
            <div style={{ width:5,height:5,borderRadius:'50%',background:'#8b5cf6',animation:'pulse 1.5s infinite' }} />
            <span style={{ color:'#a78bfa',fontSize:'0.64rem',fontWeight:700,letterSpacing:'2px',textTransform:'uppercase',fontFamily:"'JetBrains Mono',monospace" }}>CRM</span>
          </div>
          <h1 style={{ fontSize:'clamp(1.8rem,3vw,2.6rem)',fontWeight:900,letterSpacing:'-1.5px',color:'#fafafa',marginBottom:6 }}>Pipeline</h1>
          <div style={{ display:'flex',gap:20 }}>
            {[
              { label:'Total', value:totalLeads, color:'#fafafa' },
              { label:'In Progress', value:inProgress, color:'#fb923c' },
              { label:'Closed Won', value:closedWon, color:'#4ade80' },
              { label:'Conv. Rate', value:`${convRate}%`, color:'#8b5cf6' },
            ].map(s=>(
              <div key={s.label} style={{ display:'flex',alignItems:'center',gap:6 }}>
                <span style={{ fontSize:18,fontWeight:800,color:s.color,fontFamily:"'JetBrains Mono',monospace",letterSpacing:'-1px' }}>{s.value}</span>
                <span style={{ fontSize:11,color:'#b8c2d4',textTransform:'uppercase',letterSpacing:'0.08em' }}>{s.label}</span>
              </div>
            ))}
          </div>
        </div>

        {loading ? (
          <div style={{ display:'flex',justifyContent:'center',paddingTop:60 }}>
            <div style={{ width:18,height:18,border:'2px solid rgba(139,92,246,0.3)',borderTopColor:'#8b5cf6',borderRadius:'50%',animation:'spin 0.8s linear infinite' }} />
          </div>
        ) : totalLeads === 0 ? (
          <div style={{ textAlign:'center',paddingTop:80 }}>
            <div style={{ fontSize:13,color:'#b8c2d4',fontFamily:"'JetBrains Mono',monospace",marginBottom:16 }}>— No leads yet —</div>
            <button onClick={()=>navigate('/leads')} style={{ background:'linear-gradient(135deg,#8b5cf6,#6366f1)',border:'none',borderRadius:9,padding:'10px 22px',color:'#fff',fontSize:13,fontWeight:700,cursor:'pointer',fontFamily:"'Outfit',sans-serif" }}>
              Go scrape some leads →
            </button>
          </div>
        ) : (
          <div style={{ display:'flex',gap:12,overflowX:'auto',paddingBottom:20,animation:'fadeUp 0.5s cubic-bezier(0.16,1,0.3,1) 0.15s both' }}>
            {STAGES.map(stage=>(
              <KanbanColumn
                key={stage}
                stage={stage}
                leads={leadsByStage[stage]||[]}
                onStageChange={handleStageChange}
                onNoteClick={setNoteModal}
              />
            ))}
          </div>
        )}
      </div>

      {/* Notes modal */}
      {noteModal && (
        <NotesModal
          lead={noteModal}
          onClose={()=>setNoteModal(null)}
          onSave={handleNoteSave}
        />
      )}
    </div>
  )
}