  import { useState, useEffect, useRef } from 'react'
    import { useNavigate } from 'react-router-dom'
    import { useAuth } from '../context/AuthContext'
  import Select from 'react-select'
  import {
    Search, Brain, LayoutDashboard, Mail, BarChart2, Download,
    MapPin, Globe, Sparkles, Handshake, AlertTriangle, ExternalLink
  } from 'lucide-react'
  import Navbar from '../components/Navbar'

  const NICHES = ['Plumbing','HVAC','Roofing','Landscaping','Auto Repair','Dentists',
    'Barbershops','Restaurants','Electricians','Tree Services','Pressure Washing',
    'Nail Salons','Pet Grooming','Gyms','Painters','Handymen'
  ].map(n => ({ value: n, label: n }))

  const CITIES = ['Sacramento, CA','Los Angeles, CA','San Diego, CA','Dallas, TX',
    'Miami, FL','Austin, TX','Phoenix, AZ','Seattle, WA'
  ].map(c => ({ value: c, label: c }))

  const selectStyles = {
    control: (b, s) => ({
      ...b,
      background: 'rgba(255,255,255,0.03)',
      border: `1px solid ${s.isFocused ? 'rgba(139,92,246,0.7)' : 'rgba(255,255,255,0.07)'}`,
      borderRadius: '8px', boxShadow: s.isFocused ? '0 0 0 3px rgba(139,92,246,0.12)' : 'none',
      minHeight: '50px', cursor: 'pointer', transition: 'all 0.2s',
      '&:hover': { borderColor: 'rgba(139,92,246,0.4)' },
    }),
    menu: (b) => ({
      ...b, background: '#0d0d12',
      border: '1px solid rgba(255,255,255,0.07)',
      borderRadius: '10px', boxShadow: '0 30px 80px rgba(0,0,0,0.8)', zIndex: 9999,
    }),
    menuList: (b) => ({
      ...b, padding: '5px',
      '::-webkit-scrollbar': { width: '3px' },
      '::-webkit-scrollbar-thumb': { background: 'rgba(139,92,246,0.4)', borderRadius: '2px' },
    }),
    option: (b, s) => ({
      ...b,
      background: s.isFocused ? 'rgba(139,92,246,0.1)' : 'transparent',
      color: s.isFocused ? '#c4b5fd' : '#555',
      borderRadius: '6px', fontSize: '0.875rem',
      padding: '10px 14px', cursor: 'pointer', transition: 'all 0.15s',
    }),
    singleValue: (b) => ({ ...b, color: '#e5e5e5', fontSize: '0.9rem' }),
    placeholder: (b) => ({ ...b, color: '#bdbdc3', fontSize: '0.9rem' }),
    input: (b) => ({ ...b, color: '#fff' }),
    indicatorSeparator: () => ({ display: 'none' }),
    dropdownIndicator: (b, s) => ({
      ...b,
      color: s.isFocused ? '#8b5cf6' : '#bdbdc3',
      transition: 'color 0.2s, transform 0.25s',
      transform: s.selectProps.menuIsOpen ? 'rotate(180deg)' : 'rotate(0deg)',
      paddingRight: '12px',
      '&:hover': { color: '#8b5cf6' },
    }),
    clearIndicator: (b) => ({ ...b, color: '#bdbdc3', '&:hover': { color: '#f87171' } }),
  }

  const FEATURES = [
    { icon: Search, title: 'Google Maps Scraper', desc: 'Pull businesses from any city and niche. Name, phone, address, rating, and website status — all extracted automatically.' },
    { icon: Brain, title: 'AI Lead Scoring', desc: 'Every lead gets scored 0–100 by AI. No website + high reviews + competitive niche = top of your list.' },
    { icon: LayoutDashboard, title: 'CRM Pipeline', desc: 'Drag-and-drop Kanban from New Lead to Closed Won. Every call, email, and follow-up logged in one place.' },
    { icon: Mail, title: 'Outreach Generator', desc: 'One click writes a personalized cold email or call script for any business using their real data.' },
    { icon: BarChart2, title: 'Analytics', desc: 'Track contacts made, meetings booked, deals closed, and revenue generated — all live.' },
    { icon: Download, title: 'CSV Export', desc: 'Export any lead list to CSV or connect directly to your existing CRM.' },
  ]

  const STEPS = [
    { step: '01', icon: MapPin, title: 'Pick city & niche', desc: 'Select your target market from hundreds of cities and service categories.' },
    { step: '02', icon: Globe, title: 'Scrape & detect', desc: 'System pulls businesses from Google Maps and checks each one for a website.' },
    { step: '03', icon: Sparkles, title: 'AI scores leads', desc: 'Every lead is ranked 0–100 based on opportunity signals and demand.' },
    { step: '04', icon: Handshake, title: 'Outreach & close', desc: 'Contact prospects with AI-written scripts, track progress, close deals.' },
  ]

  const ALL_LEADS = [
    { name: "Joe's Plumbing", city: 'Sacramento, CA', score: 94, status: 'NO WEBSITE' },
    { name: 'Valley Auto Repair', city: 'Elk Grove, CA', score: 87, status: 'NO WEBSITE' },
    { name: 'Green Thumb Lawn', city: 'Roseville, CA', score: 71, status: 'HAS WEBSITE' },
    { name: 'Sunrise HVAC Co', city: 'Folsom, CA', score: 89, status: 'NO WEBSITE' },
    { name: 'Quick Cut Barbers', city: 'Sacramento, CA', score: 82, status: 'NO WEBSITE' },
    { name: 'Peak Roofing Co', city: 'Citrus Heights, CA', score: 76, status: 'HAS WEBSITE' },
    { name: "Maria's Nail Salon", city: 'Rancho Cordova, CA', score: 91, status: 'NO WEBSITE' },
    { name: 'Titan Tree Service', city: 'Auburn, CA', score: 85, status: 'NO WEBSITE' },
  ]

  function useTypewriter(words) {
    const [displayed, setDisplayed] = useState('')
    const ref = useRef({ displayed: '', wordIndex: 0, deleting: false })
    const tRef = useRef(null)
    useEffect(() => {
      const tick = () => {
        const s = ref.current
        const word = words[s.wordIndex]
        let delay = 75
        if (!s.deleting && s.displayed.length < word.length) {
          ref.current = { ...s, displayed: word.slice(0, s.displayed.length + 1) }; delay = 75
        } else if (!s.deleting) {
          ref.current = { ...s, deleting: true }; delay = 2000
        } else if (s.deleting && s.displayed.length > 0) {
          ref.current = { ...s, displayed: s.displayed.slice(0, -1) }; delay = 38
        } else {
          ref.current = { displayed: '', wordIndex: (s.wordIndex + 1) % words.length, deleting: false }; delay = 100
        }
        setDisplayed(ref.current.displayed)
        tRef.current = setTimeout(tick, delay)
      }
      tRef.current = setTimeout(tick, 80)
      return () => clearTimeout(tRef.current)
    }, [words])
    return displayed
  }

  function ParticleCanvas() {
    const ref = useRef(null)
    useEffect(() => {
      const canvas = ref.current
      const ctx = canvas.getContext('2d')
      let id
      const resize = () => { canvas.width = window.innerWidth; canvas.height = window.innerHeight }
      resize()
      window.addEventListener('resize', resize)
      const pts = Array.from({ length: 80 }, () => ({
        x: Math.random() * window.innerWidth, y: Math.random() * window.innerHeight,
        r: Math.random() * 1.2 + 0.3, s: Math.random() * 0.25 + 0.05,
        o: Math.random() * 0.2 + 0.04,
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

  function LeadRow({ name, city, score, status, delay }) {
    const noSite = status === 'NO WEBSITE'
    return (
      <div style={{
        display: 'flex', alignItems: 'center', gap: '14px',
        padding: '11px 0',
        borderBottom: '1px solid rgba(255,255,255,0.04)',
        animation: `fadeIn 0.4s ease ${delay}s both`,
      }}>
        <div style={{
          width: '34px', height: '34px', borderRadius: '8px', flexShrink: 0,
          background: noSite ? 'rgba(248,113,113,0.08)' : 'rgba(139,92,246,0.08)',
          border: `1px solid ${noSite ? 'rgba(248,113,113,0.15)' : 'rgba(139,92,246,0.15)'}`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          {noSite
            ? <AlertTriangle size={14} color="#f87171" strokeWidth={1.5} />
            : <ExternalLink size={14} color="#8b5cf6" strokeWidth={1.5} />
          }
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
      <div style={{ color: '#d4d4d8', fontWeight: '600', fontSize: '0.83rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{name}</div>
      <div style={{ color: '#bdbdc3', fontSize: '0.7rem', marginTop: '1px' }}>{city}</div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{ width: '56px', height: '2px', background: 'rgba(255,255,255,0.06)', borderRadius: '1px' }}>
            <div style={{
              width: `${score}%`, height: '100%',
              background: noSite ? 'linear-gradient(90deg,#f87171,#fb923c)' : 'linear-gradient(90deg,#8b5cf6,#6366f1)',
              borderRadius: '1px'
            }} />
          </div>
          <span style={{ color: noSite ? '#f87171' : '#8b5cf6', fontSize: '0.7rem', fontWeight: '700', fontFamily: 'monospace', width: '22px', textAlign: 'right' }}>{score}</span>
        </div>
      </div>
    )
  }

  function LivePanel() {
    const [offset, setOffset] = useState(0)
    const [key, setKey] = useState(0)
    useEffect(() => {
      const t = setInterval(() => {
        setOffset(o => (o + 1) % ALL_LEADS.length)
        setKey(k => k + 1)
      }, 2800)
      return () => clearInterval(t)
    }, [])
    const visible = [0,1,2,3].map(i => ALL_LEADS[(offset + i) % ALL_LEADS.length])
    return (
      <div style={{
        background: 'rgba(255,255,255,0.015)',
        border: '1px solid rgba(255,255,255,0.06)',
        borderRadius: '16px', overflow: 'hidden',
        position: 'relative',
      }}>
        {/* Top accent line */}
        <div style={{
          position: 'absolute', top: 0, left: 0, right: 0, height: '1px',
          background: 'linear-gradient(90deg, transparent, rgba(139,92,246,0.6), transparent)',
        }} />

        {/* Terminal bar */}
        <div style={{
          padding: '11px 18px',
          borderBottom: '1px solid rgba(255,255,255,0.05)',
          background: 'rgba(255,255,255,0.02)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <div style={{ display: 'flex', gap: '6px' }}>
            {['#ff5f56','#ffbd2e','#27c93f'].map(c => (
              <div key={c} style={{ width: '9px', height: '9px', borderRadius: '50%', background: c, opacity: 0.55 }} />
            ))}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '7px' }}>
            <div style={{ width: '5px', height: '5px', borderRadius: '50%', background: '#8b5cf6', animation: 'pulse 1.5s infinite' }} />
            <span style={{ color: '#bdbdc3', fontSize: '0.65rem', fontFamily: 'JetBrains Mono, monospace', letterSpacing: '1px' }}>LIVE SCAN</span>
          </div>
        </div>

        <div key={key} style={{ padding: '4px 18px 6px' }}>
          {visible.map((l, i) => <LeadRow key={`${l.name}-${key}`} {...l} delay={i * 0.07} />)}
        </div>

        <div style={{
          padding: '10px 18px',
          borderTop: '1px solid rgba(255,255,255,0.04)',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        }}>
          <span style={{ color: '#b4b4bbff', fontSize: '0.65rem', fontFamily: 'JetBrains Mono, monospace' }}>
            {ALL_LEADS.filter(l => l.status === 'NO WEBSITE').length} prospects found
          </span>
          <span style={{ color: '#8b5cf6', fontSize: '0.65rem', fontFamily: 'JetBrains Mono, monospace', cursor: 'pointer' }}>
            view all →
          </span>
        </div>
      </div>
    )
  }

  export default function Home() {
    const navigate = useNavigate()
    const { user, loading } = useAuth()
    const [city, setCity] = useState(null)
    const [niche, setNiche] = useState(null)
    const word = useTypewriter(['websites', 'clients', 'visibility', 'growth'])

    // If already authenticated, redirect to leads
    useEffect(() => {
      if (!loading && user) navigate('/leads')
    }, [user, loading, navigate])

    return (
      <div style={{ minHeight: '100vh', background: '#09090f', color: '#fff', fontFamily: "'Outfit', sans-serif" }}>
  <style>{`
          @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700;800;900&family=JetBrains+Mono:wght@400;700&display=swap');

          *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

          html, body {
            overflow-x: hidden;
            scrollbar-width: none;
            -ms-overflow-style: none;
          }
          html::-webkit-scrollbar,
          body::-webkit-scrollbar {
            display: none;
          }

          @keyframes fadeIn  { from{opacity:0;transform:translateY(8px)}  to{opacity:1;transform:translateY(0)} }
          @keyframes fadeUp  { from{opacity:0;transform:translateY(28px)} to{opacity:1;transform:translateY(0)} }
          @keyframes blink   { 0%,100%{opacity:1} 50%{opacity:0} }
          @keyframes pulse   { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:0.4;transform:scale(0.8)} }
          @keyframes shimmer { 0%{background-position:200% center} 100%{background-position:-200% center} }

          .f1{animation:fadeUp 0.6s cubic-bezier(0.16,1,0.3,1) 0.05s both}
          .f2{animation:fadeUp 0.6s cubic-bezier(0.16,1,0.3,1) 0.15s both}
          .f3{animation:fadeUp 0.6s cubic-bezier(0.16,1,0.3,1) 0.25s both}
          .f4{animation:fadeUp 0.6s cubic-bezier(0.16,1,0.3,1) 0.38s both}
          .f5{animation:fadeUp 0.6s cubic-bezier(0.16,1,0.3,1) 0.50s both}
          .f6{animation:fadeUp 0.6s cubic-bezier(0.16,1,0.3,1) 0.62s both}

          .cursor { animation: blink 1s step-end infinite; }

          .cta-btn {
            background: linear-gradient(135deg,#8b5cf6,#6366f1);
            color: #fff; border: none; border-radius: 10px;
            padding: 14px 32px; font-size: 0.95rem; font-weight: 700;
            cursor: pointer; font-family: inherit; white-space: nowrap; letter-spacing: 0.2px;
            transition: opacity 0.2s, transform 0.15s, box-shadow 0.2s;
            position: relative; overflow: hidden;
          }
          .cta-btn::after {
            content: ''; position: absolute; inset: 0;
            background: linear-gradient(135deg,rgba(255,255,255,0.1),transparent);
            border-radius: inherit; pointer-events: none;
          }
          .cta-btn:hover { opacity: 0.9; transform: translateY(-2px); box-shadow: 0 12px 32px rgba(139,92,246,0.35); }

          .ghost-btn {
            background: transparent; color: #b4b4bbff;
            border: 1px solid rgba(255,255,255,0.08);
            border-radius: 10px; padding: 14px 32px;
            font-size: 0.95rem; font-weight: 500;
            cursor: pointer; font-family: inherit;
            transition: color 0.2s, border-color 0.2s, background 0.2s;
          }
          .ghost-btn:hover { color: #d4d4d8; border-color: rgba(255,255,255,0.2); background: rgba(255,255,255,0.03); }

          .nav-btn {
            background: none; border: none; color: #bfbfc6ff;
            font-size: 0.85rem; font-family: inherit;
            cursor: pointer; transition: color 0.2s; padding: 0; letter-spacing: 0.2px;
          }
          .nav-btn:hover { color: #a1a1aa; }

          .feat-card {
            background: rgba(255,255,255,0.02);
            border: 1px solid rgba(255,255,255,0.05);
            border-radius: 16px; padding: 32px;
            transition: all 0.3s cubic-bezier(0.16,1,0.3,1);
            position: relative; overflow: hidden;
          }
          .feat-card::before {
            content: ''; position: absolute; inset: 0; opacity: 0;
            background: radial-gradient(circle at 50% 0%, rgba(139,92,246,0.07), transparent 60%);
            transition: opacity 0.3s; pointer-events: none;
          }
          .feat-card:hover { transform: translateY(-4px); border-color: rgba(139,92,246,0.2); }
          .feat-card:hover::before { opacity: 1; }

          .step-card {
            padding: 32px; position: relative;
            border-top: 1px solid rgba(255,255,255,0.05);
            transition: background 0.2s;
          }
          .step-card:first-child { border-top: 2px solid #8b5cf6; }
          .step-card:hover { background: rgba(139,92,246,0.03); }

          .divider {
            height: 1px;
            background: linear-gradient(90deg, transparent, rgba(139,92,246,0.2), rgba(99,102,241,0.2), transparent);
          }

          .icon-box {
            width: 40px; height: 40px; border-radius: 10px;
            background: rgba(139,92,246,0.08);
            border: 1px solid rgba(139,92,246,0.18);
            display: flex; align-items: center; justify-content: center;
            margin-bottom: 18px; flex-shrink: 0;
          }
        `}</style>
        
  <Navbar />

  <ParticleCanvas />

        {/* Background glows */}
        <div style={{ position: 'fixed', inset: 0, zIndex: 0, pointerEvents: 'none' }}>
          <div style={{
            position: 'absolute', top: '-20%', left: '25%',
            width: '900px', height: '700px', borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(139,92,246,0.055) 0%, transparent 70%)',
            filter: 'blur(40px)',
          }} />
          <div style={{
            position: 'absolute', top: '5%', right: '-15%',
            width: '700px', height: '700px', borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(99,102,241,0.04) 0%, transparent 70%)',
            filter: 'blur(60px)',
          }} />
        </div>

        {/* Grid overlay */}
        <div style={{
          position: 'fixed', inset: 0, zIndex: 0, pointerEvents: 'none', opacity: 0.35,
          backgroundImage: 'linear-gradient(rgba(139,92,246,0.045) 1px, transparent 1px), linear-gradient(90deg, rgba(139,92,246,0.045) 1px, transparent 1px)',
          backgroundSize: '72px 72px',
          maskImage: 'radial-gradient(ellipse 100% 55% at 50% 0%, black 0%, transparent 100%)',
        }} />


        {/* ── HERO ── */}
        <section style={{
          position: 'relative', zIndex: 1,
          padding: '160px 52px 120px',
          maxWidth: '1200px', margin: '0 auto',
          display: 'grid', gridTemplateColumns: '1fr 1fr',
          gap: '80px', alignItems: 'center',
        }}>
          {/* Left */}
          <div>
            <div className="f1" style={{
              display: 'inline-flex', alignItems: 'center', gap: '8px',
              background: 'rgba(139,92,246,0.08)', border: '1px solid rgba(139,92,246,0.2)',
              borderRadius: '6px', padding: '5px 14px', marginBottom: '32px',
            }}>
              <div style={{ width: '5px', height: '5px', borderRadius: '50%', background: '#8b5cf6', animation: 'pulse 1.5s infinite' }} />
              <span style={{ color: '#a78bfa', fontSize: '0.68rem', fontWeight: '700', letterSpacing: '2px', textTransform: 'uppercase', fontFamily: 'JetBrains Mono, monospace' }}>
                AI Lead Intelligence
              </span>
            </div>

            <h1 className="f2" style={{
              fontSize: 'clamp(2.8rem, 4.5vw, 5rem)', fontWeight: '900',
              lineHeight: 1.06, letterSpacing: '-3px', marginBottom: '24px', color: '#fafafa',
            }}>
              Find businesses<br />
              that need<br />
              <span style={{
                background: 'linear-gradient(90deg, #a78bfa, #818cf8, #a78bfa)',
                backgroundSize: '200% auto',
                WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
                animation: 'shimmer 4s linear infinite',
              }}>{word}</span>
              <span className="cursor" style={{ color: '#8b5cf6', WebkitTextFillColor: '#8b5cf6' }}>|</span>
            </h1>

            <p className="f3" style={{
              color: '#b4b4bbff', fontSize: '1rem', lineHeight: 1.8,
              maxWidth: '400px', marginBottom: '40px',
            }}>
              Scrape Google Maps, score every lead with AI, and manage your entire sales pipeline — automated from start to close.
            </p>

            <div className="f4" style={{ display: 'flex', gap: '12px', marginBottom: '48px' }}>
              <button className="cta-btn" onClick={() => navigate('/leads')}>Start for free →</button>
              <button className="ghost-btn" onClick={() => navigate('/leads')}>View leads</button>
            </div>

            <div className="f5" style={{ display: 'flex', gap: '32px' }}>
              {[['124k+','Businesses indexed'],['89k+','Without websites'],['420+','Cities covered']].map(([val, label]) => (
                <div key={label}>
                  <div style={{ fontSize: '1.5rem', fontWeight: '800', color: '#a78bfa', fontFamily: 'JetBrains Mono, monospace', letterSpacing: '-1px' }}>{val}</div>
                  <div style={{ fontSize: '0.7rem', color: '#b4b4bbff', textTransform: 'uppercase', letterSpacing: '1.5px', marginTop: '4px' }}>{label}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Right */}
          <div className="f6" style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            {/* Search card */}
            <div style={{
              background: 'rgba(255,255,255,0.02)',
              border: '1px solid rgba(255,255,255,0.06)',
              borderRadius: '16px', padding: '24px',
            }}>
              <div style={{ fontSize: '0.68rem', color: '#cfcfd6', fontFamily: 'JetBrains Mono, monospace', letterSpacing: '1.5px', textTransform: 'uppercase', marginBottom: '16px' }}>Find leads</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <Select options={CITIES} styles={selectStyles} placeholder="City or region..." value={city} onChange={setCity} isClearable />
                <Select options={NICHES} styles={selectStyles} placeholder="Business niche..." value={niche} onChange={setNiche} isClearable />
                <button
                  className="cta-btn"
                  style={{ width: '100%', marginTop: '4px', display: 'flex', justifyContent: 'center' }}
                  onClick={() => navigate('/leads')}
                >
                  Scan for leads →
                </button>
              </div>
            </div>

            <LivePanel />
          </div>
        </section>

        <div className="divider" style={{ maxWidth: '1200px', margin: '0 auto' }} />

        {/* ── HOW IT WORKS ── */}
        <section style={{ position: 'relative', zIndex: 1, padding: '120px 52px', maxWidth: '1200px', margin: '0 auto' }}>
          <div style={{ marginBottom: '64px' }}>
            <div style={{ fontSize: '0.68rem', color: '#cfcfd6', fontFamily: 'JetBrains Mono, monospace', letterSpacing: '2px', textTransform: 'uppercase', marginBottom: '16px' }}>How it works</div>
            <h2 style={{ fontSize: 'clamp(2rem, 3.5vw, 3rem)', fontWeight: '800', letterSpacing: '-2px', color: '#fafafa' }}>
              From search to signed client<br />
              <span style={{ color: '#6366f1' }}>in minutes, not weeks</span>
            </h2>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '2px' }}>
            {STEPS.map((s) => {
              const Icon = s.icon
              return (
                <div key={s.step} className="step-card">
                  <div className="icon-box" style={{ marginBottom: '20px' }}>
                    <Icon size={16} color="#8b5cf6" strokeWidth={1.5} />
                  </div>
                  <div style={{ fontSize: '0.62rem', color: '#b8c2d4', fontFamily: 'JetBrains Mono, monospace', fontWeight: '700', marginBottom: '10px', letterSpacing: '1px' }}>{s.step}</div>
                  <div style={{ fontWeight: '700', fontSize: '0.95rem', color: '#e4e4e7', marginBottom: '10px' }}>{s.title}</div>
                  <div style={{ color: '#bdbdc3', fontSize: '0.82rem', lineHeight: 1.7 }}>{s.desc}</div>
                </div>
              )
            })}
          </div>
        </section>

        <div className="divider" style={{ maxWidth: '1200px', margin: '0 auto' }} />

        {/* ── FEATURES ── */}
        <section style={{ position: 'relative', zIndex: 1, padding: '120px 52px', maxWidth: '1200px', margin: '0 auto' }}>
          <div style={{ marginBottom: '64px' }}>
        <div style={{ fontSize: '0.68rem', color: '#cfcfd6', fontFamily: 'JetBrains Mono, monospace', letterSpacing: '2px', textTransform: 'uppercase', marginBottom: '16px' }}>Features</div>
            <h2 style={{ fontSize: 'clamp(2rem, 3.5vw, 3rem)', fontWeight: '800', letterSpacing: '-2px', color: '#fafafa' }}>
              Everything you need<br />
              <span style={{ color: '#6366f1' }}>to close more deals</span>
            </h2>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px' }}>
            {FEATURES.map(f => {
              const Icon = f.icon
              return (
                <div key={f.title} className="feat-card">
                  <div className="icon-box">
                    <Icon size={18} color="#a78bfa" strokeWidth={1.5} />
                  </div>
                  <div style={{ fontWeight: '700', fontSize: '0.95rem', color: '#e4e4e7', marginBottom: '10px' }}>{f.title}</div>
                  <div style={{ color: '#b4b4bbff', fontSize: '0.85rem', lineHeight: 1.7 }}>{f.desc}</div>

                </div>
              )
            })}
          </div>
        </section>

        <div className="divider" />

        {/* ── BOTTOM CTA ── */}
        <section style={{
          position: 'relative', zIndex: 1,
          padding: '140px 52px', textAlign: 'center',
          background: 'radial-gradient(ellipse 80% 60% at 50% 50%, rgba(139,92,246,0.055) 0%, transparent 70%)',
        }}>
    <div style={{ fontSize: '0.68rem', color: '#cfcfd6', fontFamily: 'JetBrains Mono, monospace', letterSpacing: '2px', textTransform: 'uppercase', marginBottom: '20px' }}>Get started today</div>
          <h2 style={{ fontSize: 'clamp(2.5rem, 5vw, 4.5rem)', fontWeight: '900', letterSpacing: '-3px', marginBottom: '20px', color: '#fafafa' }}>
            Your next client is<br />already out there
          </h2>
          <p style={{ color: '#cfcfd6', fontSize: '1rem', marginBottom: '44px' }}>
            No credit card. No setup. Start finding leads in 30 seconds.
          </p>
          <div style={{ display: 'flex', gap: '14px', justifyContent: 'center' }}>
            <button className="cta-btn" style={{ fontSize: '1rem', padding: '16px 44px' }} onClick={() => navigate('/leads')}>
              Launch BizScout →
            </button>
            <button className="ghost-btn" style={{ fontSize: '1rem', padding: '16px 44px' }}>
              View demo
            </button>
          </div>
        </section>
      </div>
    )
  }