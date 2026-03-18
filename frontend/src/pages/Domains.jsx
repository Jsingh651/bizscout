import { useState, useRef, useEffect } from 'react'
import {
  Search, CheckCircle2, XCircle, ExternalLink,
  Globe, Loader2, Sparkles, Copy, Check, RefreshCw,
} from 'lucide-react'
import AppNav from '../components/AppNav'
import { API } from '../utils/api'

const TLD_META = {
  '.com':  { label: '.com',  accent: '#4ade80' },
  '.net':  { label: '.net',  accent: '#60a5fa' },
  '.org':  { label: '.org',  accent: '#a78bfa' },
  '.co':   { label: '.co',   accent: '#fb923c' },
  '.io':   { label: '.io',   accent: '#f472b6' },
  '.info': { label: '.info', accent: '#facc15' },
}

function ParticleCanvas() {
  const ref = useRef(null)
  useEffect(() => {
    const canvas = ref.current; const ctx = canvas.getContext('2d'); let id
    const resize = () => { canvas.width = window.innerWidth; canvas.height = window.innerHeight }
    resize(); window.addEventListener('resize', resize)
    const pts = Array.from({ length: 45 }, () => ({
      x: Math.random() * window.innerWidth, y: Math.random() * window.innerHeight,
      r: Math.random() * 0.9 + 0.2, s: Math.random() * 0.18 + 0.04,
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

// ── TLD badge ─────────────────────────────────────────────────────────────────
function TldBadge({ result }) {
  const [copied, setCopied] = useState(false)
  const meta      = TLD_META[result.tld] || { label: result.tld, accent: '#b8c2d4' }
  const available = result.available

  const copyDomain = () => {
    navigator.clipboard.writeText(result.domain)
    setCopied(true)
    setTimeout(() => setCopied(false), 1800)
  }

  return (
    <div style={{
      background: available ? `${meta.accent}08` : 'rgba(255,255,255,0.02)',
      border: `1px solid ${available ? `${meta.accent}30` : 'rgba(255,255,255,0.06)'}`,
      borderRadius: 12, padding: '14px 16px',
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      gap: 12, transition: 'all 0.2s',
      opacity: result.error === 'invalid' ? 0.35 : 1,
    }}>
      {/* TLD + domain name */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
        <div style={{
          width: 36, height: 36, borderRadius: 9, flexShrink: 0,
          background: available ? `${meta.accent}15` : 'rgba(255,255,255,0.04)',
          border: `1px solid ${available ? `${meta.accent}30` : 'rgba(255,255,255,0.08)'}`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 10, fontWeight: 800, color: available ? meta.accent : '#b8c2d4',
          fontFamily: "'JetBrains Mono', monospace",
        }}>
          {meta.label}
        </div>
        <div style={{ minWidth: 0 }}>
          <div style={{
            fontSize: 13, fontWeight: 600, color: available ? '#e4e4e7' : '#b8c2d4',
            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
          }}>
            {result.domain}
          </div>
          <div style={{ fontSize: 11, marginTop: 2, display: 'flex', alignItems: 'center', gap: 5 }}>
            {available ? (
              <>
                <CheckCircle2 size={10} color="#4ade80" />
                <span style={{ color: '#4ade80', fontWeight: 600 }}>Available</span>
                {result.price && (
                  <span style={{ color: '#b8c2d4', fontFamily: "'JetBrains Mono', monospace" }}>
                    · ${result.price}/yr
                  </span>
                )}
              </>
            ) : (
              <>
                <XCircle size={10} color="#f87171" />
                <span style={{ color: '#f87171' }}>Taken</span>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Actions */}
      <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
        <button
          onClick={copyDomain}
          title="Copy domain"
          style={{
            width: 28, height: 28, borderRadius: 7,
            background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: copied ? '#4ade80' : '#b8c2d4', cursor: 'pointer', transition: 'all 0.15s',
          }}
          onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.07)'}
          onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,255,255,0.03)'}
        >
          {copied ? <Check size={11} /> : <Copy size={11} />}
        </button>

        {available && result.buy_url && (
          <a
            href={result.buy_url}
            target="_blank"
            rel="noreferrer"
            style={{
              display: 'flex', alignItems: 'center', gap: 5,
              background: `linear-gradient(135deg, ${meta.accent}, ${meta.accent}cc)`,
              border: 'none', borderRadius: 7, padding: '0 12px', height: 28,
              color: '#fff', fontSize: 11, fontWeight: 700, textDecoration: 'none',
              fontFamily: "'Outfit', sans-serif", whiteSpace: 'nowrap',
            }}
          >
            Buy <ExternalLink size={9} />
          </a>
        )}
      </div>
    </div>
  )
}

// ── Variant card ──────────────────────────────────────────────────────────────
function VariantCard({ variant, index }) {
  const availableCount = variant.results.filter(r => r.available).length
  const bestDomain     = variant.results.find(r => r.available)

  return (
    <div style={{
      background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)',
      borderRadius: 16, overflow: 'hidden', position: 'relative',
      animation: `fadeUp 0.4s cubic-bezier(0.16,1,0.3,1) ${index * 0.07}s both`,
    }}>
      <div style={{
        position: 'absolute', top: 0, left: 0, right: 0, height: 1,
        background: availableCount > 0
          ? 'linear-gradient(90deg,transparent,rgba(74,222,128,0.5),transparent)'
          : 'linear-gradient(90deg,transparent,rgba(248,113,113,0.3),transparent)',
      }} />

      {/* Card header */}
      <div style={{
        padding: '16px 18px 14px', borderBottom: '1px solid rgba(255,255,255,0.05)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 32, height: 32, borderRadius: 9,
            background: availableCount > 0 ? 'rgba(74,222,128,0.1)' : 'rgba(248,113,113,0.08)',
            border: `1px solid ${availableCount > 0 ? 'rgba(74,222,128,0.25)' : 'rgba(248,113,113,0.18)'}`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <Globe size={13} color={availableCount > 0 ? '#4ade80' : '#f87171'} strokeWidth={1.5} />
          </div>
          <div>
            <div style={{ fontSize: 14, fontWeight: 700, color: '#e4e4e7', fontFamily: "'JetBrains Mono', monospace" }}>
              {variant.name}
            </div>
            {bestDomain && (
              <div style={{ fontSize: 11, color: '#4ade80', marginTop: 1 }}>
                Best: {bestDomain.domain} · ${bestDomain.price}/yr
              </div>
            )}
          </div>
        </div>
        <div style={{
          fontSize: 10, fontWeight: 700, padding: '3px 10px', borderRadius: 20,
          background: availableCount > 0 ? 'rgba(74,222,128,0.1)' : 'rgba(248,113,113,0.1)',
          border: `1px solid ${availableCount > 0 ? 'rgba(74,222,128,0.25)' : 'rgba(248,113,113,0.2)'}`,
          color: availableCount > 0 ? '#4ade80' : '#f87171',
          fontFamily: "'JetBrains Mono', monospace",
        }}>
          {availableCount}/{variant.results.length} available
        </div>
      </div>

      {/* TLD results */}
      <div style={{ padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 8 }}>
        {variant.results.map(result => (
          <TldBadge key={result.domain} result={result} />
        ))}
      </div>
    </div>
  )
}

// ── Quick suggestions chips ───────────────────────────────────────────────────
function SuggestionChips({ variants, onPick }) {
  return (
    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 12 }}>
      {variants.map(v => (
        <button
          key={v}
          onClick={() => onPick(v)}
          style={{
            background: 'rgba(139,92,246,0.08)', border: '1px solid rgba(139,92,246,0.2)',
            borderRadius: 20, padding: '4px 12px', color: '#a78bfa', fontSize: 12,
            fontWeight: 600, cursor: 'pointer', fontFamily: "'JetBrains Mono', monospace",
            transition: 'all 0.15s',
          }}
          onMouseEnter={e => { e.currentTarget.style.background = 'rgba(139,92,246,0.15)' }}
          onMouseLeave={e => { e.currentTarget.style.background = 'rgba(139,92,246,0.08)' }}
        >
          {v}
        </button>
      ))}
    </div>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function Domains() {
  const [query,       setQuery]       = useState('')
  const [loading,     setLoading]     = useState(false)
  const [results,     setResults]     = useState(null)   // { query, slug, variants }
  const [error,       setError]       = useState('')
  const [focused,     setFocused]     = useState(false)
  const [suggestions, setSuggestions] = useState([])
  const suggestTimer = useRef(null)

  // Live suggestion chips while typing (no API call yet)
  useEffect(() => {
    clearTimeout(suggestTimer.current)
    if (!query.trim() || query.trim().length < 3) { setSuggestions([]); return }
    suggestTimer.current = setTimeout(async () => {
      try {
        const res  = await fetch(`${API}/domains/suggest?name=${encodeURIComponent(query.trim())}`)
        const data = await res.json()
        setSuggestions(data.variants || [])
      } catch {}
    }, 350)
    return () => clearTimeout(suggestTimer.current)
  }, [query])

  const handleSearch = async (searchQuery) => {
    const q = (searchQuery || query).trim()
    if (!q) return
    setLoading(true)
    setError('')
    setResults(null)
    try {
      const res  = await fetch(`${API}/domains/check?name=${encodeURIComponent(q)}`)
      const data = await res.json()
      if (!res.ok) throw new Error(data.detail || 'Domain check failed')
      setResults(data)
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  const totalAvailable = results?.variants?.reduce(
    (sum, v) => sum + v.results.filter(r => r.available).length, 0
  ) ?? 0

  const totalChecked = results?.variants?.reduce(
    (sum, v) => sum + v.results.length, 0
  ) ?? 0

  const EXAMPLE_SEARCHES = [
    "Joe's Plumbing", "Valley Auto Repair", "Sunrise HVAC", "Quick Cut Barbers", "Green Thumb Lawn",
  ]

  return (
    <div style={{
      minHeight: '100vh', background: '#09090f', color: '#fafafa',
      fontFamily: "'Outfit', sans-serif", overflowX: 'hidden',
    }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@400;500;600;700;800;900&family=JetBrains+Mono:wght@400;700&display=swap');
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        html, body { scrollbar-width: none; }
        html::-webkit-scrollbar { display: none; }
        @keyframes fadeUp { from{opacity:0;transform:translateY(16px)} to{opacity:1;transform:translateY(0)} }
        @keyframes spin   { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }
        @keyframes pulse  { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:0.4;transform:scale(0.8)} }
      `}</style>

      <ParticleCanvas />
      <div style={{
        position: 'fixed', inset: 0, zIndex: 0, pointerEvents: 'none', opacity: 0.3,
        backgroundImage: 'linear-gradient(rgba(139,92,246,0.04) 1px,transparent 1px),linear-gradient(90deg,rgba(139,92,246,0.04) 1px,transparent 1px)',
        backgroundSize: '72px 72px',
        maskImage: 'radial-gradient(ellipse 100% 55% at 50% 0%,black 0%,transparent 100%)',
      }} />

      <AppNav />

      <div style={{ position: 'relative', zIndex: 1, maxWidth: 900, margin: '0 auto', padding: '48px 48px 80px' }}>

        {/* Header */}
        <div style={{ marginBottom: 36, animation: 'fadeUp 0.5s cubic-bezier(0.16,1,0.3,1) 0.05s both' }}>
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 7,
            background: 'rgba(139,92,246,0.08)', border: '1px solid rgba(139,92,246,0.18)',
            borderRadius: 6, padding: '4px 12px', marginBottom: 14,
          }}>
            <div style={{ width: 5, height: 5, borderRadius: '50%', background: '#8b5cf6', animation: 'pulse 1.5s infinite' }} />
            <span style={{ color: '#a78bfa', fontSize: '0.64rem', fontWeight: 700, letterSpacing: '2px', textTransform: 'uppercase', fontFamily: "'JetBrains Mono',monospace" }}>
              Domain Checker
            </span>
          </div>
          <h1 style={{ fontSize: 'clamp(1.8rem,3vw,2.6rem)', fontWeight: 900, letterSpacing: '-1.5px', color: '#fafafa', marginBottom: 6 }}>
            Find the perfect domain
          </h1>
          <p style={{ color: '#c4c4cc', fontSize: 15 }}>
            Enter a business name to check availability across .com .net .org .co .io .info
          </p>
        </div>

        {/* Search box */}
        <div style={{ marginBottom: 32, animation: 'fadeUp 0.5s cubic-bezier(0.16,1,0.3,1) 0.1s both' }}>
          <div style={{
            display: 'flex', gap: 10,
            background: 'rgba(255,255,255,0.02)', border: `1px solid ${focused ? 'rgba(139,92,246,0.5)' : 'rgba(255,255,255,0.08)'}`,
            borderRadius: 14, padding: '6px 6px 6px 18px', transition: 'border-color 0.2s',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1 }}>
              <Globe size={16} color="#b8c2d4" strokeWidth={1.5} />
              <input
                value={query}
                onChange={e => setQuery(e.target.value)}
                onFocus={() => setFocused(true)}
                onBlur={() => setFocused(false)}
                onKeyDown={e => e.key === 'Enter' && handleSearch()}
                placeholder="e.g. Joe's Plumbing, Valley Auto Repair..."
                style={{
                  background: 'none', border: 'none', outline: 'none',
                  color: '#fafafa', fontSize: 15, width: '100%',
                  fontFamily: "'Outfit', sans-serif",
                }}
              />
            </div>
            <button
              onClick={() => handleSearch()}
              disabled={loading || !query.trim()}
              style={{
                display: 'flex', alignItems: 'center', gap: 8,
                background: loading || !query.trim() ? 'rgba(255,255,255,0.06)' : 'linear-gradient(135deg,#8b5cf6,#6366f1)',
                border: 'none', borderRadius: 10, padding: '11px 22px',
                color: loading || !query.trim() ? '#b8c2d4' : '#fff',
                fontSize: 14, fontWeight: 700, cursor: loading || !query.trim() ? 'not-allowed' : 'pointer',
                fontFamily: "'Outfit', sans-serif", whiteSpace: 'nowrap',
              }}
            >
              {loading
                ? <><Loader2 size={14} style={{ animation: 'spin 0.8s linear infinite' }} /> Checking...</>
                : <><Search size={14} /> Check Domains</>
              }
            </button>
          </div>

          {/* Suggestion chips */}
          {suggestions.length > 0 && !loading && !results && (
            <SuggestionChips variants={suggestions} onPick={v => { setQuery(v); handleSearch(v) }} />
          )}

          {/* Example searches */}
          {!query && !results && (
            <div style={{ marginTop: 14, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 12, color: '#b8c2d4' }}>Try:</span>
              {EXAMPLE_SEARCHES.map(ex => (
                <button
                  key={ex}
                  onClick={() => { setQuery(ex); handleSearch(ex) }}
                  style={{
                    background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)',
                    borderRadius: 20, padding: '3px 10px', color: '#c4c4cc', fontSize: 12,
                    cursor: 'pointer', fontFamily: "'Outfit', sans-serif", transition: 'all 0.15s',
                  }}
                  onMouseEnter={e => { e.currentTarget.style.color = '#e4e4e7'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.15)' }}
                  onMouseLeave={e => { e.currentTarget.style.color = '#c4c4cc'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.07)' }}
                >
                  {ex}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Error */}
        {error && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: 10,
            background: 'rgba(248,113,113,0.07)', border: '1px solid rgba(248,113,113,0.2)',
            borderRadius: 12, padding: '14px 18px', marginBottom: 24, fontSize: 14, color: '#f87171',
          }}>
            <XCircle size={16} />
            {error}
          </div>
        )}

        {/* Loading skeleton */}
        {loading && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {[1, 2, 3].map(i => (
              <div key={i} style={{
                background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)',
                borderRadius: 16, padding: 20, animation: `pulse 1.5s ease ${i * 0.15}s infinite`,
              }}>
                <div style={{ height: 14, background: 'rgba(255,255,255,0.05)', borderRadius: 7, width: '40%', marginBottom: 12 }} />
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {[1, 2, 3].map(j => (
                    <div key={j} style={{ height: 52, background: 'rgba(255,255,255,0.03)', borderRadius: 10 }} />
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Results */}
        {results && !loading && (
          <>
            {/* Summary bar */}
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              marginBottom: 20, flexWrap: 'wrap', gap: 10,
              animation: 'fadeUp 0.4s cubic-bezier(0.16,1,0.3,1) both',
            }}>
              <div>
                <span style={{ fontSize: 14, color: '#c4c4cc' }}>
                  Results for <strong style={{ color: '#e4e4e7' }}>"{results.query}"</strong>
                </span>
                <span style={{ marginLeft: 12, fontSize: 13, color: '#4ade80', fontFamily: "'JetBrains Mono',monospace", fontWeight: 700 }}>
                  {totalAvailable} available
                </span>
                <span style={{ fontSize: 13, color: '#b8c2d4', fontFamily: "'JetBrains Mono',monospace" }}>
                  /{totalChecked} checked
                </span>
              </div>
              <button
                onClick={() => handleSearch()}
                style={{
                  display: 'flex', alignItems: 'center', gap: 6,
                  background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)',
                  borderRadius: 8, padding: '6px 12px', color: '#c4c4cc', fontSize: 12,
                  cursor: 'pointer', fontFamily: "'Outfit',sans-serif",
                }}
              >
                <RefreshCw size={11} /> Re-check
              </button>
            </div>

            {/* Variant cards */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {results.variants.map((variant, i) => (
                <VariantCard key={variant.name} variant={variant} index={i} />
              ))}
            </div>

            {/* GoDaddy note */}
            <div style={{
              marginTop: 28, padding: '12px 16px',
              background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)',
              borderRadius: 10, fontSize: 12, color: '#b8c2d4',
              display: 'flex', alignItems: 'center', gap: 8,
            }}>
              <Sparkles size={12} color="#8b5cf6" />
              Availability and pricing powered by GoDaddy. Click "Buy" to register on GoDaddy.com. Prices shown are approximate and may vary.
            </div>
          </>
        )}

        {/* Empty state */}
        {!results && !loading && !error && (
          <div style={{
            textAlign: 'center', paddingTop: 60,
            animation: 'fadeUp 0.5s cubic-bezier(0.16,1,0.3,1) 0.2s both',
          }}>
            <div style={{
              width: 72, height: 72, borderRadius: '50%', margin: '0 auto 20px',
              background: 'rgba(139,92,246,0.08)', border: '1px solid rgba(139,92,246,0.2)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <Globe size={28} color="#8b5cf6" strokeWidth={1.5} />
            </div>
            <h2 style={{ fontSize: 18, fontWeight: 700, color: '#e4e4e7', marginBottom: 8 }}>
              Search a business name
            </h2>
            <p style={{ fontSize: 14, color: '#b8c2d4', maxWidth: 400, margin: '0 auto', lineHeight: 1.7 }}>
              Enter any business name and we'll suggest domain variations and check availability
              across 6 TLDs instantly.
            </p>
          </div>
        )}
      </div>
    </div>
  )
}