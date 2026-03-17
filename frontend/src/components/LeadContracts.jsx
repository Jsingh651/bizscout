import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  FileText, CheckCircle2, Clock, Send, Plus,
  ExternalLink, Download, ChevronDown, ChevronUp,
  AlertCircle, PenLine, Eye, X
} from 'lucide-react'
import { generateContractPDF } from '../utils/pdfUtils'
import { buildContractHTML } from '../utils/contractTemplate'

const API = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000'

function getAuthHeaders() {
  const token = sessionStorage.getItem('access_token') || localStorage.getItem('access_token')
  return token ? { Authorization: `Bearer ${token}` } : {}
}

async function downloadContract(contract) {
  const token = sessionStorage.getItem('access_token') || localStorage.getItem('access_token')
  if (!contract.client_signed) {
    // Not yet signed — use browser print dialog
    const html = buildContractHTML(contract, contract.designer_sig_data || null, contract.client_sig_data || null)
    const safeName = (contract.client_name || 'Contract').replace(/\s+/g, '_')
    await generateContractPDF(html, `Web_Design_Agreement_${safeName}`)
    return
  }
  // Signed — fetch server-generated PDF (Playwright, no overlap)
  try {
    const res = await fetch(`${API}/contracts/download/${contract.id}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    })
    if (!res.ok) throw new Error('Download failed')
    const blob = await res.blob()
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement('a')
    const safeName = (contract.client_name || 'Contract').replace(/\s+/g, '_')
    a.href     = url
    a.download = `Web_Design_Agreement_${safeName}.pdf`
    a.click()
    URL.revokeObjectURL(url)
  } catch (err) {
    console.error('[download]', err)
    // Fallback to print dialog
    const html = buildContractHTML(contract, contract.designer_sig_data || null, contract.client_sig_data || null)
    const safeName = (contract.client_name || 'Contract').replace(/\s+/g, '_')
    await generateContractPDF(html, `Web_Design_Agreement_${safeName}`)
  }
}

function PreviewModal({ contract, onClose }) {
  const html = buildContractHTML(contract, contract.designer_sig_data || null, contract.client_sig_data || null)
  const blob = new Blob([html], { type: 'text/html;charset=utf-8' })
  const url  = URL.createObjectURL(blob)
  useEffect(() => () => URL.revokeObjectURL(url), [])
  return (
    <div style={{ position:'fixed',inset:0,zIndex:1000,display:'flex',flexDirection:'column',background:'rgba(0,0,0,0.92)',backdropFilter:'blur(12px)' }}>
      {/* Top bar */}
      <div style={{ display:'flex',alignItems:'center',justifyContent:'space-between',padding:'10px 20px',background:'#0d0d12',borderBottom:'1px solid rgba(255,255,255,0.08)',flexShrink:0,height:52 }}>
        <div style={{ display:'flex',alignItems:'center',gap:10 }}>
          <FileText size={15} color="#8b5cf6" />
          <span style={{ fontSize:14,fontWeight:700,color:'#e4e4e7',fontFamily:"'Outfit',sans-serif" }}>
            {contract.client_signed ? 'Fully Signed Contract' : 'Contract Preview'}
          </span>
          {contract.client_signed && (
            <span style={{ fontSize:10,background:'rgba(74,222,128,0.1)',border:'1px solid rgba(74,222,128,0.25)',borderRadius:20,padding:'2px 8px',color:'#4ade80',fontFamily:"'JetBrains Mono',monospace",fontWeight:700 }}>SIGNED</span>
          )}
          <span style={{ fontSize:11,color:'#b8c2d4',fontFamily:"'JetBrains Mono',monospace" }}>— {contract.client_name}</span>
        </div>
        <div style={{ display:'flex',gap:8,alignItems:'center' }}>
          <button onClick={() => downloadContract(contract)}
            style={{ display:'flex',alignItems:'center',gap:6,background:'rgba(139,92,246,0.12)',border:'1px solid rgba(139,92,246,0.3)',borderRadius:8,padding:'6px 14px',color:'#a78bfa',fontSize:12,fontWeight:600,cursor:'pointer',fontFamily:"'Outfit',sans-serif" }}>
            <Download size={12} /> Download PDF
          </button>
          <button onClick={onClose}
            style={{ display:'flex',alignItems:'center',justifyContent:'center',width:32,height:32,background:'rgba(255,255,255,0.05)',border:'1px solid rgba(255,255,255,0.1)',borderRadius:8,cursor:'pointer',color:'#c4c4cc',fontSize:18,lineHeight:1 }}>
            <X size={15} />
          </button>
        </div>
      </div>
      {/* Full remaining height — iframe fills everything */}
      <div style={{ flex:1,display:'flex',overflow:'hidden',background:'#1a1a22',padding:'0' }}>
        <iframe
          src={url}
          title="Contract Preview"
          style={{ flex:1, width:'100%', height:'100%', border:'none', background:'#fff', display:'block' }}
        />
      </div>
    </div>
  )
}

function StoredFileModal({ url, label, badge, badgeColor, onClose }) {
  return (
    <div style={{ position:'fixed',inset:0,zIndex:1000,display:'flex',flexDirection:'column',background:'rgba(0,0,0,0.85)',backdropFilter:'blur(8px)' }}>
      <div style={{ display:'flex',alignItems:'center',justifyContent:'space-between',padding:'12px 20px',background:'#0f0f14',borderBottom:'1px solid rgba(255,255,255,0.08)',flexShrink:0 }}>
        <div style={{ display:'flex',alignItems:'center',gap:10 }}>
          <FileText size={15} color="#8b5cf6" />
          <span style={{ fontSize:14,fontWeight:700,color:'#e4e4e7',fontFamily:"'Outfit',sans-serif" }}>{label}</span>
          {badge && <span style={{ fontSize:10,background:`${badgeColor}18`,border:`1px solid ${badgeColor}40`,borderRadius:20,padding:'2px 8px',color:badgeColor,fontFamily:"'JetBrains Mono',monospace",fontWeight:700 }}>{badge}</span>}
        </div>
        <div style={{ display:'flex',gap:8 }}>
          <a href={url} target="_blank" rel="noreferrer" style={{ display:'flex',alignItems:'center',gap:6,background:'rgba(139,92,246,0.1)',border:'1px solid rgba(139,92,246,0.25)',borderRadius:8,padding:'7px 14px',color:'#a78bfa',fontSize:12,fontWeight:600,textDecoration:'none',fontFamily:"'Outfit',sans-serif" }}><ExternalLink size={12} /> Open in Tab</a>
          <button onClick={onClose} style={{ display:'flex',alignItems:'center',justifyContent:'center',width:32,height:32,background:'rgba(255,255,255,0.05)',border:'1px solid rgba(255,255,255,0.1)',borderRadius:8,cursor:'pointer',color:'#c4c4cc' }}><X size={14} /></button>
        </div>
      </div>
      <iframe src={url} style={{ flex:1,border:'none',background:'#fff' }} title={label} />
    </div>
  )
}

function statusBadge(contract) {
  if (contract.client_signed)   return { label:'Fully Signed',    color:'#4ade80', bg:'rgba(74,222,128,0.1)',   border:'rgba(74,222,128,0.25)',   icon:CheckCircle2 }
  if (contract.designer_signed) return { label:'Awaiting Client', color:'#fb923c', bg:'rgba(251,146,60,0.1)',   border:'rgba(251,146,60,0.25)',   icon:Clock }
  return                               { label:'Draft',            color:'#b8c2d4', bg:'rgba(255,255,255,0.04)', border:'rgba(255,255,255,0.12)', icon:PenLine }
}

function ContractRow({ contract, leadId }) {
  const navigate = useNavigate()
  const [expanded, setExpanded]         = useState(false)
  const [viewingSent, setViewingSent]   = useState(false)

  const status = statusBadge(contract)
  const StatusIcon = status.icon
  const date = contract.created_at ? new Date(contract.created_at).toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'}) : '—'

  return (
    <>
      {viewingSent  && <StoredFileModal url={contract.sent_pdf_url}  label="Sent Copy"             badge="SENT"   badgeColor="#fb923c" onClose={() => setViewingSent(false)} />}

      <div style={{ background:'rgba(255,255,255,0.02)',border:'1px solid rgba(255,255,255,0.06)',borderRadius:12,overflow:'hidden',transition:'border-color 0.2s' }}
        onMouseEnter={e => e.currentTarget.style.borderColor='rgba(255,255,255,0.1)'}
        onMouseLeave={e => e.currentTarget.style.borderColor='rgba(255,255,255,0.06)'}>

        <div style={{ display:'flex',alignItems:'center',gap:12,padding:'14px 16px',cursor:'pointer' }} onClick={() => setExpanded(e => !e)}>
          <div style={{ width:32,height:32,borderRadius:8,background:`${status.color}18`,border:`1px solid ${status.color}30`,display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0 }}>
            <FileText size={13} color={status.color} strokeWidth={1.5} />
          </div>
          <div style={{ flex:1,minWidth:0 }}>
            <div style={{ fontSize:13,fontWeight:600,color:'#e4e4e7',marginBottom:2 }}>
              {contract.client_name || 'Contract'} — {contract.setup_price ? `$${Number(contract.setup_price).toLocaleString()}` : '—'} setup / {contract.monthly_price ? `$${Number(contract.monthly_price).toLocaleString()}/mo` : '—'}
            </div>
            <div style={{ fontSize:11,color:'#b8c2d4',fontFamily:"'JetBrains Mono',monospace" }}>{date}</div>
          </div>
          <div style={{ display:'flex',alignItems:'center',gap:8,flexShrink:0 }}>
            <span style={{ display:'inline-flex',alignItems:'center',gap:5,fontSize:10,fontWeight:700,padding:'3px 9px',borderRadius:20,background:status.bg,border:`1px solid ${status.border}`,color:status.color,fontFamily:"'JetBrains Mono',monospace" }}>
              <StatusIcon size={9} strokeWidth={2} /> {status.label}
            </span>
            {expanded ? <ChevronUp size={14} color="#b8c2d4" /> : <ChevronDown size={14} color="#b8c2d4" />}
          </div>
        </div>

        {expanded && (
          <div style={{ borderTop:'1px solid rgba(255,255,255,0.05)',padding:'14px 16px',background:'rgba(255,255,255,0.01)' }}>
            <div style={{ display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:12,marginBottom:14 }}>
              {[
                { label:'Setup Fee',    value:contract.setup_price    ? `$${Number(contract.setup_price).toLocaleString()}`         : '—' },
                { label:'Monthly',      value:contract.monthly_price  ? `$${Number(contract.monthly_price).toLocaleString()}/mo`    : '—' },
                { label:'Pages',        value:contract.num_pages      || '—' },
                { label:'Timeline',     value:contract.timeline_weeks ? `${contract.timeline_weeks} weeks` : '—' },
                { label:'Payment',      value:contract.payment_method || '—' },
                { label:'Client Email', value:contract.client_email   || '—' },
              ].map(item => (
                <div key={item.label}>
                  <div style={{ fontSize:9,color:'#b8c2d4',fontFamily:"'JetBrains Mono',monospace",textTransform:'uppercase',letterSpacing:'0.08em',marginBottom:3 }}>{item.label}</div>
                  <div style={{ fontSize:12,color:'#e4e4e7',fontWeight:500,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap' }}>{item.value}</div>
                </div>
              ))}
            </div>

            <div style={{ display:'flex',gap:8,marginBottom:14 }}>
              {/* Designer signing block */}
              <div style={{ flex:1,background:contract.designer_signed?'rgba(74,222,128,0.06)':'rgba(255,255,255,0.02)',border:`1px solid ${contract.designer_signed?'rgba(74,222,128,0.2)':'rgba(255,255,255,0.06)'}`,borderRadius:8,padding:'8px 12px',display:'flex',alignItems:'center',gap:7 }}>
                {contract.designer_signed ? <CheckCircle2 size={12} color="#4ade80" /> : <AlertCircle size={12} color="#b8c2d4" />}
                <div>
                  <div style={{ fontSize:10,color:'#b8c2d4',fontFamily:"'JetBrains Mono',monospace",textTransform:'uppercase',letterSpacing:'0.06em' }}>Designer</div>
                  <div style={{ fontSize:11,color:contract.designer_signed?'#4ade80':'#b8c2d4',fontWeight:600 }}>{contract.designer_signed?'Signed':'Not signed'}</div>
                  {contract.designer_signed_at && (
                    <div style={{ fontSize:10,color:'#b8c2d4',fontFamily:"'JetBrains Mono',monospace",marginTop:2 }}>
                      {new Date(contract.designer_signed_at).toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'})}
                    </div>
                  )}
                </div>
              </div>
              {/* Client signing block */}
              <div style={{ flex:1,background:contract.client_signed?'rgba(74,222,128,0.06)':'rgba(255,255,255,0.02)',border:`1px solid ${contract.client_signed?'rgba(74,222,128,0.2)':'rgba(255,255,255,0.06)'}`,borderRadius:8,padding:'8px 12px',display:'flex',alignItems:'flex-start',gap:7 }}>
                {contract.client_signed ? <CheckCircle2 size={12} color="#4ade80" style={{marginTop:2}} /> : <AlertCircle size={12} color="#b8c2d4" style={{marginTop:2}} />}
                <div style={{ minWidth:0 }}>
                  <div style={{ fontSize:10,color:'#b8c2d4',fontFamily:"'JetBrains Mono',monospace",textTransform:'uppercase',letterSpacing:'0.06em' }}>Client</div>
                  <div style={{ fontSize:11,color:contract.client_signed?'#4ade80':'#b8c2d4',fontWeight:600 }}>{contract.client_signed?'Signed':'Not signed'}</div>
                  {contract.client_signed && contract.client_signed_at && (
                    <div style={{ fontSize:10,color:'#b8c2d4',fontFamily:"'JetBrains Mono',monospace",marginTop:2 }}>
                      {new Date(contract.client_signed_at).toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'})}
                    </div>
                  )}
                  {contract.client_signed && contract.client_ip && (
                    <div style={{ fontSize:10,color:'#888',fontFamily:"'JetBrains Mono',monospace",marginTop:2,display:'flex',alignItems:'center',gap:4 }}>
                      <span style={{ opacity:0.6 }}>IP</span> {contract.client_ip}
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div style={{ display:'flex',gap:8,flexWrap:'wrap' }}>
              <button onClick={() => {
                const html = buildContractHTML(contract, contract.designer_sig_data || null, contract.client_sig_data || null)
                const blob = new Blob([html], { type: 'text/html;charset=utf-8' })
                const url  = URL.createObjectURL(blob)
                window.open(url, '_blank')
                setTimeout(() => URL.revokeObjectURL(url), 60000)
              }} style={{ display:'flex',alignItems:'center',gap:5,background:'rgba(139,92,246,0.08)',border:'1px solid rgba(139,92,246,0.2)',borderRadius:8,padding:'7px 12px',color:'#a78bfa',fontSize:12,fontWeight:600,cursor:'pointer',fontFamily:"'Outfit',sans-serif" }}><Eye size={11} /> Preview</button>
              <button onClick={() => downloadContract(contract)} style={{ display:'flex',alignItems:'center',gap:5,background:'rgba(255,255,255,0.03)',border:'1px solid rgba(255,255,255,0.08)',borderRadius:8,padding:'7px 12px',color:'#c4c4cc',fontSize:12,fontWeight:600,cursor:'pointer',fontFamily:"'Outfit',sans-serif" }}><Download size={11} /> {contract.client_signed ? 'Download Signed PDF' : 'Download PDF'}</button>
              {contract.sent_pdf_url  && <button onClick={() => setViewingSent(true)}  style={{ display:'flex',alignItems:'center',gap:5,background:'rgba(251,146,60,0.06)',border:'1px solid rgba(251,146,60,0.2)',borderRadius:8,padding:'7px 12px',color:'#fb923c',fontSize:12,fontWeight:600,cursor:'pointer',fontFamily:"'Outfit',sans-serif" }}><Eye size={11} /> Sent Copy</button>}

              <button onClick={() => navigate(`/contract/${leadId}`)} style={{ display:'flex',alignItems:'center',gap:5,background:'rgba(255,255,255,0.02)',border:'1px solid rgba(255,255,255,0.06)',borderRadius:8,padding:'7px 12px',color:'#b8c2d4',fontSize:12,fontWeight:600,cursor:'pointer',fontFamily:"'Outfit',sans-serif" }}><Plus size={11} /> New Contract</button>
              {contract.client_token && !contract.client_signed && (
                <button onClick={() => navigator.clipboard.writeText(`${window.location.origin}/sign/${contract.client_token}`)} style={{ display:'flex',alignItems:'center',gap:5,background:'rgba(99,102,241,0.06)',border:'1px solid rgba(99,102,241,0.2)',borderRadius:8,padding:'7px 12px',color:'#818cf8',fontSize:12,fontWeight:600,cursor:'pointer',fontFamily:"'Outfit',sans-serif" }}><Send size={11} /> Copy Sign Link</button>
              )}
            </div>
          </div>
        )}
      </div>
    </>
  )
}

export default function LeadContracts({ leadId }) {
  const navigate = useNavigate()
  const [contracts, setContracts] = useState([])
  const [loading,   setLoading]   = useState(true)

  useEffect(() => {
    if (!leadId) return
    fetch(`${API}/contracts/by-lead/${leadId}`, { credentials:'include', headers:getAuthHeaders() })
      .then(r => r.ok ? r.json() : [])
      .then(data => { setContracts(Array.isArray(data) ? data : []); setLoading(false) })
      .catch(() => setLoading(false))
  }, [leadId])

  return (
    <div style={{ background:'rgba(255,255,255,0.02)',border:'1px solid rgba(255,255,255,0.06)',borderRadius:16,padding:'22px 24px',position:'relative',overflow:'hidden' }}>
      <div style={{ position:'absolute',top:0,left:0,right:0,height:1,background:'linear-gradient(90deg,transparent,rgba(139,92,246,0.4),transparent)' }} />
      <div style={{ display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:16 }}>
        <div style={{ display:'flex',alignItems:'center',gap:8 }}>
          <FileText size={13} color="#8b5cf6" strokeWidth={1.5} />
          <span style={{ fontSize:13,fontWeight:700,color:'#e4e4e7' }}>Contracts</span>
          {contracts.length > 0 && <span style={{ fontSize:10,background:'rgba(139,92,246,0.12)',border:'1px solid rgba(139,92,246,0.2)',borderRadius:20,padding:'2px 7px',color:'#a78bfa',fontFamily:"'JetBrains Mono',monospace" }}>{contracts.length}</span>}
        </div>
        <button onClick={() => navigate(`/contract/${leadId}`)} style={{ display:'flex',alignItems:'center',gap:5,background:'linear-gradient(135deg,#8b5cf6,#6366f1)',border:'none',borderRadius:8,padding:'7px 14px',color:'#fff',fontSize:12,fontWeight:700,cursor:'pointer',fontFamily:"'Outfit',sans-serif" }}>
          <Plus size={12} /> New Contract
        </button>
      </div>
      {loading ? (
        <div style={{ display:'flex',justifyContent:'center',padding:'20px 0' }}>
          <div style={{ width:16,height:16,border:'2px solid rgba(139,92,246,0.3)',borderTopColor:'#8b5cf6',borderRadius:'50%',animation:'spin 0.8s linear infinite' }} />
          <style>{`@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}`}</style>
        </div>
      ) : contracts.length === 0 ? (
        <div style={{ textAlign:'center',padding:'20px 0' }}>
          <div style={{ fontSize:12,color:'#b8c2d4',fontFamily:"'JetBrains Mono',monospace",marginBottom:10 }}>— No contracts yet —</div>
          <button onClick={() => navigate(`/contract/${leadId}`)} style={{ display:'inline-flex',alignItems:'center',gap:6,background:'rgba(139,92,246,0.08)',border:'1px solid rgba(139,92,246,0.2)',borderRadius:8,padding:'8px 14px',color:'#a78bfa',fontSize:12,fontWeight:600,cursor:'pointer',fontFamily:"'Outfit',sans-serif" }}>
            <FileText size={12} /> Create first contract
          </button>
        </div>
      ) : (
        <div style={{ display:'flex',flexDirection:'column',gap:8 }}>
          {contracts.map(c => <ContractRow key={c.id} contract={c} leadId={leadId} />)}
        </div>
      )}
    </div>
  )
}