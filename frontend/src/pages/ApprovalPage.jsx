// frontend/src/pages/ApprovalPage.jsx
// Public page — no auth required
import { useState, useEffect, useRef } from 'react'
import { useParams } from 'react-router-dom'
import { CheckCircle2, AlertCircle, Loader2, ExternalLink, PenLine, X } from 'lucide-react'
import { API } from '../utils/api'

export default function ApprovalPage() {
  const { token } = useParams()

  const [data, setData]         = useState(null)
  const [loading, setLoading]   = useState(true)
  const [error, setError]       = useState(null)
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted]   = useState(false)

  // Canvas
  const canvasRef   = useRef(null)
  const drawing     = useRef(false)
  const lastPos     = useRef({ x: 0, y: 0 })
  const hasStrokes  = useRef(false)
  const [canClear, setCanClear] = useState(false)

  // ── Fetch approval info ────────────────────────────────────────────────────
  useEffect(() => {
    fetch(`${API}/payments/approval/${token}`)
      .then(r => r.json())
      .then(d => {
        if (d.detail) throw new Error(d.detail)
        setData(d)
      })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }, [token])

  // ── Canvas helpers ─────────────────────────────────────────────────────────
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    ctx.fillStyle = 'rgba(255,255,255,0.03)'
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    ctx.strokeStyle = '#e2e8f0'
    ctx.lineWidth   = 2
    ctx.lineCap     = 'round'
    ctx.lineJoin    = 'round'
  }, [data])

  const getPos = (e, canvas) => {
    const rect = canvas.getBoundingClientRect()
    const scaleX = canvas.width  / rect.width
    const scaleY = canvas.height / rect.height
    if (e.touches) {
      return {
        x: (e.touches[0].clientX - rect.left) * scaleX,
        y: (e.touches[0].clientY - rect.top)  * scaleY,
      }
    }
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top)  * scaleY,
    }
  }

  const startDraw = e => {
    e.preventDefault()
    drawing.current = true
    const pos = getPos(e, canvasRef.current)
    lastPos.current = pos
  }

  const draw = e => {
    e.preventDefault()
    if (!drawing.current) return
    const canvas = canvasRef.current
    const ctx    = canvas.getContext('2d')
    const pos    = getPos(e, canvas)
    ctx.beginPath()
    ctx.moveTo(lastPos.current.x, lastPos.current.y)
    ctx.lineTo(pos.x, pos.y)
    ctx.stroke()
    lastPos.current = pos
    hasStrokes.current = true
    setCanClear(true)
  }

  const stopDraw = e => {
    e.preventDefault()
    drawing.current = false
  }

  const clearCanvas = () => {
    const canvas = canvasRef.current
    const ctx    = canvas.getContext('2d')
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    ctx.fillStyle = 'rgba(255,255,255,0.03)'
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    hasStrokes.current = false
    setCanClear(false)
  }

  // ── Submit approval ────────────────────────────────────────────────────────
  const handleSubmit = async () => {
    if (!hasStrokes.current) {
      alert('Please draw your signature before submitting.')
      return
    }
    setSubmitting(true)
    try {
      const canvas    = canvasRef.current
      const signature = canvas.toDataURL('image/png')
      const res = await fetch(`${API}/payments/approve/${token}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ signature }),
      })
      const d = await res.json()
      if (!res.ok) throw new Error(d.detail || 'Failed to submit approval')
      setSubmitted(true)
    } catch (e) {
      alert(`Error: ${e.message}`)
    } finally {
      setSubmitting(false)
    }
  }

  // ── Render states ──────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div style={{ minHeight: '100vh', background: '#0f1117', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Loader2 size={28} color="#7c3aed" style={{ animation: 'spin 1s linear infinite' }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
      </div>
    )
  }

  if (error) {
    return (
      <div style={{ minHeight: '100vh', background: '#0f1117', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
        <div style={{ maxWidth: 420, width: '100%', background: 'rgba(248,113,113,0.06)', border: '1px solid rgba(248,113,113,0.2)', borderRadius: 16, padding: '32px 28px', textAlign: 'center' }}>
          <AlertCircle size={36} color="#f87171" style={{ marginBottom: 14 }} />
          <div style={{ fontSize: 18, fontWeight: 700, color: '#f87171', fontFamily: "'Outfit',sans-serif", marginBottom: 8 }}>Link Not Found</div>
          <div style={{ fontSize: 13, color: '#94a3b8', fontFamily: "'Outfit',sans-serif" }}>{error}</div>
        </div>
      </div>
    )
  }

  if (data?.client_approved || submitted) {
    const approvedAt = submitted ? new Date() : (data?.client_approved_at ? new Date(data.client_approved_at) : null)
    return (
      <div style={{ minHeight: '100vh', background: '#0f1117', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
        <div style={{ maxWidth: 440, width: '100%', background: 'rgba(5,150,105,0.06)', border: '1px solid rgba(5,150,105,0.25)', borderRadius: 20, padding: '40px 32px', textAlign: 'center' }}>
          <CheckCircle2 size={52} color="#34d399" style={{ marginBottom: 18 }} />
          <div style={{ fontSize: 22, fontWeight: 800, color: '#e2e8f0', fontFamily: "'Outfit',sans-serif", marginBottom: 8 }}>Thank you!</div>
          <div style={{ fontSize: 15, color: '#34d399', fontFamily: "'Outfit',sans-serif", fontWeight: 600, marginBottom: 12 }}>Your approval has been recorded.</div>
          <div style={{ fontSize: 13, color: '#94a3b8', fontFamily: "'Outfit',sans-serif", lineHeight: 1.6 }}>
            {approvedAt ? `Approved on ${approvedAt.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}.` : ''}
            {' '}Your designer will now proceed with the final invoice.
          </div>
        </div>
      </div>
    )
  }

  // ── Main page ──────────────────────────────────────────────────────────────
  return (
    <div style={{ minHeight: '100vh', background: '#0f1117', padding: '40px 16px 60px', fontFamily: "'Outfit',sans-serif" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;700&display=swap');
        * { box-sizing: border-box; }
        canvas { touch-action: none; cursor: crosshair; }
      `}</style>

      <div style={{ maxWidth: 560, margin: '0 auto' }}>

        {/* Brand bar */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 32 }}>
          <div style={{ width: 32, height: 32, background: '#1a1a2e', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 900, color: '#fff' }}>✦</div>
          <span style={{ fontSize: 15, fontWeight: 800, color: '#e2e8f0', letterSpacing: '-0.3px' }}>{data.designer_name || 'Your Designer'}</span>
        </div>

        {/* Main card */}
        <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 20, overflow: 'hidden' }}>

          {/* Green top bar */}
          <div style={{ height: 4, background: 'linear-gradient(90deg,#059669,#34d399)', fontSize: 0 }} />

          {/* Header */}
          <div style={{ padding: '28px 28px 20px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: '#059669', textTransform: 'uppercase', letterSpacing: '1.8px', marginBottom: 6, fontFamily: "'JetBrains Mono',monospace" }}>
              Website Approval
            </div>
            <div style={{ fontSize: 22, fontWeight: 800, color: '#e2e8f0', letterSpacing: '-0.5px', lineHeight: 1.2, marginBottom: 8 }}>
              Your website is ready!
            </div>
            <div style={{ fontSize: 13, color: '#94a3b8' }}>
              Hi <strong style={{ color: '#e2e8f0' }}>{data.client_name || 'there'}</strong>, <strong style={{ color: '#e2e8f0' }}>{data.designer_name || 'your designer'}</strong> has finished building your website and would like your sign-off before sending the final invoice.
            </div>
          </div>

          {/* Body */}
          <div style={{ padding: '24px 28px' }}>

            {/* Step 1 — Preview */}
            <div style={{ marginBottom: 24 }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: '#059669', textTransform: 'uppercase', letterSpacing: '1.4px', marginBottom: 10, fontFamily: "'JetBrains Mono',monospace" }}>
                Step 1 — Preview Your Website
              </div>
              {data.website_url && (
                <a
                  href={data.website_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, background: 'rgba(5,150,105,0.08)', border: '1px solid rgba(5,150,105,0.3)', borderRadius: 12, padding: '14px 16px', textDecoration: 'none', color: '#34d399', fontSize: 13, fontWeight: 700, transition: 'background 0.15s' }}
                >
                  <span style={{ wordBreak: 'break-all', fontSize: 12, fontFamily: "'JetBrains Mono',monospace" }}>{data.website_url}</span>
                  <ExternalLink size={14} style={{ flexShrink: 0 }} />
                </a>
              )}
            </div>

            {/* Divider */}
            <div style={{ height: 1, background: 'rgba(255,255,255,0.06)', marginBottom: 24 }} />

            {/* Step 2 — Agreement */}
            <div style={{ marginBottom: 20 }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: '#059669', textTransform: 'uppercase', letterSpacing: '1.4px', marginBottom: 12, fontFamily: "'JetBrains Mono',monospace" }}>
                Step 2 — Client Satisfaction &amp; Final Payment Agreement
              </div>
              <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 12, padding: '16px 18px' }}>
                <div style={{ fontSize: 12, color: '#cbd5e1', lineHeight: 1.8, fontFamily: "'Outfit',sans-serif" }}>
                  By signing below, I <strong style={{ color: '#e2e8f0' }}>{data.client_name || '[Client]'}</strong> confirm that:
                  <br /><br />
                  <span style={{ display: 'block', paddingLeft: 4, color: '#94a3b8' }}>
                    1.&nbsp; I have reviewed the completed website at{' '}
                    {data.website_url
                      ? <a href={data.website_url} target="_blank" rel="noopener noreferrer" style={{ color: '#34d399', textDecoration: 'none' }}>{data.website_url}</a>
                      : '[website URL]'
                    }
                  </span>
                  <span style={{ display: 'block', paddingLeft: 4, color: '#94a3b8' }}>
                    2.&nbsp; I am satisfied with the design, layout, and functionality
                  </span>
                  <span style={{ display: 'block', paddingLeft: 4, color: '#94a3b8' }}>
                    3.&nbsp; I authorize <strong style={{ color: '#e2e8f0' }}>{data.designer_name || '[Designer]'}</strong> to proceed with final billing (Invoice #2)
                  </span>
                  <span style={{ display: 'block', paddingLeft: 4, color: '#94a3b8' }}>
                    4.&nbsp; I waive any design-related disputes regarding the work reviewed above
                  </span>
                </div>
              </div>
            </div>

            {/* Divider */}
            <div style={{ height: 1, background: 'rgba(255,255,255,0.06)', marginBottom: 20 }} />

            {/* Step 3 — Signature */}
            <div style={{ marginBottom: 20 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: '#059669', textTransform: 'uppercase', letterSpacing: '1.4px', fontFamily: "'JetBrains Mono',monospace" }}>
                  Step 3 — Draw Your Signature
                </div>
                {canClear && (
                  <button
                    onClick={clearCanvas}
                    style={{ display: 'flex', alignItems: 'center', gap: 4, background: 'transparent', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 6, padding: '4px 10px', color: '#94a3b8', fontSize: 11, cursor: 'pointer', fontFamily: "'Outfit',sans-serif" }}
                  >
                    <X size={11} /> Clear
                  </button>
                )}
              </div>
              <div style={{ position: 'relative', borderRadius: 12, overflow: 'hidden', border: '1px solid rgba(5,150,105,0.3)', background: 'rgba(255,255,255,0.02)' }}>
                <canvas
                  ref={canvasRef}
                  width={520}
                  height={160}
                  style={{ width: '100%', height: 160, display: 'block' }}
                  onMouseDown={startDraw}
                  onMouseMove={draw}
                  onMouseUp={stopDraw}
                  onMouseLeave={stopDraw}
                  onTouchStart={startDraw}
                  onTouchMove={draw}
                  onTouchEnd={stopDraw}
                />
                {!canClear && (
                  <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'rgba(148,163,184,0.4)', fontSize: 12, fontFamily: "'Outfit',sans-serif" }}>
                      <PenLine size={14} />
                      Sign here
                    </div>
                  </div>
                )}
              </div>
              <div style={{ marginTop: 6, height: 1, background: 'rgba(255,255,255,0.06)' }} />
            </div>

            {/* Submit button */}
            <button
              onClick={handleSubmit}
              disabled={submitting}
              style={{
                width: '100%',
                padding: '14px 20px',
                background: submitting ? 'rgba(5,150,105,0.4)' : 'linear-gradient(135deg,#059669,#047857)',
                border: 'none',
                borderRadius: 12,
                color: '#fff',
                fontSize: 15,
                fontWeight: 700,
                cursor: submitting ? 'not-allowed' : 'pointer',
                fontFamily: "'Outfit',sans-serif",
                letterSpacing: '-0.2px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
              }}
            >
              {submitting
                ? <><Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} /> Submitting...</>
                : <><CheckCircle2 size={16} /> Approve &amp; Sign</>
              }
            </button>

            <div style={{ marginTop: 14, fontSize: 11, color: 'rgba(148,163,184,0.6)', textAlign: 'center', fontFamily: "'JetBrains Mono',monospace" }}>
              By submitting you agree to the Client Satisfaction Agreement above
            </div>

          </div>
        </div>

        {/* Footer */}
        <div style={{ marginTop: 24, textAlign: 'center', fontSize: 11, color: 'rgba(148,163,184,0.4)', fontFamily: "'JetBrains Mono',monospace" }}>
          Powered by BizScout &nbsp;·&nbsp; 256-bit SSL encryption
        </div>

      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
    </div>
  )
}
