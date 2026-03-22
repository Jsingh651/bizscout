import { useState, useEffect, useRef, useCallback } from 'react'
import ReactDOM from 'react-dom'
import { useNavigate } from 'react-router-dom'
import {
    MapPin, Star, AlertTriangle, ExternalLink, ArrowLeft,
    BarChart2, Users, Target, ChevronRight, Search,
    Circle, CheckCircle2, ChevronDown, Info, X, SlidersHorizontal,
} from 'lucide-react'
import AppNav from '../components/AppNav'
import {
    getCachedBatches, setCachedBatches,
    getCachedBatchLeads, setCachedBatchLeads,
    patchCachedLead,
} from '../utils/batchCache'
import { API, getAuthHeaders } from '../utils/api'

const STAGES = ['New Lead', 'Contacted', 'Interested', 'Proposal Sent', 'Closed Won', 'Closed Lost']
const STAGE_STYLE = {
    'New Lead':      { bg: 'rgba(99,102,241,0.12)',  border: 'rgba(99,102,241,0.3)',  color: '#818cf8' },
    'Contacted':     { bg: 'rgba(251,146,60,0.12)',  border: 'rgba(251,146,60,0.3)',  color: '#fb923c' },
    'Interested':    { bg: 'rgba(234,179,8,0.12)',   border: 'rgba(234,179,8,0.3)',   color: '#eab308' },
    'Proposal Sent': { bg: 'rgba(139,92,246,0.12)',  border: 'rgba(139,92,246,0.3)',  color: '#a78bfa' },
    'Closed Won':    { bg: 'rgba(74,222,128,0.12)',  border: 'rgba(74,222,128,0.3)',  color: '#4ade80' },
    'Closed Lost':   { bg: 'rgba(248,113,113,0.12)', border: 'rgba(248,113,113,0.3)', color: '#f87171' },
}

const CALL_OUTCOME_COLORS = {
    'Interested':    { color: '#4ade80', bg: 'rgba(74,222,128,0.08)',   border: 'rgba(74,222,128,0.2)'  },
    'Not Interested':{ color: '#f87171', bg: 'rgba(248,113,113,0.08)',  border: 'rgba(248,113,113,0.2)' },
    'Call Later':    { color: '#eab308', bg: 'rgba(234,179,8,0.08)',    border: 'rgba(234,179,8,0.2)'   },
    'No Answer':     { color: '#fb923c', bg: 'rgba(251,146,60,0.08)',   border: 'rgba(251,146,60,0.2)'  },
    'Wrong Number':  { color: '#c4c4cc', bg: 'rgba(113,113,122,0.08)',  border: 'rgba(113,113,122,0.2)' },
}

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
    let rPts=0, rDetail='No rating data'
    if(r>=4.8){rPts=20;rDetail=`${r}★ — exceptional`}
    else if(r>=4.5){rPts=14;rDetail=`${r}★ — excellent`}
    else if(r>=4.0){rPts=8;rDetail=`${r}★ — good`}
    else if(r>=3.5){rPts=3;rDetail=`${r}★ — average`}
    else if(r>0){rPts=0;rDetail=`${r}★ — below average`}
    signals.push({ label:'Rating', pts:rPts, max:20, earned:rPts>0, detail:rDetail })
    const rc = parseInt(lead.review_count)||0
    let rcPts=0, rcDetail='No reviews found'
    if(rc>=200){rcPts=15;rcDetail=`${rc} reviews — very established`}
    else if(rc>=100){rcPts=12;rcDetail=`${rc} reviews — well reviewed`}
    else if(rc>=50){rcPts=8;rcDetail=`${rc} reviews — decent presence`}
    else if(rc>=20){rcPts=4;rcDetail=`${rc} reviews — some traction`}
    else if(rc>0){rcPts=0;rcDetail=`${rc} reviews — limited reviews`}
    signals.push({ label:'Review count', pts:rcPts, max:15, earned:rcPts>0, detail:rcDetail })
    const age = parseInt(lead.business_age_years)||0
    let agePts=0, ageDetail='Age unknown'
    if(age>=7){agePts=12;ageDetail=`${age} years old — very established`}
    else if(age>=5){agePts=9;ageDetail=`${age} years old — established`}
    else if(age>=3){agePts=6;ageDetail=`${age} years old — growing`}
    else if(age>=1){agePts=3;ageDetail=`${age} years old — newer business`}
    signals.push({ label:'Business age', pts:agePts, max:12, earned:agePts>0, detail:ageDetail })
    const catText = (lead.category||'').toLowerCase()
    let catPts=0, catDetail='Standard category'
    for(const kw of HIGH_URGENCY){if(catText.includes(kw)){catPts=10;catDetail=`${lead.category} — high urgency niche`;break}}
    if(!catPts)for(const kw of MEDIUM_URGENCY){if(catText.includes(kw)){catPts=5;catDetail=`${lead.category} — medium urgency niche`;break}}
    signals.push({ label:'Category urgency', pts:catPts, max:10, earned:catPts>0, detail:catDetail })
    const hasPhone = !!(lead.phone||'').trim()
    signals.push({ label:'Phone present', pts:hasPhone?4:0, max:4, earned:hasPhone, detail:hasPhone?lead.phone:'No phone number found' })
    const hasAddr = !!(lead.address||'').trim()
    signals.push({ label:'Address present', pts:hasAddr?4:0, max:4, earned:hasAddr, detail:hasAddr?'Physical location confirmed':'No address found' })
    const total = signals.reduce((s,x)=>s+x.pts,0)
    return { signals, total }
}

function ParticleCanvas() {
    const ref = useRef(null)
    useEffect(() => {
        const canvas=ref.current, ctx=canvas.getContext('2d'); let id
        const resize=()=>{canvas.width=window.innerWidth;canvas.height=window.innerHeight}
        resize(); window.addEventListener('resize',resize)
        const pts=Array.from({length:55},()=>({x:Math.random()*window.innerWidth,y:Math.random()*window.innerHeight,r:Math.random()*1.0+0.2,s:Math.random()*0.2+0.04,o:Math.random()*0.14+0.03,hue:Math.random()>0.5?'139,92,246':'99,102,241'}))
        const draw=()=>{ctx.clearRect(0,0,canvas.width,canvas.height);pts.forEach(p=>{p.y-=p.s;if(p.y<-2){p.y=canvas.height+2;p.x=Math.random()*canvas.width}ctx.beginPath();ctx.arc(p.x,p.y,p.r,0,Math.PI*2);ctx.fillStyle=`rgba(${p.hue},${p.o})`;ctx.fill()});id=requestAnimationFrame(draw)}
        draw(); return()=>{cancelAnimationFrame(id);window.removeEventListener('resize',resize)}
    },[])
    return <canvas ref={ref} style={{position:'fixed',inset:0,zIndex:0,pointerEvents:'none'}}/>
}

function ScoreBadge({ lead, expanded, onToggle }) {
    const score=lead.score||0, color=scoreColor(score), filled=Math.round((score/100)*5)
    return (
        <div style={{display:'flex',alignItems:'center',gap:6}}>
            <div style={{display:'flex',alignItems:'center',gap:2}}>
                {[1,2,3,4,5].map(i=><Star key={i} size={12} strokeWidth={1.5} style={{color:i<=filled?color:'rgba(255,255,255,0.1)',fill:i<=filled?color:'transparent'}}/>)}
            </div>
            <button onClick={e=>{e.stopPropagation();onToggle()}}
                style={{display:'inline-flex',alignItems:'center',gap:4,background:`${color}18`,border:`1px solid ${color}40`,borderRadius:20,padding:'3px 9px',cursor:'pointer',transition:'all 0.15s'}}
                onMouseEnter={e=>{e.currentTarget.style.background=`${color}28`;e.currentTarget.style.borderColor=`${color}70`}}
                onMouseLeave={e=>{e.currentTarget.style.background=`${color}18`;e.currentTarget.style.borderColor=`${color}40`}}>
                <span style={{fontSize:11,fontWeight:700,color,fontFamily:"'JetBrains Mono',monospace"}}>{score}</span>
                <Info size={9} color={color} strokeWidth={2}/>
            </button>
        </div>
    )
}

function ScoreBreakdown({ lead }) {
    const { signals, total } = calcBreakdown(lead)
    const color = scoreColor(total)
    return (
        <div style={{gridColumn:'1 / -1',margin:'0 0 2px 0',background:'rgba(255,255,255,0.025)',border:'1px solid rgba(255,255,255,0.07)',borderRadius:12,padding:'16px 20px',animation:'expandDown 0.2s ease'}}>
            <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:14}}>
                <div style={{display:'flex',alignItems:'center',gap:10}}>
                    <span style={{fontSize:12,fontWeight:700,color:'#e4e4e7'}}>Score Breakdown</span>
                    <span style={{fontSize:10,color:'#c4c4cc',fontFamily:"'JetBrains Mono',monospace"}}>{lead.name}</span>
                </div>
                <div style={{display:'flex',alignItems:'center',gap:6}}>
                    <span style={{fontSize:10,color:'#c4c4cc',fontFamily:"'JetBrains Mono',monospace"}}>total</span>
                    <span style={{fontSize:18,fontWeight:800,color,fontFamily:"'JetBrains Mono',monospace",letterSpacing:'-1px'}}>{total}</span>
                    <span style={{fontSize:10,color:'#b8c2d4',fontFamily:"'JetBrains Mono',monospace"}}>/100</span>
                </div>
            </div>
            <div style={{height:3,background:'rgba(255,255,255,0.04)',borderRadius:2,marginBottom:16,overflow:'hidden'}}>
                <div style={{height:'100%',width:`${total}%`,background:`linear-gradient(90deg,${color},${color}99)`,borderRadius:2,transition:'width 0.6s ease'}}/>
            </div>
            <div style={{display:'flex',flexDirection:'column',gap:8}}>
                {signals.map(sig=>(
                    <div key={sig.label} style={{display:'flex',alignItems:'center',gap:12}}>
                        <div style={{width:6,height:6,borderRadius:'50%',flexShrink:0,background:sig.pts>0?'#4ade80':'rgba(255,255,255,0.1)'}}/>
                        <div style={{width:130,flexShrink:0,fontSize:12,color:sig.pts>0?'#c4c4cc':'#b8c2d4'}}>{sig.label}</div>
                        <div style={{flex:1,height:3,background:'rgba(255,255,255,0.04)',borderRadius:2,overflow:'hidden'}}>
                            <div style={{height:'100%',width:`${(sig.pts/sig.max)*100}%`,background:sig.pts>0?(sig.pts===sig.max?'#4ade80':'#fb923c'):'transparent',borderRadius:2,transition:'width 0.5s ease'}}/>
                        </div>
                        <div style={{width:52,flexShrink:0,textAlign:'right',fontSize:11,fontFamily:"'JetBrains Mono',monospace",color:sig.pts>0?'#e4e4e7':'#b8c2d4'}}>+{sig.pts}<span style={{color:'#b8c2d4'}}>/{sig.max}</span></div>
                        <div style={{width:200,flexShrink:0,fontSize:11,color:'#c4c4cc',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{sig.detail}</div>
                    </div>
                ))}
            </div>
        </div>
    )
}

// ─── Stage Dropdown (portal) ──────────────────────────────────────────────────
function StageDropdown({ lead, onChange }) {
    const [open, setOpen] = useState(false)
    const [pos, setPos]   = useState({ top: 0, left: 0 })
    const triggerRef = useRef(null)
    const menuRef    = useRef(null)
    const s = STAGE_STYLE[lead.pipeline_stage] || STAGE_STYLE['New Lead']

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

    const handleOpen = e => {
        e.stopPropagation()
        if (!open) {
            const rect = triggerRef.current.getBoundingClientRect()
            setPos({ top: rect.bottom + window.scrollY + 5, left: rect.left + window.scrollX })
        }
        setOpen(o => !o)
    }

    return (
        <>
            <div ref={triggerRef} onClick={handleOpen}
                style={{display:'inline-flex',alignItems:'center',gap:5,cursor:'pointer',background:s.bg,border:`1px solid ${s.border}`,borderRadius:20,padding:'4px 10px',fontSize:11,color:s.color,fontFamily:"'JetBrains Mono',monospace",userSelect:'none',whiteSpace:'nowrap'}}>
                {lead.pipeline_stage || 'New Lead'}
                <ChevronDown size={10} style={{transform:open?'rotate(180deg)':'none',transition:'transform 0.2s'}}/>
            </div>

            {open && ReactDOM.createPortal(
                <div ref={menuRef} style={{position:'absolute',top:pos.top,left:pos.left,zIndex:99999,background:'#111118',border:'1px solid rgba(255,255,255,0.08)',borderRadius:10,padding:4,minWidth:155,boxShadow:'0 20px 50px rgba(0,0,0,0.9)'}}>
                    {STAGES.map(stage => {
                        const c = STAGE_STYLE[stage], active = stage === (lead.pipeline_stage || 'New Lead')
                        return (
                            <div key={stage} onClick={e => { e.stopPropagation(); onChange(lead.hid || lead.id, stage); setOpen(false) }}
                                style={{padding:'8px 12px',borderRadius:7,fontSize:12,cursor:'pointer',color:active?c.color:'#c4c4cc',background:active?c.bg:'transparent',fontFamily:"'JetBrains Mono',monospace",display:'flex',alignItems:'center',gap:8,transition:'background 0.15s',whiteSpace:'nowrap'}}
                                onMouseEnter={e => { if(!active) e.currentTarget.style.background='rgba(255,255,255,0.04)' }}
                                onMouseLeave={e => { if(!active) e.currentTarget.style.background='transparent' }}>
                                {active ? <CheckCircle2 size={11}/> : <Circle size={11}/>}{stage}
                            </div>
                        )
                    })}
                </div>,
                document.body
            )}
        </>
    )
}

// ─── Call Outcome Badge ───────────────────────────────────────────────────────
const CALL_OUTCOMES = ['Interested','Not Interested','Call Later','No Answer','Wrong Number']

function CallOutcomeDropdown({ lead, onChange }) {
    const [open, setOpen] = useState(false)
    const [pos, setPos]   = useState({ top: 0, left: 0 })
    const triggerRef = useRef(null)
    const menuRef    = useRef(null)
    const oc = lead.call_outcome ? CALL_OUTCOME_COLORS[lead.call_outcome] : null

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

    const handleOpen = e => {
        e.stopPropagation()
        if (!open) {
            const rect = triggerRef.current.getBoundingClientRect()
            setPos({ top: rect.bottom + window.scrollY + 5, left: rect.left + window.scrollX })
        }
        setOpen(o => !o)
    }

    return (
        <>
            <div ref={triggerRef} onClick={handleOpen}
                style={{display:'inline-flex',alignItems:'center',gap:5,cursor:'pointer',background:oc?oc.bg:'rgba(255,255,255,0.03)',border:`1px solid ${oc?oc.border:'rgba(255,255,255,0.07)'}`,borderRadius:20,padding:'4px 10px',fontSize:11,color:oc?oc.color:'#b8c2d4',fontFamily:"'JetBrains Mono',monospace",userSelect:'none',whiteSpace:'nowrap',transition:'all 0.15s'}}
                onMouseEnter={e=>{if(!oc)e.currentTarget.style.borderColor='rgba(255,255,255,0.15)'}}
                onMouseLeave={e=>{if(!oc)e.currentTarget.style.borderColor='rgba(255,255,255,0.07)'}}>
                {lead.call_outcome || '— set —'}
                <ChevronDown size={10} style={{transform:open?'rotate(180deg)':'none',transition:'transform 0.2s'}}/>
            </div>

            {open && ReactDOM.createPortal(
                <div ref={menuRef} style={{position:'absolute',top:pos.top,left:pos.left,zIndex:99999,background:'#111118',border:'1px solid rgba(255,255,255,0.08)',borderRadius:10,padding:4,minWidth:155,boxShadow:'0 20px 50px rgba(0,0,0,0.9)'}}>
                    {CALL_OUTCOMES.map(outcome => {
                        const c = CALL_OUTCOME_COLORS[outcome]
                        const active = outcome === lead.call_outcome
                        return (
                            <div key={outcome} onClick={e => { e.stopPropagation(); onChange(lead.hid || lead.id, outcome); setOpen(false) }}
                                style={{padding:'8px 12px',borderRadius:7,fontSize:12,cursor:'pointer',color:active?c.color:'#c4c4cc',background:active?c.bg:'transparent',fontFamily:"'JetBrains Mono',monospace",display:'flex',alignItems:'center',gap:8,transition:'background 0.15s',whiteSpace:'nowrap'}}
                                onMouseEnter={e => { if(!active) e.currentTarget.style.background='rgba(255,255,255,0.04)' }}
                                onMouseLeave={e => { if(!active) e.currentTarget.style.background='transparent' }}>
                                {active ? <CheckCircle2 size={11}/> : <Circle size={11}/>}{outcome}
                            </div>
                        )
                    })}
                </div>,
                document.body
            )}
        </>
    )
}

// ─── Filter Bar ───────────────────────────────────────────────────────────────
function FilterBar({ batches, filters, onChange, onClear }) {
    const niches  = [...new Set(batches.map(b=>b.query))].sort()
    const cities  = [...new Set(batches.map(b=>b.location))].sort()
    const hasActive = Object.values(filters).some(Boolean)

    const pill = (label, active, onClick) => (
        <button key={label} onClick={onClick}
            style={{display:'inline-flex',alignItems:'center',padding:'5px 12px',borderRadius:20,fontSize:12,cursor:'pointer',fontFamily:"'Outfit',sans-serif",transition:'all 0.15s',background:active?'rgba(139,92,246,0.15)':'rgba(255,255,255,0.03)',border:`1px solid ${active?'rgba(139,92,246,0.4)':'rgba(255,255,255,0.07)'}`,color:active?'#c4b5fd':'#c4c4cc',whiteSpace:'nowrap'}}>
            {label}
        </button>
    )

    const section = (label, children) => (
        <div style={{marginBottom:14}}>
            <div style={{fontSize:10,color:'#b8c2d4',fontFamily:"'JetBrains Mono',monospace",textTransform:'uppercase',letterSpacing:'0.08em',marginBottom:7}}>{label}</div>
            <div style={{display:'flex',flexWrap:'wrap',gap:6}}>{children}</div>
        </div>
    )

    return (
        <div>
            <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:14}}>
                <div style={{display:'flex',alignItems:'center',gap:7}}>
                    <SlidersHorizontal size={12} color="#c4c4cc" strokeWidth={1.5}/>
                    <span style={{fontSize:11,color:'#c4c4cc',fontFamily:"'JetBrains Mono',monospace",textTransform:'uppercase',letterSpacing:'0.08em'}}>Filters</span>
                </div>
                {hasActive && (
                    <button onClick={onClear} style={{display:'flex',alignItems:'center',gap:4,background:'rgba(248,113,113,0.06)',border:'1px solid rgba(248,113,113,0.18)',borderRadius:20,padding:'3px 10px',color:'#f87171',fontSize:11,cursor:'pointer',fontFamily:"'Outfit',sans-serif"}}>
                        <X size={9}/> Clear all
                    </button>
                )}
            </div>
            {section('Niche', niches.map(n=>pill(n, filters.niche===n, ()=>onChange('niche', filters.niche===n?null:n))))}
            {section('City', cities.map(c=>pill(c, filters.city===c, ()=>onChange('city', filters.city===c?null:c))))}
            <div style={{display:'flex',gap:32,flexWrap:'wrap'}}>
                {section('Avg Score', [['High','70+'],['Medium','40–69'],['Low','<40']].map(([l,s])=>pill(`${l} (${s})`, filters.score===l, ()=>onChange('score', filters.score===l?null:l))))}
                {section('No Website %', [['Hot','50%+'],['Warm','20–49%'],['Cold','<20%']].map(([l,s])=>pill(`${l} (${s})`, filters.opportunity===l, ()=>onChange('opportunity', filters.opportunity===l?null:l))))}
                {section('Date', ['Today','This Week','This Month'].map(l=>pill(l, filters.date===l, ()=>onChange('date', filters.date===l?null:l))))}
            </div>
        </div>
    )
}

// ─── Batch Card ───────────────────────────────────────────────────────────────
function BatchCard({ batch, onClick }) {
    const noSitePct = batch.lead_count>0 ? Math.round((batch.no_site/batch.lead_count)*100) : 0
    const date = batch.created_at ? new Date(batch.created_at).toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'}) : '—'
    const filledStars = Math.round((batch.avg_score/100)*5)
    return (
        <div onClick={onClick}
            style={{background:'rgba(255,255,255,0.02)',border:'1px solid rgba(255,255,255,0.06)',borderRadius:16,padding:'22px 24px',cursor:'pointer',position:'relative',overflow:'hidden',transition:'border-color 0.2s,transform 0.2s,box-shadow 0.2s'}}
            onMouseEnter={e=>{e.currentTarget.style.borderColor='rgba(139,92,246,0.35)';e.currentTarget.style.transform='translateY(-3px)';e.currentTarget.style.boxShadow='0 12px 40px rgba(0,0,0,0.4)'}}
            onMouseLeave={e=>{e.currentTarget.style.borderColor='rgba(255,255,255,0.06)';e.currentTarget.style.transform='translateY(0)';e.currentTarget.style.boxShadow='none'}}>
            <div style={{position:'absolute',top:0,left:0,right:0,height:1,background:'linear-gradient(90deg,transparent,rgba(139,92,246,0.5),transparent)'}}/>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:16}}>
                <div>
                    <div style={{fontSize:16,fontWeight:700,color:'#fafafa',marginBottom:5,letterSpacing:'-0.3px'}}>{batch.query}</div>
                    <div style={{display:'flex',alignItems:'center',gap:5,color:'#c4c4cc',fontSize:12}}><MapPin size={10}/>{batch.location}</div>
                </div>
                <ChevronRight size={16} color="#b8c2d4"/>
            </div>
            <div style={{display:'flex',gap:20,marginBottom:16}}>
                {[
                    {val:batch.lead_count,label:'leads',color:'#fafafa'},
                    {val:batch.no_site,label:'no website',color:'#f87171'},
                    {val:batch.avg_score||'—',label:'avg score',color:scoreColor(batch.avg_score)},
                ].reduce((acc,s,i)=>i===0?[
                    <div key={i}><div style={{fontSize:22,fontWeight:800,color:s.color,fontFamily:"'JetBrains Mono',monospace",letterSpacing:'-1px'}}>{s.val}</div><div style={{fontSize:10,color:'#b8c2d4',textTransform:'uppercase',letterSpacing:'0.08em',marginTop:2}}>{s.label}</div></div>
                ]:[...acc,<div key={`d${i}`} style={{width:1,background:'rgba(255,255,255,0.05)'}}/>,<div key={i}><div style={{fontSize:22,fontWeight:800,color:s.color,fontFamily:"'JetBrains Mono',monospace",letterSpacing:'-1px'}}>{s.val}</div><div style={{fontSize:10,color:'#b8c2d4',textTransform:'uppercase',letterSpacing:'0.08em',marginTop:2}}>{s.label}</div></div>],[])}
            </div>
            <div style={{display:'flex',alignItems:'center',gap:3,marginBottom:14}}>
                {[1,2,3,4,5].map(i=><Star key={i} size={12} strokeWidth={1.5} style={{color:i<=filledStars?scoreColor(batch.avg_score):'rgba(255,255,255,0.08)',fill:i<=filledStars?scoreColor(batch.avg_score):'transparent'}}/>)}
                <span style={{fontSize:11,color:'#c4c4cc',marginLeft:6,fontFamily:"'JetBrains Mono',monospace"}}>avg quality</span>
            </div>
            <div>
                <div style={{display:'flex',justifyContent:'space-between',marginBottom:4}}>
                    <span style={{fontSize:10,color:'#b8c2d4',fontFamily:"'JetBrains Mono',monospace"}}>no website</span>
                    <span style={{fontSize:10,color:'#f87171',fontFamily:"'JetBrains Mono',monospace"}}>{noSitePct}%</span>
                </div>
                <div style={{height:2,background:'rgba(255,255,255,0.04)',borderRadius:2}}>
                    <div style={{height:'100%',width:`${noSitePct}%`,background:'linear-gradient(90deg,#f87171,#fb923c)',borderRadius:2}}/>
                </div>
            </div>
            <div style={{marginTop:14,fontSize:11,color:'#b8c2d4',fontFamily:"'JetBrains Mono',monospace"}}>{date}</div>
        </div>
    )
}

// ─── Batch Detail ─────────────────────────────────────────────────────────────
function BatchDetail({ batch, leads, onBack, onStageChange, onCallOutcomeChange }) {
    const navigate = useNavigate()
    const [search,setSearch]               = useState('')
    const [focused,setFocused]             = useState(false)
    const [filterSite,setFilterSite]       = useState('All')
    const [expandedScore,setExpandedScore] = useState(null)

    const filtered = leads.filter(l => {
        const q = search.toLowerCase()
        const matchQ = (l.name||'').toLowerCase().includes(q) || (l.city||'').toLowerCase().includes(q)
        const matchW = filterSite==='All'
            || (filterSite==='No Website' && l.website_status==='NO WEBSITE')
            || (filterSite==='Has Website' && l.website_status==='HAS WEBSITE')
        return matchQ && matchW
    })

    const noSite = leads.filter(l => l.website_status==='NO WEBSITE').length
    const GRID = '2fr 1fr 1.2fr 1.2fr 1fr 0.9fr'

    return (
        <div style={{animation:'fadeUp 0.4s cubic-bezier(0.16,1,0.3,1) both'}}>
            <div style={{display:'flex',alignItems:'center',gap:16,marginBottom:28}}>
                <button onClick={onBack}
                    style={{display:'flex',alignItems:'center',gap:6,background:'rgba(255,255,255,0.03)',border:'1px solid rgba(255,255,255,0.07)',borderRadius:8,padding:'7px 14px',color:'#c4c4cc',fontSize:13,cursor:'pointer',fontFamily:"'Outfit',sans-serif",transition:'color 0.2s'}}
                    onMouseEnter={e=>e.currentTarget.style.color='#c4c4cc'}
                    onMouseLeave={e=>e.currentTarget.style.color='#c4c4cc'}>
                    <ArrowLeft size={13}/> All Batches
                </button>
                <div>
                    <h2 style={{fontSize:22,fontWeight:800,letterSpacing:'-0.5px',color:'#fafafa',margin:0}}>{batch.query}</h2>
                    <div style={{display:'flex',alignItems:'center',gap:5,color:'#c4c4cc',fontSize:13,marginTop:3}}><MapPin size={11}/>{batch.location}</div>
                </div>
            </div>

            <div style={{display:'flex',gap:12,marginBottom:24,flexWrap:'wrap'}}>
                {[
                    {icon:Users,    label:'Total Leads', value:leads.length, accent:'#8b5cf6'},
                    {icon:Target,   label:'No Website',  value:noSite,       accent:'#f87171'},
                    {icon:BarChart2,label:'Avg Score',   value:leads.length?Math.round(leads.reduce((a,l)=>a+(l.score||0),0)/leads.length):'—', accent:'#4ade80'},
                ].map(s=>(
                    <div key={s.label} style={{display:'flex',alignItems:'center',gap:12,background:'rgba(255,255,255,0.02)',border:'1px solid rgba(255,255,255,0.05)',borderRadius:12,padding:'14px 18px',minWidth:130}}>
                        <div style={{width:32,height:32,borderRadius:9,background:`${s.accent}18`,border:`1px solid ${s.accent}30`,display:'flex',alignItems:'center',justifyContent:'center'}}><s.icon size={14} color={s.accent} strokeWidth={1.5}/></div>
                        <div>
                            <div style={{fontSize:20,fontWeight:800,color:'#fafafa',fontFamily:"'JetBrains Mono',monospace",letterSpacing:'-1px'}}>{s.value}</div>
                            <div style={{fontSize:10,color:'#b8c2d4',textTransform:'uppercase',letterSpacing:'0.08em'}}>{s.label}</div>
                        </div>
                    </div>
                ))}
            </div>

            <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:14,flexWrap:'wrap'}}>
                <div style={{display:'flex',alignItems:'center',gap:10,flex:1,minWidth:200,background:'rgba(255,255,255,0.03)',border:`1px solid ${focused?'rgba(139,92,246,0.5)':'rgba(255,255,255,0.07)'}`,borderRadius:9,padding:'0 14px',height:38,transition:'border-color 0.2s'}}>
                    <Search size={13} color="#b8c2d4"/>
                    <input style={{background:'none',border:'none',outline:'none',color:'#fafafa',fontSize:13,width:'100%',fontFamily:"'Outfit',sans-serif"}} placeholder="Search leads..." value={search} onChange={e=>setSearch(e.target.value)} onFocus={()=>setFocused(true)} onBlur={()=>setFocused(false)}/>
                </div>
                <div style={{display:'flex',gap:6}}>
                    {['All','No Website','Has Website'].map(s=>(
                        <button key={s} className={`fbtn${filterSite===s?' on':''}`} onClick={()=>setFilterSite(s)}>{s}</button>
                    ))}
                </div>
                <div style={{fontSize:11,color:'#b8c2d4',fontFamily:"'JetBrains Mono',monospace",marginLeft:'auto'}}>
                    click name to open · click score to expand
                </div>
            </div>

            <div className="table-scroll">
            <div style={{background:'rgba(255,255,255,0.015)',border:'1px solid rgba(255,255,255,0.06)',borderRadius:16,overflow:'hidden',position:'relative',minWidth:680}}>
                <div style={{position:'absolute',top:0,left:0,right:0,height:1,background:'linear-gradient(90deg,transparent,rgba(139,92,246,0.5),transparent)'}}/>

                {/* Header */}
                <div style={{display:'grid',gridTemplateColumns:GRID,gap:16,padding:'12px 20px',borderBottom:'1px solid rgba(255,255,255,0.05)',background:'rgba(255,255,255,0.02)'}}>
                    {['Business','Website','Score','Status','Call','Phone'].map(h=>(
                        <div key={h} style={{fontSize:10,fontWeight:700,color:'#b8c2d4',letterSpacing:'0.1em',textTransform:'uppercase',fontFamily:"'JetBrains Mono',monospace"}}>{h}</div>
                    ))}
                </div>

                {filtered.length===0 ? (
                    <div style={{padding:'48px 20px',textAlign:'center',fontSize:13,color:'#b8c2d4',fontFamily:"'JetBrains Mono',monospace"}}>— No leads match your filters —</div>
                ) : filtered.map(lead => {
                    const noSiteL  = lead.website_status==='NO WEBSITE'
                    const isExpanded = expandedScore===lead.id
                    return (
                        <div key={lead.id} style={{borderBottom:'1px solid rgba(255,255,255,0.04)'}}>
                            <div
                                style={{display:'grid',gridTemplateColumns:GRID,alignItems:'center',gap:16,padding:'14px 20px',background:isExpanded?'rgba(139,92,246,0.04)':'transparent',transition:'background 0.15s',cursor:'pointer'}}
                                onClick={() => navigate(`/leads/${lead.hid || lead.id}`)}
                                onMouseEnter={e=>{if(!isExpanded)e.currentTarget.style.background='rgba(255,255,255,0.02)'}}
                                onMouseLeave={e=>{if(!isExpanded)e.currentTarget.style.background=isExpanded?'rgba(139,92,246,0.04)':'transparent'}}>

                                {/* Business */}
                                <div style={{display:'flex',alignItems:'center',gap:11,minWidth:0}}>
                                    <div style={{width:34,height:34,borderRadius:9,flexShrink:0,background:noSiteL?'rgba(248,113,113,0.08)':'rgba(139,92,246,0.08)',border:`1px solid ${noSiteL?'rgba(248,113,113,0.18)':'rgba(139,92,246,0.18)'}`,display:'flex',alignItems:'center',justifyContent:'center'}}>
                                        {noSiteL?<AlertTriangle size={13} color="#f87171" strokeWidth={1.5}/>:<ExternalLink size={13} color="#8b5cf6" strokeWidth={1.5}/>}
                                    </div>
                                    <div style={{minWidth:0}}>
                                        <div style={{fontSize:14,fontWeight:600,color:'#e4e4e7',whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>{lead.name}</div>
                                        {lead.city && <div style={{fontSize:11,color:'#b8c2d4',marginTop:1}}>{lead.city}</div>}
                                    </div>
                                </div>

                                {/* Website */}
                                <div>
                                    <span style={{fontSize:10,fontWeight:700,letterSpacing:'0.06em',padding:'3px 8px',borderRadius:20,background:noSiteL?'rgba(248,113,113,0.1)':'rgba(139,92,246,0.1)',border:`1px solid ${noSiteL?'rgba(248,113,113,0.22)':'rgba(139,92,246,0.22)'}`,color:noSiteL?'#f87171':'#a78bfa',fontFamily:"'JetBrains Mono',monospace"}}>
                                        {noSiteL?'NO SITE':'HAS SITE'}
                                    </span>
                                </div>

                                {/* Score */}
                                <ScoreBadge lead={{...lead,score:calcBreakdown(lead).total}} expanded={isExpanded} onToggle={e=>{e?.stopPropagation?.();setExpandedScore(isExpanded?null:lead.id)}}/>

                                {/* Stage */}
                                <div onClick={e=>e.stopPropagation()}>
                                    <StageDropdown lead={lead} onChange={onStageChange}/>
                                </div>

                                {/* Call Outcome */}
                                <div onClick={e=>e.stopPropagation()}>
                                    <CallOutcomeDropdown lead={lead} onChange={onCallOutcomeChange}/>
                                </div>

                                {/* Phone */}
                                <span style={{fontSize:11,color:'#b8c2d4',fontFamily:"'JetBrains Mono',monospace"}}>{lead.phone||'—'}</span>
                            </div>

                            {isExpanded && (
                                <div style={{padding:'0 20px 16px'}} onClick={e=>e.stopPropagation()}>
                                    <ScoreBreakdown lead={lead}/>
                                </div>
                            )}
                        </div>
                    )
                })}

                <div style={{padding:'11px 20px',borderTop:'1px solid rgba(255,255,255,0.04)',display:'flex',justifyContent:'space-between'}}>
                    <span style={{fontSize:11,color:'#b8c2d4',fontFamily:"'JetBrains Mono',monospace"}}>Showing {filtered.length} of {leads.length} leads</span>
                </div>
            </div>
            </div>
        </div>
    )
}

// ─── Main ─────────────────────────────────────────────────────────────────────
export default function Batches() {
    const navigate = useNavigate()
    const [batches,setBatches]             = useState([])
    const [loading,setLoading]             = useState(true)
    const [activeBatch,setActiveBatch]     = useState(null)
    const [loadingDetail,setLoadingDetail] = useState(false)
    const [showFilters,setShowFilters]     = useState(false)
    const [filters,setFilters]             = useState({ niche:null, city:null, score:null, opportunity:null, date:null })

    // ── Fetch batch list with stale-while-revalidate ──────────────────────────
    useEffect(()=>{
        const { data: cached, stale } = getCachedBatches()
        if (cached) {
            setBatches(cached)
            setLoading(false)
            if (!stale) return  // fresh — no network call needed
        }
        // No cache or stale — fetch in background (silently if we already showed cached data)
        fetch(`${API}/batches/`,{credentials:'include',headers:getAuthHeaders()})
            .then(r=>r.json())
            .then(data=>{
                const list = Array.isArray(data) ? data : []
                setCachedBatches(list)
                setBatches(list)
                setLoading(false)
            })
            .catch(()=>setLoading(false))
    },[])

    // ── Open a batch — show cached leads instantly, refresh in background ─────
    const openBatch = useCallback((id, hid) => {
        const key = hid || id
        const { data: cached, stale } = getCachedBatchLeads(key)
        if (cached) {
            setActiveBatch(cached)
            setLoadingDetail(false)
            if (!stale) return  // fresh — skip network
        } else {
            setLoadingDetail(true)
        }
        fetch(`${API}/batches/${key}/leads`,{credentials:'include',headers:getAuthHeaders()})
            .then(r=>r.json())
            .then(data=>{
                setCachedBatchLeads(key, data)
                setActiveBatch(data)
                setLoadingDetail(false)
            })
            .catch(()=>setLoadingDetail(false))
    }, [])

    const handleStageChange = (leadId, stage) => {
        setActiveBatch(prev=>({...prev,leads:prev.leads.map(l=>(l.hid||l.id)===leadId?{...l,pipeline_stage:stage}:l)}))
        patchCachedLead(leadId, { pipeline_stage: stage })
        fetch(`${API}/leads/${leadId}`,{method:'PATCH',headers:{'Content-Type':'application/json',...getAuthHeaders()},credentials:'include',body:JSON.stringify({pipeline_stage:stage})}).catch(()=>{})
    }

    const handleCallOutcomeChange = (leadId, outcome) => {
        setActiveBatch(prev=>({...prev,leads:prev.leads.map(l=>(l.hid||l.id)===leadId?{...l,call_outcome:outcome}:l)}))
        patchCachedLead(leadId, { call_outcome: outcome })
        fetch(`${API}/leads/${leadId}`,{method:'PATCH',headers:{'Content-Type':'application/json',...getAuthHeaders()},credentials:'include',body:JSON.stringify({call_outcome:outcome})}).catch(()=>{})
    }
    const handleFilterChange = (key,val) => setFilters(prev=>({...prev,[key]:val}))
    const clearFilters = () => setFilters({niche:null,city:null,score:null,opportunity:null,date:null})

    const filteredBatches = batches.filter(b=>{
        if(filters.niche && b.query!==filters.niche) return false
        if(filters.city  && b.location!==filters.city) return false
        if(filters.score){
            if(filters.score==='High'   && b.avg_score<70) return false
            if(filters.score==='Medium' && (b.avg_score<40||b.avg_score>=70)) return false
            if(filters.score==='Low'    && b.avg_score>=40) return false
        }
        if(filters.opportunity){
            const pct=b.lead_count?Math.round((b.no_site/b.lead_count)*100):0
            if(filters.opportunity==='Hot'  && pct<50) return false
            if(filters.opportunity==='Warm' && (pct<20||pct>=50)) return false
            if(filters.opportunity==='Cold' && pct>=20) return false
        }
        if(filters.date){
            const created=new Date(b.created_at), now=new Date()
            if(filters.date==='Today'      && created.toDateString()!==now.toDateString()) return false
            if(filters.date==='This Week') { const wa=new Date(now);wa.setDate(now.getDate()-7);if(created<wa)return false }
            if(filters.date==='This Month' && (created.getMonth()!==now.getMonth()||created.getFullYear()!==now.getFullYear())) return false
        }
        return true
    })

    const activeFilterCount = Object.values(filters).filter(Boolean).length

    return (
        <div style={{minHeight:'100vh',background:'#09090f',color:'#fafafa',fontFamily:"'Outfit',sans-serif",overflowX:'hidden'}}>
            <style>{`
                @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@400;500;600;700;800;900&family=JetBrains+Mono:wght@400;700&display=swap');
                *,*::before,*::after{box-sizing:border-box;margin:0;padding:0;}
                html,body{scrollbar-width:none;overflow-x:hidden;}
                html::-webkit-scrollbar{display:none;}
                @keyframes fadeUp{from{opacity:0;transform:translateY(16px)}to{opacity:1;transform:translateY(0)}}
                @keyframes expandDown{from{opacity:0;transform:translateY(-6px)}to{opacity:1;transform:translateY(0)}}
                @keyframes pulse{0%,100%{opacity:1;transform:scale(1)}50%{opacity:0.4;transform:scale(0.8)}}
                @keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}
                .f1{animation:fadeUp 0.5s cubic-bezier(0.16,1,0.3,1) 0.05s both}
                .f2{animation:fadeUp 0.5s cubic-bezier(0.16,1,0.3,1) 0.14s both}
                .nav-link{background:none;border:none;color:#b8c2d4;font-size:14px;cursor:pointer;font-family:'Outfit',sans-serif;transition:color 0.2s;padding:0;}
                .nav-link:hover{color:#c4c4cc;}
                .nav-link.active{color:#fafafa;font-weight:600;}
                .fbtn{background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.07);border-radius:8px;color:#c4c4cc;font-family:'Outfit',sans-serif;font-size:13px;padding:7px 14px;cursor:pointer;transition:all 0.15s;}
                .fbtn:hover,.fbtn.on{background:rgba(139,92,246,0.1);border-color:rgba(139,92,246,0.35);color:#c4b5fd;}
            `}</style>

            <ParticleCanvas/>
            <div style={{position:'fixed',inset:0,zIndex:0,pointerEvents:'none',opacity:0.35,backgroundImage:'linear-gradient(rgba(139,92,246,0.045) 1px,transparent 1px),linear-gradient(90deg,rgba(139,92,246,0.045) 1px,transparent 1px)',backgroundSize:'72px 72px',maskImage:'radial-gradient(ellipse 100% 55% at 50% 0%,black 0%,transparent 100%)'}}/>
            <div style={{position:'fixed',top:-180,left:'50%',transform:'translateX(-50%)',width:900,height:500,zIndex:0,pointerEvents:'none',background:'radial-gradient(ellipse at center,rgba(139,92,246,0.09) 0%,transparent 70%)'}}/>

            <AppNav/>

            <div className="page-content" style={{position:'relative',zIndex:1,maxWidth:1280,margin:'0 auto',padding:'48px 48px 80px'}}>
                {activeBatch ? (
                    loadingDetail ? (
                        <div style={{display:'flex',justifyContent:'center',paddingTop:80}}>
                            <div style={{width:18,height:18,border:'2px solid rgba(139,92,246,0.3)',borderTopColor:'#8b5cf6',borderRadius:'50%',animation:'spin 0.8s linear infinite'}}/>
                        </div>
                    ) : (
<BatchDetail batch={activeBatch.batch} leads={activeBatch.leads} onBack={()=>setActiveBatch(null)} onStageChange={handleStageChange} onCallOutcomeChange={handleCallOutcomeChange}/>                    )
                ) : (
                    <>
                        <div className="f1" style={{marginBottom:28}}>
                            <div style={{display:'inline-flex',alignItems:'center',gap:7,background:'rgba(139,92,246,0.08)',border:'1px solid rgba(139,92,246,0.18)',borderRadius:6,padding:'4px 12px',marginBottom:14}}>
                                <div style={{width:5,height:5,borderRadius:'50%',background:'#8b5cf6',animation:'pulse 1.5s infinite'}}/>
                                <span style={{color:'#a78bfa',fontSize:'0.64rem',fontWeight:700,letterSpacing:'2px',textTransform:'uppercase',fontFamily:"'JetBrains Mono',monospace"}}>Scrape History</span>
                            </div>
                            <div style={{display:'flex',alignItems:'flex-end',justifyContent:'space-between',flexWrap:'wrap',gap:12}}>
                                <div>
                                    <h1 style={{fontSize:'clamp(1.8rem,3vw,2.6rem)',fontWeight:900,letterSpacing:'-1.5px',color:'#fafafa',marginBottom:6}}>Your Batches</h1>
                                    <p style={{color:'#c4c4cc',fontSize:15}}>
                                        {batches.length===0
                                            ? 'No batches yet — run a scrape from the Leads page to get started.'
                                            : `${filteredBatches.length} of ${batches.length} ${batches.length===1?'batch':'batches'} shown`}
                                    </p>
                                </div>
                                {batches.length>0 && (
                                    <button onClick={()=>setShowFilters(f=>!f)}
                                        style={{display:'flex',alignItems:'center',gap:7,background:showFilters||activeFilterCount>0?'rgba(139,92,246,0.1)':'rgba(255,255,255,0.03)',border:`1px solid ${showFilters||activeFilterCount>0?'rgba(139,92,246,0.35)':'rgba(255,255,255,0.07)'}`,borderRadius:10,padding:'9px 16px',color:showFilters||activeFilterCount>0?'#c4b5fd':'#c4c4cc',fontSize:13,fontWeight:600,cursor:'pointer',fontFamily:"'Outfit',sans-serif",transition:'all 0.15s'}}>
                                        <SlidersHorizontal size={13}/>
                                        Filters
                                        {activeFilterCount>0 && <span style={{background:'#8b5cf6',borderRadius:20,padding:'1px 7px',fontSize:10,color:'#fff',fontWeight:700,marginLeft:2}}>{activeFilterCount}</span>}
                                    </button>
                                )}
                            </div>
                        </div>

                        {showFilters && batches.length>0 && (
                            <div style={{background:'rgba(255,255,255,0.015)',border:'1px solid rgba(255,255,255,0.06)',borderRadius:14,padding:'20px 22px',marginBottom:20,animation:'expandDown 0.2s ease'}}>
                                <FilterBar batches={batches} filters={filters} onChange={handleFilterChange} onClear={clearFilters}/>
                            </div>
                        )}

                        {loading ? (
                            <div style={{display:'flex',justifyContent:'center',paddingTop:80}}>
                                <div style={{width:18,height:18,border:'2px solid rgba(139,92,246,0.3)',borderTopColor:'#8b5cf6',borderRadius:'50%',animation:'spin 0.8s linear infinite'}}/>
                            </div>
                        ) : batches.length===0 ? (
                            <div style={{textAlign:'center',paddingTop:80}}>
                                <div style={{fontSize:13,color:'#b8c2d4',fontFamily:"'JetBrains Mono',monospace",marginBottom:16}}>— No batches yet —</div>
                                <button onClick={()=>navigate('/leads')} style={{background:'linear-gradient(135deg,#8b5cf6,#6366f1)',border:'none',borderRadius:9,padding:'10px 22px',color:'#fff',fontSize:13,fontWeight:700,cursor:'pointer',fontFamily:"'Outfit',sans-serif"}}>
                                    Go scrape some leads →
                                </button>
                            </div>
                        ) : filteredBatches.length===0 ? (
                            <div style={{textAlign:'center',paddingTop:60}}>
                                <div style={{fontSize:13,color:'#b8c2d4',fontFamily:"'JetBrains Mono',monospace",marginBottom:12}}>— No batches match your filters —</div>
                                <button onClick={clearFilters} style={{background:'rgba(139,92,246,0.08)',border:'1px solid rgba(139,92,246,0.2)',borderRadius:9,padding:'8px 18px',color:'#a78bfa',fontSize:13,fontWeight:600,cursor:'pointer',fontFamily:"'Outfit',sans-serif"}}>
                                    Clear filters
                                </button>
                            </div>
                        ) : (
                            <div className="f2" style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(300px,1fr))',gap:16}}>
                                {filteredBatches.map(b=><BatchCard key={b.id} batch={b} onClick={()=>openBatch(b.id, b.hid)}/>)}
                            </div>
                        )}
                    </>
                )}
            </div>
        </div>
    )
}