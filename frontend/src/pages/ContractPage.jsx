import { useState, useEffect, useRef, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  ArrowLeft, FileText, CheckCircle2, Send, Download,
  PenLine, X, RotateCcw, ChevronRight, AlertCircle,
  User, Mail, DollarSign, Calendar, Layout,
  CreditCard, Check, Loader2
} from 'lucide-react'
import NavbarDropdown from '../components/NavbarDropdown'
import { generateContractPDF } from '../utils/pdfUtils'
import { buildContractHTML } from '../utils/contractTemplate'

const API = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000'

function getAuthHeaders() {
  const token = sessionStorage.getItem('access_token') || localStorage.getItem('access_token')
  return token ? { Authorization: `Bearer ${token}` } : {}
}

// ─── Signature Canvas ─────────────────────────────────────────────────────────
function SignatureCanvas({ onSave, onCancel, label = 'Draw your signature' }) {
  const canvasRef = useRef(null)
  const isDrawing = useRef(false)
  const [isEmpty, setIsEmpty] = useState(true)

  useEffect(() => {
    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')
    ctx.fillStyle = 'transparent'
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    ctx.strokeStyle = '#1a1a2e'
    ctx.lineWidth = 2.5
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
  }, [])

  const getPos = (e, canvas) => {
    const rect = canvas.getBoundingClientRect()
    const scaleX = canvas.width / rect.width
    const scaleY = canvas.height / rect.height
    const clientX = e.touches ? e.touches[0].clientX : e.clientX
    const clientY = e.touches ? e.touches[0].clientY : e.clientY
    return { x: (clientX - rect.left) * scaleX, y: (clientY - rect.top) * scaleY }
  }

  const startDraw = e => {
    e.preventDefault()
    isDrawing.current = true
    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')
    const pos = getPos(e, canvas)
    ctx.beginPath(); ctx.moveTo(pos.x, pos.y)
    setIsEmpty(false)
  }
  const draw = e => {
    e.preventDefault()
    if (!isDrawing.current) return
    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')
    const pos = getPos(e, canvas)
    ctx.lineTo(pos.x, pos.y); ctx.stroke()
  }
  const stopDraw = () => { isDrawing.current = false }
  const clear = () => {
    canvasRef.current.getContext('2d').clearRect(0, 0, canvasRef.current.width, canvasRef.current.height)
    setIsEmpty(true)
  }
  const save = () => { if (!isEmpty) onSave(canvasRef.current.toDataURL('image/png')) }

  return (
    <div style={{ background: '#fff', borderRadius: 14, padding: 20, boxShadow: '0 20px 60px rgba(0,0,0,0.3)', border: '1px solid rgba(0,0,0,0.08)', maxWidth: 480, width: '100%' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <PenLine size={16} color="#8b5cf6" />
          <span style={{ fontSize: 14, fontWeight: 700, color: '#1a1a2e' }}>{label}</span>
        </div>
        <button onClick={onCancel} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9ca3af', padding: 2, display: 'flex' }}><X size={16} /></button>
      </div>
      <div style={{ position: 'relative', border: '2px dashed #e5e7eb', borderRadius: 10, background: '#fafafa', marginBottom: 12 }}>
        <canvas ref={canvasRef} width={440} height={140}
          style={{ display: 'block', width: '100%', height: 140, borderRadius: 8, cursor: 'crosshair', touchAction: 'none' }}
          onMouseDown={startDraw} onMouseMove={draw} onMouseUp={stopDraw} onMouseLeave={stopDraw}
          onTouchStart={startDraw} onTouchMove={draw} onTouchEnd={stopDraw}
        />
        {isEmpty && (
          <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
            <span style={{ color: '#c4c4cc', fontSize: 13, fontStyle: 'italic' }}>Sign here</span>
          </div>
        )}
      </div>
      <div style={{ height: 1, background: '#e5e7eb', margin: '0 0 12px' }} />
      <div style={{ display: 'flex', gap: 8 }}>
        <button onClick={clear} style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, background: '#f3f4f6', border: '1px solid #e5e7eb', borderRadius: 8, padding: '9px', fontSize: 13, color: '#6b7280', cursor: 'pointer', fontFamily: "'Outfit',sans-serif" }}>
          <RotateCcw size={12} /> Clear
        </button>
        <button onClick={save} disabled={isEmpty} style={{ flex: 2, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, background: isEmpty ? '#e5e7eb' : 'linear-gradient(135deg,#8b5cf6,#6366f1)', border: 'none', borderRadius: 8, padding: '9px 16px', fontSize: 13, fontWeight: 700, color: isEmpty ? '#9ca3af' : '#fff', cursor: isEmpty ? 'not-allowed' : 'pointer', fontFamily: "'Outfit',sans-serif" }}>
          <Check size={12} /> Apply Signature
        </button>
      </div>
    </div>
  )
}

// ─── Step dot ────────────────────────────────────────────────────────────────
function StepDot({ num, label, active, done }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
      <div style={{ width: 32, height: 32, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 700, fontFamily: "'JetBrains Mono',monospace", background: done ? '#4ade80' : active ? 'linear-gradient(135deg,#8b5cf6,#6366f1)' : 'rgba(255,255,255,0.06)', border: done ? '2px solid #4ade80' : active ? 'none' : '1px solid rgba(255,255,255,0.1)', color: done || active ? '#fff' : '#b8c2d4', transition: 'all 0.3s' }}>
        {done ? <Check size={14} /> : num}
      </div>
      <span style={{ fontSize: 10, color: active ? '#c4b5fd' : done ? '#4ade80' : '#b8c2d4', fontFamily: "'JetBrains Mono',monospace", textTransform: 'uppercase', letterSpacing: '0.05em', whiteSpace: 'nowrap' }}>{label}</span>
    </div>
  )
}

// ─── Generic form field ───────────────────────────────────────────────────────
function Field({ label, icon: Icon, value, onChange, placeholder, type = 'text', prefix }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <label style={{ fontSize: 10, fontWeight: 700, color: '#b8c2d4', textTransform: 'uppercase', letterSpacing: '0.1em', fontFamily: "'JetBrains Mono',monospace", display: 'flex', alignItems: 'center', gap: 5 }}>
        {Icon && <Icon size={10} color="#8b5cf6" />}{label}
      </label>
      <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
        {prefix && <span style={{ position: 'absolute', left: 12, fontSize: 13, color: '#b8c2d4', fontFamily: "'JetBrains Mono',monospace" }}>{prefix}</span>}
        <input type={type} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}
          style={{ width: '100%', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 9, padding: `10px ${prefix ? '12px 10px 28px' : '12px'}`, color: '#f4f4f5', fontSize: 13, fontFamily: "'Outfit',sans-serif", outline: 'none', transition: 'border-color 0.2s,box-shadow 0.2s' }}
          onFocus={e => { e.target.style.borderColor = 'rgba(139,92,246,0.5)'; e.target.style.boxShadow = '0 0 0 3px rgba(139,92,246,0.08)' }}
          onBlur={e => { e.target.style.borderColor = 'rgba(255,255,255,0.08)'; e.target.style.boxShadow = 'none' }}
        />
      </div>
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function ContractPage() {
  const { id: leadId } = useParams()
  const navigate = useNavigate()

  const [lead, setLead]               = useState(null)
  const [step, setStep]               = useState(1)
  const [loading, setLoading]         = useState(true)
  const [saving, setSaving]           = useState(false)
  const [sending, setSending]         = useState(false)
  const [contractId, setContractId]   = useState(null)
  const [signUrl, setSignUrl]         = useState(null)
  const [sendError, setSendError]     = useState('')
  const [showSigPad, setShowSigPad]   = useState(false)
  const [designerSig, setDesignerSig] = useState(null)

  const [fields, setFields] = useState({
    designerName:  '',
    designerEmail: '',
    clientName:    '',
    clientEmail:   '',
    clientAddress: '',
    numPages:      '5',
    setupPrice:    '',
    monthlyPrice:  '',
    timelineWeeks: '4',
    paymentMethod: 'Stripe',
  })

  const iframeRef = useRef(null)

  useEffect(() => {
    fetch(`${API}/leads/${leadId}`, { credentials: 'include', headers: getAuthHeaders() })
      .then(r => r.json())
      .then(data => {
        setLead(data)
        setFields(f => ({ ...f, clientName: data.name || '', clientAddress: data.address || data.city || '' }))
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [leadId])

  const setField = (key, val) => setFields(f => ({ ...f, [key]: val }))

  const contractData = {
    id:             contractId,
    designer_name:  fields.designerName,
    designer_email: fields.designerEmail,
    client_name:    fields.clientName,
    client_email:   fields.clientEmail,
    client_address: fields.clientAddress,
    num_pages:      fields.numPages,
    setup_price:    fields.setupPrice,
    monthly_price:  fields.monthlyPrice,
    timeline_weeks: fields.timelineWeeks,
    payment_method: fields.paymentMethod,
    designer_signed_at: null,
    client_signed_at:   null,
  }

  const updatePreview = useCallback(() => {
    if (!iframeRef.current) return
    const html = buildContractHTML(contractData, designerSig, null)
    const doc = iframeRef.current.contentDocument || iframeRef.current.contentWindow.document
    doc.open(); doc.write(html); doc.close()
  }, [fields, designerSig])

  useEffect(() => { updatePreview() }, [updatePreview])

  const handleSaveContract = async () => {
    if (!fields.designerName.trim()) return
    setSaving(true)
    try {
      const res = await fetch(`${API}/contracts/create`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        credentials: 'include',
        body: JSON.stringify({
          lead_id:       parseInt(leadId),
          designer_name: fields.designerName,
          designer_email:fields.designerEmail,
          client_email:  fields.clientEmail,
          num_pages:     fields.numPages,
          setup_price:   fields.setupPrice,
          monthly_price: fields.monthlyPrice,
          timeline_weeks:fields.timelineWeeks,
          payment_method:fields.paymentMethod,
        }),
      })
      const data = await res.json()
      setContractId(data.id)
      setStep(2)
    } catch (e) { console.error(e) }
    finally { setSaving(false) }
  }

  const handleApplySig = async sigData => {
    setDesignerSig(sigData)
    setShowSigPad(false)
    if (!contractId) return
    await fetch(`${API}/contracts/sign/designer`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
      credentials: 'include',
      body: JSON.stringify({ contract_id: contractId, sig_data: sigData }),
    })
    setStep(3)
  }

  const handleSendToClient = async () => {
    if (!fields.clientEmail) { setSendError('Client email is required.'); return }
    setSending(true); setSendError('')
    try {
      const res = await fetch(`${API}/contracts/send-to-client`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        credentials: 'include',
        body: JSON.stringify({ contract_id: contractId }),
      })
      const data = await res.json()
      setSignUrl(data.sign_url)
      setStep(4)
    } catch { setSendError('Failed to send. Check your SMTP settings.') }
    finally { setSending(false) }
  }

  const handleDownloadPDF = async () => {
    const html = buildContractHTML(contractData, designerSig, null)
    await generateContractPDF(html, `contract_${fields.clientName || leadId}`, true)
  }

  const rawSetup   = Number(fields.setupPrice  || 0)
  const rawMonthly = Number(fields.monthlyPrice || 0)
  const showPreview = rawSetup > 0 && rawMonthly > 0

  if (loading) return (
    <div style={{ minHeight: '100vh', background: '#09090f', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ width: 20, height: 20, border: '2px solid rgba(139,92,246,0.3)', borderTopColor: '#8b5cf6', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
      <style>{`@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}`}</style>
    </div>
  )

  const steps = [
    { num: 1, label: 'Fill Details' },
    { num: 2, label: 'Sign' },
    { num: 3, label: 'Send' },
    { num: 4, label: 'Done' },
  ]

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
        .nav-link:hover{color:#c4c4cc;}
      `}</style>

      {/* Nav */}
      <nav style={{ position: 'sticky', top: 0, zIndex: 100, display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0 48px', height: 64, background: 'rgba(9,9,15,0.88)', backdropFilter: 'blur(20px)', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <button onClick={() => navigate(`/leads/${leadId}`)} style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 8, padding: '6px 12px', color: '#c4c4cc', fontSize: 13, cursor: 'pointer', fontFamily: "'Outfit',sans-serif" }}>
            <ArrowLeft size={13} /> Back to Lead
          </button>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }} onClick={() => navigate('/')}>
            <div style={{ width: 28, height: 28, borderRadius: 8, background: 'linear-gradient(135deg,#8b5cf6,#6366f1)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.7rem', fontWeight: 900, color: '#fff' }}>B</div>
            <span style={{ fontWeight: 800, fontSize: '1rem', letterSpacing: '-0.5px', color: '#f4f4f5' }}>BizScout</span>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <FileText size={14} color="#8b5cf6" />
          <span style={{ fontSize: 13, fontWeight: 600, color: '#c4b5fd' }}>{lead?.name} — Contract</span>
        </div>
        <NavbarDropdown />
      </nav>

      <div style={{ maxWidth: 1400, margin: '0 auto', padding: '32px 48px 80px' }}>

        {/* Step indicator */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 0, marginBottom: 40 }}>
          {steps.map((s, i) => (
            <div key={s.num} style={{ display: 'flex', alignItems: 'center' }}>
              <StepDot num={s.num} label={s.label} active={step === s.num} done={step > s.num} />
              {i < steps.length - 1 && <div style={{ width: 60, height: 1, background: step > s.num ? 'rgba(74,222,128,0.4)' : 'rgba(255,255,255,0.08)', margin: '0 8px 20px' }} />}
            </div>
          ))}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '380px 1fr', gap: 28, alignItems: 'start' }}>

          {/* ── LEFT: Form ── */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

            {/* Step 1 — Fill Details */}
            {step === 1 && (
              <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 16, padding: '24px', position: 'relative', overflow: 'hidden' }}>
                <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 1, background: 'linear-gradient(90deg,transparent,rgba(139,92,246,0.5),transparent)' }} />

                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 20 }}>
                  <FileText size={14} color="#8b5cf6" />
                  <span style={{ fontSize: 14, fontWeight: 700, color: '#e4e4e7' }}>Contract Details</span>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

                  <div style={{ fontSize: 11, color: '#a78bfa', fontFamily: "'JetBrains Mono',monospace", textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 2 }}>Your Info</div>
                  <Field label="Your Full Name" icon={User} value={fields.designerName} onChange={v => setField('designerName', v)} placeholder="Jason Singh" />
                  <Field label="Your Email" icon={Mail} value={fields.designerEmail} onChange={v => setField('designerEmail', v)} placeholder="you@email.com" />

                  <div style={{ height: 1, background: 'rgba(255,255,255,0.05)', margin: '4px 0' }} />

                  <div style={{ fontSize: 11, color: '#a78bfa', fontFamily: "'JetBrains Mono',monospace", textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 2 }}>Client Info</div>
                  <Field label="Client Name" icon={User} value={fields.clientName} onChange={v => setField('clientName', v)} placeholder="Joe's Plumbing" />
                  <Field label="Client Email" icon={Mail} value={fields.clientEmail} onChange={v => setField('clientEmail', v)} placeholder="client@email.com" />
                  <Field label="Client Address" icon={Layout} value={fields.clientAddress} onChange={v => setField('clientAddress', v)} placeholder="123 Main St, Sacramento CA" />

                  <div style={{ height: 1, background: 'rgba(255,255,255,0.05)', margin: '4px 0' }} />

                  <div style={{ fontSize: 11, color: '#a78bfa', fontFamily: "'JetBrains Mono',monospace", textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 2 }}>Project Terms</div>
                  <Field label="Number of Pages" icon={Layout} value={fields.numPages} onChange={v => setField('numPages', v)} placeholder="5" />
                  <Field label="Setup Price" icon={DollarSign} value={fields.setupPrice} onChange={v => setField('setupPrice', v)} placeholder="1500" prefix="$" />
                  <Field label="Monthly Price" icon={DollarSign} value={fields.monthlyPrice} onChange={v => setField('monthlyPrice', v)} placeholder="99" prefix="$" />

                  <div style={{ height: 1, background: 'rgba(255,255,255,0.05)', margin: '4px 0' }} />

                  <Field label="Timeline (weeks)" icon={Calendar} value={fields.timelineWeeks} onChange={v => setField('timelineWeeks', v)} placeholder="4" />

                  {/* Live plan preview */}
                  {showPreview && (
                    <div style={{ background: 'rgba(139,92,246,0.06)', border: '1px solid rgba(139,92,246,0.15)', borderRadius: 10, padding: '12px 14px' }}>
                      <div style={{ fontSize: 10, color: '#b8c2d4', fontFamily: "'JetBrains Mono',monospace", textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>Contract preview</div>
                      <div style={{ fontSize: 12, color: '#c4c4cc' }}>
                        <span style={{ color: '#a78bfa', fontWeight: 700 }}>Setup:</span>{' '}
                        ${rawSetup.toLocaleString()} one-time &nbsp;·&nbsp;
                        <span style={{ color: '#4ade80', fontWeight: 700 }}>${rawMonthly.toLocaleString()}/mo</span> ongoing
                      </div>
                    </div>
                  )}
                </div>

                <button
                  onClick={handleSaveContract}
                  disabled={saving || !fields.designerName.trim()}
                  style={{ width: '100%', marginTop: 20, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, background: !fields.designerName.trim() ? 'rgba(255,255,255,0.06)' : 'linear-gradient(135deg,#8b5cf6,#6366f1)', border: 'none', borderRadius: 10, padding: '12px', color: !fields.designerName.trim() ? '#b8c2d4' : '#fff', fontSize: 14, fontWeight: 700, cursor: saving || !fields.designerName.trim() ? 'not-allowed' : 'pointer', fontFamily: "'Outfit',sans-serif" }}
                >
                  {saving
                    ? <><div style={{ width: 14, height: 14, border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} /> Saving...</>
                    : <>Continue to Sign <ChevronRight size={14} /></>
                  }
                </button>
              </div>
            )}

            {/* Step 2 — Sign */}
            {step === 2 && (
              <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 16, padding: '24px', position: 'relative', overflow: 'hidden' }}>
                <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 1, background: 'linear-gradient(90deg,transparent,rgba(139,92,246,0.5),transparent)' }} />
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
                  <PenLine size={14} color="#8b5cf6" />
                  <span style={{ fontSize: 14, fontWeight: 700, color: '#e4e4e7' }}>Your Signature</span>
                </div>
                <p style={{ fontSize: 13, color: '#c4c4cc', lineHeight: 1.6, marginBottom: 16 }}>
                  Draw your signature. It will appear on the contract in the designer signature field.
                </p>
                {designerSig ? (
                  <div style={{ marginBottom: 16 }}>
                    <div style={{ fontSize: 10, color: '#b8c2d4', fontFamily: "'JetBrains Mono',monospace", textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>Your signature</div>
                    <div style={{ background: '#fff', borderRadius: 10, padding: 12, border: '1px solid rgba(255,255,255,0.1)' }}>
                      <img src={designerSig} alt="signature" style={{ height: 48, display: 'block' }} />
                    </div>
                    <button onClick={() => setShowSigPad(true)} style={{ marginTop: 8, background: 'none', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, padding: '6px 12px', color: '#c4c4cc', fontSize: 12, cursor: 'pointer', fontFamily: "'Outfit',sans-serif" }}>Redraw</button>
                  </div>
                ) : (
                  <button onClick={() => setShowSigPad(true)} style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, background: 'rgba(139,92,246,0.08)', border: '2px dashed rgba(139,92,246,0.3)', borderRadius: 10, padding: '20px', color: '#a78bfa', fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: "'Outfit',sans-serif", marginBottom: 16 }}>
                    <PenLine size={16} /> Click to draw signature
                  </button>
                )}
                <div style={{ display: 'flex', gap: 8 }}>
                  <button onClick={() => setStep(1)} style={{ flex: 1, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 10, padding: '11px', color: '#c4c4cc', fontSize: 13, cursor: 'pointer', fontFamily: "'Outfit',sans-serif" }}>Back</button>
                  {designerSig && (
                    <button onClick={() => setStep(3)} style={{ flex: 2, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, background: 'linear-gradient(135deg,#8b5cf6,#6366f1)', border: 'none', borderRadius: 10, padding: '11px', color: '#fff', fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: "'Outfit',sans-serif" }}>
                      Continue to Send <ChevronRight size={14} />
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* Step 3 — Send */}
            {step === 3 && (
              <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 16, padding: '24px', position: 'relative', overflow: 'hidden' }}>
                <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 1, background: 'linear-gradient(90deg,transparent,rgba(251,146,60,0.5),transparent)' }} />
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
                  <Send size={14} color="#fb923c" />
                  <span style={{ fontSize: 14, fontWeight: 700, color: '#e4e4e7' }}>Send to Client</span>
                </div>
                <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 10, padding: '14px', marginBottom: 16 }}>
                  <div style={{ fontSize: 11, color: '#b8c2d4', fontFamily: "'JetBrains Mono',monospace", marginBottom: 6 }}>Sending to:</div>
                  <div style={{ fontSize: 14, fontWeight: 600, color: '#e4e4e7' }}>{fields.clientName}</div>
                  {fields.clientEmail
                    ? <div style={{ fontSize: 12, color: '#a78bfa', marginTop: 2 }}>{fields.clientEmail}</div>
                    : <div style={{ fontSize: 12, color: '#f87171', marginTop: 2 }}>⚠ No client email set</div>
                  }
                </div>
                <p style={{ fontSize: 13, color: '#c4c4cc', lineHeight: 1.6, marginBottom: 16 }}>
                  The client will receive an email with a secure signing link. Once they sign, you'll get the completed PDF.
                </p>
                {sendError && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'rgba(248,113,113,0.07)', border: '1px solid rgba(248,113,113,0.2)', borderRadius: 8, padding: '10px 12px', marginBottom: 12, fontSize: 13, color: '#f87171' }}>
                    <AlertCircle size={12} /> {sendError}
                  </div>
                )}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <button onClick={handleSendToClient} disabled={sending || !fields.clientEmail}
                    style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, background: !fields.clientEmail ? 'rgba(255,255,255,0.06)' : 'linear-gradient(135deg,#fb923c,#f97316)', border: 'none', borderRadius: 10, padding: '12px', color: !fields.clientEmail ? '#b8c2d4' : '#fff', fontSize: 14, fontWeight: 700, cursor: sending || !fields.clientEmail ? 'not-allowed' : 'pointer', fontFamily: "'Outfit',sans-serif" }}>
                    {sending ? <>Sending...</> : <><Send size={14} /> Send Contract</>}
                  </button>
                  <button onClick={handleDownloadPDF} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 10, padding: '11px', color: '#c4c4cc', fontSize: 13, cursor: 'pointer', fontFamily: "'Outfit',sans-serif" }}>
                    <Download size={13} /> Save / Print PDF
                  </button>
                </div>
              </div>
            )}

            {/* Step 4 — Done */}
            {step === 4 && (
              <div style={{ background: 'rgba(74,222,128,0.04)', border: '1px solid rgba(74,222,128,0.2)', borderRadius: 16, padding: '24px', position: 'relative', overflow: 'hidden' }}>
                <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 1, background: 'linear-gradient(90deg,transparent,rgba(74,222,128,0.5),transparent)' }} />
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
                  <CheckCircle2 size={20} color="#4ade80" />
                  <span style={{ fontSize: 16, fontWeight: 700, color: '#4ade80' }}>Contract Sent!</span>
                </div>
                <p style={{ fontSize: 13, color: '#c4c4cc', lineHeight: 1.7, marginBottom: 16 }}>
                  <strong style={{ color: '#e4e4e7' }}>{fields.clientName}</strong> has been sent a signing link at{' '}
                  <strong style={{ color: '#a78bfa' }}>{fields.clientEmail}</strong>.
                </p>
                {signUrl && (
                  <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 10, padding: '12px', marginBottom: 16 }}>
                    <div style={{ fontSize: 10, color: '#b8c2d4', fontFamily: "'JetBrains Mono',monospace", textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>Client signing link</div>
                    <div style={{ fontSize: 11, color: '#a78bfa', wordBreak: 'break-all', fontFamily: "'JetBrains Mono',monospace" }}>{signUrl}</div>
                    <button onClick={() => navigator.clipboard.writeText(signUrl)} style={{ marginTop: 8, background: 'none', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 6, padding: '4px 10px', fontSize: 11, color: '#c4c4cc', cursor: 'pointer', fontFamily: "'Outfit',sans-serif" }}>Copy link</button>
                  </div>
                )}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <button onClick={handleDownloadPDF} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 10, padding: '11px', color: '#c4c4cc', fontSize: 13, cursor: 'pointer', fontFamily: "'Outfit',sans-serif" }}>
                    <Download size={13} /> Download My Copy
                  </button>
                  <button onClick={() => navigate(`/leads/${leadId}`)} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, background: 'none', border: 'none', color: '#b8c2d4', fontSize: 13, cursor: 'pointer', fontFamily: "'Outfit',sans-serif" }}>
                    <ArrowLeft size={12} /> Back to Lead
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* ── RIGHT: Live preview ── */}
          <div style={{ position: 'sticky', top: 88 }}>
            <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 16, overflow: 'hidden', position: 'relative' }}>
              <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 1, background: 'linear-gradient(90deg,transparent,rgba(139,92,246,0.4),transparent)' }} />
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 18px', borderBottom: '1px solid rgba(255,255,255,0.05)', background: 'rgba(255,255,255,0.02)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{ width: 5, height: 5, borderRadius: '50%', background: '#8b5cf6', animation: 'pulse 1.5s infinite' }} />
                  <span style={{ fontSize: 12, fontWeight: 600, color: '#c4b5fd', fontFamily: "'JetBrains Mono',monospace" }}>Live Preview</span>
                </div>
                <div style={{ display: 'flex', gap: 5 }}>
                  {['#ff5f56','#ffbd2e','#27c93f'].map(c => (
                    <div key={c} style={{ width: 9, height: 9, borderRadius: '50%', background: c, opacity: 0.6 }} />
                  ))}
                </div>
              </div>
              <iframe ref={iframeRef} style={{ width: '100%', height: 'calc(100vh - 220px)', border: 'none', display: 'block', background: '#fff' }} title="Contract Preview" />
            </div>
          </div>
        </div>
      </div>

      {/* Signature pad modal */}
      {showSigPad && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(8px)' }} onClick={() => setShowSigPad(false)}>
          <div onClick={e => e.stopPropagation()}>
            <SignatureCanvas label="Draw your signature" onSave={handleApplySig} onCancel={() => setShowSigPad(false)} />
          </div>
        </div>
      )}
    </div>
  )
}