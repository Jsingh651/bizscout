// frontend/src/pages/PaymentsPage.jsx
import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  DollarSign, TrendingUp, CheckCircle2, Clock, AlertCircle,
  Search, X, ChevronRight, Copy, RefreshCw,
  CreditCard, BarChart2, Users, AlertTriangle,
} from 'lucide-react'
import AppNav from '../components/AppNav'
import { API, getAuthHeaders } from '../utils/api'

function fmt(n) {
  return `$${Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: 0 })}`
}

function fmtDate(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function ParticleCanvas() {
  const ref = useRef(null)
  useEffect(() => {
    const canvas = ref.current; const ctx = canvas.getContext('2d'); let id
    const resize = () => { canvas.width = window.innerWidth; canvas.height = window.innerHeight }
    resize(); window.addEventListener('resize', resize)
    const pts = Array.from({ length: 35 }, () => ({
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

function StatCard({ icon: Icon, label, value, sub, accent, highlight }) {
  return (
    <div style={{ background: highlight ? `${accent}08` : 'rgba(255,255,255,0.02)', border: `1px solid ${highlight ? `${accent}25` : 'rgba(255,255,255,0.05)'}`, borderRadius: 14, padding: '18px 20px', position: 'relative', overflow: 'hidden' }}>
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 1, background: `linear-gradient(90deg,transparent,${accent}50,transparent)` }} />
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
        <div style={{ width: 32, height: 32, borderRadius: 9, background: `${accent}18`, border: `1px solid ${accent}30`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Icon size={14} color={accent} strokeWidth={1.5} />
        </div>
        <span style={{ fontSize: 10, color: '#b8c2d4', textTransform: 'uppercase', letterSpacing: '0.1em', fontFamily: "'JetBrains Mono',monospace" }}>{label}</span>
      </div>
      <div style={{ fontSize: 28, fontWeight: 900, color: highlight ? accent : '#fafafa', fontFamily: "'JetBrains Mono',monospace", letterSpacing: '-1.5px', lineHeight: 1 }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: '#c4c4cc', marginTop: 6 }}>{sub}</div>}
    </div>
  )
}

function PaymentBadge({ p }) {
  const { deposit_paid, final_paid, payment_failed } = p

  if (payment_failed) {
    return <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 10, fontWeight: 700, padding: '3px 9px', borderRadius: 20, background: 'rgba(248,113,113,0.1)', border: '1px solid rgba(248,113,113,0.3)', color: '#f87171', fontFamily: "'JetBrains Mono',monospace" }}><AlertTriangle size={9}/> Failed</span>
  }
  if (final_paid) {
    return <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 10, fontWeight: 700, padding: '3px 9px', borderRadius: 20, background: 'rgba(74,222,128,0.1)', border: '1px solid rgba(74,222,128,0.25)', color: '#4ade80', fontFamily: "'JetBrains Mono',monospace" }}><CheckCircle2 size={9}/> Fully Paid</span>
  }
  if (deposit_paid) {
    return <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 10, fontWeight: 700, padding: '3px 9px', borderRadius: 20, background: 'rgba(251,146,60,0.1)', border: '1px solid rgba(251,146,60,0.3)', color: '#fb923c', fontFamily: "'JetBrains Mono',monospace" }}><Clock size={9}/> Building</span>
  }
  return <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 10, fontWeight: 700, padding: '3px 9px', borderRadius: 20, background: 'rgba(139,92,246,0.1)', border: '1px solid rgba(139,92,246,0.25)', color: '#a78bfa', fontFamily: "'JetBrains Mono',monospace" }}><Clock size={9}/> Pending</span>
}

export default function PaymentsPage() {
  const navigate = useNavigate()
  const [payments, setPayments]       = useState([])
  const [loading, setLoading]         = useState(true)
  const [refreshing, setRefreshing]   = useState(false)
  const [search, setSearch]           = useState('')
  const [filter, setFilter]           = useState('All')
  const [focused, setFocused]         = useState(false)
  const [actionState, setActionState] = useState({})

  const loadData = async (silent = false) => {
    if (!silent) setLoading(true)
    else setRefreshing(true)
    try {
      const data = await fetch(`${API}/payments/all`, { credentials: 'include', headers: getAuthHeaders() })
        .then(r => r.ok ? r.json() : [])
      setPayments(Array.isArray(data) ? data : [])
    } catch {}
    finally { setLoading(false); setRefreshing(false) }
  }

  useEffect(() => { loadData() }, [])

  const handleCopyLink = (paymentId, url) => {
    navigator.clipboard.writeText(url)
    setActionState(prev => ({ ...prev, [paymentId]: { copied: true } }))
    setTimeout(() => setActionState(prev => ({ ...prev, [paymentId]: {} })), 2000)
  }

  // ── Computed stats ────────────────────────────────────────────────────────
  const fullyPaid  = payments.filter(p => p.final_paid)
  const building   = payments.filter(p => p.deposit_paid && !p.final_paid && !p.payment_failed)
  const pending    = payments.filter(p => p.pay_url && !p.deposit_paid && !p.payment_failed)
  const noInvoice  = payments.filter(p => !p.pay_url)
  const failed     = payments.filter(p => p.payment_failed)

  // Revenue collected = deposit amounts paid + final amounts paid
  const totalCollected = payments.reduce((s, p) => {
    const setup = parseFloat(p.setup_price || 0)
    if (p.final_paid) return s + setup
    if (p.deposit_paid) return s + parseFloat(p.deposit_amount || setup / 2)
    return s
  }, 0)
  const mrr          = fullyPaid.reduce((s, p) => s + parseFloat(p.monthly_price || 0), 0)
  const pendingValue = pending.reduce((s, p) => s + parseFloat(p.deposit_amount || parseFloat(p.setup_price || 0) / 2), 0)

  // ── Filter ────────────────────────────────────────────────────────────────
  const FILTERS = ['All', 'Fully Paid', 'Building', 'Pending', 'Failed', 'No Invoice']
  const filtered = payments.filter(p => {
    const q = search.toLowerCase()
    const matchSearch = !q ||
      (p.client_name  || '').toLowerCase().includes(q) ||
      (p.client_email || '').toLowerCase().includes(q)
    const matchFilter =
      filter === 'All'          ||
      (filter === 'Fully Paid'  && p.final_paid) ||
      (filter === 'Building'    && p.deposit_paid && !p.final_paid && !p.payment_failed) ||
      (filter === 'Pending'     && p.pay_url && !p.deposit_paid && !p.payment_failed) ||
      (filter === 'Failed'      && p.payment_failed) ||
      (filter === 'No Invoice'  && !p.pay_url)
    return matchSearch && matchFilter
  })

  return (
    <div style={{ minHeight: '100vh', background: '#09090f', color: '#fafafa', fontFamily: "'Outfit',sans-serif", overflowX: 'hidden' }}>
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
        .filter-btn.fail{color:#f87171;}.filter-btn.fail.on{background:rgba(248,113,113,0.1);border-color:rgba(248,113,113,0.35);color:#f87171;}
      `}</style>

      <ParticleCanvas />
      <div style={{ position: 'fixed', inset: 0, zIndex: 0, pointerEvents: 'none', opacity: 0.3, backgroundImage: 'linear-gradient(rgba(139,92,246,0.04) 1px,transparent 1px),linear-gradient(90deg,rgba(139,92,246,0.04) 1px,transparent 1px)', backgroundSize: '72px 72px', maskImage: 'radial-gradient(ellipse 100% 55% at 50% 0%,black 0%,transparent 100%)' }} />

      <AppNav />

      <div style={{ position: 'relative', zIndex: 1, maxWidth: 1280, margin: '0 auto', padding: '48px 48px 80px' }}>

        {/* Header */}
        <div style={{ marginBottom: 32, animation: 'fadeUp 0.5s cubic-bezier(0.16,1,0.3,1) 0.05s both' }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 7, background: 'rgba(74,222,128,0.08)', border: '1px solid rgba(74,222,128,0.18)', borderRadius: 6, padding: '4px 12px', marginBottom: 14 }}>
            <div style={{ width: 5, height: 5, borderRadius: '50%', background: '#4ade80', animation: 'pulse 1.5s infinite' }} />
            <span style={{ color: '#4ade80', fontSize: '0.64rem', fontWeight: 700, letterSpacing: '2px', textTransform: 'uppercase', fontFamily: "'JetBrains Mono',monospace" }}>Revenue</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
            <div>
              <h1 style={{ fontSize: 'clamp(1.8rem,3vw,2.6rem)', fontWeight: 900, letterSpacing: '-1.5px', color: '#fafafa', marginBottom: 6 }}>Payments</h1>
              <p style={{ color: '#c4c4cc', fontSize: 15 }}>
                {payments.length} clients · {fullyPaid.length} fully paid · {building.length} building · {pending.length} pending
                {failed.length > 0 && <span style={{ color: '#f87171', marginLeft: 8 }}>· {failed.length} failed</span>}
              </p>
            </div>
            <button onClick={() => loadData(true)} disabled={refreshing}
              style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 9, padding: '8px 14px', color: '#c4c4cc', fontSize: 13, cursor: 'pointer', fontFamily: "'Outfit',sans-serif", opacity: refreshing ? 0.6 : 1 }}>
              <RefreshCw size={12} style={{ animation: refreshing ? 'spin 0.8s linear infinite' : 'none' }} /> Refresh
            </button>
          </div>
        </div>

        {/* Stat cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12, marginBottom: 28, animation: 'fadeUp 0.5s cubic-bezier(0.16,1,0.3,1) 0.1s both' }}>
          <StatCard icon={DollarSign}   label="Total Collected"   value={fmt(totalCollected)} sub={`${fullyPaid.length} fully paid · ${building.length} building`} accent="#4ade80" highlight />
          <StatCard icon={TrendingUp}   label="Monthly Recurring" value={fmt(mrr)}            sub={`${fullyPaid.length} active subscriptions`}                      accent="#8b5cf6" />
          <StatCard icon={BarChart2}    label="Est. Annual (ARR)" value={fmt(mrr * 12)}       sub="MRR × 12"                                                         accent="#a78bfa" />
          <StatCard icon={AlertCircle}  label="Pending Revenue"   value={fmt(pendingValue)}   sub={`${pending.length} awaiting deposit`}                             accent="#fb923c" />
        </div>

        {/* Secondary stat tiles */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', gap: 12, marginBottom: 32, animation: 'fadeUp 0.5s cubic-bezier(0.16,1,0.3,1) 0.14s both' }}>
          {[
            { label: 'Fully Paid', value: fullyPaid.length,  color: '#4ade80', icon: CheckCircle2,  filterKey: 'Fully Paid' },
            { label: 'Building',   value: building.length,   color: '#fb923c', icon: Clock,         filterKey: 'Building' },
            { label: 'Pending',    value: pending.length,    color: '#a78bfa', icon: Clock,         filterKey: 'Pending' },
            { label: 'Failed',     value: failed.length,     color: '#f87171', icon: AlertTriangle, filterKey: 'Failed' },
            { label: 'No Invoice', value: noInvoice.length,  color: '#b8c2d4', icon: CreditCard,    filterKey: 'No Invoice' },
          ].map(s => (
            <div key={s.label} onClick={() => setFilter(s.filterKey)}
              style={{ background: failed.length > 0 && s.label === 'Failed' ? 'rgba(248,113,113,0.05)' : 'rgba(255,255,255,0.02)', border: `1px solid ${failed.length > 0 && s.label === 'Failed' ? 'rgba(248,113,113,0.2)' : 'rgba(255,255,255,0.05)'}`, borderRadius: 12, padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer', transition: 'border-color 0.2s' }}
              onMouseEnter={e => e.currentTarget.style.borderColor = `${s.color}30`}
              onMouseLeave={e => e.currentTarget.style.borderColor = failed.length > 0 && s.label === 'Failed' ? 'rgba(248,113,113,0.2)' : 'rgba(255,255,255,0.05)'}>
              <s.icon size={16} color={s.color} strokeWidth={1.5} />
              <div>
                <div style={{ fontSize: 20, fontWeight: 900, color: s.color, fontFamily: "'JetBrains Mono',monospace", letterSpacing: '-1px', lineHeight: 1 }}>{s.value}</div>
                <div style={{ fontSize: 11, color: '#b8c2d4', marginTop: 3 }}>{s.label}</div>
              </div>
            </div>
          ))}
        </div>

        {/* Search + filter */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20, animation: 'fadeUp 0.5s cubic-bezier(0.16,1,0.3,1) 0.18s both' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1, background: 'rgba(255,255,255,0.03)', border: `1px solid ${focused ? 'rgba(139,92,246,0.5)' : 'rgba(255,255,255,0.07)'}`, borderRadius: 9, padding: '0 14px', height: 38, transition: 'border-color 0.2s' }}>
            <Search size={13} color="#b8c2d4" />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by client name or email..."
              onFocus={() => setFocused(true)} onBlur={() => setFocused(false)}
              style={{ background: 'none', border: 'none', outline: 'none', color: '#fafafa', fontSize: 13, width: '100%', fontFamily: "'Outfit',sans-serif" }} />
            {search && <button onClick={() => setSearch('')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#b8c2d4', padding: 0, display: 'flex' }}><X size={12} /></button>}
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            {FILTERS.map(f => (
              <button key={f} className={`filter-btn${f === 'Failed' ? ' fail' : ''}${filter === f ? ' on' : ''}`} onClick={() => setFilter(f)}>{f}</button>
            ))}
          </div>
        </div>

        {/* Table */}
        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', paddingTop: 60 }}>
            <div style={{ width: 18, height: 18, border: '2px solid rgba(139,92,246,0.3)', borderTopColor: '#8b5cf6', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
          </div>
        ) : payments.length === 0 ? (
          <div style={{ textAlign: 'center', paddingTop: 80 }}>
            <DollarSign size={40} color="#b8c2d4" strokeWidth={1} style={{ margin: '0 auto 16px', display: 'block' }} />
            <div style={{ fontSize: 13, color: '#b8c2d4', fontFamily: "'JetBrains Mono',monospace", marginBottom: 16 }}>— No payment records yet —</div>
            <button onClick={() => navigate('/leads')} style={{ background: 'linear-gradient(135deg,#8b5cf6,#6366f1)', border: 'none', borderRadius: 9, padding: '10px 22px', color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: "'Outfit',sans-serif" }}>Go to Leads →</button>
          </div>
        ) : filtered.length === 0 ? (
          <div style={{ textAlign: 'center', paddingTop: 60, fontSize: 13, color: '#b8c2d4', fontFamily: "'JetBrains Mono',monospace" }}>— No results —</div>
        ) : (
          <div style={{ background: 'rgba(255,255,255,0.015)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 16, overflow: 'hidden', position: 'relative', animation: 'fadeUp 0.5s cubic-bezier(0.16,1,0.3,1) 0.22s both' }}>
            <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 1, background: 'linear-gradient(90deg,transparent,rgba(74,222,128,0.5),transparent)' }} />

            {/* Header row */}
            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1.4fr 1fr 1fr 1.4fr', gap: 16, padding: '12px 20px', borderBottom: '1px solid rgba(255,255,255,0.05)', background: 'rgba(255,255,255,0.02)' }}>
              {['Client', 'Status', 'Invoices', 'Monthly', 'Launch', 'Actions'].map(h => (
                <div key={h} style={{ fontSize: 10, fontWeight: 700, color: '#b8c2d4', letterSpacing: '0.1em', textTransform: 'uppercase', fontFamily: "'JetBrains Mono',monospace" }}>{h}</div>
              ))}
            </div>

            {filtered.map((p, i) => {
              const hasFailed     = !!p.payment_failed
              const depositPaid   = p.deposit_paid
              const finalPaid     = p.final_paid
              const depositAmt    = p.deposit_amount || parseFloat(p.setup_price || 0) / 2
              const state         = actionState[p.id] || {}
              const iconColor     = hasFailed ? '#f87171' : finalPaid ? '#4ade80' : depositPaid ? '#fb923c' : '#a78bfa'
              const iconBg        = hasFailed ? 'rgba(248,113,113,0.1)' : finalPaid ? 'rgba(74,222,128,0.1)' : depositPaid ? 'rgba(251,146,60,0.1)' : 'rgba(139,92,246,0.08)'
              const iconBorder    = hasFailed ? 'rgba(248,113,113,0.25)' : finalPaid ? 'rgba(74,222,128,0.25)' : depositPaid ? 'rgba(251,146,60,0.25)' : 'rgba(139,92,246,0.2)'

              return (
                <div key={p.id}
                  style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1.4fr 1fr 1fr 1.4fr', alignItems: 'center', gap: 16, padding: '14px 20px', borderBottom: i < filtered.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none', transition: 'background 0.15s', background: hasFailed ? 'rgba(248,113,113,0.02)' : 'transparent' }}
                  onMouseEnter={e => e.currentTarget.style.background = hasFailed ? 'rgba(248,113,113,0.04)' : 'rgba(255,255,255,0.02)'}
                  onMouseLeave={e => e.currentTarget.style.background = hasFailed ? 'rgba(248,113,113,0.02)' : 'transparent'}>

                  {/* Client */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                    <div style={{ width: 34, height: 34, borderRadius: 9, flexShrink: 0, background: iconBg, border: `1px solid ${iconBorder}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <Users size={13} color={iconColor} strokeWidth={1.5} />
                    </div>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: '#e4e4e7', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.client_name || '—'}</div>
                      <div style={{ fontSize: 11, color: '#b8c2d4' }}>{p.client_email || '—'}</div>
                    </div>
                  </div>

                  {/* Status */}
                  <div>
                    <PaymentBadge p={p} />
                  </div>

                  {/* Invoices */}
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 3 }}>
                      <span style={{ fontSize: 9, color: depositPaid ? '#4ade80' : '#b8c2d4', fontFamily: "'JetBrains Mono',monospace" }}>{depositPaid ? '✓' : '○'} Inv#1</span>
                      <span style={{ fontSize: 11, fontWeight: 700, color: depositPaid ? '#4ade80' : '#e4e4e7', fontFamily: "'JetBrains Mono',monospace" }}>{fmt(depositAmt)}</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                      <span style={{ fontSize: 9, color: finalPaid ? '#4ade80' : '#b8c2d4', fontFamily: "'JetBrains Mono',monospace" }}>{finalPaid ? '✓' : '○'} Inv#2</span>
                      <span style={{ fontSize: 11, fontWeight: 700, color: finalPaid ? '#4ade80' : '#b8c2d4', fontFamily: "'JetBrains Mono',monospace" }}>{fmt(p.final_amount || depositAmt)}</span>
                    </div>
                  </div>

                  {/* Monthly */}
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: hasFailed ? '#f87171' : '#4ade80', fontFamily: "'JetBrains Mono',monospace" }}>{fmt(p.monthly_price)}/mo</div>
                    {p.stripe_subscription_id && finalPaid && !hasFailed && <div style={{ fontSize: 9, color: '#4ade80', marginTop: 2 }}>● Sub active</div>}
                    {hasFailed && <div style={{ fontSize: 9, color: '#f87171', marginTop: 2 }}>● Payment failed</div>}
                    {p.last_invoice_paid_at && !hasFailed && (
                      <div style={{ fontSize: 9, color: '#b8c2d4', marginTop: 2, fontFamily: "'JetBrains Mono',monospace" }}>
                        Last paid {fmtDate(p.last_invoice_paid_at)}
                      </div>
                    )}
                  </div>

                  {/* Launch / Next Billing */}
                  <div style={{ fontFamily: "'JetBrains Mono',monospace" }}>
                    <div style={{ fontSize: 11, color: '#c4c4cc' }}>{fmtDate(p.launch_date)}</div>
                    {p.next_billing_date && finalPaid && !hasFailed && (
                      <div style={{ fontSize: 9, color: '#a78bfa', marginTop: 3 }}>
                        Next bill {fmtDate(p.next_billing_date)}
                      </div>
                    )}
                    {hasFailed && p.last_failed_at && (
                      <div style={{ fontSize: 9, color: '#f87171', marginTop: 3 }}>
                        Failed {fmtDate(p.last_failed_at)}
                      </div>
                    )}
                    {hasFailed && p.last_failure_reason && (
                      <div style={{ fontSize: 9, color: '#fb923c', marginTop: 2, maxWidth: 120, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={p.last_failure_reason}>
                        {p.last_failure_reason}
                      </div>
                    )}
                  </div>

                  {/* Actions */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }} onClick={e => e.stopPropagation()}>
                    {p.pay_url && !depositPaid && (
                      <button onClick={() => handleCopyLink(p.id, p.pay_url)}
                        style={{ display: 'flex', alignItems: 'center', gap: 5, background: 'rgba(139,92,246,0.1)', border: '1px solid rgba(139,92,246,0.25)', borderRadius: 7, padding: '4px 9px', color: state.copied ? '#4ade80' : '#a78bfa', fontSize: 10, fontWeight: 600, cursor: 'pointer', fontFamily: "'Outfit',sans-serif" }}>
                        <Copy size={10} /> {state.copied ? 'Copied!' : 'Inv#1 Link'}
                      </button>
                    )}
                    {p.final_pay_url && depositPaid && !finalPaid && (
                      <button onClick={() => handleCopyLink(p.id, p.final_pay_url)}
                        style={{ display: 'flex', alignItems: 'center', gap: 5, background: 'rgba(251,146,60,0.1)', border: '1px solid rgba(251,146,60,0.25)', borderRadius: 7, padding: '4px 9px', color: state.copied ? '#4ade80' : '#fb923c', fontSize: 10, fontWeight: 600, cursor: 'pointer', fontFamily: "'Outfit',sans-serif" }}>
                        <Copy size={10} /> {state.copied ? 'Copied!' : 'Inv#2 Link'}
                      </button>
                    )}
                    {p.lead_id && (
                      <button onClick={() => navigate(`/leads/${p.lead_hid || p.lead_id}`)}
                        style={{ display: 'flex', alignItems: 'center', gap: 5, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 7, padding: '4px 9px', color: '#b8c2d4', fontSize: 10, cursor: 'pointer', fontFamily: "'Outfit',sans-serif" }}>
                        <ChevronRight size={10} /> View Lead
                      </button>
                    )}
                    {state.error && <div style={{ fontSize: 10, color: '#f87171', fontFamily: "'JetBrains Mono',monospace" }}>{state.error}</div>}
                  </div>
                </div>
              )
            })}

            <div style={{ padding: '11px 20px', borderTop: '1px solid rgba(255,255,255,0.04)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 11, color: '#b8c2d4', fontFamily: "'JetBrains Mono',monospace" }}>
                Showing {filtered.length} of {payments.length} clients
              </span>
              <span style={{ fontSize: 11, color: '#4ade80', fontFamily: "'JetBrains Mono',monospace", fontWeight: 700 }}>
                MRR: {fmt(mrr)}/mo · ARR: {fmt(mrr * 12)}/yr
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}