import { useState, useEffect, useRef } from 'react'
import { useParams } from 'react-router-dom'
import { PenLine, Check, RotateCcw, CheckCircle2, AlertCircle, Loader2, Download } from 'lucide-react'
import { buildContractHTML } from '../utils/contractTemplate'
import { generateContractPDF } from '../utils/pdfUtils'

const API = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000'

// PDF generation handled by pdfUtils

export default function SignContractPage() {
  const { token } = useParams()
  const [contract, setContract]     = useState(null)
  const [loading, setLoading]       = useState(true)
  const [error, setError]           = useState(null)
  const [clientSig, setClientSig]   = useState(null)
  const [isEmpty, setIsEmpty]       = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [signed, setSigned]         = useState(false)
  const [finalPdfUrl, setFinalPdfUrl] = useState(null)
  const [pdfDataUri, setPdfDataUri] = useState(null)
  const canvasRef  = useRef(null)
  const iframeRef  = useRef(null)
  const drawingRef = useRef(false)

  useEffect(() => {
    fetch(`${API}/contracts/public/${token}`)
      .then(async r => { if (!r.ok) { const d = await r.json().catch(() => ({})); throw new Error(d.detail || 'Invalid or expired signing link') } return r.json() })
      .then(data => { setContract(data); setLoading(false) })
      .catch(e => { setError(e.message); setLoading(false) })
  }, [token])

  // Update preview whenever contract or sig changes
  useEffect(() => {
    if (!contract || !iframeRef.current) return
    const html = buildContractHTML(contract, contract.designer_sig_data || null, clientSig)
    const blob = new Blob([html], { type: 'text/html;charset=utf-8' })
    const url  = URL.createObjectURL(blob)
    iframeRef.current.src = url
    return () => URL.revokeObjectURL(url)
  }, [contract, clientSig])

  useEffect(() => {
    if (!canvasRef.current) return
    const ctx = canvasRef.current.getContext('2d')
    ctx.strokeStyle = '#1a1a2e'; ctx.lineWidth = 2.5
    ctx.lineCap = 'round'; ctx.lineJoin = 'round'
  }, [contract])

  const getPos = (e, canvas) => {
    const rect = canvas.getBoundingClientRect()
    const sx = canvas.width / rect.width, sy = canvas.height / rect.height
    const cx = e.touches ? e.touches[0].clientX : e.clientX
    const cy = e.touches ? e.touches[0].clientY : e.clientY
    return { x: (cx - rect.left) * sx, y: (cy - rect.top) * sy }
  }

  const startDraw = e => { e.preventDefault(); drawingRef.current = true; const ctx = canvasRef.current.getContext('2d'); const p = getPos(e, canvasRef.current); ctx.beginPath(); ctx.moveTo(p.x, p.y); setIsEmpty(false) }
  const draw      = e => { e.preventDefault(); if (!drawingRef.current) return; const ctx = canvasRef.current.getContext('2d'); const p = getPos(e, canvasRef.current); ctx.lineTo(p.x, p.y); ctx.stroke() }
  const stopDraw  = () => { drawingRef.current = false }
  const clearSig  = () => { canvasRef.current.getContext('2d').clearRect(0, 0, canvasRef.current.width, canvasRef.current.height); setIsEmpty(true); setClientSig(null) }
  const applySig  = () => { if (isEmpty) return; setClientSig(canvasRef.current.toDataURL('image/png')) }

  const submitSig = async () => {
    if (!clientSig) return
    setSubmitting(true)
    try {
      const signRes = await fetch(`${API}/contracts/sign/client`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, sig_data: clientSig }),
      })
      if (!signRes.ok) throw new Error('Failed to submit signature')

      const finalHtml = buildContractHTML(contract, contract.designer_sig_data || null, clientSig)
      let pdfUri = null
      // Store HTML version for emailing — PDF download uses browser print
      try { pdfUri = null } catch(e) {}

      const pdfRes = await fetch(`${API}/contracts/save-pdf/${contract.id}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pdf_base64: pdfUri ? pdfUri.split(',')[1] : null, html_content: finalHtml, client_token: token }),
      })
      if (pdfRes.ok) {
        const data = await pdfRes.json()
        setFinalPdfUrl(data.final_pdf_url || null)
      }
      setSigned(true)
    } catch (e) { setError(e.message) }
    finally { setSubmitting(false) }
  }

  const downloadPDF = async () => {
    const html = buildContractHTML(
      contract,
      contract.designer_sig_data || null,
      clientSig || contract.client_sig_data || null
    )
    await generateContractPDF(html, `web_design_agreement_${contract?.client_name || 'signed'}`, true)
  }

  if (loading) return (
    <div style={{ minHeight: '100vh', background: '#f8fafc', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ width: 36, height: 36, border: '3px solid #e5e7eb', borderTopColor: '#8b5cf6', borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto 12px' }} />
        <p style={{ color: '#6b7280', fontFamily: 'system-ui', fontSize: 14 }}>Loading contract...</p>
      </div>
      <style>{`@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}`}</style>
    </div>
  )

  if (error && !signed) return (
    <div style={{ minHeight: '100vh', background: '#f8fafc', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'system-ui' }}>
      <div style={{ textAlign: 'center', maxWidth: 360, padding: 32 }}>
        <AlertCircle size={40} color="#f87171" style={{ margin: '0 auto 16px' }} />
        <h2 style={{ fontSize: 18, fontWeight: 700, color: '#1a1a2e', marginBottom: 8 }}>Link Error</h2>
        <p style={{ color: '#6b7280', fontSize: 14 }}>{error}</p>
      </div>
    </div>
  )

  if (signed) return (
    <div style={{ minHeight: '100vh', background: '#f8fafc', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'system-ui' }}>
      <style>{`@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}`}</style>
      <div style={{ textAlign: 'center', maxWidth: 480, padding: 40 }}>
        <div style={{ width: 64, height: 64, borderRadius: '50%', background: 'rgba(74,222,128,0.1)', border: '2px solid #4ade80', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}>
          <CheckCircle2 size={28} color="#4ade80" />
        </div>
        <h1 style={{ fontSize: 24, fontWeight: 800, color: '#1a1a2e', marginBottom: 10 }}>All signed!</h1>
        <p style={{ color: '#6b7280', fontSize: 15, lineHeight: 1.6, marginBottom: 8 }}>
          Thank you for signing the Web Design &amp; Development Agreement with <strong>{contract?.designer_name}</strong>.
        </p>
        <p style={{ color: '#6b7280', fontSize: 14, lineHeight: 1.6, marginBottom: 28 }}>
          A fully executed copy has been emailed to you and to {contract?.designer_name}. Please keep it for your records.
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, alignItems: 'center' }}>
          <button onClick={downloadPDF} style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: '#1a1a2e', border: 'none', borderRadius: 10, padding: '12px 24px', color: '#fff', fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>
            <Download size={14} /> Download Signed Copy (PDF)
          </button>

        </div>
      </div>
    </div>
  )

  if (contract?.client_signed) return (
    <div style={{ minHeight: '100vh', background: '#f8fafc', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'system-ui' }}>
      <div style={{ textAlign: 'center', maxWidth: 400, padding: 40 }}>
        <CheckCircle2 size={40} color="#8b5cf6" style={{ margin: '0 auto 16px' }} />
        <h2 style={{ fontSize: 20, fontWeight: 700, color: '#1a1a2e', marginBottom: 8 }}>Already Signed</h2>
        <p style={{ color: '#6b7280', fontSize: 14 }}>This contract has already been signed by both parties.</p>
      </div>
    </div>
  )

  return (
    <div style={{ minHeight: '100vh', background: '#f1f5f9', fontFamily: 'system-ui, sans-serif' }}>
      <style>{`@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}`}</style>

      <div style={{ background: '#1a1a2e', padding: '16px 32px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 28, height: 28, borderRadius: 8, background: 'linear-gradient(135deg,#8b5cf6,#6366f1)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.7rem', fontWeight: 900, color: '#fff' }}>B</div>
          <span style={{ fontWeight: 800, fontSize: '1rem', color: '#fff' }}>BizScout</span>
        </div>
        <span style={{ fontSize: 13, color: '#c4c4cc' }}>Web Design &amp; Development Agreement — Please review and sign below</span>
      </div>

      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '32px 32px 80px', display: 'grid', gridTemplateColumns: '1fr 340px', gap: 28, alignItems: 'start' }}>

        {/* Contract preview */}
        <div style={{ background: '#fff', borderRadius: 12, overflow: 'hidden', boxShadow: '0 4px 24px rgba(0,0,0,0.08)', border: '1px solid #e5e7eb' }}>
          <div style={{ padding: '12px 18px', background: '#f9fafb', borderBottom: '1px solid #e5e7eb', display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#4ade80' }} />
            <span style={{ fontSize: 12, fontWeight: 600, color: '#6b7280' }}>Web Design &amp; Development Agreement — Read carefully before signing</span>
          </div>
          <iframe ref={iframeRef} style={{ width: '100%', height: 'calc(100vh - 200px)', border: 'none', display: 'block' }} title="Contract" />
        </div>

        {/* Signing panel */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16, position: 'sticky', top: 24 }}>
          <div style={{ background: '#fff', borderRadius: 12, padding: 24, boxShadow: '0 4px 24px rgba(0,0,0,0.06)', border: '1px solid #e5e7eb' }}>
            <h2 style={{ fontSize: 16, fontWeight: 800, color: '#1a1a2e', marginBottom: 4 }}>Sign this Agreement</h2>
            <p style={{ fontSize: 13, color: '#6b7280', marginBottom: 20, lineHeight: 1.5 }}>
              By signing, you agree to all terms in the Web Design &amp; Development Agreement above.
              A signed PDF will be emailed to you and to {contract?.designer_name}.
            </p>

            <div style={{ position: 'relative', border: '2px dashed #d1d5db', borderRadius: 10, background: '#fafafa', marginBottom: 10 }}>
              <canvas ref={canvasRef} width={300} height={120}
                style={{ display: 'block', width: '100%', height: 120, borderRadius: 8, cursor: 'crosshair', touchAction: 'none' }}
                onMouseDown={startDraw} onMouseMove={draw} onMouseUp={stopDraw} onMouseLeave={stopDraw}
                onTouchStart={startDraw} onTouchMove={draw} onTouchEnd={stopDraw}
              />
              {isEmpty && !clientSig && (
                <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
                  <span style={{ color: '#9ca3af', fontSize: 13, fontStyle: 'italic' }}>Sign here</span>
                </div>
              )}
            </div>
            <div style={{ height: 1, background: '#e5e7eb', margin: '0 0 10px' }} />

            <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
              <button onClick={clearSig} style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5, background: '#f3f4f6', border: '1px solid #e5e7eb', borderRadius: 8, padding: 8, fontSize: 13, color: '#6b7280', cursor: 'pointer' }}>
                <RotateCcw size={11} /> Clear
              </button>
              <button onClick={applySig} disabled={isEmpty} style={{ flex: 2, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5, background: isEmpty ? '#e5e7eb' : '#1a1a2e', border: 'none', borderRadius: 8, padding: '8px 14px', fontSize: 13, fontWeight: 700, color: isEmpty ? '#9ca3af' : '#fff', cursor: isEmpty ? 'not-allowed' : 'pointer' }}>
                <Check size={11} /> Apply Signature
              </button>
            </div>

            {clientSig && (
              <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 8, padding: '10px 12px', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
                <CheckCircle2 size={14} color="#16a34a" />
                <span style={{ fontSize: 13, color: '#166534', fontWeight: 600 }}>Signature applied — preview updated</span>
              </div>
            )}

            <button onClick={submitSig} disabled={!clientSig || submitting}
              style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, background: !clientSig ? '#e5e7eb' : 'linear-gradient(135deg,#8b5cf6,#6366f1)', border: 'none', borderRadius: 10, padding: 13, color: !clientSig ? '#9ca3af' : '#fff', fontSize: 14, fontWeight: 700, cursor: !clientSig || submitting ? 'not-allowed' : 'pointer' }}>
              {submitting
                ? <><Loader2 size={14} style={{ animation: 'spin 0.8s linear infinite' }} /> Generating &amp; sending...</>
                : 'Submit Signed Contract'}
            </button>

            {submitting && <p style={{ fontSize: 11, color: '#6b7280', textAlign: 'center', marginTop: 8, lineHeight: 1.5 }}>Generating your PDF and sending copies to both parties...</p>}
          </div>

          {/* Summary card */}
          <div style={{ background: '#fff', borderRadius: 12, padding: 20, boxShadow: '0 4px 24px rgba(0,0,0,0.04)', border: '1px solid #e5e7eb' }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 12 }}>Agreement Summary</div>
            {[
              { label: 'Designer',      value: contract?.designer_name },
              { label: 'Client',        value: contract?.client_name },
              { label: 'Setup Fee',     value: contract?.setup_price    ? `$${Number(contract.setup_price).toLocaleString()}`   : '—' },
              { label: 'Monthly Fee',   value: contract?.monthly_price  ? `$${Number(contract.monthly_price).toLocaleString()}/mo` : '—' },
              { label: 'Pages',         value: contract?.num_pages      || '—' },
              { label: 'Timeline',      value: contract?.timeline_weeks ? `${contract.timeline_weeks} weeks` : '—' },
              { label: 'Payment Via',   value: contract?.payment_method || '—' },
            ].map(item => (
              <div key={item.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 0', borderBottom: '1px solid #f3f4f6' }}>
                <span style={{ fontSize: 12, color: '#9ca3af' }}>{item.label}</span>
                <span style={{ fontSize: 12, fontWeight: 600, color: '#1a1a1a' }}>{item.value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}