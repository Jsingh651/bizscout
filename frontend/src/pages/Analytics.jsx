import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { BarChart2, TrendingUp, Target, Users, MapPin, Zap, ArrowUpRight, ChevronRight } from 'lucide-react'
import NavbarDropdown from '../components/NavbarDropdown'

const API = 'http://127.0.0.1:8000'
const scoreColor = s => s >= 75 ? '#4ade80' : s >= 50 ? '#fb923c' : '#f87171'

function ParticleCanvas() {
  const ref = useRef(null)
  useEffect(() => {
    const canvas = ref.current; const ctx = canvas.getContext('2d'); let id
    const resize = () => { canvas.width = window.innerWidth; canvas.height = window.innerHeight }
    resize(); window.addEventListener('resize', resize)
    const pts = Array.from({ length: 40 }, () => ({
      x: Math.random() * window.innerWidth, y: Math.random() * window.innerHeight,
      r: Math.random() * 1.0 + 0.2, s: Math.random() * 0.2 + 0.04,
      o: Math.random() * 0.12 + 0.03, hue: Math.random() > 0.5 ? '139,92,246' : '99,102,241',
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

// ─── Mini bar chart ───────────────────────────────────────────────────────────
function BarChart({ data, valueKey, labelKey, color = '#8b5cf6', maxBars = 8 }) {
  const sorted = [...data].sort((a, b) => b[valueKey] - a[valueKey]).slice(0, maxBars)
  const max = sorted[0]?.[valueKey] || 1
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {sorted.map((item, i) => (
        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 130, flexShrink: 0, fontSize: 12, color: '#71717a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{item[labelKey]}</div>
          <div style={{ flex: 1, height: 6, background: 'rgba(255,255,255,0.04)', borderRadius: 3, overflow: 'hidden' }}>
            <div style={{
              height: '100%', borderRadius: 3,
              width: `${(item[valueKey] / max) * 100}%`,
              background: `linear-gradient(90deg, ${color}, ${color}88)`,
              transition: 'width 0.8s cubic-bezier(0.16,1,0.3,1)',
            }} />
          </div>
          <div style={{ width: 36, flexShrink: 0, textAlign: 'right', fontSize: 12, fontWeight: 700, color: '#e4e4e7', fontFamily: "'JetBrains Mono', monospace" }}>{item[valueKey]}</div>
        </div>
      ))}
    </div>
  )
}

// ─── Pipeline funnel ──────────────────────────────────────────────────────────
function PipelineFunnel({ stageCounts }) {
  const STAGES = ['New Lead', 'Contacted', 'Interested', 'Proposal Sent', 'Closed Won', 'Closed Lost']
  const COLORS = { 'New Lead': '#818cf8', 'Contacted': '#fb923c', 'Interested': '#eab308', 'Proposal Sent': '#a78bfa', 'Closed Won': '#4ade80', 'Closed Lost': '#f87171' }
  const max = Math.max(...STAGES.map(s => stageCounts[s] || 0), 1)
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {STAGES.map(stage => {
        const count = stageCounts[stage] || 0
        const pct = (count / max) * 100
        return (
          <div key={stage} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 110, flexShrink: 0, fontSize: 11, color: COLORS[stage], fontFamily: "'JetBrains Mono', monospace", whiteSpace: 'nowrap' }}>{stage}</div>
            <div style={{ flex: 1, height: 20, background: 'rgba(255,255,255,0.03)', borderRadius: 4, overflow: 'hidden', position: 'relative' }}>
              <div style={{ height: '100%', width: `${pct}%`, background: `${COLORS[stage]}22`, borderLeft: `2px solid ${COLORS[stage]}`, borderRadius: 4, transition: 'width 0.8s cubic-bezier(0.16,1,0.3,1)' }} />
            </div>
            <div style={{ width: 28, flexShrink: 0, textAlign: 'right', fontSize: 12, fontWeight: 700, color: '#e4e4e7', fontFamily: "'JetBrains Mono', monospace" }}>{count}</div>
          </div>
        )
      })}
    </div>
  )
}

// ─── Stat card ────────────────────────────────────────────────────────────────
function StatCard({ icon: Icon, label, value, sub, accent, delay = 0 }) {
  return (
    <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: 14, padding: '18px 20px', position: 'relative', overflow: 'hidden', animation: `fadeUp 0.5s cubic-bezier(0.16,1,0.3,1) ${delay}s both` }}>
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 1, background: `linear-gradient(90deg, transparent, ${accent}50, transparent)` }} />
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
        <div style={{ width: 32, height: 32, borderRadius: 9, background: `${accent}18`, border: `1px solid ${accent}30`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Icon size={14} color={accent} strokeWidth={1.5} />
        </div>
        <span style={{ fontSize: 10, color: '#3f3f46', textTransform: 'uppercase', letterSpacing: '0.1em', fontFamily: "'JetBrains Mono', monospace" }}>{label}</span>
      </div>
      <div style={{ fontSize: 32, fontWeight: 900, color: '#fafafa', fontFamily: "'JetBrains Mono', monospace", letterSpacing: '-2px', lineHeight: 1 }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: '#52525b', marginTop: 6, display: 'flex', alignItems: 'center', gap: 3 }}><ArrowUpRight size={10} color={accent} />{sub}</div>}
    </div>
  )
}

export default function Analytics() {
  const navigate = useNavigate()
  const [batches, setBatches] = useState([])
  const [allLeads, setAllLeads] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch(`${API}/batches`, { credentials: 'include' })
      .then(r => r.json())
      .then(async data => {
        const arr = Array.isArray(data) ? data : []
        setBatches(arr)
        // Fetch leads for all batches
        const leadArrays = await Promise.all(
          arr.map(b => fetch(`${API}/batches/${b.id}/leads`, { credentials: 'include' })
            .then(r => r.json()).then(d => d.leads || []).catch(() => []))
        )
        setAllLeads(leadArrays.flat())
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [])

  // ── Derived stats ────────────────────────────────────────────────────────────
  const totalLeads    = allLeads.length
  const noSiteLeads   = allLeads.filter(l => l.website_status === 'NO WEBSITE')
  const hasSiteLeads  = allLeads.filter(l => l.website_status !== 'NO WEBSITE')
  const noSitePct     = totalLeads ? Math.round((noSiteLeads.length / totalLeads) * 100) : 0
  const avgScore      = totalLeads ? Math.round(allLeads.reduce((a, l) => a + (l.score || 0), 0) / totalLeads) : 0
  const closedWon     = allLeads.filter(l => l.pipeline_stage === 'Closed Won').length
  const convRate      = totalLeads ? Math.round((closedWon / totalLeads) * 100) : 0

  // Stage distribution
  const stageCounts = allLeads.reduce((acc, l) => {
    const s = l.pipeline_stage || 'New Lead'; acc[s] = (acc[s] || 0) + 1; return acc
  }, {})

  // Top niches by lead count
  const nicheCounts = batches.reduce((acc, b) => {
    acc[b.query] = (acc[b.query] || 0) + b.lead_count; return acc
  }, {})
  const nicheData = Object.entries(nicheCounts).map(([query, count]) => ({ query, count }))

  // Top niches by no-website rate
  const nicheNoSite = batches.reduce((acc, b) => {
    if (!acc[b.query]) acc[b.query] = { total: 0, noSite: 0 }
    acc[b.query].total += b.lead_count; acc[b.query].noSite += b.no_site; return acc
  }, {})
  const nicheOpportunity = Object.entries(nicheNoSite)
    .map(([query, d]) => ({ query, pct: d.total ? Math.round((d.noSite / d.total) * 100) : 0 }))
    .filter(d => d.pct > 0)
    .sort((a, b) => b.pct - a.pct)
    .slice(0, 8)

  // City breakdown
  const cityData = batches.reduce((acc, b) => {
    const city = b.location.split(',')[0]
    if (!acc[city]) acc[city] = { city, leads: 0, noSite: 0 }
    acc[city].leads += b.lead_count; acc[city].noSite += b.no_site; return acc
  }, {})
  const cityArr = Object.values(cityData).sort((a, b) => b.leads - a.leads).slice(0, 6)

  // Score distribution buckets
  const scoreBuckets = [
    { label: '80–100', count: allLeads.filter(l => (l.score || 0) >= 80).length, color: '#4ade80' },
    { label: '60–79',  count: allLeads.filter(l => (l.score || 0) >= 60 && (l.score || 0) < 80).length, color: '#a78bfa' },
    { label: '40–59',  count: allLeads.filter(l => (l.score || 0) >= 40 && (l.score || 0) < 60).length, color: '#fb923c' },
    { label: '0–39',   count: allLeads.filter(l => (l.score || 0) < 40).length, color: '#f87171' },
  ]
  const maxBucket = Math.max(...scoreBuckets.map(b => b.count), 1)

  // Recent batches timeline
  const recentBatches = [...batches].slice(0, 6)

  return (
    <div style={{ minHeight: '100vh', background: '#09090f', color: '#fafafa', fontFamily: "'Outfit', sans-serif", overflowX: 'hidden' }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@400;500;600;700;800;900&family=JetBrains+Mono:wght@400;700&display=swap');
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        html, body { scrollbar-width: none; }
        html::-webkit-scrollbar { display: none; }
        @keyframes fadeUp { from{opacity:0;transform:translateY(16px)} to{opacity:1;transform:translateY(0)} }
        @keyframes pulse  { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:0.4;transform:scale(0.8)} }
        @keyframes spin   { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }
        .nav-link { background:none;border:none;color:#3f3f46;font-size:14px;cursor:pointer;font-family:'Outfit',sans-serif;transition:color 0.2s;padding:0; }
        .nav-link:hover { color:#a1a1aa; }
        .nav-link.active { color:#fafafa; font-weight:600; }
        .card { background:rgba(255,255,255,0.02);border:1px solid rgba(255,255,255,0.05);border-radius:16px;padding:22px 24px;position:relative;overflow:hidden; }
      `}</style>

      <ParticleCanvas />
      <div style={{ position:'fixed',inset:0,zIndex:0,pointerEvents:'none',opacity:0.3,backgroundImage:'linear-gradient(rgba(139,92,246,0.04) 1px,transparent 1px),linear-gradient(90deg,rgba(139,92,246,0.04) 1px,transparent 1px)',backgroundSize:'72px 72px',maskImage:'radial-gradient(ellipse 100% 55% at 50% 0%,black 0%,transparent 100%)' }} />

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
            <button className="nav-link active">Analytics</button>
          </div>
        </div>
        <NavbarDropdown />
      </nav>

      <div style={{ position:'relative',zIndex:1,maxWidth:1280,margin:'0 auto',padding:'48px 48px 80px' }}>

        {/* Header */}
        <div style={{ marginBottom:36, animation:'fadeUp 0.5s cubic-bezier(0.16,1,0.3,1) 0.05s both' }}>
          <div style={{ display:'inline-flex',alignItems:'center',gap:7,background:'rgba(139,92,246,0.08)',border:'1px solid rgba(139,92,246,0.18)',borderRadius:6,padding:'4px 12px',marginBottom:14 }}>
            <div style={{ width:5,height:5,borderRadius:'50%',background:'#8b5cf6',animation:'pulse 1.5s infinite' }} />
            <span style={{ color:'#a78bfa',fontSize:'0.64rem',fontWeight:700,letterSpacing:'2px',textTransform:'uppercase',fontFamily:"'JetBrains Mono',monospace" }}>Intelligence</span>
          </div>
          <h1 style={{ fontSize:'clamp(1.8rem,3vw,2.6rem)',fontWeight:900,letterSpacing:'-1.5px',color:'#fafafa',marginBottom:6 }}>Analytics</h1>
          <p style={{ color:'#52525b',fontSize:15 }}>{batches.length} batches · {totalLeads} leads tracked</p>
        </div>

        {loading ? (
          <div style={{ display:'flex',justifyContent:'center',paddingTop:80 }}>
            <div style={{ width:18,height:18,border:'2px solid rgba(139,92,246,0.3)',borderTopColor:'#8b5cf6',borderRadius:'50%',animation:'spin 0.8s linear infinite' }} />
          </div>
        ) : totalLeads === 0 ? (
          <div style={{ textAlign:'center',paddingTop:80 }}>
            <div style={{ fontSize:13,color:'#3f3f46',fontFamily:"'JetBrains Mono',monospace",marginBottom:16 }}>— No data yet — run some scrapes first —</div>
            <button onClick={() => navigate('/leads')} style={{ background:'linear-gradient(135deg,#8b5cf6,#6366f1)',border:'none',borderRadius:9,padding:'10px 22px',color:'#fff',fontSize:13,fontWeight:700,cursor:'pointer',fontFamily:"'Outfit',sans-serif" }}>Go scrape some leads →</button>
          </div>
        ) : (
          <>
            {/* ── Top stat cards ─────────────────────────────────────────── */}
            <div style={{ display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:12,marginBottom:24 }}>
              <StatCard icon={Users}    label="Total Leads"    value={totalLeads}       sub={`${batches.length} batches`}        accent="#8b5cf6" delay={0.08} />
              <StatCard icon={Target}   label="No Website"     value={noSiteLeads.length} sub={`${noSitePct}% of all leads`}     accent="#f87171" delay={0.14} />
              <StatCard icon={BarChart2} label="Avg Score"     value={avgScore}         sub="across all leads"                   accent="#4ade80" delay={0.20} />
              <StatCard icon={TrendingUp} label="Closed Won"   value={closedWon}        sub={`${convRate}% conversion`}          accent="#fb923c" delay={0.26} />
            </div>

            {/* ── Row 2: Pipeline funnel + Score distribution ─────────────── */}
            <div style={{ display:'grid',gridTemplateColumns:'1fr 1fr',gap:16,marginBottom:16 }}>

              {/* Pipeline funnel */}
              <div className="card" style={{ animation:'fadeUp 0.5s cubic-bezier(0.16,1,0.3,1) 0.3s both' }}>
                <div style={{ position:'absolute',top:0,left:0,right:0,height:1,background:'linear-gradient(90deg,transparent,rgba(139,92,246,0.5),transparent)' }} />
                <div style={{ display:'flex',alignItems:'center',gap:8,marginBottom:20 }}>
                  <Zap size={13} color="#8b5cf6" strokeWidth={1.5} />
                  <span style={{ fontSize:13,fontWeight:700,color:'#e4e4e7' }}>Pipeline Stages</span>
                  <span style={{ fontSize:11,color:'#3f3f46',marginLeft:'auto',fontFamily:"'JetBrains Mono',monospace" }}>{totalLeads} total</span>
                </div>
                <PipelineFunnel stageCounts={stageCounts} />
              </div>

              {/* Score distribution */}
              <div className="card" style={{ animation:'fadeUp 0.5s cubic-bezier(0.16,1,0.3,1) 0.36s both' }}>
                <div style={{ position:'absolute',top:0,left:0,right:0,height:1,background:'linear-gradient(90deg,transparent,rgba(74,222,128,0.5),transparent)' }} />
                <div style={{ display:'flex',alignItems:'center',gap:8,marginBottom:20 }}>
                  <BarChart2 size={13} color="#4ade80" strokeWidth={1.5} />
                  <span style={{ fontSize:13,fontWeight:700,color:'#e4e4e7' }}>Score Distribution</span>
                </div>
                <div style={{ display:'flex',flexDirection:'column',gap:10 }}>
                  {scoreBuckets.map(b => (
                    <div key={b.label} style={{ display:'flex',alignItems:'center',gap:12 }}>
                      <div style={{ width:50,flexShrink:0,fontSize:11,color:b.color,fontFamily:"'JetBrains Mono',monospace",fontWeight:700 }}>{b.label}</div>
                      <div style={{ flex:1,height:22,background:'rgba(255,255,255,0.03)',borderRadius:5,overflow:'hidden',position:'relative' }}>
                        <div style={{ height:'100%',width:`${(b.count/maxBucket)*100}%`,background:`${b.color}20`,borderLeft:`2px solid ${b.color}`,borderRadius:5,transition:'width 0.8s cubic-bezier(0.16,1,0.3,1)',display:'flex',alignItems:'center',paddingLeft:8 }}>
                          {b.count > 0 && <span style={{ fontSize:10,color:b.color,fontFamily:"'JetBrains Mono',monospace",fontWeight:700 }}>{b.count}</span>}
                        </div>
                      </div>
                      <div style={{ width:28,flexShrink:0,textAlign:'right',fontSize:11,color:'#52525b',fontFamily:"'JetBrains Mono',monospace" }}>{totalLeads ? Math.round((b.count/totalLeads)*100) : 0}%</div>
                    </div>
                  ))}
                </div>
                <div style={{ marginTop:16,paddingTop:14,borderTop:'1px solid rgba(255,255,255,0.05)',display:'flex',justifyContent:'space-between' }}>
                  <span style={{ fontSize:11,color:'#3f3f46',fontFamily:"'JetBrains Mono',monospace" }}>website status split</span>
                  <div style={{ display:'flex',gap:14 }}>
                    <span style={{ fontSize:11,color:'#f87171',fontFamily:"'JetBrains Mono',monospace" }}>🚫 {noSiteLeads.length} no site</span>
                    <span style={{ fontSize:11,color:'#a78bfa',fontFamily:"'JetBrains Mono',monospace" }}>🌐 {hasSiteLeads.length} has site</span>
                  </div>
                </div>
              </div>
            </div>

            {/* ── Row 3: Top niches + Opportunity niches ─────────────────── */}
            <div style={{ display:'grid',gridTemplateColumns:'1fr 1fr',gap:16,marginBottom:16 }}>
              <div className="card" style={{ animation:'fadeUp 0.5s cubic-bezier(0.16,1,0.3,1) 0.4s both' }}>
                <div style={{ position:'absolute',top:0,left:0,right:0,height:1,background:'linear-gradient(90deg,transparent,rgba(139,92,246,0.5),transparent)' }} />
                <div style={{ display:'flex',alignItems:'center',gap:8,marginBottom:20 }}>
                  <Users size={13} color="#8b5cf6" strokeWidth={1.5} />
                  <span style={{ fontSize:13,fontWeight:700,color:'#e4e4e7' }}>Top Niches by Volume</span>
                </div>
                <BarChart data={nicheData} valueKey="count" labelKey="query" color="#8b5cf6" />
              </div>

              <div className="card" style={{ animation:'fadeUp 0.5s cubic-bezier(0.16,1,0.3,1) 0.46s both' }}>
                <div style={{ position:'absolute',top:0,left:0,right:0,height:1,background:'linear-gradient(90deg,transparent,rgba(248,113,113,0.5),transparent)' }} />
                <div style={{ display:'flex',alignItems:'center',gap:8,marginBottom:20 }}>
                  <Target size={13} color="#f87171" strokeWidth={1.5} />
                  <span style={{ fontSize:13,fontWeight:700,color:'#e4e4e7' }}>Best Niches</span>
                  <span style={{ fontSize:10,color:'#3f3f46',fontFamily:"'JetBrains Mono',monospace",marginLeft:'auto' }}>% no website</span>
                </div>
                {nicheOpportunity.length === 0 ? (
                  <div style={{ fontSize:12,color:'#3f3f46',fontFamily:"'JetBrains Mono',monospace" }}>— not enough data yet —</div>
                ) : (
                  <div style={{ display:'flex',flexDirection:'column',gap:8 }}>
                    {nicheOpportunity.map((n, i) => (
                      <div key={i} style={{ display:'flex',alignItems:'center',gap:10 }}>
                        <div style={{ width:130,flexShrink:0,fontSize:12,color:'#71717a',whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis' }}>{n.query}</div>
                        <div style={{ flex:1,height:6,background:'rgba(255,255,255,0.04)',borderRadius:3,overflow:'hidden' }}>
                          <div style={{ height:'100%',borderRadius:3,width:`${n.pct}%`,background:`linear-gradient(90deg,#f87171,#fb923c)`,transition:'width 0.8s cubic-bezier(0.16,1,0.3,1)' }} />
                        </div>
                        <div style={{ width:36,flexShrink:0,textAlign:'right',fontSize:11,fontWeight:700,color:'#f87171',fontFamily:"'JetBrains Mono',monospace" }}>{n.pct}%</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* ── Row 4: City breakdown + Recent batches ──────────────────── */}
            <div style={{ display:'grid',gridTemplateColumns:'1fr 1fr',gap:16 }}>
              <div className="card" style={{ animation:'fadeUp 0.5s cubic-bezier(0.16,1,0.3,1) 0.5s both' }}>
                <div style={{ position:'absolute',top:0,left:0,right:0,height:1,background:'linear-gradient(90deg,transparent,rgba(251,146,60,0.5),transparent)' }} />
                <div style={{ display:'flex',alignItems:'center',gap:8,marginBottom:20 }}>
                  <MapPin size={13} color="#fb923c" strokeWidth={1.5} />
                  <span style={{ fontSize:13,fontWeight:700,color:'#e4e4e7' }}>City Breakdown</span>
                </div>
                {cityArr.length === 0 ? (
                  <div style={{ fontSize:12,color:'#3f3f46',fontFamily:"'JetBrains Mono',monospace" }}>— no city data yet —</div>
                ) : (
                  <div style={{ display:'flex',flexDirection:'column',gap:10 }}>
                    {cityArr.map((c, i) => {
                      const pct = c.leads ? Math.round((c.noSite/c.leads)*100) : 0
                      return (
                        <div key={i} style={{ display:'flex',alignItems:'center',gap:10 }}>
                          <div style={{ width:110,flexShrink:0,fontSize:12,color:'#71717a',whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis' }}>{c.city}</div>
                          <div style={{ flex:1 }}>
                            <div style={{ display:'flex',justifyContent:'space-between',marginBottom:3 }}>
                              <span style={{ fontSize:10,color:'#3f3f46',fontFamily:"'JetBrains Mono',monospace" }}>{c.leads} leads</span>
                              <span style={{ fontSize:10,color:'#f87171',fontFamily:"'JetBrains Mono',monospace" }}>{pct}% no site</span>
                            </div>
                            <div style={{ height:4,background:'rgba(255,255,255,0.04)',borderRadius:2,overflow:'hidden' }}>
                              <div style={{ height:'100%',width:`${pct}%`,background:'linear-gradient(90deg,#f87171,#fb923c)',borderRadius:2,transition:'width 0.8s cubic-bezier(0.16,1,0.3,1)' }} />
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>

              {/* Recent batches */}
              <div className="card" style={{ animation:'fadeUp 0.5s cubic-bezier(0.16,1,0.3,1) 0.56s both' }}>
                <div style={{ position:'absolute',top:0,left:0,right:0,height:1,background:'linear-gradient(90deg,transparent,rgba(74,222,128,0.5),transparent)' }} />
                <div style={{ display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:20 }}>
                  <div style={{ display:'flex',alignItems:'center',gap:8 }}>
                    <TrendingUp size={13} color="#4ade80" strokeWidth={1.5} />
                    <span style={{ fontSize:13,fontWeight:700,color:'#e4e4e7' }}>Recent Scrapes</span>
                  </div>
                  <button onClick={() => navigate('/batches')} style={{ display:'flex',alignItems:'center',gap:4,background:'none',border:'none',cursor:'pointer',color:'#3f3f46',fontSize:11,fontFamily:"'Outfit',sans-serif",transition:'color 0.2s' }} onMouseEnter={e=>e.currentTarget.style.color='#a78bfa'} onMouseLeave={e=>e.currentTarget.style.color='#3f3f46'}>
                    View all <ChevronRight size={11} />
                  </button>
                </div>
                <div style={{ display:'flex',flexDirection:'column',gap:8 }}>
                  {recentBatches.map(b => {
                    const date = b.created_at ? new Date(b.created_at).toLocaleDateString('en-US',{month:'short',day:'numeric'}) : '—'
                    const noSitePctB = b.lead_count ? Math.round((b.no_site/b.lead_count)*100) : 0
                    return (
                      <div key={b.id} onClick={() => navigate('/batches')}
                        style={{ display:'flex',alignItems:'center',gap:10,padding:'8px 10px',borderRadius:9,cursor:'pointer',transition:'background 0.15s' }}
                        onMouseEnter={e=>e.currentTarget.style.background='rgba(139,92,246,0.05)'}
                        onMouseLeave={e=>e.currentTarget.style.background='transparent'}>
                        <div style={{ flex:1,minWidth:0 }}>
                          <div style={{ fontSize:12,fontWeight:600,color:'#e4e4e7',whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis' }}>{b.query}</div>
                          <div style={{ fontSize:10,color:'#52525b',marginTop:1 }}>{b.location}</div>
                        </div>
                        <div style={{ display:'flex',gap:10,flexShrink:0 }}>
                          <span style={{ fontSize:11,color:'#fafafa',fontFamily:"'JetBrains Mono',monospace",fontWeight:700 }}>{b.lead_count}</span>
                          <span style={{ fontSize:11,color:'#f87171',fontFamily:"'JetBrains Mono',monospace" }}>{noSitePctB}%</span>
                          <span style={{ fontSize:10,color:'#27272a',fontFamily:"'JetBrains Mono',monospace" }}>{date}</span>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}