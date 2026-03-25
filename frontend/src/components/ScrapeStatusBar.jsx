import { useScrape } from '../context/ScrapeContext'
import { useNavigate, useLocation } from 'react-router-dom'
import { Square, CheckCircle2, X, AlertCircle } from 'lucide-react'

export default function ScrapeStatusBar() {
  const navigate = useNavigate()
  const location = useLocation()
  const {
    job, scrapeQuery, scrapeLocation,
    isScraping, stopScrape, dismissJob,
  } = useScrape()

  // Only show when there's an active/finished job AND we're NOT on /leads
  if (!job) return null
  if (location.pathname === '/leads') return null

  const isDone    = job.status === 'done'
  const isStopped = job.status === 'stopped'
  const isError   = job.status === 'error'

  const accent = isDone ? '#4ade80' : isStopped ? '#fb923c' : isError ? '#f87171' : '#8b5cf6'
  const bg     = isDone ? 'rgba(74,222,128,0.08)' : isStopped ? 'rgba(251,146,60,0.08)' : isError ? 'rgba(248,113,113,0.08)' : 'rgba(139,92,246,0.08)'

  return (
    <div style={{
      position: 'fixed',
      bottom: 20,
      left: '50%',
      transform: 'translateX(-50%)',
      zIndex: 9999,
      background: '#111118',
      border: `1px solid ${accent}40`,
      borderRadius: 14,
      padding: '12px 18px',
      display: 'flex',
      alignItems: 'center',
      gap: 12,
      boxShadow: `0 8px 40px rgba(0,0,0,0.8), 0 0 0 1px ${accent}20`,
      backdropFilter: 'blur(12px)',
      minWidth: 340,
      maxWidth: 500,
      animation: 'scrapeBarIn 0.3s cubic-bezier(0.16,1,0.3,1)',
    }}>
      <style>{`
        @keyframes scrapeBarIn {
          from { opacity: 0; transform: translateX(-50%) translateY(12px); }
          to   { opacity: 1; transform: translateX(-50%) translateY(0); }
        }
        @keyframes scrapeBarPulse {
          0%,100% { opacity: 1; } 50% { opacity: 0.4; }
        }
        @keyframes scrapeBarSpin {
          from { transform: rotate(0deg); } to { transform: rotate(360deg); }
        }
      `}</style>

      {/* Status icon */}
      <div style={{
        width: 28, height: 28, borderRadius: '50%', flexShrink: 0,
        background: bg, border: `1px solid ${accent}30`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        {isScraping ? (
          <div style={{
            width: 14, height: 14, borderRadius: '50%',
            border: `2px solid ${accent}40`, borderTopColor: accent,
            animation: 'scrapeBarSpin 0.8s linear infinite',
          }} />
        ) : isDone ? (
          <CheckCircle2 size={14} color={accent} />
        ) : (
          <AlertCircle size={14} color={accent} />
        )}
      </div>

      {/* Text */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: '#e4e4e7', marginBottom: 2 }}>
          {isScraping
            ? `Scanning ${scrapeQuery?.value || ''}…`
            : isDone
            ? 'Scrape complete!'
            : isStopped
            ? 'Scrape stopped'
            : 'Scrape error'}
        </div>
        <div style={{ fontSize: 11, color: '#c4c4cc', fontFamily: "'JetBrains Mono', monospace", overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {isScraping
            ? `${job.found_count ?? 0} found · ${job.progress ?? 0}% · ${scrapeLocation?.value || ''}`
            : job.message || ''}
        </div>
      </div>

      {/* Progress bar — only while scraping */}
      {isScraping && (
        <div style={{ width: 60, flexShrink: 0 }}>
          <div style={{ height: 3, background: 'rgba(255,255,255,0.06)', borderRadius: 2, overflow: 'hidden' }}>
            <div style={{
              height: '100%', borderRadius: 2,
              width: `${job.progress ?? 0}%`,
              background: `linear-gradient(90deg, ${accent}, ${accent}99)`,
              transition: 'width 0.8s ease',
            }} />
          </div>
          <div style={{ fontSize: 10, color: accent, textAlign: 'right', marginTop: 2, fontFamily: "'JetBrains Mono', monospace" }}>
            {job.progress ?? 0}%
          </div>
        </div>
      )}

      {/* Actions */}
      <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
        {/* Go to leads */}
        <button
          onClick={() => navigate('/leads')}
          style={{
            background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: 7, padding: '5px 10px', color: '#c4c4cc', fontSize: 11,
            cursor: 'pointer', fontFamily: "'Outfit', sans-serif", fontWeight: 600,
            whiteSpace: 'nowrap',
          }}
          onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.1)'}
          onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,255,255,0.05)'}
        >
          View
        </button>

        {/* Stop (only while running) */}
        {isScraping && (
          <button
            onClick={stopScrape}
            style={{
              background: 'rgba(248,113,113,0.08)', border: '1px solid rgba(248,113,113,0.2)',
              borderRadius: 7, padding: '5px 8px', color: '#f87171', fontSize: 11,
              cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4,
            }}
            onMouseEnter={e => e.currentTarget.style.background = 'rgba(248,113,113,0.16)'}
            onMouseLeave={e => e.currentTarget.style.background = 'rgba(248,113,113,0.08)'}
          >
            <Square size={9} fill="#f87171" /> Stop
          </button>
        )}

        {/* Dismiss (only when finished) */}
        {!isScraping && (
          <button
            onClick={dismissJob}
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              color: '#b8c2d4', padding: 4, display: 'flex', alignItems: 'center',
            }}
            onMouseEnter={e => e.currentTarget.style.color = '#e4e4e7'}
            onMouseLeave={e => e.currentTarget.style.color = '#b8c2d4'}
          >
            <X size={13} />
          </button>
        )}
      </div>
    </div>
  )
}