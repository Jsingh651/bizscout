// frontend/src/components/InvoiceModal.jsx
import { useState, useEffect } from 'react'
import {
  X, CreditCard, Calendar, Send, Copy, CheckCircle2,
  AlertCircle, Loader2, ExternalLink, DollarSign
} from 'lucide-react'
import { API, getAuthHeaders } from '../utils/api'

function fmt(n) {
  return `$${Number(n).toLocaleString('en-US', { minimumFractionDigits: 0 })}`
}

function Field({ label, value, color = '#fafafa', sub }) {
  return (
    <div style={{ background:'rgba(255,255,255,0.02)',border:'1px solid rgba(255,255,255,0.06)',borderRadius:10,padding:'10px 14px' }}>
      <div style={{ fontSize:10,color:'#b8c2d4',fontFamily:"'JetBrains Mono',monospace",textTransform:'uppercase',letterSpacing:'0.08em',marginBottom:4 }}>{label}</div>
      <div style={{ fontSize:16,fontWeight:800,color,fontFamily:"'JetBrains Mono',monospace",letterSpacing:'-0.5px' }}>{value}</div>
      {sub && <div style={{ fontSize:10,color:'#b8c2d4',marginTop:3 }}>{sub}</div>}
    </div>
  )
}

function PayLink({ url, label }) {
  const [copied, setCopied] = useState(false)
  const copy = () => {
    navigator.clipboard.writeText(url)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }
  return (
    <div style={{ background:'rgba(139,92,246,0.06)',border:'1px solid rgba(139,92,246,0.18)',borderRadius:10,padding:'12px 14px',marginBottom:10 }}>
      <div style={{ fontSize:10,color:'#b8c2d4',fontFamily:"'JetBrains Mono',monospace",textTransform:'uppercase',letterSpacing:'0.08em',marginBottom:6 }}>{label || 'Payment Link'}</div>
      <div style={{ display:'flex',alignItems:'center',gap:8 }}>
        <div style={{ flex:1,fontSize:11,color:'#a78bfa',fontFamily:"'JetBrains Mono',monospace",overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap' }}>{url}</div>
        <button onClick={copy} style={{ display:'flex',alignItems:'center',gap:4,background:'rgba(139,92,246,0.1)',border:'1px solid rgba(139,92,246,0.25)',borderRadius:7,padding:'5px 10px',color:copied?'#4ade80':'#a78bfa',fontSize:11,fontWeight:600,cursor:'pointer',fontFamily:"'Outfit',sans-serif",whiteSpace:'nowrap' }}>
          {copied ? <><CheckCircle2 size={10}/> Copied!</> : <><Copy size={10}/> Copy</>}
        </button>
        <a href={url} target="_blank" rel="noreferrer" style={{ display:'flex',alignItems:'center',justifyContent:'center',width:28,height:28,background:'rgba(255,255,255,0.04)',border:'1px solid rgba(255,255,255,0.08)',borderRadius:7,color:'#c4c4cc',textDecoration:'none' }}>
          <ExternalLink size={11} />
        </a>
      </div>
    </div>
  )
}

export default function InvoiceModal({ contract, onClose }) {
  const [launchDate, setLaunchDate] = useState('')
  const [sending, setSending]       = useState(false)
  const [status, setStatus]         = useState(null)
  const [error, setError]           = useState('')
  const [success, setSuccess]       = useState('')

  const setup   = parseFloat(contract.setup_price   || 0)
  const monthly = parseFloat(contract.monthly_price || 0)
  const deposit = Math.round(setup / 2)

  useEffect(() => {
    if (!contract?.id) return
    fetch(`${API}/payments/status/${contract.id}`, {
      credentials: 'include', headers: getAuthHeaders(),
    })
      .then(r => r.ok ? r.json() : null)
      .then(d => {
        if (!d) return
        setStatus(d)
        if (d.launch_date) setLaunchDate(d.launch_date.split('T')[0])
      })
      .catch(() => {})
  }, [contract?.id])

  const handleSendInvoice = async () => {
    if (!launchDate) { setError('Please set a launch date.'); return }
    setSending(true); setError(''); setSuccess('')
    try {
      const res = await fetch(`${API}/payments/send-invoice`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        credentials: 'include',
        body: JSON.stringify({ contract_id: contract.id, launch_date: launchDate }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.detail || 'Failed to send')
      setStatus(prev => ({ ...(prev || {}), ...data }))
      setSuccess(`Invoice #1 (deposit) sent to ${contract.client_email}`)
    } catch (e) { setError(e.message) }
    finally { setSending(false) }
  }

  const depositPaid = status?.deposit_paid || false
  const finalPaid   = status?.final_paid   || false
  const payUrl      = status?.pay_url      || null
  const finalPayUrl = status?.final_pay_url || null
  const hasSent     = !!payUrl

  return (
    <div
      style={{ position:'fixed',inset:0,zIndex:1000,display:'flex',alignItems:'center',justifyContent:'center',background:'rgba(0,0,0,0.75)',backdropFilter:'blur(8px)' }}
      onClick={onClose}
    >
      <div
        style={{ width:520,maxHeight:'92vh',overflowY:'auto',background:'#111118',border:'1px solid rgba(255,255,255,0.1)',borderRadius:18,overflow:'hidden',boxShadow:'0 40px 80px rgba(0,0,0,0.8)',position:'relative' }}
        onClick={e => e.stopPropagation()}
      >
        <div style={{ position:'absolute',top:0,left:0,right:0,height:1,background:'linear-gradient(90deg,transparent,rgba(139,92,246,0.6),transparent)',zIndex:1 }} />

        {/* Header */}
        <div style={{ display:'flex',alignItems:'center',justifyContent:'space-between',padding:'20px 24px',borderBottom:'1px solid rgba(255,255,255,0.06)' }}>
          <div style={{ display:'flex',alignItems:'center',gap:10 }}>
            <div style={{ width:32,height:32,borderRadius:9,background:'rgba(139,92,246,0.12)',border:'1px solid rgba(139,92,246,0.25)',display:'flex',alignItems:'center',justifyContent:'center' }}>
              <CreditCard size={14} color="#a78bfa" strokeWidth={1.5} />
            </div>
            <div>
              <div style={{ fontSize:14,fontWeight:700,color:'#fafafa' }}>Send Invoice #1 — Deposit</div>
              <div style={{ fontSize:11,color:'#c4c4cc',marginTop:1 }}>{contract.client_name} · 50/50 payment plan</div>
            </div>
          </div>
          <button onClick={onClose} style={{ background:'none',border:'none',cursor:'pointer',color:'#b8c2d4',padding:4,display:'flex' }}>
            <X size={15} />
          </button>
        </div>

        <div style={{ padding:'20px 24px' }}>

          {/* Pricing summary */}
          <div style={{ display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:10,marginBottom:16 }}>
            <Field label="Invoice #1 (Deposit)" value={deposit ? fmt(deposit) : '—'} color="#a78bfa" sub="due today" />
            <Field label="Invoice #2 (Final)" value={deposit ? fmt(deposit) : '—'} color="#fb923c" sub="due on completion" />
            <Field label="Monthly (from launch)" value={monthly ? `${fmt(monthly)}/mo` : '—'} color="#4ade80" sub="with Invoice #2" />
          </div>

          {/* Plan explainer */}
          <div style={{ background:'rgba(139,92,246,0.04)',border:'1px solid rgba(139,92,246,0.12)',borderRadius:10,padding:'10px 14px',marginBottom:16,fontSize:12,color:'#c4c4cc',lineHeight:1.6 }}>
            <DollarSign size={11} color="#a78bfa" style={{ display:'inline',marginRight:4,verticalAlign:'middle' }} />
            <strong style={{ color:'#a78bfa' }}>50/50 Split Plan:</strong> Client pays {fmt(deposit)} now to start work.
            When the site is ready, you send Invoice #2 for the remaining {fmt(deposit)} + monthly hosting ({fmt(monthly)}/mo) starting on the launch date.
          </div>

          {/* Status badges */}
          <div style={{ display:'flex',gap:8,marginBottom:16,flexWrap:'wrap' }}>
            <div style={{ display:'flex',alignItems:'center',gap:5,fontSize:11,padding:'4px 10px',borderRadius:20,background:depositPaid?'rgba(74,222,128,0.1)':'rgba(255,255,255,0.04)',border:`1px solid ${depositPaid?'rgba(74,222,128,0.25)':'rgba(255,255,255,0.08)'}`,color:depositPaid?'#4ade80':'#b8c2d4',fontFamily:"'JetBrains Mono',monospace",fontWeight:700 }}>
              {depositPaid ? <CheckCircle2 size={10}/> : <CreditCard size={10}/>} Invoice #1: {depositPaid ? 'Paid' : 'Pending'}
            </div>
            <div style={{ display:'flex',alignItems:'center',gap:5,fontSize:11,padding:'4px 10px',borderRadius:20,background:finalPaid?'rgba(74,222,128,0.1)':'rgba(255,255,255,0.04)',border:`1px solid ${finalPaid?'rgba(74,222,128,0.25)':'rgba(255,255,255,0.08)'}`,color:finalPaid?'#4ade80':'#b8c2d4',fontFamily:"'JetBrains Mono',monospace",fontWeight:700 }}>
              {finalPaid ? <CheckCircle2 size={10}/> : <CreditCard size={10}/>} Invoice #2: {finalPaid ? 'Paid' : depositPaid ? 'Ready to send' : 'Locked'}
            </div>
          </div>

          {/* Launch date */}
          {!depositPaid && (
            <div style={{ marginBottom:16 }}>
              <label style={{ fontSize:10,fontWeight:700,color:'#b8c2d4',fontFamily:"'JetBrains Mono',monospace",textTransform:'uppercase',letterSpacing:'0.1em',display:'flex',alignItems:'center',gap:5,marginBottom:8 }}>
                <Calendar size={10} color="#8b5cf6" /> Planned Launch Date (when monthly billing starts)
              </label>
              <input
                type="date"
                value={launchDate}
                min={new Date().toISOString().split('T')[0]}
                onChange={e => setLaunchDate(e.target.value)}
                style={{ width:'100%',background:'rgba(255,255,255,0.04)',border:'1px solid rgba(255,255,255,0.08)',borderRadius:9,padding:'10px 14px',color:'#f4f4f5',fontSize:13,fontFamily:"'Outfit',sans-serif",outline:'none',boxSizing:'border-box' }}
                onFocus={e => e.target.style.borderColor='rgba(139,92,246,0.5)'}
                onBlur={e => e.target.style.borderColor='rgba(255,255,255,0.08)'}
              />
            </div>
          )}

          {/* Pay URLs */}
          {payUrl && <PayLink url={payUrl} label="Invoice #1 — Deposit Payment Link" />}
          {finalPayUrl && <PayLink url={finalPayUrl} label="Invoice #2 — Final Payment Link" />}

          {/* Error / success */}
          {error && (
            <div style={{ display:'flex',alignItems:'center',gap:8,background:'rgba(248,113,113,0.07)',border:'1px solid rgba(248,113,113,0.2)',borderRadius:8,padding:'10px 14px',marginBottom:14,fontSize:13,color:'#f87171' }}>
              <AlertCircle size={13} /> {error}
            </div>
          )}
          {success && (
            <div style={{ display:'flex',alignItems:'center',gap:8,background:'rgba(74,222,128,0.07)',border:'1px solid rgba(74,222,128,0.2)',borderRadius:8,padding:'10px 14px',marginBottom:14,fontSize:13,color:'#4ade80' }}>
              <CheckCircle2 size={13} /> {success}
            </div>
          )}

          {/* Send button */}
          {!depositPaid && (
            <button
              onClick={handleSendInvoice}
              disabled={sending || !launchDate || !contract.client_email}
              style={{ width:'100%',display:'flex',alignItems:'center',justifyContent:'center',gap:8,background:(!launchDate||!contract.client_email)?'rgba(255,255,255,0.06)':'linear-gradient(135deg,#8b5cf6,#6366f1)',border:'none',borderRadius:10,padding:'12px',color:(!launchDate||!contract.client_email)?'#b8c2d4':'#fff',fontSize:14,fontWeight:700,cursor:(sending||!launchDate||!contract.client_email)?'not-allowed':'pointer',fontFamily:"'Outfit',sans-serif",opacity:sending?0.7:1 }}
            >
              {sending
                ? <><Loader2 size={14} style={{ animation:'spin 0.8s linear infinite' }}/> Sending...</>
                : hasSent
                ? <><Send size={14}/> Resend Invoice #1 (Deposit)</>
                : <><Send size={14}/> Send Invoice #1 — {fmt(deposit)} Deposit</>
              }
            </button>
          )}

          {depositPaid && !finalPaid && (
            <div style={{ background:'rgba(74,222,128,0.06)',border:'1px solid rgba(74,222,128,0.18)',borderRadius:10,padding:'12px 14px',fontSize:13,color:'#4ade80',textAlign:'center',fontWeight:600 }}>
              <CheckCircle2 size={14} style={{ display:'inline',marginRight:6,verticalAlign:'middle' }} />
              Deposit paid! Use the Payment Status card on the lead page to send Invoice #2 when the site is ready.
            </div>
          )}

          {finalPaid && (
            <div style={{ display:'flex',alignItems:'center',justifyContent:'center',gap:8,background:'rgba(74,222,128,0.08)',border:'1px solid rgba(74,222,128,0.2)',borderRadius:10,padding:'14px',fontSize:14,fontWeight:700,color:'#4ade80' }}>
              <CheckCircle2 size={16} />
              Fully paid · Monthly subscription active
            </div>
          )}

          {!contract.client_email && (
            <p style={{ fontSize:11,color:'#f87171',marginTop:10,textAlign:'center' }}>
              ⚠ No client email — add one to this contract first.
            </p>
          )}
        </div>
      </div>

      <style>{`@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}`}</style>
    </div>
  )
}
