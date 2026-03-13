import { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import Select from 'react-select'
import { useAuth } from '../context/AuthContext'
import {
  Search, MapPin, AlertTriangle, ExternalLink, Plus, Download,
  ChevronDown, Zap, BarChart2, Users, Target, ArrowUpRight,
  CheckCircle2, Circle, MoreHorizontal, X, CheckCheck, Square,
  Globe, PhoneCall,
} from 'lucide-react'
import NavbarDropdown from '../components/NavbarDropdown'

// ─── Constants ────────────────────────────────────────────────────────────────

const NICHES = [
  'Food Trucks','Plumbing','HVAC','Roofing','Landscaping','Auto Repair',
  'Dentists','Barbershops','Restaurants','Electricians','Tree Services',
  'Pressure Washing','Nail Salons','Pet Grooming','Gyms','Painters','Handymen',
  'Hair Salons','Cleaning Services','Pest Control',
].map(n => ({ value: n, label: n }))

const CITIES = [
  'Sacramento, CA','Los Angeles, CA','San Diego, CA','San Francisco, CA',
  'Dallas, TX','Miami, FL','Austin, TX','Phoenix, AZ','Seattle, WA',
  'Denver, CO','Portland, OR','Las Vegas, NV','Atlanta, GA','Chicago, IL',
  'New York, NY','Houston, TX',
].map(c => ({ value: c, label: c }))

const STAGES = ['New Lead', 'Contacted', 'Closed']

const STAGE_STYLE = {
  'New Lead':  { bg: 'rgba(99,102,241,0.12)',  border: 'rgba(99,102,241,0.3)',  color: '#818cf8' },
  'Contacted': { bg: 'rgba(251,146,60,0.12)',  border: 'rgba(251,146,60,0.3)',  color: '#fb923c' },
  'Closed':    { bg: 'rgba(74,222,128,0.12)',  border: 'rgba(74,222,128,0.3)',  color: '#4ade80' },
}

const scoreColor = s => s >= 85 ? '#4ade80' : s >= 70 ? '#fb923c' : '#f87171'

const selectStyles = {
  control: (b, s) => ({
    ...b,
    background: 'rgba(255,255,255,0.03)',
    border: `1px solid ${s.isFocused ? 'rgba(139,92,246,0.6)' : 'rgba(255,255,255,0.08)'}`,
    borderRadius: '9px', boxShadow: s.isFocused ? '0 0 0 3px rgba(139,92,246,0.1)' : 'none',
    minHeight: '38px', cursor: 'pointer', transition: 'all 0.2s',
    '&:hover': { borderColor: 'rgba(139,92,246,0.35)' },
  }),
  menu: b => ({
    ...b, background: '#0d0d12',
    border: '1px solid rgba(255,255,255,0.07)',
    borderRadius: '10px', boxShadow: '0 20px 60px rgba(0,0,0,0.8)', zIndex: 9999,
  }),
  menuList: b => ({
    ...b, padding: '4px',
    '::-webkit-scrollbar': { width: '3px' },
    '::-webkit-scrollbar-thumb': { background: 'rgba(139,92,246,0.4)', borderRadius: '2px' },
  }),
  option: (b, s) => ({
    ...b,
    background: s.isFocused ? 'rgba(139,92,246,0.1)' : 'transparent',
    color: s.isFocused ? '#c4b5fd' : '#71717a',
    borderRadius: '6px', fontSize: '0.85rem',
    padding: '9px 12px', cursor: 'pointer', transition: 'all 0.15s',
  }),
  singleValue: b => ({ ...b, color: '#e4e4e7', fontSize: '0.85rem' }),
  placeholder: b => ({ ...b, color: '#3f3f46', fontSize: '0.85rem' }),
  input: b => ({ ...b, color: '#fff', fontSize: '0.85rem' }),
  indicatorSeparator: () => ({ display: 'none' }),
  dropdownIndicator: (b, s) => ({
    ...b, color: s.isFocused ? '#8b5cf6' : '#3f3f46',
    transition: 'color 0.2s, transform 0.25s',
    transform: s.selectProps.menuIsOpen ? 'rotate(180deg)' : 'rotate(0deg)',
    paddingRight: '10px', '&:hover': { color: '#8b5cf6' },
  }),
  clearIndicator: b => ({ ...b, color: '#3f3f46', padding: '0 6px', '&:hover': { color: '#f87171' } }),
}

// ─── Particle Canvas ──────────────────────────────────────────────────────────

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
      x: Math.random() * window.innerWidth, y: Math.random() * window.innerHeight,
      r: Math.random() * 1.0 + 0.2, s: Math.random() * 0.2 + 0.04,
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

// ─── Scraper Animation ────────────────────────────────────────────────────────

function ScrapeAnimation({ job, query, location, jobId, onDismiss }) {
  const [dots, setDots] = useState(0)
  const [scanLine, setScanLine] = useState(0)
  const [visibleCompany, setVisibleCompany] = useState(null)
  const [companyVisible, setCompanyVisible] = useState(false)
  const [stopping, setStopping] = useState(false)
  const [displayEta, setDisplayEta] = useState(null)
  const prevCompanyCount = useRef(0)
  const tickerTimeout = useRef(null)

  const isRunning  = job?.status === 'queued' || job?.status === 'running'
  const isDone     = job?.status === 'done'
  const isStopped  = job?.status === 'stopped'
  const isError    = job?.status === 'error'
  const isFinished = isDone || isStopped || isError
  const progress   = job?.progress ?? 0
  const companies  = job?.found_companies || []
  const foundCount = job?.found_count ?? 0
  const etaSeconds = job?.eta_seconds ?? null

  useEffect(() => {
    if (!isRunning) return
    const t = setInterval(() => setDots(d => (d + 1) % 4), 400)
    return () => clearInterval(t)
  }, [isRunning])

  useEffect(() => {
    if (!isRunning) return
    const t = setInterval(() => setScanLine(p => (p + 1.4) % 100), 28)
    return () => clearInterval(t)
  }, [isRunning])

  useEffect(() => {
    if (etaSeconds === null || !isRunning) return
    setDisplayEta(etaSeconds)
  }, [etaSeconds, isRunning])

  useEffect(() => {
    if (!isRunning || companies.length === 0) return
    if (companies.length <= prevCompanyCount.current) return
    const latest = companies[companies.length - 1]
    prevCompanyCount.current = companies.length
    clearTimeout(tickerTimeout.current)
    setCompanyVisible(false)
    setTimeout(() => { setVisibleCompany(latest); setCompanyVisible(true) }, 150)
    tickerTimeout.current = setTimeout(() => setCompanyVisible(false), 2500)
  }, [companies.length, isRunning])

  useEffect(() => () => clearTimeout(tickerTimeout.current), [])

  const handleStop = () => {
    if (!jobId || stopping) return
    setStopping(true)
    fetch(`http://127.0.0.1:8000/scrape/stop/${jobId}`, { method: 'POST', credentials: 'include' }).catch(() => {})
  }

  const formatEta = (s) => {
    if (s === null || s === undefined) return '—'
    if (s <= 0) return 'finishing...'
    if (s < 60) return `~${s}s`
    return `~${Math.ceil(s / 60)}m`
  }

  const stages = [
    { label: 'Launch browser', pct: 10 },
    { label: 'Load Maps',      pct: 20 },
    { label: 'Scroll results', pct: 45 },
    { label: 'Extract data',   pct: 70 },
    { label: 'Save to DB',     pct: 86 },
  ]
  const currentStage = stages.reduce((acc, s) => progress >= s.pct ? s : acc, stages[0])

  const borderColor = isDone ? 'rgba(74,222,128,0.2)' : isStopped ? 'rgba(251,146,60,0.2)' : isError ? 'rgba(248,113,113,0.2)' : 'rgba(139,92,246,0.18)'
  const bgColor     = isDone ? 'rgba(74,222,128,0.03)' : isStopped ? 'rgba(251,146,60,0.03)' : isError ? 'rgba(248,113,113,0.03)' : 'rgba(139,92,246,0.03)'
  const shimmer     = isDone ? 'rgba(74,222,128,0.7)' : isStopped ? 'rgba(251,146,60,0.7)' : isError ? 'rgba(248,113,113,0.7)' : 'rgba(139,92,246,0.8)'

  return (
    <div style={{ position: 'relative', borderRadius: 16, overflow: 'hidden', background: bgColor, border: `1px solid ${borderColor}`, marginBottom: 20, transition: 'all 0.4s ease' }}>
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 1, background: `linear-gradient(90deg, transparent, ${shimmer}, transparent)` }} />

      <div style={{ padding: '20px 22px' }}>
        {isRunning && (
          <>
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ position: 'relative', width: 22, height: 22, flexShrink: 0 }}>
                  <div style={{ position: 'absolute', inset: 0, borderRadius: '50%', background: 'rgba(139,92,246,0.25)', animation: 'scrapeRipple 1.6s ease-out infinite' }} />
                  <div style={{ position: 'absolute', inset: 5, borderRadius: '50%', background: '#8b5cf6' }} />
                </div>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#c4b5fd' }}>Scanning{'.'.repeat(dots)}</div>
                  <div style={{ fontSize: 11, color: '#3f3f46', fontFamily: "'JetBrains Mono', monospace", marginTop: 1 }}>{query?.value} · {location?.value}</div>
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 16, fontWeight: 800, color: '#e4e4e7', fontFamily: "'JetBrains Mono', monospace", lineHeight: 1 }}>{foundCount}</div>
                  <div style={{ fontSize: 9, color: '#3f3f46', textTransform: 'uppercase', letterSpacing: '0.1em', marginTop: 2 }}>found</div>
                </div>
                <div style={{ width: 1, height: 28, background: 'rgba(255,255,255,0.06)' }} />
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 16, fontWeight: 800, fontFamily: "'JetBrains Mono', monospace", lineHeight: 1, transition: 'color 0.5s', color: displayEta !== null && displayEta < 15 ? '#4ade80' : displayEta !== null && displayEta < 30 ? '#fb923c' : '#e4e4e7' }}>
                    {formatEta(displayEta)}
                  </div>
                  <div style={{ fontSize: 9, color: '#3f3f46', textTransform: 'uppercase', letterSpacing: '0.1em', marginTop: 2 }}>remaining</div>
                </div>
                <button
                  onClick={handleStop} disabled={stopping}
                  style={{ display: 'flex', alignItems: 'center', gap: 5, background: stopping ? 'rgba(255,255,255,0.02)' : 'rgba(248,113,113,0.08)', border: `1px solid ${stopping ? 'rgba(255,255,255,0.06)' : 'rgba(248,113,113,0.2)'}`, borderRadius: 8, padding: '6px 12px', color: stopping ? '#3f3f46' : '#f87171', fontSize: 12, fontWeight: 600, cursor: stopping ? 'not-allowed' : 'pointer', fontFamily: "'Outfit', sans-serif", transition: 'all 0.2s' }}
                  onMouseEnter={e => { if (!stopping) e.currentTarget.style.background = 'rgba(248,113,113,0.14)' }}
                  onMouseLeave={e => { if (!stopping) e.currentTarget.style.background = 'rgba(248,113,113,0.08)' }}
                >
                  <Square size={10} fill={stopping ? '#3f3f46' : '#f87171'} />
                  {stopping ? 'Stopping...' : 'Stop'}
                </button>
              </div>
            </div>

            {/* Radar + company ticker */}
            <div style={{ position: 'relative', height: 96, borderRadius: 10, overflow: 'hidden', background: 'rgba(0,0,0,0.28)', border: '1px solid rgba(139,92,246,0.1)', marginBottom: 14 }}>
              {[25, 50, 75].map(x => <div key={x} style={{ position: 'absolute', left: `${x}%`, top: 0, bottom: 0, width: 1, background: 'rgba(139,92,246,0.07)' }} />)}
              <div style={{ position: 'absolute', top: '50%', left: 0, right: 0, height: 1, background: 'rgba(139,92,246,0.07)' }} />
              <div style={{ position: 'absolute', top: 0, bottom: 0, left: `${scanLine}%`, width: 2, background: 'linear-gradient(180deg, transparent, rgba(139,92,246,0.9) 50%, transparent)', boxShadow: '0 0 10px rgba(139,92,246,0.5)', transition: 'left 0.028s linear' }} />
              <div style={{ position: 'absolute', top: 0, bottom: 0, left: `${Math.max(0, scanLine - 10)}%`, width: '10%', background: 'linear-gradient(90deg, transparent, rgba(139,92,246,0.05))', pointerEvents: 'none' }} />
              {[{ top: 5, left: 5, borderTop: '1px solid rgba(139,92,246,0.4)', borderLeft: '1px solid rgba(139,92,246,0.4)' }, { top: 5, right: 5, borderTop: '1px solid rgba(139,92,246,0.4)', borderRight: '1px solid rgba(139,92,246,0.4)' }, { bottom: 5, left: 5, borderBottom: '1px solid rgba(139,92,246,0.4)', borderLeft: '1px solid rgba(139,92,246,0.4)' }, { bottom: 5, right: 5, borderBottom: '1px solid rgba(139,92,246,0.4)', borderRight: '1px solid rgba(139,92,246,0.4)' }].map((s, i) => <div key={i} style={{ position: 'absolute', width: 9, height: 9, ...s }} />)}

              {/* Company ticker */}
              <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none', opacity: companyVisible ? 1 : 0, transform: companyVisible ? 'translateY(0)' : 'translateY(6px)', transition: 'opacity 0.3s ease, transform 0.3s ease' }}>
                {visibleCompany && (
                  <>
                    <div style={{ fontSize: 13, fontWeight: 700, color: '#e4e4e7', textShadow: '0 0 20px rgba(139,92,246,0.8)', fontFamily: "'Outfit', sans-serif", letterSpacing: '-0.3px', maxWidth: '80%', textAlign: 'center', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {visibleCompany.name}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 5 }}>
                      {visibleCompany.phone && (
                        <span style={{ fontSize: 10, color: '#52525b', fontFamily: "'JetBrains Mono', monospace", display: 'flex', alignItems: 'center', gap: 3 }}>
                          <PhoneCall size={8} />{visibleCompany.phone}
                        </span>
                      )}
                      <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.08em', padding: '2px 7px', borderRadius: 20, background: visibleCompany.has_website ? 'rgba(139,92,246,0.12)' : 'rgba(248,113,113,0.12)', border: `1px solid ${visibleCompany.has_website ? 'rgba(139,92,246,0.25)' : 'rgba(248,113,113,0.25)'}`, color: visibleCompany.has_website ? '#a78bfa' : '#f87171', fontFamily: "'JetBrains Mono', monospace", display: 'flex', alignItems: 'center', gap: 3 }}>
                        {visibleCompany.has_website ? <><Globe size={7} /> HAS SITE</> : <><AlertTriangle size={7} /> NO SITE</>}
                      </span>
                      <span style={{ fontSize: 10, color: '#52525b', fontFamily: "'JetBrains Mono', monospace" }}>score {visibleCompany.score}</span>
                    </div>
                  </>
                )}
              </div>
              <div style={{ position: 'absolute', bottom: 7, left: 10, fontSize: 9, color: '#4c1d95', fontFamily: "'JetBrains Mono', monospace", letterSpacing: '0.1em', textTransform: 'uppercase' }}>{currentStage.label}</div>
            </div>

            {/* Progress bar */}
            <div style={{ marginBottom: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 5 }}>
                <span style={{ fontSize: 11, color: '#3f3f46', fontFamily: "'JetBrains Mono', monospace" }}>{job?.message || 'Initialising...'}</span>
                <span style={{ fontSize: 11, color: '#8b5cf6', fontFamily: "'JetBrains Mono', monospace" }}>{progress}%</span>
              </div>
              <div style={{ height: 3, background: 'rgba(255,255,255,0.04)', borderRadius: 2, overflow: 'hidden' }}>
                <div style={{ height: '100%', borderRadius: 2, background: 'linear-gradient(90deg, #8b5cf6, #6366f1)', width: `${progress}%`, transition: 'width 0.8s ease', boxShadow: '0 0 8px rgba(139,92,246,0.5)' }} />
              </div>
            </div>

            {/* Stage pills */}
            <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
              {stages.map(s => {
                const done = progress > s.pct
                const current = currentStage.label === s.label
                return (
                  <div key={s.label} style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '3px 8px', borderRadius: 20, fontSize: 10, background: done ? 'rgba(139,92,246,0.12)' : current ? 'rgba(139,92,246,0.06)' : 'transparent', border: `1px solid ${done ? 'rgba(139,92,246,0.22)' : current ? 'rgba(139,92,246,0.12)' : 'rgba(255,255,255,0.04)'}`, color: done ? '#a78bfa' : current ? '#7c3aed' : '#27272a', fontFamily: "'JetBrains Mono', monospace", transition: 'all 0.3s' }}>
                    {done ? <CheckCheck size={8} /> : current ? <div style={{ width: 5, height: 5, borderRadius: '50%', background: '#8b5cf6', animation: 'pulse 1.2s infinite' }} /> : <div style={{ width: 5, height: 5, borderRadius: '50%', background: '#27272a' }} />}
                    {s.label}
                  </div>
                )
              })}
            </div>
          </>
        )}

        {isFinished && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ width: 38, height: 38, borderRadius: '50%', flexShrink: 0, background: isDone ? 'rgba(74,222,128,0.1)' : isStopped ? 'rgba(251,146,60,0.1)' : 'rgba(248,113,113,0.1)', border: `1px solid ${isDone ? 'rgba(74,222,128,0.25)' : isStopped ? 'rgba(251,146,60,0.25)' : 'rgba(248,113,113,0.25)'}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {isDone ? <CheckCircle2 size={16} color="#4ade80" strokeWidth={1.5} /> : isStopped ? <Square size={14} color="#fb923c" fill="#fb923c" /> : <X size={16} color="#f87171" strokeWidth={1.5} />}
              </div>
              <div>
                <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 2, color: isDone ? '#4ade80' : isStopped ? '#fb923c' : '#f87171' }}>
                  {isDone ? 'Scrape complete!' : isStopped ? 'Stopped — results saved' : 'Scrape failed'}
                </div>
                <div style={{ fontSize: 12, color: '#52525b', maxWidth: 460 }}>{job?.message}</div>
              </div>
            </div>
            <button onClick={onDismiss} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#3f3f46', padding: 6, display: 'flex', transition: 'color 0.2s' }} onMouseEnter={e => e.currentTarget.style.color = '#71717a'} onMouseLeave={e => e.currentTarget.style.color = '#3f3f46'}>
              <X size={14} />
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function StageDropdown({ lead, onChange }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)
  const s = STAGE_STYLE[lead.pipeline_stage] || STAGE_STYLE['New Lead']

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
        {lead.pipeline_stage || 'New Lead'}
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
            const active = stage === (lead.pipeline_stage || 'New Lead')
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

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function Leads() {
  const { user } = useAuth()
  const navigate = useNavigate()

  // Real data state
  const [leads, setLeads]           = useState([])
  const [loadingLeads, setLoadingLeads] = useState(true)

  // Search / filter
  const [search, setSearch]         = useState('')
  const [filterStage, setFilterStage] = useState('All')
  const [filterSite, setFilterSite]   = useState('All')
  const [focused, setFocused]       = useState(false)

  // Scraper state
  const [scrapeQuery, setScrapeQuery]       = useState(null)
  const [scrapeLocation, setScrapeLocation] = useState(null)
  const [noWebOnly, setNoWebOnly]           = useState(false)
  const [showScraper, setShowScraper]       = useState(false)
  const [jobId, setJobId]                   = useState(null)
  const [job, setJob]                       = useState(null)
  const pollRef = useRef(null)

  // ── Fetch leads from DB ──────────────────────────────────────────────────
  const fetchLeads = useCallback(() => {
    fetch('http://127.0.0.1:8000/leads', { credentials: 'include' })
      .then(r => r.json())
      .then(data => { setLeads(Array.isArray(data) ? data : []); setLoadingLeads(false) })
      .catch(() => setLoadingLeads(false))
  }, [])

  useEffect(() => { fetchLeads() }, [fetchLeads])

  // ── Poll job status ──────────────────────────────────────────────────────
  useEffect(() => {
    if (!jobId) return
    const poll = () => {
      fetch(`http://127.0.0.1:8000/scrape/status/${jobId}`, { credentials: 'include' })
        .then(r => r.json())
        .then(data => {
          setJob(data)
          if (data.status === 'done' || data.status === 'stopped') {
            clearInterval(pollRef.current)
            fetchLeads()
          }
          if (data.status === 'error') {
            clearInterval(pollRef.current)
          }
        })
        .catch(() => {})
    }
    poll()
    pollRef.current = setInterval(poll, 2000)
    return () => clearInterval(pollRef.current)
  }, [jobId, fetchLeads])

  // ── Start scrape ─────────────────────────────────────────────────────────
  const handleScrape = () => {
    if (!scrapeQuery || !scrapeLocation) return
    setJob({ status: 'queued', message: 'Job queued...', progress: 0 })
    setShowScraper(true)

    fetch('http://127.0.0.1:8000/scrape/start', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({
        query: scrapeQuery.value,
        location: scrapeLocation.value,
        no_website_only: noWebOnly,
      }),
    })
      .then(r => r.json())
      .then(data => setJobId(data.job_id))
      .catch(err => setJob({ status: 'error', message: String(err), progress: 0 }))
  }

  // ── Stage change (optimistic) ────────────────────────────────────────────
  const changeStage = (id, stage) => {
    setLeads(prev => prev.map(l => l.id === id ? { ...l, pipeline_stage: stage } : l))
    // Optionally PATCH to backend here
  }

  // ── Derived stats ────────────────────────────────────────────────────────
  const noSite    = leads.filter(l => l.website_status === 'NO WEBSITE').length
  const contacted = leads.filter(l => l.pipeline_stage === 'Contacted').length
  const avgScore  = leads.length ? Math.round(leads.reduce((a, l) => a + (l.score || 0), 0) / leads.length) : 0
  const topScore  = leads.length ? Math.max(...leads.map(l => l.score || 0)) : 0

  const firstName = user?.full_name?.split(' ')[0] || user?.email?.split('@')[0] || 'there'

  // ── Filtered + sorted leads ──────────────────────────────────────────────
  const filtered = leads
    .filter(l => {
      const q = search.toLowerCase()
      const matchQ = (l.name || '').toLowerCase().includes(q) || (l.city || '').toLowerCase().includes(q)
      const matchS = filterStage === 'All' || l.pipeline_stage === filterStage
      const matchW = filterSite === 'All'
        || (filterSite === 'No Website' && l.website_status === 'NO WEBSITE')
        || (filterSite === 'Has Website' && l.website_status === 'HAS WEBSITE')
      return matchQ && matchS && matchW
    })
    .sort((a, b) => (b.score || 0) - (a.score || 0))

  const isScraping = job?.status === 'queued' || job?.status === 'running' || job?.status === 'stopping'

  // ── Export CSV ───────────────────────────────────────────────────────────
  const exportCSV = () => {
    const headers = ['Name', 'City', 'Phone', 'Website Status', 'Score', 'Stage']
    const rows = filtered.map(l => [l.name, l.city, l.phone, l.website_status, l.score, l.pipeline_stage].join(','))
    const blob = new Blob([[headers.join(','), ...rows].join('\n')], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a'); a.href = url; a.download = 'leads.csv'; a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div style={{ minHeight: '100vh', background: '#09090f', color: '#fafafa', fontFamily: "'Outfit', sans-serif", overflowX: 'hidden' }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@400;500;600;700;800;900&family=JetBrains+Mono:wght@400;700&display=swap');
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        html, body { scrollbar-width: none; overflow-x: hidden; }
        html::-webkit-scrollbar { display: none; }

        @keyframes fadeUp   { from{opacity:0;transform:translateY(16px)} to{opacity:1;transform:translateY(0)} }
        @keyframes pulse    { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:0.4;transform:scale(0.8)} }
        @keyframes scrapeRipple { 0%{transform:scale(1);opacity:0.6} 100%{transform:scale(2.5);opacity:0} }
        @keyframes scrapeFloat  { 0%{transform:translateY(0) translateX(0)} 100%{transform:translateY(-6px) translateX(3px)} }
        @keyframes spin     { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }
        @keyframes shimmer  { 0%{opacity:0.4} 50%{opacity:1} 100%{opacity:0.4} }

        .f1{animation:fadeUp 0.5s cubic-bezier(0.16,1,0.3,1) 0.05s both}
        .f2{animation:fadeUp 0.5s cubic-bezier(0.16,1,0.3,1) 0.13s both}
        .f3{animation:fadeUp 0.5s cubic-bezier(0.16,1,0.3,1) 0.21s both}
        .f4{animation:fadeUp 0.5s cubic-bezier(0.16,1,0.3,1) 0.29s both}

        .fbtn {
          background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.07);
          border-radius: 8px; color: #71717a; font-family:'Outfit',sans-serif;
          font-size:13px; padding:7px 14px; cursor:pointer; transition:all 0.15s;
        }
        .fbtn:hover,.fbtn.on {
          background:rgba(139,92,246,0.1); border-color:rgba(139,92,246,0.35); color:#c4b5fd;
        }
        .add-btn {
          background:linear-gradient(135deg,#8b5cf6,#6366f1); border:none; border-radius:9px;
          color:#fff; font-family:'Outfit',sans-serif; font-size:13px; font-weight:700;
          padding:9px 18px; cursor:pointer; display:flex; align-items:center; gap:7px;
          transition:opacity 0.2s,transform 0.15s;
        }
        .add-btn:hover { opacity:0.88; transform:translateY(-1px); }
        .add-btn:disabled { opacity:0.4; cursor:not-allowed; transform:none; }
        .icon-btn {
          background:rgba(255,255,255,0.03); border:1px solid rgba(255,255,255,0.07);
          border-radius:9px; color:#71717a; padding:9px 14px; cursor:pointer;
          display:flex; align-items:center; gap:7px; font-family:'Outfit',sans-serif;
          font-size:13px; transition:all 0.15s;
        }
        .icon-btn:hover { border-color:rgba(255,255,255,0.14); color:#a1a1aa; }
        .nav-lnk {
          background:none; border:none; color:#3f3f46; font-size:14px; cursor:pointer;
          font-family:'Outfit',sans-serif; transition:color 0.2s; padding:0;
        }
        .nav-lnk:hover { color:#a1a1aa; }
        .row-wrap:hover { background: rgba(255,255,255,0.02) !important; }
        .scrape-toggle {
          display: flex; align-items: center; gap: 8px;
          background: rgba(139,92,246,0.06); border: 1px solid rgba(139,92,246,0.18);
          border-radius: 9px; padding: 9px 16px; cursor: pointer;
          color: #a78bfa; font-family:'Outfit',sans-serif; font-size:13px; font-weight:600;
          transition: all 0.2s;
        }
        .scrape-toggle:hover { background:rgba(139,92,246,0.12); border-color:rgba(139,92,246,0.3); }
        .scan-btn {
          background:linear-gradient(135deg,#8b5cf6,#6366f1); border:none; border-radius:9px;
          color:#fff; font-family:'Outfit',sans-serif; font-size:13px; font-weight:700;
          padding:9px 20px; cursor:pointer; display:flex; align-items:center; gap:7px;
          transition:opacity 0.2s,transform 0.15s; white-space:nowrap;
          box-shadow: 0 4px 16px rgba(139,92,246,0.25);
        }
        .scan-btn:hover:not(:disabled) { opacity:0.88; transform:translateY(-1px); box-shadow:0 8px 24px rgba(139,92,246,0.35); }
        .scan-btn:disabled { opacity:0.4; cursor:not-allowed; transform:none; }
        .empty-row {
          padding: 64px 20px; text-align: center; animation: shimmer 2s ease-in-out infinite;
        }
      `}</style>

      <ParticleCanvas />
      <div style={{ position:'fixed',inset:0,zIndex:0,pointerEvents:'none',opacity:0.35,backgroundImage:'linear-gradient(rgba(139,92,246,0.045) 1px,transparent 1px),linear-gradient(90deg,rgba(139,92,246,0.045) 1px,transparent 1px)',backgroundSize:'72px 72px',maskImage:'radial-gradient(ellipse 100% 55% at 50% 0%,black 0%,transparent 100%)' }} />
      <div style={{ position:'fixed',top:-180,left:'50%',transform:'translateX(-50%)',width:900,height:500,zIndex:0,pointerEvents:'none',background:'radial-gradient(ellipse at center,rgba(139,92,246,0.09) 0%,transparent 70%)' }} />

      {/* ── NAV ── */}
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

      {/* ── CONTENT ── */}
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
            {leads.length === 0
              ? 'No leads yet — use the scraper below to find your first prospects.'
              : <>You have <span style={{ color:'#a78bfa',fontWeight:600 }}>{noSite} leads</span> without a website — ready to contact.</>
            }
          </p>
        </div>

        {/* Stats */}
        <div className="f2" style={{ display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:14,marginBottom:36 }}>
          <StatCard icon={Users}     label="Total Leads"  value={leads.length} sub={leads.length > 0 ? `${leads.length} imported` : 'Run scraper to start'} accent="#8b5cf6" />
          <StatCard icon={Target}    label="No Website"   value={noSite}       sub={leads.length > 0 ? `${Math.round(noSite / Math.max(leads.length,1) * 100)}% of leads` : '—'} accent="#f87171" />
          <StatCard icon={Zap}       label="Contacted"    value={contacted}    sub={contacted > 0 ? `${contacted} in progress` : 'None yet'} accent="#fb923c" />
          <StatCard icon={BarChart2} label="Avg AI Score" value={avgScore || '—'} sub={topScore > 0 ? `Top score: ${topScore}` : '—'} accent="#4ade80" />
        </div>

        {/* ── Scraper panel ── */}
        <div className="f3" style={{ marginBottom: 20 }}>
          {/* Toggle button when scraper hidden */}
          {!showScraper && !isScraping && !job && (
            <button className="scrape-toggle" onClick={() => setShowScraper(true)}>
              <div style={{ width:6,height:6,borderRadius:'50%',background:'#8b5cf6',animation:'pulse 1.5s infinite' }} />
              <Search size={13} />
              Scrape Google Maps for new leads
            </button>
          )}

          {/* Scraper form */}
          {showScraper && !isScraping && !job && (
            <div style={{
              background: 'rgba(255,255,255,0.015)',
              border: '1px solid rgba(255,255,255,0.06)',
              borderRadius: 16, padding: '18px 20px',
              position: 'relative', overflow: 'hidden',
              marginBottom: 0,
            }}>
              <div style={{ position:'absolute',top:0,left:0,right:0,height:1,background:'linear-gradient(90deg,transparent,rgba(139,92,246,0.5),transparent)' }} />
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                <div style={{ flex: '1 1 180px', minWidth: 160 }}>
                  <Select
                    options={NICHES} styles={selectStyles}
                    placeholder="Business niche..."
                    value={scrapeQuery} onChange={setScrapeQuery} isClearable
                  />
                </div>
                <div style={{ flex: '1 1 180px', minWidth: 160 }}>
                  <Select
                    options={CITIES} styles={selectStyles}
                    placeholder="City or region..."
                    value={scrapeLocation} onChange={setScrapeLocation} isClearable
                  />
                </div>
                <label style={{ display:'flex',alignItems:'center',gap:7,cursor:'pointer',userSelect:'none',fontSize:13,color:'#71717a',whiteSpace:'nowrap' }}>
                  <input
                    type="checkbox" checked={noWebOnly} onChange={e => setNoWebOnly(e.target.checked)}
                    style={{ accentColor:'#8b5cf6', width:14, height:14 }}
                  />
                  No website only
                </label>
                <button
                  className="scan-btn"
                  onClick={handleScrape}
                  disabled={!scrapeQuery || !scrapeLocation}
                >
                  <Search size={13} /> Scan for leads
                </button>
                <button
                  onClick={() => setShowScraper(false)}
                  style={{ background:'none',border:'none',cursor:'pointer',color:'#3f3f46',padding:4,display:'flex',transition:'color 0.2s' }}
                  onMouseEnter={e => e.currentTarget.style.color='#71717a'}
                  onMouseLeave={e => e.currentTarget.style.color='#3f3f46'}
                >
                  <X size={14} />
                </button>
              </div>
              <p style={{ fontSize:11,color:'#27272a',marginTop:10,fontFamily:"'JetBrains Mono',monospace" }}>
                Headless Chrome scrapes Google Maps live · Takes 1–3 min · Duplicates are skipped
              </p>
            </div>
          )}

          {/* Scraping animation */}
          {job && (
            <ScrapeAnimation
              job={job}
              query={scrapeQuery}
              location={scrapeLocation}
              jobId={jobId}
              onDismiss={() => { setJob(null); setJobId(null); setShowScraper(false) }}
            />
          )}
        </div>

        {/* Toolbar */}
        <div className="f3" style={{ display:'flex',alignItems:'center',gap:10,marginBottom:16,flexWrap:'wrap' }}>
          <div style={{ display:'flex',alignItems:'center',gap:10,flex:1,minWidth:220,background:'rgba(255,255,255,0.03)',border:`1px solid ${focused ? 'rgba(139,92,246,0.5)' : 'rgba(255,255,255,0.07)'}`,borderRadius:9,padding:'0 14px',height:38,transition:'border-color 0.2s',boxShadow:focused ? '0 0 0 3px rgba(139,92,246,0.08)' : 'none' }}>
            <Search size={13} color="#3f3f46" />
            <input
              style={{ background:'none',border:'none',outline:'none',color:'#fafafa',fontSize:13,width:'100%',fontFamily:"'Outfit',sans-serif" }}
              placeholder="Search leads..."
              value={search} onChange={e => setSearch(e.target.value)}
              onFocus={() => setFocused(true)} onBlur={() => setFocused(false)}
            />
          </div>

          <div style={{ display:'flex',gap:6 }}>
            {['All',...STAGES].map(s => (
              <button key={s} className={`fbtn${filterStage===s?' on':''}`} onClick={() => setFilterStage(s)}>{s}</button>
            ))}
          </div>

          <div style={{ display:'flex',gap:6 }}>
            {['All','No Website','Has Website'].map(s => (
              <button key={s} className={`fbtn${filterSite===s?' on':''}`} onClick={() => setFilterSite(s)}>{s}</button>
            ))}
          </div>

          <div style={{ marginLeft:'auto',display:'flex',gap:8 }}>
            <button className="icon-btn" onClick={exportCSV}><Download size={13} />Export</button>
            <button className="add-btn" onClick={() => navigate('/add')}><Plus size={14} />Add Lead</button>
          </div>
        </div>

        {/* ── Table ── */}
        <div className="f4" style={{ background:'rgba(255,255,255,0.015)',border:'1px solid rgba(255,255,255,0.06)',borderRadius:16,overflow:'hidden',position:'relative' }}>
          <div style={{ position:'absolute',top:0,left:0,right:0,height:1,background:'linear-gradient(90deg,transparent,rgba(139,92,246,0.5),transparent)' }} />

          {/* Header */}
          <div style={{ display:'grid',gridTemplateColumns:'2fr 1fr 1fr 1fr 1fr 1fr',gap:16,padding:'12px 20px',borderBottom:'1px solid rgba(255,255,255,0.05)',background:'rgba(255,255,255,0.02)' }}>
            {['Business','City','Website','AI Score','Stage','Phone'].map(h => (
              <div key={h} style={{ fontSize:10,fontWeight:700,color:'#3f3f46',letterSpacing:'0.1em',textTransform:'uppercase',fontFamily:"'JetBrains Mono',monospace" }}>{h}</div>
            ))}
          </div>

          {/* Rows */}
          {loadingLeads ? (
            <div className="empty-row">
              <div style={{ display:'flex',alignItems:'center',justifyContent:'center',gap:10,color:'#3f3f46' }}>
                <div style={{ width:14,height:14,border:'2px solid rgba(139,92,246,0.3)',borderTopColor:'#8b5cf6',borderRadius:'50%',animation:'spin 0.8s linear infinite' }} />
                <span style={{ fontSize:13,fontFamily:"'JetBrains Mono',monospace" }}>Loading leads...</span>
              </div>
            </div>
          ) : filtered.length === 0 ? (
            <div className="empty-row">
              <div style={{ fontSize:13,color:'#3f3f46',fontFamily:"'JetBrains Mono',monospace",marginBottom:8 }}>
                {leads.length === 0 ? '— No leads in database —' : '— No leads match your filters —'}
              </div>
              {leads.length === 0 && (
                <div style={{ fontSize:12,color:'#27272a',fontFamily:"'JetBrains Mono',monospace" }}>
                  Use the scraper above to pull live data from Google Maps
                </div>
              )}
            </div>
          ) : (
            filtered.map(lead => {
              const noSiteL = lead.website_status === 'NO WEBSITE'
              return (
                <div key={lead.id} className="row-wrap" style={{ display:'grid',gridTemplateColumns:'2fr 1fr 1fr 1fr 1fr 1fr',alignItems:'center',gap:16,padding:'14px 20px',borderBottom:'1px solid rgba(255,255,255,0.04)',background:'transparent',transition:'background 0.15s' }}>

                  {/* Business name */}
                  <div style={{ display:'flex',alignItems:'center',gap:12,minWidth:0 }}>
                    <div style={{ width:36,height:36,borderRadius:10,flexShrink:0,background:noSiteL?'rgba(248,113,113,0.08)':'rgba(139,92,246,0.08)',border:`1px solid ${noSiteL?'rgba(248,113,113,0.18)':'rgba(139,92,246,0.18)'}`,display:'flex',alignItems:'center',justifyContent:'center' }}>
                      {noSiteL ? <AlertTriangle size={14} color="#f87171" strokeWidth={1.5} /> : <ExternalLink size={14} color="#8b5cf6" strokeWidth={1.5} />}
                    </div>
                    <div style={{ minWidth:0 }}>
                      <div style={{ fontSize:14,fontWeight:600,color:'#e4e4e7',whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis' }}>{lead.name}</div>
                    </div>
                  </div>

                  {/* City */}
                  <div style={{ fontSize:12,color:'#52525b',display:'flex',alignItems:'center',gap:4 }}>
                    <MapPin size={9} />{lead.city || '—'}
                  </div>

                  {/* Website badge */}
                  <div>
                    <span style={{ fontSize:10,fontWeight:700,letterSpacing:'0.06em',padding:'3px 8px',borderRadius:20,background:noSiteL?'rgba(248,113,113,0.1)':'rgba(139,92,246,0.1)',border:`1px solid ${noSiteL?'rgba(248,113,113,0.22)':'rgba(139,92,246,0.22)'}`,color:noSiteL?'#f87171':'#a78bfa',fontFamily:"'JetBrains Mono',monospace" }}>
                      {noSiteL ? 'NO SITE' : 'HAS SITE'}
                    </span>
                  </div>

                  {/* Score */}
                  <div style={{ display:'flex',alignItems:'center',gap:8 }}>
                    <div style={{ width:40,height:3,background:'rgba(255,255,255,0.06)',borderRadius:2 }}>
                      <div style={{ width:`${lead.score || 0}%`,height:'100%',borderRadius:2,background:scoreColor(lead.score || 0) }} />
                    </div>
                    <span style={{ fontSize:12,fontWeight:700,color:scoreColor(lead.score||0),fontFamily:"'JetBrains Mono',monospace",width:24 }}>{lead.score || 0}</span>
                  </div>

                  {/* Stage */}
                  <StageDropdown lead={lead} onChange={changeStage} />

                  {/* Phone + actions */}
                  <div style={{ display:'flex',alignItems:'center',gap:8,justifyContent:'flex-end' }}>
                    <span style={{ fontSize:11,color:'#3f3f46',fontFamily:"'JetBrains Mono',monospace" }}>{lead.phone || '—'}</span>
                    <div
                      style={{ width:28,height:28,borderRadius:7,cursor:'pointer',background:'rgba(255,255,255,0.03)',border:'1px solid rgba(255,255,255,0.06)',display:'flex',alignItems:'center',justifyContent:'center',transition:'background 0.15s' }}
                      onMouseEnter={e => e.currentTarget.style.background='rgba(139,92,246,0.1)'}
                      onMouseLeave={e => e.currentTarget.style.background='rgba(255,255,255,0.03)'}
                    >
                      <MoreHorizontal size={13} color="#52525b" />
                    </div>
                  </div>
                </div>
              )
            })
          )}

          {/* Footer */}
          <div style={{ padding:'12px 20px',borderTop:'1px solid rgba(255,255,255,0.04)',display:'flex',justifyContent:'space-between',alignItems:'center' }}>
            <span style={{ fontSize:11,color:'#3f3f46',fontFamily:"'JetBrains Mono',monospace" }}>
              Showing {filtered.length} of {leads.length} leads
            </span>
            <div style={{ display:'flex',alignItems:'center',gap:6 }}>
              <div style={{ width:5,height:5,borderRadius:'50%',background: isScraping ? '#fb923c' : '#8b5cf6',animation:'pulse 1.5s infinite' }} />
              <span style={{ fontSize:11,color:'#52525b',fontFamily:"'JetBrains Mono',monospace" }}>
                {isScraping ? 'Scraping...' : 'Live data'}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}