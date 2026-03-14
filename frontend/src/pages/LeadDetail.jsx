import { useState, useEffect, useRef } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
    ArrowLeft, MapPin, Phone, Star, AlertTriangle, ExternalLink,
    BarChart2, Clock, Tag, Globe, FileText, Video, Mail,
    ChevronDown, CheckCircle2, Circle, StickyNote, Check, X,
    Info, Building2, PhoneCall, PhoneOff, PhoneMissed,
    ThumbsUp, ThumbsDown, CalendarClock,
} from 'lucide-react'
import NavbarDropdown from '../components/NavbarDropdown'
import ReactDOM from 'react-dom'
const API = 'http://127.0.0.1:8000'

const STAGES = ['New Lead', 'Contacted', 'Interested', 'Proposal Sent', 'Closed Won', 'Closed Lost']
const STAGE_STYLE = {
    'New Lead':      { bg: 'rgba(99,102,241,0.12)',  border: 'rgba(99,102,241,0.3)',  color: '#818cf8' },
    'Contacted':     { bg: 'rgba(251,146,60,0.12)',  border: 'rgba(251,146,60,0.3)',  color: '#fb923c' },
    'Interested':    { bg: 'rgba(234,179,8,0.12)',   border: 'rgba(234,179,8,0.3)',   color: '#eab308' },
    'Proposal Sent': { bg: 'rgba(139,92,246,0.12)',  border: 'rgba(139,92,246,0.3)',  color: '#a78bfa' },
    'Closed Won':    { bg: 'rgba(74,222,128,0.12)',  border: 'rgba(74,222,128,0.3)',  color: '#4ade80' },
    'Closed Lost':   { bg: 'rgba(248,113,113,0.12)', border: 'rgba(248,113,113,0.3)', color: '#f87171' },
}

// ─── Call outcome config ──────────────────────────────────────────────────────
const CALL_OUTCOMES = [
    { key: 'Interested',      label: 'Interested',      icon: ThumbsUp,      color: '#4ade80', bg: 'rgba(74,222,128,0.08)',   border: 'rgba(74,222,128,0.25)'   },
    { key: 'Not Interested',  label: 'Not Interested',  icon: ThumbsDown,    color: '#f87171', bg: 'rgba(248,113,113,0.08)',  border: 'rgba(248,113,113,0.25)'  },
    { key: 'Call Later',      label: 'Call Later',      icon: CalendarClock, color: '#eab308', bg: 'rgba(234,179,8,0.08)',    border: 'rgba(234,179,8,0.25)'    },
    { key: 'No Answer',       label: 'No Answer',       icon: PhoneMissed,   color: '#fb923c', bg: 'rgba(251,146,60,0.08)',   border: 'rgba(251,146,60,0.25)'   },
    { key: 'Wrong Number',    label: 'Wrong Number',    icon: PhoneOff,      color: '#71717a', bg: 'rgba(113,113,122,0.08)',  border: 'rgba(113,113,122,0.25)'  },
]

const outcomeStyle = key => CALL_OUTCOMES.find(o => o.key === key) || null

const scoreColor = s => s >= 75 ? '#4ade80' : s >= 50 ? '#fb923c' : '#f87171'

const HIGH_URGENCY = new Set([
    'restaurant','food truck','cafe','bakery','pizza','sushi','mexican','chinese',
    'thai','indian','italian','burger','sandwich','catering','auto repair','auto body',
    'mechanic','plumber','plumbing','hvac','roofing','roofer','landscaping','lawn care',
    'electrician','contractor','hair salon','barbershop','barber','nail salon','spa',
    'massage','dentist','chiropractor','veterinarian','vet','pet grooming',
    'cleaning','pest control','tree service','painter','handyman',
])
const MEDIUM_URGENCY = new Set([
    'gym','fitness','yoga','pilates','martial arts','dance','accountant','tax',
    'insurance','real estate','florist','photographer','videographer','printing',
    'locksmith','dry cleaner','tailor','shoe repair','laundry',
])

function calcBreakdown(lead) {
    const signals = []
    const noSite = lead.website_status === 'NO WEBSITE'
    signals.push({ label:'No website', pts:noSite?35:0, max:35, earned:noSite, detail:noSite?'Confirmed no website':'Has a website' })
    const r = parseFloat(lead.rating)||0
    let rPts=0,rDetail='No rating data'
    if(r>=4.8){rPts=20;rDetail=`${r}★ — exceptional`}
    else if(r>=4.5){rPts=14;rDetail=`${r}★ — excellent`}
    else if(r>=4.0){rPts=8;rDetail=`${r}★ — good`}
    else if(r>=3.5){rPts=3;rDetail=`${r}★ — average`}
    else if(r>0){rPts=0;rDetail=`${r}★ — below average`}
    signals.push({ label:'Rating', pts:rPts, max:20, earned:rPts>0, detail:rDetail })
    const rc = parseInt(lead.review_count)||0
    let rcPts=0,rcDetail='No reviews found'
    if(rc>=200){rcPts=15;rcDetail=`${rc} reviews`}
    else if(rc>=100){rcPts=12;rcDetail=`${rc} reviews`}
    else if(rc>=50){rcPts=8;rcDetail=`${rc} reviews`}
    else if(rc>=20){rcPts=4;rcDetail=`${rc} reviews`}
    else if(rc>0){rcPts=0;rcDetail=`${rc} reviews`}
    signals.push({ label:'Review count', pts:rcPts, max:15, earned:rcPts>0, detail:rcDetail })
    const age = parseInt(lead.business_age_years)||0
    let agePts=0,ageDetail='Age unknown'
    if(age>=7){agePts=12;ageDetail=`${age} yrs — very established`}
    else if(age>=5){agePts=9;ageDetail=`${age} yrs — established`}
    else if(age>=3){agePts=6;ageDetail=`${age} yrs — growing`}
    else if(age>=1){agePts=3;ageDetail=`${age} yrs — newer`}
    signals.push({ label:'Business age', pts:agePts, max:12, earned:agePts>0, detail:ageDetail })
    const catText=(lead.category||'').toLowerCase()
    let catPts=0,catDetail='Standard category'
    for(const kw of HIGH_URGENCY){if(catText.includes(kw)){catPts=10;catDetail='High urgency niche';break}}
    if(!catPts)for(const kw of MEDIUM_URGENCY){if(catText.includes(kw)){catPts=5;catDetail='Medium urgency niche';break}}
    signals.push({ label:'Category urgency', pts:catPts, max:10, earned:catPts>0, detail:catDetail })
    const hasPhone=!!(lead.phone||'').trim()
    signals.push({ label:'Phone present', pts:hasPhone?4:0, max:4, earned:hasPhone, detail:hasPhone?lead.phone:'No phone found' })
    const hasAddr=!!(lead.address||'').trim()
    signals.push({ label:'Address present', pts:hasAddr?4:0, max:4, earned:hasAddr, detail:hasAddr?'Confirmed':'No address' })
    const total=signals.reduce((s,x)=>s+x.pts,0)
    return { signals, total }
}

// ─── Particle Canvas ──────────────────────────────────────────────────────────
function ParticleCanvas() {
    const ref = useRef(null)
    useEffect(() => {
        const canvas=ref.current,ctx=canvas.getContext('2d');let id
        const resize=()=>{canvas.width=window.innerWidth;canvas.height=window.innerHeight}
        resize();window.addEventListener('resize',resize)
        const pts=Array.from({length:40},()=>({x:Math.random()*window.innerWidth,y:Math.random()*window.innerHeight,r:Math.random()*0.8+0.2,s:Math.random()*0.15+0.03,o:Math.random()*0.1+0.02,hue:Math.random()>0.5?'139,92,246':'99,102,241'}))
        const draw=()=>{ctx.clearRect(0,0,canvas.width,canvas.height);pts.forEach(p=>{p.y-=p.s;if(p.y<-2){p.y=canvas.height+2;p.x=Math.random()*canvas.width}ctx.beginPath();ctx.arc(p.x,p.y,p.r,0,Math.PI*2);ctx.fillStyle=`rgba(${p.hue},${p.o})`;ctx.fill()});id=requestAnimationFrame(draw)}
        draw();return()=>{cancelAnimationFrame(id);window.removeEventListener('resize',resize)}
    },[])
    return <canvas ref={ref} style={{position:'fixed',inset:0,zIndex:0,pointerEvents:'none'}}/>
}

// ─── Stage Dropdown (fixed solid bg) ─────────────────────────────────────────
function StageDropdown({ stage, onChange }) {
    const [open, setOpen] = useState(false)
    const [pos, setPos]   = useState({ top: 0, left: 0 })
    const triggerRef = useRef(null)
    const menuRef    = useRef(null)
    const s = STAGE_STYLE[stage] || STAGE_STYLE['New Lead']

    useEffect(() => {
        const h = e => {
            if (menuRef.current && !menuRef.current.contains(e.target) &&
                triggerRef.current && !triggerRef.current.contains(e.target)) {
                setOpen(false)
            }
        }
        document.addEventListener('mousedown', h)
        return () => document.removeEventListener('mousedown', h)
    }, [])

    const handleOpen = () => {
        if (!open) {
            const rect = triggerRef.current.getBoundingClientRect()
            setPos({ top: rect.bottom + window.scrollY + 5, left: rect.left + window.scrollX })
        }
        setOpen(o => !o)
    }

    return (
        <>
            <div ref={triggerRef} onClick={handleOpen}
                style={{display:'inline-flex',alignItems:'center',gap:6,cursor:'pointer',background:s.bg,border:`1px solid ${s.border}`,borderRadius:20,padding:'6px 14px',fontSize:12,color:s.color,fontFamily:"'JetBrains Mono',monospace",userSelect:'none',whiteSpace:'nowrap',fontWeight:700}}>
                {stage || 'New Lead'}
                <ChevronDown size={11} style={{transform:open?'rotate(180deg)':'none',transition:'transform 0.2s'}}/>
            </div>

            {open && ReactDOM.createPortal(
                <div ref={menuRef} style={{position:'absolute',top:pos.top,left:pos.left,zIndex:99999,background:'#111118',border:'1px solid rgba(255,255,255,0.1)',borderRadius:10,padding:4,minWidth:170,boxShadow:'0 24px 60px rgba(0,0,0,0.95)'}}>
                    {STAGES.map(st => {
                        const c = STAGE_STYLE[st], active = st === (stage || 'New Lead')
                        return (
                            <div key={st} onClick={() => { onChange(st); setOpen(false) }}
                                style={{padding:'9px 12px',borderRadius:7,fontSize:12,cursor:'pointer',color:active?c.color:'#a1a1aa',background:active?c.bg:'transparent',fontFamily:"'JetBrains Mono',monospace",display:'flex',alignItems:'center',gap:8,transition:'background 0.12s',whiteSpace:'nowrap'}}
                                onMouseEnter={e => { if(!active) e.currentTarget.style.background='rgba(255,255,255,0.06)' }}
                                onMouseLeave={e => { if(!active) e.currentTarget.style.background='transparent' }}>
                                {active ? <CheckCircle2 size={11}/> : <Circle size={11}/>}{st}
                            </div>
                        )
                    })}
                </div>,
                document.body
            )}
        </>
    )
}

// ─── Call Log section ─────────────────────────────────────────────────────────
function CallLog({ lead, onOutcomeSet }) {
    const [saving, setSaving] = useState(null)

    const setOutcome = async (key) => {
        setSaving(key)
        await fetch(`${API}/leads/${lead.id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ call_outcome: key }),
        }).catch(() => {})
        onOutcomeSet(key)
        setSaving(null)
    }

    const current = outcomeStyle(lead.call_outcome)
    const callTime = lead.call_outcome_at
        ? new Date(lead.call_outcome_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
        : null

    return (
        <div>
            {/* Current outcome badge */}
            {current && (
                <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:14,padding:'10px 14px',background:current.bg,border:`1px solid ${current.border}`,borderRadius:10}}>
                    <div style={{display:'flex',alignItems:'center',gap:8}}>
                        <current.icon size={13} color={current.color} strokeWidth={1.5}/>
                        <span style={{fontSize:12,fontWeight:700,color:current.color,fontFamily:"'JetBrains Mono',monospace"}}>Last: {current.label}</span>
                    </div>
                    {callTime && <span style={{fontSize:10,color:'#52525b',fontFamily:"'JetBrains Mono',monospace"}}>{callTime}</span>}
                </div>
            )}

            {/* Outcome buttons */}
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8}}>
                {CALL_OUTCOMES.map(o => {
                    const isActive = lead.call_outcome === o.key
                    const isLoading = saving === o.key
                    return (
                        <button key={o.key} onClick={() => setOutcome(o.key)} disabled={!!saving}
                            style={{display:'flex',alignItems:'center',gap:7,padding:'9px 12px',borderRadius:10,cursor:saving?'wait':'pointer',fontFamily:"'Outfit',sans-serif",fontSize:12,fontWeight:600,transition:'all 0.15s',background:isActive?o.bg:'rgba(255,255,255,0.03)',border:`1px solid ${isActive?o.border:'rgba(255,255,255,0.07)'}`,color:isActive?o.color:'#71717a',opacity:saving&&!isLoading?0.5:1}}
                            onMouseEnter={e => { if(!saving) { e.currentTarget.style.background=o.bg; e.currentTarget.style.borderColor=o.border; e.currentTarget.style.color=o.color } }}
                            onMouseLeave={e => { if(!isActive) { e.currentTarget.style.background='rgba(255,255,255,0.03)'; e.currentTarget.style.borderColor='rgba(255,255,255,0.07)'; e.currentTarget.style.color='#71717a' } }}>
                            {isLoading
                                ? <div style={{width:12,height:12,border:'2px solid rgba(255,255,255,0.2)',borderTopColor:'#fff',borderRadius:'50%',animation:'spin 0.6s linear infinite'}}/>
                                : <o.icon size={12} strokeWidth={1.5}/>
                            }
                            {o.label}
                            {isActive && <CheckCircle2 size={10} style={{marginLeft:'auto'}}/>}
                        </button>
                    )
                })}
            </div>
        </div>
    )
}

// ─── Notes editor ─────────────────────────────────────────────────────────────
function NotesEditor({ lead, onSave }) {
    const [text, setText] = useState(lead.notes || '')
    const [saving, setSaving] = useState(false)
    const [saved, setSaved] = useState(false)

    const save = async () => {
        setSaving(true)
        await fetch(`${API}/leads/${lead.id}`, {
            method: 'PATCH', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
            body: JSON.stringify({ notes: text }),
        }).catch(() => {})
        onSave(text)
        setSaving(false); setSaved(true)
        setTimeout(() => setSaved(false), 2000)
    }

    return (
        <div>
            <textarea value={text} onChange={e => setText(e.target.value)}
                placeholder="Add notes about this lead — call outcomes, objections, what they said..."
                style={{width:'100%',height:120,background:'rgba(255,255,255,0.03)',border:'1px solid rgba(255,255,255,0.08)',borderRadius:10,padding:'12px 14px',color:'#e4e4e7',fontSize:13,fontFamily:"'Outfit',sans-serif",resize:'none',outline:'none',lineHeight:1.6,transition:'border-color 0.2s'}}
                onFocus={e => e.currentTarget.style.borderColor='rgba(139,92,246,0.5)'}
                onBlur={e => e.currentTarget.style.borderColor='rgba(255,255,255,0.08)'}/>
            <div style={{display:'flex',justifyContent:'flex-end',marginTop:8}}>
                <button onClick={save} disabled={saving}
                    style={{display:'flex',alignItems:'center',gap:6,background:saved?'rgba(74,222,128,0.1)':'linear-gradient(135deg,#8b5cf6,#6366f1)',border:saved?'1px solid rgba(74,222,128,0.3)':'none',borderRadius:8,padding:'7px 16px',color:saved?'#4ade80':'#fff',fontSize:12,fontWeight:700,cursor:'pointer',fontFamily:"'Outfit',sans-serif",transition:'all 0.2s',opacity:saving?0.6:1}}>
                    {saved ? <><Check size={11}/> Saved!</> : saving ? 'Saving...' : <><StickyNote size={11}/> Save Notes</>}
                </button>
            </div>
        </div>
    )
}

// ─── Action Card ──────────────────────────────────────────────────────────────
function ActionCard({ icon: Icon, title, description, accent, badge, onClick, disabled }) {
    return (
        <div style={{background:'rgba(255,255,255,0.02)',border:'1px solid rgba(255,255,255,0.06)',borderRadius:14,padding:'16px 18px',position:'relative',overflow:'hidden',transition:'border-color 0.2s,transform 0.15s',cursor:disabled?'default':'pointer'}}
            onMouseEnter={e => { if(!disabled) { e.currentTarget.style.borderColor=`${accent}40`; e.currentTarget.style.transform='translateY(-1px)' } }}
            onMouseLeave={e => { e.currentTarget.style.borderColor='rgba(255,255,255,0.06)'; e.currentTarget.style.transform='translateY(0)' }}
            onClick={!disabled ? onClick : undefined}>
            <div style={{position:'absolute',top:0,left:0,right:0,height:1,background:`linear-gradient(90deg,transparent,${accent}50,transparent)`}}/>
            <div style={{display:'flex',alignItems:'center',justifyContent:'space-between'}}>
                <div style={{display:'flex',alignItems:'center',gap:10}}>
                    <div style={{width:32,height:32,borderRadius:9,background:`${accent}15`,border:`1px solid ${accent}25`,display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>
                        <Icon size={14} color={accent} strokeWidth={1.5}/>
                    </div>
                    <div>
                        <div style={{fontSize:13,fontWeight:700,color:'#e4e4e7',display:'flex',alignItems:'center',gap:7}}>
                            {title}
                            {badge && <span style={{fontSize:9,background:`${accent}18`,border:`1px solid ${accent}30`,borderRadius:20,padding:'2px 7px',color:accent,fontFamily:"'JetBrains Mono',monospace",fontWeight:700}}>{badge}</span>}
                        </div>
                        <div style={{fontSize:11,color:'#52525b',marginTop:1}}>{description}</div>
                    </div>
                </div>
                {disabled
                    ? <span style={{fontSize:10,color:'#3f3f46',fontFamily:"'JetBrains Mono',monospace",background:'rgba(255,255,255,0.03)',border:'1px solid rgba(255,255,255,0.06)',borderRadius:20,padding:'3px 8px',flexShrink:0}}>soon</span>
                    : <div style={{width:26,height:26,borderRadius:7,background:`${accent}10`,border:`1px solid ${accent}20`,display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>
                        <ExternalLink size={10} color={accent} strokeWidth={1.5}/>
                      </div>
                }
            </div>
        </div>
    )
}

// ─── Score Ring ───────────────────────────────────────────────────────────────
function ScoreRing({ score }) {
    const color = scoreColor(score)
    const r = 36, circ = 2 * Math.PI * r
    return (
        <div style={{position:'relative',width:96,height:96,flexShrink:0}}>
            <svg width={96} height={96} style={{transform:'rotate(-90deg)'}}>
                <circle cx={48} cy={48} r={r} fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth={6}/>
                <circle cx={48} cy={48} r={r} fill="none" stroke={color} strokeWidth={6}
                    strokeDasharray={`${(score/100)*circ} ${circ}`} strokeLinecap="round"
                    style={{transition:'stroke-dasharray 0.8s cubic-bezier(0.16,1,0.3,1)'}}/>
            </svg>
            <div style={{position:'absolute',inset:0,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center'}}>
                <span style={{fontSize:22,fontWeight:900,color,fontFamily:"'JetBrains Mono',monospace",letterSpacing:'-1px',lineHeight:1}}>{score}</span>
                <span style={{fontSize:9,color:'#3f3f46',textTransform:'uppercase',letterSpacing:'0.1em',marginTop:2}}>score</span>
            </div>
        </div>
    )
}

// ─── Main ─────────────────────────────────────────────────────────────────────
export default function LeadDetail() {
    const { id } = useParams()
    const navigate = useNavigate()
    const [lead, setLead]       = useState(null)
    const [loading, setLoading] = useState(true)
    const [notFound, setNotFound] = useState(false)

    useEffect(() => {
        fetch(`${API}/leads/${id}`, { credentials: 'include' })
            .then(r => { if(!r.ok) throw new Error(); return r.json() })
            .then(data => { setLead(data); setLoading(false) })
            .catch(() => { setNotFound(true); setLoading(false) })
    }, [id])

    const handleStageChange = stage => {
        setLead(prev => ({ ...prev, pipeline_stage: stage }))
        fetch(`${API}/leads/${id}`, { method:'PATCH', headers:{'Content-Type':'application/json'}, credentials:'include', body:JSON.stringify({ pipeline_stage: stage }) }).catch(() => {})
    }

    const handleNotesSave  = notes        => setLead(prev => ({ ...prev, notes }))
    const handleOutcomeSet = call_outcome => setLead(prev => ({ ...prev, call_outcome, call_outcome_at: new Date().toISOString() }))

    if(loading) return (
        <div style={{minHeight:'100vh',background:'#09090f',display:'flex',alignItems:'center',justifyContent:'center'}}>
            <div style={{width:20,height:20,border:'2px solid rgba(139,92,246,0.3)',borderTopColor:'#8b5cf6',borderRadius:'50%',animation:'spin 0.8s linear infinite'}}/>
            <style>{`@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}`}</style>
        </div>
    )

    if(notFound) return (
        <div style={{minHeight:'100vh',background:'#09090f',display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',gap:16}}>
            <div style={{fontSize:13,color:'#3f3f46',fontFamily:"'JetBrains Mono',monospace"}}>— Lead not found —</div>
            <button onClick={() => navigate('/batches')} style={{background:'linear-gradient(135deg,#8b5cf6,#6366f1)',border:'none',borderRadius:9,padding:'10px 22px',color:'#fff',fontSize:13,fontWeight:700,cursor:'pointer',fontFamily:"'Outfit',sans-serif"}}>Back to Batches</button>
        </div>
    )

    const { signals, total } = calcBreakdown(lead)
    const noSite = lead.website_status === 'NO WEBSITE'
    const color  = scoreColor(total)
    const filled = Math.round((total / 100) * 5)
    const stageStyle = STAGE_STYLE[lead.pipeline_stage] || STAGE_STYLE['New Lead']
    const currentOutcome = outcomeStyle(lead.call_outcome)

    return (
        <div style={{minHeight:'100vh',background:'#09090f',color:'#fafafa',fontFamily:"'Outfit',sans-serif",overflowX:'hidden'}}>
            <style>{`
                @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@400;500;600;700;800;900&family=JetBrains+Mono:wght@400;700&display=swap');
                *,*::before,*::after{box-sizing:border-box;margin:0;padding:0;}
                html,body{scrollbar-width:none;}
                html::-webkit-scrollbar{display:none;}
                @keyframes fadeUp{from{opacity:0;transform:translateY(16px)}to{opacity:1;transform:translateY(0)}}
                @keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}
                @keyframes pulse{0%,100%{opacity:1;transform:scale(1)}50%{opacity:0.4;transform:scale(0.8)}}
                .nav-link{background:none;border:none;color:#3f3f46;font-size:14px;cursor:pointer;font-family:'Outfit',sans-serif;transition:color 0.2s;padding:0;}
                .nav-link:hover{color:#a1a1aa;}
                .sec-title{font-size:11px;font-weight:700;color:#3f3f46;text-transform:uppercase;letter-spacing:0.1em;font-family:'JetBrains Mono',monospace;margin-bottom:12px;}
            `}</style>

            <ParticleCanvas/>
            <div style={{position:'fixed',inset:0,zIndex:0,pointerEvents:'none',opacity:0.3,backgroundImage:'linear-gradient(rgba(139,92,246,0.04) 1px,transparent 1px),linear-gradient(90deg,rgba(139,92,246,0.04) 1px,transparent 1px)',backgroundSize:'72px 72px',maskImage:'radial-gradient(ellipse 100% 55% at 50% 0%,black 0%,transparent 100%)'}}/>

            {/* NAV */}
            <nav style={{position:'sticky',top:0,zIndex:100,display:'flex',justifyContent:'space-between',alignItems:'center',padding:'0 48px',height:64,background:'rgba(9,9,15,0.82)',backdropFilter:'blur(20px)',borderBottom:'1px solid rgba(255,255,255,0.04)'}}>
                <div style={{display:'flex',alignItems:'center',gap:32}}>
                    <div style={{display:'flex',alignItems:'center',gap:10,cursor:'pointer'}} onClick={() => navigate('/')}>
                        <div style={{width:28,height:28,borderRadius:8,background:'linear-gradient(135deg,#8b5cf6,#6366f1)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:'0.7rem',fontWeight:900,color:'#fff'}}>B</div>
                        <span style={{fontWeight:800,fontSize:'1rem',letterSpacing:'-0.5px',color:'#f4f4f5'}}>BizScout</span>
                    </div>
                    <div style={{display:'flex',gap:24}}>
                        <button className="nav-link" onClick={() => navigate('/leads')}>Leads</button>
                        <button className="nav-link" onClick={() => navigate('/batches')}>Batches</button>
                        <button className="nav-link" onClick={() => navigate('/pipeline')}>Pipeline</button>
                        <button className="nav-link" onClick={() => navigate('/analytics')}>Analytics</button>
                    </div>
                </div>
                <NavbarDropdown/>
            </nav>

            <div style={{position:'relative',zIndex:1,maxWidth:1280,margin:'0 auto',padding:'40px 48px 80px'}}>

                {/* Back + hero */}
                <div style={{marginBottom:32,animation:'fadeUp 0.5s cubic-bezier(0.16,1,0.3,1) 0.05s both'}}>
                    <button onClick={() => navigate(-1)}
                        style={{display:'inline-flex',alignItems:'center',gap:6,background:'rgba(255,255,255,0.03)',border:'1px solid rgba(255,255,255,0.07)',borderRadius:8,padding:'7px 14px',color:'#71717a',fontSize:13,cursor:'pointer',fontFamily:"'Outfit',sans-serif",marginBottom:20,transition:'color 0.2s'}}
                        onMouseEnter={e => e.currentTarget.style.color='#a1a1aa'}
                        onMouseLeave={e => e.currentTarget.style.color='#71717a'}>
                        <ArrowLeft size={13}/> Back
                    </button>

                    <div style={{display:'flex',alignItems:'flex-start',gap:20,flexWrap:'wrap'}}>
                        <div style={{width:56,height:56,borderRadius:14,flexShrink:0,background:noSite?'rgba(248,113,113,0.08)':'rgba(139,92,246,0.08)',border:`1px solid ${noSite?'rgba(248,113,113,0.18)':'rgba(139,92,246,0.18)'}`,display:'flex',alignItems:'center',justifyContent:'center'}}>
                            {noSite ? <AlertTriangle size={22} color="#f87171" strokeWidth={1.5}/> : <ExternalLink size={22} color="#8b5cf6" strokeWidth={1.5}/>}
                        </div>

                        <div style={{flex:1,minWidth:0}}>
                            <div style={{display:'flex',alignItems:'center',gap:12,flexWrap:'wrap',marginBottom:6}}>
                                <h1 style={{fontSize:'clamp(1.4rem,2.5vw,2rem)',fontWeight:900,letterSpacing:'-0.5px',color:'#fafafa',lineHeight:1}}>{lead.name}</h1>
                                <span style={{fontSize:10,fontWeight:700,padding:'3px 10px',borderRadius:20,background:noSite?'rgba(248,113,113,0.1)':'rgba(139,92,246,0.1)',border:`1px solid ${noSite?'rgba(248,113,113,0.22)':'rgba(139,92,246,0.22)'}`,color:noSite?'#f87171':'#a78bfa',fontFamily:"'JetBrains Mono',monospace"}}>
                                    {noSite ? 'NO WEBSITE' : 'HAS WEBSITE'}
                                </span>
                                {currentOutcome && (
                                    <span style={{fontSize:10,fontWeight:700,padding:'3px 10px',borderRadius:20,background:currentOutcome.bg,border:`1px solid ${currentOutcome.border}`,color:currentOutcome.color,fontFamily:"'JetBrains Mono',monospace",display:'flex',alignItems:'center',gap:5}}>
                                        <currentOutcome.icon size={9} strokeWidth={2}/>{currentOutcome.label}
                                    </span>
                                )}
                            </div>
                            <div style={{display:'flex',alignItems:'center',gap:16,flexWrap:'wrap'}}>
                                {lead.category && <span style={{fontSize:12,color:'#52525b',display:'flex',alignItems:'center',gap:4}}><Tag size={11}/>{lead.category}</span>}
                                {lead.city     && <span style={{fontSize:12,color:'#52525b',display:'flex',alignItems:'center',gap:4}}><MapPin size={11}/>{lead.city}</span>}
                                {lead.phone    && <span style={{fontSize:12,color:'#52525b',display:'flex',alignItems:'center',gap:4}}><Phone size={11}/>{lead.phone}</span>}
                                {lead.rating > 0 && <span style={{fontSize:12,color:'#52525b',display:'flex',alignItems:'center',gap:4}}><Star size={11} style={{fill:'#eab308',color:'#eab308'}}/>{lead.rating} ({lead.review_count || 0} reviews)</span>}
                            </div>
                        </div>

                        <div style={{display:'flex',alignItems:'center',gap:16,flexShrink:0}}>
                            <ScoreRing score={total}/>
                            <div>
                                <div style={{fontSize:10,color:'#3f3f46',fontFamily:"'JetBrains Mono',monospace",textTransform:'uppercase',letterSpacing:'0.08em',marginBottom:8}}>Pipeline Stage</div>
                                <StageDropdown stage={lead.pipeline_stage} onChange={handleStageChange}/>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Two column grid */}
                <div style={{display:'grid',gridTemplateColumns:'1fr 360px',gap:20,alignItems:'start'}}>

                    {/* LEFT */}
                    <div style={{display:'flex',flexDirection:'column',gap:16}}>

                        {/* Business info */}
                        <div style={{background:'rgba(255,255,255,0.02)',border:'1px solid rgba(255,255,255,0.06)',borderRadius:16,padding:'22px 24px',animation:'fadeUp 0.5s cubic-bezier(0.16,1,0.3,1) 0.1s both',position:'relative',overflow:'hidden'}}>
                            <div style={{position:'absolute',top:0,left:0,right:0,height:1,background:'linear-gradient(90deg,transparent,rgba(139,92,246,0.4),transparent)'}}/>
                            <div className="sec-title">Business Info</div>
                            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:16}}>
                                {[
                                    { label:'Business Name', value:lead.name,               icon:Building2 },
                                    { label:'Category',      value:lead.category||'—',       icon:Tag       },
                                    { label:'Phone',         value:lead.phone||'—',          icon:Phone     },
                                    { label:'City',          value:lead.city||'—',           icon:MapPin    },
                                    { label:'Address',       value:lead.address||'—',        icon:MapPin    },
                                    { label:'Website',       value:lead.website_url||'None', icon:Globe     },
                                    { label:'Rating',        value:lead.rating?`${lead.rating}★`:'—', icon:Star },
                                    { label:'Reviews',       value:lead.review_count||'—',   icon:BarChart2 },
                                    { label:'Business Age',  value:lead.business_age_years?`${lead.business_age_years} years`:'Unknown', icon:Clock },
                                ].map(f => (
                                    <div key={f.label} style={{display:'flex',gap:10,alignItems:'flex-start'}}>
                                        <div style={{width:28,height:28,borderRadius:7,background:'rgba(255,255,255,0.03)',border:'1px solid rgba(255,255,255,0.06)',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0,marginTop:1}}>
                                            <f.icon size={12} color="#52525b" strokeWidth={1.5}/>
                                        </div>
                                        <div>
                                            <div style={{fontSize:10,color:'#3f3f46',fontFamily:"'JetBrains Mono',monospace",textTransform:'uppercase',letterSpacing:'0.06em',marginBottom:2}}>{f.label}</div>
                                            <div style={{fontSize:13,color:'#e4e4e7',fontWeight:500,wordBreak:'break-word'}}>{f.value}</div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Score breakdown */}
                        <div style={{background:'rgba(255,255,255,0.02)',border:'1px solid rgba(255,255,255,0.06)',borderRadius:16,padding:'22px 24px',animation:'fadeUp 0.5s cubic-bezier(0.16,1,0.3,1) 0.16s both',position:'relative',overflow:'hidden'}}>
                            <div style={{position:'absolute',top:0,left:0,right:0,height:1,background:`linear-gradient(90deg,transparent,${color}50,transparent)`}}/>
                            <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:16}}>
                                <div className="sec-title" style={{marginBottom:0}}>Score Breakdown</div>
                                <div style={{display:'flex',alignItems:'center',gap:4}}>
                                    {[1,2,3,4,5].map(i => <Star key={i} size={11} strokeWidth={1.5} style={{color:i<=filled?color:'rgba(255,255,255,0.08)',fill:i<=filled?color:'transparent'}}/>)}
                                    <span style={{fontSize:13,fontWeight:800,color,fontFamily:"'JetBrains Mono',monospace",marginLeft:6}}>{total}/100</span>
                                </div>
                            </div>
                            <div style={{height:3,background:'rgba(255,255,255,0.04)',borderRadius:2,marginBottom:18,overflow:'hidden'}}>
                                <div style={{height:'100%',width:`${total}%`,background:`linear-gradient(90deg,${color},${color}88)`,borderRadius:2,transition:'width 0.8s cubic-bezier(0.16,1,0.3,1)'}}/>
                            </div>
                            <div style={{display:'flex',flexDirection:'column',gap:9}}>
                                {signals.map(sig => (
                                    <div key={sig.label} style={{display:'flex',alignItems:'center',gap:10}}>
                                        <div style={{width:6,height:6,borderRadius:'50%',flexShrink:0,background:sig.pts>0?'#4ade80':'rgba(255,255,255,0.1)'}}/>
                                        <div style={{width:120,flexShrink:0,fontSize:12,color:sig.pts>0?'#a1a1aa':'#3f3f46'}}>{sig.label}</div>
                                        <div style={{flex:1,height:3,background:'rgba(255,255,255,0.04)',borderRadius:2,overflow:'hidden'}}>
                                            <div style={{height:'100%',width:`${(sig.pts/sig.max)*100}%`,background:sig.pts>0?(sig.pts===sig.max?'#4ade80':'#fb923c'):'transparent',borderRadius:2}}/>
                                        </div>
                                        <div style={{width:48,flexShrink:0,textAlign:'right',fontSize:11,fontFamily:"'JetBrains Mono',monospace",color:sig.pts>0?'#e4e4e7':'#27272a'}}>+{sig.pts}<span style={{color:'#27272a'}}>/{sig.max}</span></div>
                                        <div style={{width:160,flexShrink:0,fontSize:11,color:'#52525b',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{sig.detail}</div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Call Log */}
                        <div style={{background:'rgba(255,255,255,0.02)',border:'1px solid rgba(255,255,255,0.06)',borderRadius:16,padding:'22px 24px',animation:'fadeUp 0.5s cubic-bezier(0.16,1,0.3,1) 0.22s both',position:'relative',overflow:'hidden'}}>
                            <div style={{position:'absolute',top:0,left:0,right:0,height:1,background:'linear-gradient(90deg,transparent,rgba(74,222,128,0.4),transparent)'}}/>
                            <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:14}}>
                                <PhoneCall size={13} color="#4ade80" strokeWidth={1.5}/>
                                <div className="sec-title" style={{marginBottom:0}}>Call Outcome</div>
                            </div>
                            <CallLog lead={lead} onOutcomeSet={handleOutcomeSet}/>
                        </div>

                        {/* Notes */}
                        <div style={{background:'rgba(255,255,255,0.02)',border:'1px solid rgba(255,255,255,0.06)',borderRadius:16,padding:'22px 24px',animation:'fadeUp 0.5s cubic-bezier(0.16,1,0.3,1) 0.28s both',position:'relative',overflow:'hidden'}}>
                            <div style={{position:'absolute',top:0,left:0,right:0,height:1,background:'linear-gradient(90deg,transparent,rgba(251,146,60,0.4),transparent)'}}/>
                            <div className="sec-title">Notes</div>
                            <NotesEditor lead={lead} onSave={handleNotesSave}/>
                        </div>
                    </div>

                    {/* RIGHT — Action Center */}
                    <div style={{display:'flex',flexDirection:'column',gap:10,animation:'fadeUp 0.5s cubic-bezier(0.16,1,0.3,1) 0.18s both'}}>
                        <div style={{fontSize:11,fontWeight:700,color:'#3f3f46',textTransform:'uppercase',letterSpacing:'0.1em',fontFamily:"'JetBrains Mono',monospace",marginBottom:4}}>Action Center</div>

                        <ActionCard icon={Globe}     title="Generate Demo Site"   description="Build a sample website to show the prospect" accent="#8b5cf6" badge="FREE" onClick={() => navigate(`/leads/${id}/demo`)}/>
                        <ActionCard icon={Mail}      title="Outreach Scripts"     description="Cold email & follow-up templates"            accent="#4ade80"             onClick={() => navigate(`/leads/${id}/outreach`)}/>
                        <ActionCard icon={Video}     title="Schedule Demo Call"   description="Create a Zoom meeting and send invite"        accent="#fb923c" disabled/>
                        <ActionCard icon={FileText}  title="Generate Contract"    description="Auto-fill contract with lead data"            accent="#a78bfa" disabled/>
                        <ActionCard icon={BarChart2} title="Send Invoice"         description="Generate and send Stripe payment link"        accent="#f87171" disabled/>
                        <ActionCard icon={Globe}     title="Check Domain"         description="Check domain availability for this business"  accent="#eab308" disabled/>

                        {/* Lead quality panel */}
                        <div style={{background:'rgba(255,255,255,0.015)',border:'1px solid rgba(255,255,255,0.05)',borderRadius:14,padding:'16px 18px',marginTop:4}}>
                            <div style={{fontSize:10,fontWeight:700,color:'#3f3f46',textTransform:'uppercase',letterSpacing:'0.1em',fontFamily:"'JetBrains Mono',monospace",marginBottom:12}}>Lead Quality</div>
                            <div style={{display:'flex',flexDirection:'column',gap:9}}>
                                {[
                                    { label:'Score',         value:`${total}/100`,                                          color },
                                    { label:'Priority',      value:total>=75?'High':total>=50?'Medium':'Low',               color:total>=75?'#4ade80':total>=50?'#fb923c':'#f87171' },
                                    { label:'Stage',         value:lead.pipeline_stage||'New Lead',                         color:stageStyle.color },
                                    { label:'Call Outcome',  value:lead.call_outcome||'Not called',                         color:currentOutcome?currentOutcome.color:'#3f3f46' },
                                ].map(s => (
                                    <div key={s.label} style={{display:'flex',alignItems:'center',justifyContent:'space-between'}}>
                                        <span style={{fontSize:12,color:'#52525b'}}>{s.label}</span>
                                        <span style={{fontSize:12,fontWeight:700,color:s.color,fontFamily:"'JetBrains Mono',monospace"}}>{s.value}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}