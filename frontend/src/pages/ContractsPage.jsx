import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  FileText, CheckCircle2, Clock, PenLine, Send,
  Download, Search, DollarSign, ChevronRight, X
} from 'lucide-react'
import NavbarDropdown from '../components/NavbarDropdown'
import { buildContractHTML } from '../utils/contractTemplate'
import { generateContractPDF } from '../utils/pdfUtils'

const API = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000'

function getAuthHeaders() {
  const token = sessionStorage.getItem('access_token') || localStorage.getItem('access_token')
  return token ? { Authorization: `Bearer ${token}` } : {}
}

async function downloadContract(contract) {
  const token = sessionStorage.getItem('access_token') || localStorage.getItem('access_token')
  if (!contract.client_signed) {
    // Not yet signed — use browser print dialog
    const html = buildContractHTML(contract, contract.designer_sig_data || null, contract.client_sig_data || null)
    const safeName = (contract.client_name || 'Contract').replace(/\s+/g, '_')
    await generateContractPDF(html, `Web_Design_Agreement_${safeName}`)
    return
  }
  // Signed — fetch server-generated PDF (Playwright, no overlap)
  try {
    const res = await fetch(`${API}/contracts/download/${contract.id}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    })
    if (!res.ok) throw new Error('Download failed')
    const blob = await res.blob()
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement('a')
    const safeName = (contract.client_name || 'Contract').replace(/\s+/g, '_')
    a.href     = url
    a.download = `Web_Design_Agreement_${safeName}.pdf`
    a.click()
    URL.revokeObjectURL(url)
  } catch (err) {
    console.error('[download]', err)
    // Fallback to print dialog
    const html = buildContractHTML(contract, contract.designer_sig_data || null, contract.client_sig_data || null)
    const safeName = (contract.client_name || 'Contract').replace(/\s+/g, '_')
    await generateContractPDF(html, `Web_Design_Agreement_${safeName}`)
  }
}

function ParticleCanvas() {
  const ref = useRef(null)
  useEffect(() => {
    const canvas = ref.current; const ctx = canvas.getContext('2d'); let id
    const resize = () => { canvas.width = window.innerWidth; canvas.height = window.innerHeight }
    resize(); window.addEventListener('resize', resize)
    const pts = Array.from({ length: 40 }, () => ({
      x: Math.random()*window.innerWidth, y: Math.random()*window.innerHeight,
      r: Math.random()*0.8+0.2, s: Math.random()*0.15+0.03,
      o: Math.random()*0.1+0.02, hue: Math.random()>0.5?'139,92,246':'99,102,241'
    }))
    const draw = () => {
      ctx.clearRect(0,0,canvas.width,canvas.height)
      pts.forEach(p => {
        p.y -= p.s; if(p.y<-2){p.y=canvas.height+2;p.x=Math.random()*canvas.width}
        ctx.beginPath(); ctx.arc(p.x,p.y,p.r,0,Math.PI*2)
        ctx.fillStyle=`rgba(${p.hue},${p.o})`; ctx.fill()
      }); id=requestAnimationFrame(draw)
    }
    draw(); return()=>{cancelAnimationFrame(id);window.removeEventListener('resize',resize)}
  },[])
  return <canvas ref={ref} style={{position:'fixed',inset:0,zIndex:0,pointerEvents:'none'}}/>
}

function statusInfo(c) {
  if (c.client_signed)   return { label:'Fully Signed',    color:'#4ade80', bg:'rgba(74,222,128,0.1)',   border:'rgba(74,222,128,0.25)',   icon:CheckCircle2 }
  if (c.designer_signed) return { label:'Awaiting Client', color:'#fb923c', bg:'rgba(251,146,60,0.1)',   border:'rgba(251,146,60,0.25)',   icon:Clock }
  return                        { label:'Draft',            color:'#b8c2d4', bg:'rgba(255,255,255,0.04)', border:'rgba(255,255,255,0.12)', icon:PenLine }
}

function StatCard({ icon: Icon, label, value, accent, sub }) {
  return (
    <div style={{ background:'rgba(255,255,255,0.02)',border:'1px solid rgba(255,255,255,0.05)',borderRadius:14,padding:'18px 20px',position:'relative',overflow:'hidden' }}>
      <div style={{ position:'absolute',top:0,left:0,right:0,height:1,background:`linear-gradient(90deg,transparent,${accent}50,transparent)` }}/>
      <div style={{ display:'flex',alignItems:'center',gap:10,marginBottom:12 }}>
        <div style={{ width:32,height:32,borderRadius:9,background:`${accent}18`,border:`1px solid ${accent}30`,display:'flex',alignItems:'center',justifyContent:'center' }}>
          <Icon size={14} color={accent} strokeWidth={1.5}/>
        </div>
        <span style={{ fontSize:10,color:'#b8c2d4',textTransform:'uppercase',letterSpacing:'0.1em',fontFamily:"'JetBrains Mono',monospace" }}>{label}</span>
      </div>
      <div style={{ fontSize:30,fontWeight:900,color:'#fafafa',fontFamily:"'JetBrains Mono',monospace",letterSpacing:'-2px',lineHeight:1 }}>{value}</div>
      {sub && <div style={{ fontSize:11,color:'#c4c4cc',marginTop:6 }}>{sub}</div>}
    </div>
  )
}

function DownloadBtn({ contract, color, bg, border, title }) {
  const [loading, setLoading] = useState(false)
  const handleClick = async (e) => {
    e.stopPropagation()
    if (loading) return
    setLoading(true)
    try { await downloadContract(contract) }
    catch (err) { console.error('[download]', err) }
    finally { setLoading(false) }
  }
  return (
    <button onClick={handleClick} disabled={loading} title={title}
      style={{ display:'flex',alignItems:'center',justifyContent:'center',width:28,height:28,background:bg,border:`1px solid ${border}`,borderRadius:7,color,cursor:loading?'wait':'pointer',transition:'all 0.15s',opacity:loading?0.6:1 }}
      onMouseEnter={e => { if(!loading) e.currentTarget.style.opacity='0.8' }}
      onMouseLeave={e => { e.currentTarget.style.opacity=loading?'0.6':'1' }}>
      <Download size={11}/>
    </button>
  )
}

export default function ContractsPage() {
  const navigate = useNavigate()
  const [contracts, setContracts]       = useState([])
  const [loading, setLoading]           = useState(true)
  const [search, setSearch]             = useState('')
  const [filterStatus, setFilterStatus] = useState('All')
  const [focused, setFocused]           = useState(false)

  useEffect(() => {
    fetch(`${API}/contracts/all`, {
      credentials: 'include',
      headers: getAuthHeaders(),
    })
      .then(r => r.ok ? r.json() : [])
      .then(data => { setContracts(Array.isArray(data) ? data : []); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  const filtered = contracts.filter(c => {
    const q = search.toLowerCase()
    const matchSearch = !q ||
      (c.client_name   || '').toLowerCase().includes(q) ||
      (c.designer_name || '').toLowerCase().includes(q) ||
      (c.client_email  || '').toLowerCase().includes(q)
    const matchStatus =
      filterStatus === 'All' ||
      (filterStatus === 'Signed'  && c.client_signed) ||
      (filterStatus === 'Pending' && c.designer_signed && !c.client_signed) ||
      (filterStatus === 'Draft'   && !c.designer_signed)
    return matchSearch && matchStatus
  })

  const totalContracts = contracts.length
  const fullySigned    = contracts.filter(c => c.client_signed).length
  const awaitingClient = contracts.filter(c => c.designer_signed && !c.client_signed).length
  const totalValue     = contracts
    .filter(c => c.setup_price)
    .reduce((sum, c) => sum + parseFloat(c.setup_price || 0), 0)

  const FILTERS = ['All', 'Signed', 'Pending', 'Draft']

  return (
    <div style={{ minHeight:'100vh',background:'#09090f',color:'#fafafa',fontFamily:"'Outfit',sans-serif",overflowX:'hidden' }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@400;500;600;700;800;900&family=JetBrains+Mono:wght@400;700&display=swap');
        *,*::before,*::after{box-sizing:border-box;margin:0;padding:0;}
        html,body{scrollbar-width:none;}html::-webkit-scrollbar{display:none;}
        @keyframes fadeUp{from{opacity:0;transform:translateY(16px)}to{opacity:1;transform:translateY(0)}}
        @keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}
        @keyframes pulse{0%,100%{opacity:1;transform:scale(1)}50%{opacity:0.4;transform:scale(0.8)}}
        .nav-link{background:none;border:none;color:#b8c2d4;font-size:14px;cursor:pointer;font-family:'Outfit',sans-serif;transition:color 0.2s;padding:0;}
        .nav-link:hover{color:#c4c4cc;}.nav-link.active{color:#fafafa;font-weight:600;}
        .filter-btn{background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.07);border-radius:8px;color:#c4c4cc;font-family:'Outfit',sans-serif;font-size:13px;padding:6px 14px;cursor:pointer;transition:all 0.15s;}
        .filter-btn:hover,.filter-btn.on{background:rgba(139,92,246,0.1);border-color:rgba(139,92,246,0.35);color:#c4b5fd;}
      `}</style>

      <ParticleCanvas/>
      <div style={{ position:'fixed',inset:0,zIndex:0,pointerEvents:'none',opacity:0.3,backgroundImage:'linear-gradient(rgba(139,92,246,0.04) 1px,transparent 1px),linear-gradient(90deg,rgba(139,92,246,0.04) 1px,transparent 1px)',backgroundSize:'72px 72px',maskImage:'radial-gradient(ellipse 100% 55% at 50% 0%,black 0%,transparent 100%)' }}/>

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
            <button className="nav-link" onClick={() => navigate('/meetings')}>Meetings</button>
            <button className="nav-link active">Contracts</button>
          </div>
        </div>
        <NavbarDropdown/>
      </nav>

      <div style={{ position:'relative',zIndex:1,maxWidth:1280,margin:'0 auto',padding:'48px 48px 80px' }}>

        {/* Header */}
        <div style={{ marginBottom:32,animation:'fadeUp 0.5s cubic-bezier(0.16,1,0.3,1) 0.05s both' }}>
          <div style={{ display:'inline-flex',alignItems:'center',gap:7,background:'rgba(139,92,246,0.08)',border:'1px solid rgba(139,92,246,0.18)',borderRadius:6,padding:'4px 12px',marginBottom:14 }}>
            <div style={{ width:5,height:5,borderRadius:'50%',background:'#8b5cf6',animation:'pulse 1.5s infinite' }}/>
            <span style={{ color:'#a78bfa',fontSize:'0.64rem',fontWeight:700,letterSpacing:'2px',textTransform:'uppercase',fontFamily:"'JetBrains Mono',monospace" }}>Documents</span>
          </div>
          <h1 style={{ fontSize:'clamp(1.8rem,3vw,2.6rem)',fontWeight:900,letterSpacing:'-1.5px',color:'#fafafa',marginBottom:6 }}>Contracts</h1>
          <p style={{ color:'#c4c4cc',fontSize:15 }}>
            {totalContracts === 0
              ? 'No contracts yet — create one from a lead page.'
              : `${totalContracts} contract${totalContracts===1?'':'s'} · ${fullySigned} fully signed`}
          </p>
        </div>

        {/* Stats */}
        {totalContracts > 0 && (
          <div style={{ display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:12,marginBottom:28,animation:'fadeUp 0.5s cubic-bezier(0.16,1,0.3,1) 0.1s both' }}>
            <StatCard icon={FileText}     label="Total"        value={totalContracts} accent="#8b5cf6"/>
            <StatCard icon={CheckCircle2} label="Fully Signed" value={fullySigned}    accent="#4ade80" sub={`${totalContracts?Math.round((fullySigned/totalContracts)*100):0}% close rate`}/>
            <StatCard icon={Clock}        label="Awaiting"     value={awaitingClient} accent="#fb923c"/>
            <StatCard icon={DollarSign}   label="Total Value"  value={`$${totalValue.toLocaleString()}`} accent="#eab308" sub="setup fees"/>
          </div>
        )}

        {/* Search + filters */}
        <div style={{ display:'flex',alignItems:'center',gap:10,marginBottom:20,animation:'fadeUp 0.5s cubic-bezier(0.16,1,0.3,1) 0.15s both' }}>
          <div style={{ display:'flex',alignItems:'center',gap:10,flex:1,background:'rgba(255,255,255,0.03)',border:`1px solid ${focused?'rgba(139,92,246,0.5)':'rgba(255,255,255,0.07)'}`,borderRadius:9,padding:'0 14px',height:38,transition:'border-color 0.2s' }}>
            <Search size={13} color="#b8c2d4"/>
            <input value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Search by client, designer, email..."
              onFocus={() => setFocused(true)} onBlur={() => setFocused(false)}
              style={{ background:'none',border:'none',outline:'none',color:'#fafafa',fontSize:13,width:'100%',fontFamily:"'Outfit',sans-serif" }}/>
            {search && (
              <button onClick={() => setSearch('')} style={{ background:'none',border:'none',cursor:'pointer',color:'#b8c2d4',padding:0,display:'flex' }}>
                <X size={12}/>
              </button>
            )}
          </div>
          <div style={{ display:'flex',gap:6 }}>
            {FILTERS.map(f => (
              <button key={f} className={`filter-btn${filterStatus===f?' on':''}`} onClick={() => setFilterStatus(f)}>{f}</button>
            ))}
          </div>
        </div>

        {/* Table */}
        {loading ? (
          <div style={{ display:'flex',justifyContent:'center',paddingTop:60 }}>
            <div style={{ width:18,height:18,border:'2px solid rgba(139,92,246,0.3)',borderTopColor:'#8b5cf6',borderRadius:'50%',animation:'spin 0.8s linear infinite' }}/>
          </div>
        ) : contracts.length === 0 ? (
          <div style={{ textAlign:'center',paddingTop:80 }}>
            <FileText size={40} color="#b8c2d4" strokeWidth={1} style={{ margin:'0 auto 16px',display:'block' }}/>
            <div style={{ fontSize:13,color:'#b8c2d4',fontFamily:"'JetBrains Mono',monospace",marginBottom:16 }}>— No contracts yet —</div>
            <button onClick={() => navigate('/leads')} style={{ background:'linear-gradient(135deg,#8b5cf6,#6366f1)',border:'none',borderRadius:9,padding:'10px 22px',color:'#fff',fontSize:13,fontWeight:700,cursor:'pointer',fontFamily:"'Outfit',sans-serif" }}>
              Go to Leads →
            </button>
          </div>
        ) : filtered.length === 0 ? (
          <div style={{ textAlign:'center',paddingTop:60,fontSize:13,color:'#b8c2d4',fontFamily:"'JetBrains Mono',monospace" }}>
            — No contracts match your filters —
          </div>
        ) : (
          <div style={{ background:'rgba(255,255,255,0.015)',border:'1px solid rgba(255,255,255,0.06)',borderRadius:16,overflow:'hidden',position:'relative',animation:'fadeUp 0.5s cubic-bezier(0.16,1,0.3,1) 0.2s both' }}>
            <div style={{ position:'absolute',top:0,left:0,right:0,height:1,background:'linear-gradient(90deg,transparent,rgba(139,92,246,0.5),transparent)' }}/>

            {/* Header row */}
            <div style={{ display:'grid',gridTemplateColumns:'2fr 1.2fr 1fr 1fr 0.8fr 1fr',gap:16,padding:'12px 20px',borderBottom:'1px solid rgba(255,255,255,0.05)',background:'rgba(255,255,255,0.02)' }}>
              {['Client','Designer','Value','Status','Date','Actions'].map(h => (
                <div key={h} style={{ fontSize:10,fontWeight:700,color:'#b8c2d4',letterSpacing:'0.1em',textTransform:'uppercase',fontFamily:"'JetBrains Mono',monospace" }}>{h}</div>
              ))}
            </div>

            {filtered.map((c, i) => {
              const status     = statusInfo(c)
              const StatusIcon = status.icon
              const date       = c.created_at
                ? new Date(c.created_at).toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'})
                : '—'

              return (
                <div key={c.id}
                  style={{ display:'grid',gridTemplateColumns:'2fr 1.2fr 1fr 1fr 0.8fr 1fr',alignItems:'center',gap:16,padding:'14px 20px',borderBottom:i<filtered.length-1?'1px solid rgba(255,255,255,0.04)':'none',transition:'background 0.15s',cursor:'pointer' }}
                  onClick={() => navigate(`/leads/${c.lead_id}`)}
                  onMouseEnter={e => e.currentTarget.style.background='rgba(255,255,255,0.02)'}
                  onMouseLeave={e => e.currentTarget.style.background='transparent'}>

                  {/* Client */}
                  <div style={{ display:'flex',alignItems:'center',gap:10,minWidth:0 }}>
                    <div style={{ width:34,height:34,borderRadius:9,flexShrink:0,background:`${status.color}18`,border:`1px solid ${status.color}25`,display:'flex',alignItems:'center',justifyContent:'center' }}>
                      <FileText size={13} color={status.color} strokeWidth={1.5}/>
                    </div>
                    <div style={{ minWidth:0 }}>
                      <div style={{ fontSize:13,fontWeight:600,color:'#e4e4e7',whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis' }}>{c.client_name || '—'}</div>
                      <div style={{ fontSize:11,color:'#b8c2d4' }}>{c.client_email || '—'}</div>
                    </div>
                  </div>

                  {/* Designer */}
                  <div style={{ fontSize:12,color:'#c4c4cc' }}>{c.designer_name || '—'}</div>

                  {/* Value */}
                  <div>
                    <div style={{ fontSize:13,fontWeight:700,color:'#e4e4e7',fontFamily:"'JetBrains Mono',monospace" }}>
                      {c.setup_price ? `$${Number(c.setup_price).toLocaleString()}` : '—'}
                    </div>
                    {c.monthly_price && (
                      <div style={{ fontSize:10,color:'#b8c2d4',fontFamily:"'JetBrains Mono',monospace" }}>${Number(c.monthly_price).toLocaleString()}/mo</div>
                    )}
                  </div>

                  {/* Status */}
                  <span style={{ display:'inline-flex',alignItems:'center',gap:5,fontSize:10,fontWeight:700,padding:'3px 9px',borderRadius:20,background:status.bg,border:`1px solid ${status.border}`,color:status.color,fontFamily:"'JetBrains Mono',monospace",whiteSpace:'nowrap' }}>
                    <StatusIcon size={9} strokeWidth={2}/> {status.label}
                  </span>

                  {/* Date */}
                  <div style={{ fontSize:11,color:'#b8c2d4',fontFamily:"'JetBrains Mono',monospace" }}>{date}</div>

                  {/* Actions */}
                  <div style={{ display:'flex',gap:6 }} onClick={e => e.stopPropagation()}>

                    {/* Download PDF */}
                    <DownloadBtn
                      contract={c}
                      title={c.client_signed ? 'Download signed contract PDF' : 'Download contract PDF'}
                      color={c.client_signed ? '#4ade80' : '#c4c4cc'}
                      bg={c.client_signed ? 'rgba(74,222,128,0.06)' : 'rgba(255,255,255,0.03)'}
                      border={c.client_signed ? 'rgba(74,222,128,0.2)' : 'rgba(255,255,255,0.08)'}
                    />

                    {/* Copy signing link */}
                    {c.client_token && !c.client_signed && (
                      <button
                        title="Copy signing link"
                        onClick={() => navigator.clipboard.writeText(`${window.location.origin}/sign/${c.client_token}`)}
                        style={{ display:'flex',alignItems:'center',justifyContent:'center',width:28,height:28,background:'rgba(251,146,60,0.06)',border:'1px solid rgba(251,146,60,0.2)',borderRadius:7,color:'#fb923c',cursor:'pointer',transition:'all 0.15s' }}
                        onMouseEnter={e => e.currentTarget.style.background='rgba(251,146,60,0.14)'}
                        onMouseLeave={e => e.currentTarget.style.background='rgba(251,146,60,0.06)'}>
                        <Send size={11}/>
                      </button>
                    )}

                    {/* View lead */}
                    <button
                      title="View lead"
                      onClick={() => navigate(`/leads/${c.lead_id}`)}
                      style={{ display:'flex',alignItems:'center',justifyContent:'center',width:28,height:28,background:'rgba(255,255,255,0.03)',border:'1px solid rgba(255,255,255,0.07)',borderRadius:7,color:'#b8c2d4',cursor:'pointer',transition:'all 0.15s' }}
                      onMouseEnter={e => { e.currentTarget.style.background='rgba(255,255,255,0.06)'; e.currentTarget.style.color='#e4e4e7' }}
                      onMouseLeave={e => { e.currentTarget.style.background='rgba(255,255,255,0.03)'; e.currentTarget.style.color='#b8c2d4' }}>
                      <ChevronRight size={11}/>
                    </button>
                  </div>
                </div>
              )
            })}

            <div style={{ padding:'11px 20px',borderTop:'1px solid rgba(255,255,255,0.04)',display:'flex',justifyContent:'space-between' }}>
              <span style={{ fontSize:11,color:'#b8c2d4',fontFamily:"'JetBrains Mono',monospace" }}>
                Showing {filtered.length} of {contracts.length} contracts
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}