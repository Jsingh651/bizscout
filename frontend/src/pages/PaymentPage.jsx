// frontend/src/pages/PaymentPage.jsx
import { useState, useEffect } from 'react'
import { useParams, useSearchParams } from 'react-router-dom'
import {
  CheckCircle2, AlertCircle, Loader2, CreditCard,
  ArrowRight, Shield, Star, Zap
} from 'lucide-react'

const API = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000'

function fmt(n) {
  return `$${Number(n).toLocaleString('en-US', { minimumFractionDigits: 0 })}`
}

function fmtDate(iso) {
  if (!iso) return null
  return new Date(iso).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function PaymentPage() {
  const { token } = useParams()
  const [searchParams] = useSearchParams()

  const [data, setData]         = useState(null)
  const [loading, setLoading]   = useState(true)
  const [error, setError]       = useState(null)
  const [paying, setPaying]     = useState(false)

  const success   = searchParams.get('success')   === '1'
  const cancelled = searchParams.get('cancelled') === '1'

  useEffect(() => {
    fetch(`${API}/payments/public/${token}`)
      .then(async r => {
        if (!r.ok) { const d = await r.json().catch(() => ({})); throw new Error(d.detail || 'Invalid payment link') }
        return r.json()
      })
      .then(d => { setData(d); setLoading(false) })
      .catch(e => { setError(e.message); setLoading(false) })
  }, [token])

  const handlePay = async () => {
    if (paying) return
    setPaying(true)
    try {
      const res = await fetch(`${API}/payments/create-session`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ payment_token: token, plan: 'full' }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.detail || 'Failed to create session')
      window.location.href = json.checkout_url
    } catch (e) {
      setError(e.message)
      setPaying(false)
    }
  }

  // ── Loading ───────────────────────────────────────────────────────────────
  if (loading) return (
    <Page>
      <div style={{ display:'flex',justifyContent:'center',paddingTop:100 }}>
        <div style={{ width:20,height:20,border:'2px solid rgba(139,92,246,0.3)',borderTopColor:'#8b5cf6',borderRadius:'50%',animation:'spin 0.8s linear infinite' }} />
      </div>
    </Page>
  )

  if (error) return (
    <Page>
      <div style={{ textAlign:'center',maxWidth:400,margin:'80px auto',padding:'0 24px' }}>
        <AlertCircle size={40} color="#f87171" style={{ margin:'0 auto 16px',display:'block' }} />
        <h2 style={{ fontSize:20,fontWeight:700,color:'#fafafa',marginBottom:8 }}>Something went wrong</h2>
        <p style={{ fontSize:14,color:'#c4c4cc' }}>{error}</p>
      </div>
    </Page>
  )

  const launchStr = fmtDate(data.launch_date)

  // ── Already paid / success ────────────────────────────────────────────────
  if (success || data.deposit_paid || data.final_paid) {
    return (
      <Page>
        <div style={{ textAlign:'center',maxWidth:480,margin:'0 auto',padding:'80px 24px' }}>
          <div style={{ width:72,height:72,borderRadius:'50%',background:'rgba(74,222,128,0.1)',border:'2px solid #4ade80',display:'flex',alignItems:'center',justifyContent:'center',margin:'0 auto 24px' }}>
            <CheckCircle2 size={32} color="#4ade80" />
          </div>
          <h1 style={{ fontSize:28,fontWeight:900,color:'#fafafa',marginBottom:12,letterSpacing:'-1px' }}>
            Payment received!
          </h1>
          <p style={{ fontSize:15,color:'#c4c4cc',lineHeight:1.7,marginBottom:8 }}>
            {launchStr
              ? `All set! Monthly hosting (${fmt(data.monthly_price)}/mo) starts ${launchStr}.`
              : 'All set! Monthly hosting is now active.'
            }
          </p>
          <p style={{ fontSize:13,color:'#888',marginTop:16 }}>
            You'll receive a receipt from Stripe. Reach out to {data.designer_name} with any questions.
          </p>
        </div>
      </Page>
    )
  }

  // ── Default: single payment card ──────────────────────────────────────────
  return (
    <Page>
      <div style={{ maxWidth:560,margin:'0 auto',padding:'48px 24px 80px' }}>

        {/* Header */}
        <div style={{ textAlign:'center',marginBottom:40 }}>
          <div style={{ display:'inline-flex',alignItems:'center',gap:7,background:'rgba(139,92,246,0.08)',border:'1px solid rgba(139,92,246,0.2)',borderRadius:6,padding:'5px 12px',marginBottom:16 }}>
            <CreditCard size={11} color="#a78bfa" />
            <span style={{ color:'#a78bfa',fontSize:'0.64rem',fontWeight:700,letterSpacing:'2px',textTransform:'uppercase',fontFamily:"'JetBrains Mono',monospace" }}>
              Secure Payment
            </span>
          </div>
          <h1 style={{ fontSize:'clamp(1.6rem,4vw,2.4rem)',fontWeight:900,color:'#fafafa',letterSpacing:'-1.5px',marginBottom:10 }}>
            Pay for your new website
          </h1>
          <p style={{ fontSize:15,color:'#c4c4cc',lineHeight:1.6 }}>
            From <strong style={{ color:'#e4e4e7' }}>{data.designer_name}</strong> for <strong style={{ color:'#e4e4e7' }}>{data.client_name}</strong>
            {launchStr && <> · Launch: <span style={{ color:'#8b5cf6' }}>{launchStr}</span></>}
          </p>
        </div>

        {cancelled && (
          <div style={{ display:'flex',alignItems:'center',gap:10,background:'rgba(251,146,60,0.07)',border:'1px solid rgba(251,146,60,0.2)',borderRadius:10,padding:'12px 16px',marginBottom:24,fontSize:13,color:'#fb923c' }}>
            <AlertCircle size={14} /> Payment was cancelled. Click below when you're ready to try again.
          </div>
        )}

        {error && (
          <div style={{ display:'flex',alignItems:'center',gap:10,background:'rgba(248,113,113,0.07)',border:'1px solid rgba(248,113,113,0.2)',borderRadius:10,padding:'12px 16px',marginBottom:24,fontSize:13,color:'#f87171' }}>
            <AlertCircle size={14} /> {error}
          </div>
        )}

        {/* Payment card */}
        <div style={{ background:'rgba(255,255,255,0.02)',border:'2px solid rgba(139,92,246,0.4)',borderRadius:18,padding:'32px 28px',marginBottom:24,position:'relative',overflow:'hidden' }}>
          <div style={{ position:'absolute',top:0,left:0,right:0,height:3,background:'linear-gradient(90deg,transparent,#8b5cf6,transparent)' }} />

          <div style={{ fontSize:11,fontWeight:700,color:'#a78bfa',fontFamily:"'JetBrains Mono',monospace",textTransform:'uppercase',letterSpacing:'1.5px',marginBottom:20 }}>
            What you're paying
          </div>

          <div style={{ display:'flex',flexDirection:'column',gap:14,marginBottom:28 }}>
            {/* Setup fee row */}
            <div style={{ display:'flex',justifyContent:'space-between',alignItems:'center',padding:'14px 16px',background:'rgba(139,92,246,0.06)',border:'1px solid rgba(139,92,246,0.15)',borderRadius:10 }}>
              <div>
                <div style={{ fontSize:13,fontWeight:600,color:'#e4e4e7' }}>One-time setup fee</div>
                <div style={{ fontSize:11,color:'#b8c2d4',marginTop:2 }}>Billed today — non-refundable once work begins</div>
              </div>
              <div style={{ fontSize:22,fontWeight:900,color:'#fafafa',fontFamily:"'JetBrains Mono',monospace",letterSpacing:'-1px' }}>
                {fmt(data.setup_price)}
              </div>
            </div>

            {/* Monthly row */}
            <div style={{ display:'flex',justifyContent:'space-between',alignItems:'center',padding:'14px 16px',background:'rgba(74,222,128,0.04)',border:'1px solid rgba(74,222,128,0.12)',borderRadius:10 }}>
              <div>
                <div style={{ fontSize:13,fontWeight:600,color:'#e4e4e7' }}>Monthly hosting &amp; maintenance</div>
                <div style={{ fontSize:11,color:'#b8c2d4',marginTop:2 }}>
                  Starts on launch date{launchStr ? ` · ${launchStr}` : ''} · Cancel anytime with 30 days notice
                </div>
              </div>
              <div style={{ fontSize:18,fontWeight:900,color:'#4ade80',fontFamily:"'JetBrains Mono',monospace",letterSpacing:'-0.5px',whiteSpace:'nowrap' }}>
                {fmt(data.monthly_price)}<span style={{ fontSize:12,fontWeight:500,color:'#6ee7b7' }}>/mo</span>
              </div>
            </div>
          </div>

          <button
            onClick={handlePay}
            disabled={paying}
            style={{ width:'100%',display:'flex',alignItems:'center',justifyContent:'center',gap:10,background:paying?'rgba(139,92,246,0.4)':'linear-gradient(135deg,#8b5cf6,#6366f1)',border:'none',borderRadius:12,padding:'15px',color:'#fff',fontSize:15,fontWeight:700,cursor:paying?'not-allowed':'pointer',fontFamily:"'Outfit',sans-serif",transition:'opacity 0.2s',letterSpacing:'-0.2px' }}
          >
            {paying
              ? <><Loader2 size={15} style={{ animation:'spin 0.8s linear infinite' }} /> Redirecting to Stripe...</>
              : <><CreditCard size={15} /> Pay {fmt(data.setup_price)} &amp; Start Subscription <ArrowRight size={14} /></>
            }
          </button>

          <p style={{ textAlign:'center',fontSize:11,color:'#888',marginTop:12,lineHeight:1.5 }}>
            You'll be charged {fmt(data.setup_price)} today. Monthly billing of {fmt(data.monthly_price)}/mo begins on your launch date.
          </p>
        </div>

        <TrustBar />
      </div>
    </Page>
  )
}

// ─── Shared components ────────────────────────────────────────────────────────

function TrustBar() {
  return (
    <div style={{ display:'flex',justifyContent:'center',gap:32,flexWrap:'wrap',padding:'20px 0',borderTop:'1px solid rgba(255,255,255,0.05)' }}>
      {[
        { icon: Shield,      text: 'Secured by Stripe' },
        { icon: CreditCard,  text: 'All major cards accepted' },
        { icon: Star,        text: 'Cancel anytime' },
        { icon: Zap,         text: 'Instant confirmation' },
      ].map(({ icon: Icon, text }) => (
        <div key={text} style={{ display:'flex',alignItems:'center',gap:6,fontSize:12,color:'#b8c2d4' }}>
          <Icon size={12} color="#8b5cf6" strokeWidth={1.5} /> {text}
        </div>
      ))}
    </div>
  )
}

function Page({ children }) {
  return (
    <div style={{ minHeight:'100vh',background:'#09090f',color:'#fafafa',fontFamily:"'Outfit',sans-serif" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@400;500;600;700;800;900&family=JetBrains+Mono:wght@400;700&display=swap');
        *,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
        html,body{scrollbar-width:none}
        html::-webkit-scrollbar{display:none}
        @keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}
      `}</style>
      <nav style={{ display:'flex',alignItems:'center',gap:10,padding:'0 32px',height:60,background:'rgba(9,9,15,0.9)',backdropFilter:'blur(20px)',borderBottom:'1px solid rgba(255,255,255,0.05)' }}>
        <div style={{ width:26,height:26,borderRadius:7,background:'linear-gradient(135deg,#8b5cf6,#6366f1)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:'0.65rem',fontWeight:900,color:'#fff' }}>B</div>
        <span style={{ fontWeight:800,fontSize:'0.95rem',color:'#f4f4f5',letterSpacing:'-0.3px' }}>BizScout</span>
        <span style={{ marginLeft:'auto',fontSize:12,color:'#b8c2d4',display:'flex',alignItems:'center',gap:5 }}>
          <Shield size={11} color="#4ade80" /> Payments secured by Stripe
        </span>
      </nav>
      <div style={{ position:'fixed',inset:0,zIndex:0,pointerEvents:'none',opacity:0.25,backgroundImage:'linear-gradient(rgba(139,92,246,0.04) 1px,transparent 1px),linear-gradient(90deg,rgba(139,92,246,0.04) 1px,transparent 1px)',backgroundSize:'72px 72px',maskImage:'radial-gradient(ellipse 100% 55% at 50% 0%,black 0%,transparent 100%)' }} />
      <div style={{ position:'relative',zIndex:1 }}>{children}</div>
    </div>
  )
}