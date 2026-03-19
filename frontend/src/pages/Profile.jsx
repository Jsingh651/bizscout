// FILE: frontend/src/pages/Profile.jsx
// ACTION: CREATE this new file

import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useForm } from 'react-hook-form'
import {
  User, Mail, Lock, CheckCircle2, AlertCircle,
  ArrowLeft, Shield, Activity, Trash2, Eye, EyeOff,
} from 'lucide-react'
import AppNav from '../components/AppNav'
import { API } from '../utils/api'

function ParticleCanvas() {
  const ref = useRef(null)
  useEffect(() => {
    const canvas = ref.current
    const ctx = canvas.getContext('2d')
    let id
    const resize = () => { canvas.width = window.innerWidth; canvas.height = window.innerHeight }
    resize()
    window.addEventListener('resize', resize)
    const pts = Array.from({ length: 60 }, () => ({
      x: Math.random() * window.innerWidth, y: Math.random() * window.innerHeight,
      r: Math.random() * 1.0 + 0.2, s: Math.random() * 0.2 + 0.04,
      o: Math.random() * 0.15 + 0.03,
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

export default function Profile() {
  const { user, login } = useAuth()
  const navigate = useNavigate()
  const [activeTab, setActiveTab] = useState('info')

  // Info form
  const [nameSuccess, setNameSuccess] = useState(false)
  const [nameError, setNameError] = useState('')
  const { register: regInfo, handleSubmit: handleInfo, formState: { errors: errInfo }, setValue } = useForm()

  // Password form
  const [pwSuccess, setPwSuccess] = useState(false)
  const [pwError, setPwError] = useState('')
  const [showCurrent, setShowCurrent] = useState(false)
  const [showNew, setShowNew] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const { register: regPw, handleSubmit: handlePw, watch, reset: resetPw, formState: { errors: errPw } } = useForm()
  const newPw = watch('new_password', '')

  useEffect(() => {
    if (user?.full_name) setValue('full_name', user.full_name)
    if (user?.email)     setValue('email', user.email)
  }, [user])

  const onSaveInfo = async (data) => {
    setNameError(''); setNameSuccess(false)
    try {
      const res = await fetch(`${API}/auth/me`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ full_name: data.full_name }),
      })
      const json = await res.json()
      if (!res.ok) { setNameError(json.detail || 'Failed to update.'); return }
      login(json)
      setNameSuccess(true)
      setTimeout(() => setNameSuccess(false), 3000)
    } catch { setNameError('Something went wrong.') }
  }

  const onChangePassword = async (data) => {
    setPwError(''); setPwSuccess(false)
    try {
      const res = await fetch(`${API}/auth/me`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ current_password: data.current_password, new_password: data.new_password }),
      })
      const json = await res.json()
      if (!res.ok) { setPwError(json.detail || 'Failed to update password.'); return }
      setPwSuccess(true); resetPw()
      setTimeout(() => setPwSuccess(false), 3000)
    } catch { setPwError('Something went wrong.') }
  }

  const pwRules = [
    { label: '8+ characters',    pass: newPw.length >= 8 },
    { label: 'Uppercase letter', pass: /[A-Z]/.test(newPw) },
    { label: 'Number',           pass: /[0-9]/.test(newPw) },
  ]

  const initials = user?.full_name
    ? user.full_name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
    : user?.email?.[0]?.toUpperCase() || '?'

  const TABS = [
    { id: 'info',     label: 'Profile Info', icon: <User size={14} /> },
    { id: 'security', label: 'Security',     icon: <Lock size={14} /> },
    { id: 'activity', label: 'Activity',     icon: <Activity size={14} /> },
  ]

  const ACTIVITY = [
    { action: 'Added Lead',    detail: "Joe's Plumbing",              time: '2 hours ago'  },
    { action: 'Stage Updated', detail: 'Valley Auto → Contacted',     time: '3 hours ago'  },
    { action: 'Added Lead',    detail: "Maria's Nail Salon",          time: 'Yesterday'    },
    { action: 'Stage Updated', detail: 'Quick Cut Barbers → Closed',  time: '2 days ago'   },
    { action: 'Added Lead',    detail: 'Titan Tree Service',          time: '3 days ago'   },
  ]

  return (
    <div style={{ minHeight: '100vh', background: '#09090f', color: '#fafafa', fontFamily: "'Outfit', sans-serif", overflowX: 'hidden' }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@400;500;600;700;800;900&family=JetBrains+Mono:wght@400;700&display=swap');
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        html, body { scrollbar-width: none; overflow-x: hidden; }
        html::-webkit-scrollbar { display: none; }
        @keyframes pulse { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:0.4;transform:scale(0.8)} }
        @keyframes fadeUp { from{opacity:0;transform:translateY(14px)} to{opacity:1;transform:translateY(0)} }
        .fade1 { animation: fadeUp 0.5s cubic-bezier(0.16,1,0.3,1) 0.05s both }
        .fade2 { animation: fadeUp 0.5s cubic-bezier(0.16,1,0.3,1) 0.14s both }

        .profile-input {
          width: 100%; background: rgba(255,255,255,0.03);
          border: 1px solid rgba(255,255,255,0.08); border-radius: 10px;
          padding: 11px 14px; color: #fafafa; font-size: 14px;
          font-family: 'Outfit', sans-serif; outline: none;
          transition: border-color 0.2s, box-shadow 0.2s; box-sizing: border-box;
        }
        .profile-input:focus {
          border-color: rgba(139,92,246,0.5);
          box-shadow: 0 0 0 3px rgba(139,92,246,0.08);
        }
        .profile-input:disabled { color: #b8c2d4; cursor: not-allowed; }
        .profile-input.err { border-color: rgba(248,113,113,0.4); }

        .save-btn {
          background: linear-gradient(135deg,#8b5cf6,#6366f1); border: none;
          border-radius: 10px; padding: 11px 24px; color: #fff; font-size: 14px;
          font-weight: 700; cursor: pointer; font-family: 'Outfit',sans-serif;
          letter-spacing: 0.2px; transition: opacity 0.2s, transform 0.15s; align-self: flex-start;
        }
        .save-btn:hover { opacity: 0.88; transform: translateY(-1px); }

        .tab-btn {
          display: flex; align-items: center; gap: 10px; padding: 10px 14px;
          border-radius: 10px; background: transparent; border: none;
          color: #c4c4cc; font-size: 14px; cursor: pointer;
          font-family: 'Outfit',sans-serif; text-align: left; transition: all 0.15s; width: 100%;
        }
        .tab-btn:hover { background: rgba(139,92,246,0.06); color: #c4b5fd; }
        .tab-btn.active { background: rgba(139,92,246,0.1); color: #c4b5fd; }

        .back-btn {
          display: flex; align-items: center; background: rgba(255,255,255,0.03);
          border: 1px solid rgba(255,255,255,0.07); border-radius: 8px;
          padding: 6px 12px; color: #c4c4cc; font-size: 13px; cursor: pointer;
          font-family: 'Outfit',sans-serif; transition: color 0.2s; gap: 6px;
        }
        .back-btn:hover { color: #c4c4cc; }

        .delete-btn {
          display: flex; align-items: center; gap: 6px;
          background: rgba(248,113,113,0.08); border: 1px solid rgba(248,113,113,0.2);
          border-radius: 8px; padding: 8px 14px; color: #f87171; font-size: 13px;
          cursor: pointer; font-family: 'Outfit',sans-serif; transition: background 0.15s; flex-shrink: 0;
        }
        .delete-btn:hover { background: rgba(248,113,113,0.14); }

        .eye-btn {
          position: absolute; right: 12px; top: 50%; transform: translateY(-50%);
          background: none; border: none; color: #c4c4cc; cursor: pointer;
          display: flex; align-items: center; padding: 0;
        }
        .eye-btn:hover { color: #c4c4cc; }

        .nav-link { background: none; border: none; color: #b8c2d4; font-size: 14px; cursor: pointer; font-family: 'Outfit',sans-serif; transition: color 0.2s; padding: 0; }
        .nav-link:hover { color: #c4c4cc; }
      `}</style>

      <ParticleCanvas />

      {/* Grid */}
      <div style={{
        position: 'fixed', inset: 0, zIndex: 0, pointerEvents: 'none', opacity: 0.35,
        backgroundImage: 'linear-gradient(rgba(139,92,246,0.045) 1px, transparent 1px), linear-gradient(90deg, rgba(139,92,246,0.045) 1px, transparent 1px)',
        backgroundSize: '72px 72px',
        maskImage: 'radial-gradient(ellipse 100% 55% at 50% 0%, black 0%, transparent 100%)',
      }} />

      {/* Glow */}
      <div style={{ position: 'fixed', top: -150, left: '50%', transform: 'translateX(-50%)', width: 800, height: 500, zIndex: 0, pointerEvents: 'none', background: 'radial-gradient(ellipse at center, rgba(139,92,246,0.08) 0%, transparent 70%)' }} />

      <AppNav />

      {/* Content */}
      <div className="page-content" style={{ position: 'relative', zIndex: 1, maxWidth: 1100, margin: '0 auto', padding: '48px 48px 80px' }}>

        {/* Hero */}
        <div className="fade1" style={{ display: 'flex', alignItems: 'center', gap: 20, marginBottom: 40 }}>
          <div style={{
            width: 64, height: 64, borderRadius: '50%', flexShrink: 0,
            background: 'linear-gradient(135deg, #8b5cf6, #6366f1)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 22, fontWeight: 700, color: '#fff',
            fontFamily: "'JetBrains Mono', monospace",
            border: '3px solid rgba(139,92,246,0.25)',
          }}>
            {initials}
          </div>
          <div>
            <h1 style={{ fontSize: 24, fontWeight: 700, margin: '0 0 4px', letterSpacing: '-0.5px' }}>{user?.full_name || 'User'}</h1>
            <p style={{ fontSize: 13, color: '#c4c4cc', fontFamily: "'JetBrains Mono', monospace", margin: '0 0 8px' }}>{user?.email}</p>
            <span style={{
              display: 'inline-flex', alignItems: 'center', gap: 4,
              background: 'rgba(139,92,246,0.1)', border: '1px solid rgba(139,92,246,0.2)',
              borderRadius: 20, padding: '3px 10px', fontSize: 11, color: '#a78bfa',
              fontFamily: "'JetBrains Mono', monospace",
            }}>
              <Shield size={10} /> Free Plan
            </span>
          </div>
        </div>

        {/* Layout */}
        <div className="fade2 profile-layout" style={{ gap: 24 }}>

          {/* Sidebar */}
          <div className="profile-sidebar" style={{ width: 200, flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
            {TABS.map(tab => (
              <button key={tab.id} className={`tab-btn${activeTab === tab.id ? ' active' : ''}`}
                onClick={() => setActiveTab(tab.id)}>
                {tab.icon} {tab.label}
              </button>
            ))}
          </div>

          {/* Panel */}
          <div style={{
            flex: 1, background: 'rgba(255,255,255,0.02)',
            border: '1px solid rgba(255,255,255,0.06)', borderRadius: 16, padding: 32,
          }}>

            {/* ── Profile Info ── */}
            {activeTab === 'info' && (
              <>
                <h2 style={{ fontSize: 20, fontWeight: 700, margin: '0 0 6px', letterSpacing: '-0.3px' }}>Profile Information</h2>
                <p style={{ fontSize: 14, color: '#c4c4cc', marginBottom: 28 }}>Update your display name.</p>

                <form onSubmit={handleInfo(onSaveInfo)} style={{ display: 'flex', flexDirection: 'column', gap: 18, maxWidth: 480 }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <label style={{ fontSize: 11, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#c4c4cc', display: 'flex', alignItems: 'center', gap: 6, fontFamily: "'JetBrains Mono', monospace" }}>
                      <User size={11} color="#8b5cf6" /> Full Name
                    </label>
                    <input className={`profile-input${errInfo.full_name ? ' err' : ''}`}
                      placeholder="Your full name"
                      {...regInfo('full_name', { required: 'Name is required', minLength: { value: 2, message: 'At least 2 characters' } })} />
                    {errInfo.full_name && <span style={{ fontSize: 12, color: '#f87171' }}>{errInfo.full_name.message}</span>}
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <label style={{ fontSize: 11, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#c4c4cc', display: 'flex', alignItems: 'center', gap: 6, fontFamily: "'JetBrains Mono', monospace" }}>
                      <Mail size={11} color="#8b5cf6" /> Email Address
                    </label>
                    <input className="profile-input" disabled {...regInfo('email')} />
                    <span style={{ fontSize: 12, color: '#b8c2d4' }}>Email cannot be changed.</span>
                  </div>

                  {nameSuccess && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'rgba(74,222,128,0.07)', border: '1px solid rgba(74,222,128,0.2)', borderRadius: 8, padding: '10px 14px', fontSize: 13, color: '#4ade80' }}>
                      <CheckCircle2 size={13} /> Profile updated successfully.
                    </div>
                  )}
                  {nameError && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'rgba(248,113,113,0.07)', border: '1px solid rgba(248,113,113,0.2)', borderRadius: 8, padding: '10px 14px', fontSize: 13, color: '#f87171' }}>
                      <AlertCircle size={13} /> {nameError}
                    </div>
                  )}

                  <button type="submit" className="save-btn">Save Changes</button>
                </form>
              </>
            )}

            {/* ── Security ── */}
            {activeTab === 'security' && (
              <>
                <h2 style={{ fontSize: 20, fontWeight: 700, margin: '0 0 6px', letterSpacing: '-0.3px' }}>Security</h2>
                <p style={{ fontSize: 14, color: '#c4c4cc', marginBottom: 28 }}>Change your password.</p>

                <form onSubmit={handlePw(onChangePassword)} style={{ display: 'flex', flexDirection: 'column', gap: 18, maxWidth: 480 }}>

                  {/* Current password */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <label style={{ fontSize: 11, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#c4c4cc', display: 'flex', alignItems: 'center', gap: 6, fontFamily: "'JetBrains Mono', monospace" }}>
                      <Lock size={11} color="#8b5cf6" /> Current Password
                    </label>
                    <div style={{ position: 'relative' }}>
                      <input className={`profile-input${errPw.current_password ? ' err' : ''}`}
                        type={showCurrent ? 'text' : 'password'} placeholder="Current password"
                        style={{ paddingRight: 40 }}
                        {...regPw('current_password', { required: 'Current password is required' })} />
                      <button type="button" className="eye-btn" onClick={() => setShowCurrent(v => !v)}>
                        {showCurrent ? <EyeOff size={14} /> : <Eye size={14} />}
                      </button>
                    </div>
                    {errPw.current_password && <span style={{ fontSize: 12, color: '#f87171' }}>{errPw.current_password.message}</span>}
                  </div>

                  {/* New password */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <label style={{ fontSize: 11, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#c4c4cc', display: 'flex', alignItems: 'center', gap: 6, fontFamily: "'JetBrains Mono', monospace" }}>
                      <Lock size={11} color="#8b5cf6" /> New Password
                    </label>
                    <div style={{ position: 'relative' }}>
                      <input className={`profile-input${errPw.new_password ? ' err' : ''}`}
                        type={showNew ? 'text' : 'password'} placeholder="New password"
                        style={{ paddingRight: 40 }}
                        {...regPw('new_password', {
                          required: 'New password is required',
                          minLength: { value: 8, message: 'Min 8 characters' },
                          pattern: { value: /^(?=.*[A-Z])(?=.*[0-9])/, message: 'Needs uppercase + number' },
                        })} />
                      <button type="button" className="eye-btn" onClick={() => setShowNew(v => !v)}>
                        {showNew ? <EyeOff size={14} /> : <Eye size={14} />}
                      </button>
                    </div>
                    {errPw.new_password && <span style={{ fontSize: 12, color: '#f87171' }}>{errPw.new_password.message}</span>}

                    {newPw.length > 0 && (
                      <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: 8, padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 6 }}>
                        {pwRules.map(r => (
                          <div key={r.label} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <CheckCircle2 size={12} style={{ color: r.pass ? '#4ade80' : '#b8c2d4' }} />
                            <span style={{ fontSize: 12, color: r.pass ? '#c4c4cc' : '#c4c4cc' }}>{r.label}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Confirm */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <label style={{ fontSize: 11, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#c4c4cc', display: 'flex', alignItems: 'center', gap: 6, fontFamily: "'JetBrains Mono', monospace" }}>
                      <Lock size={11} color="#8b5cf6" /> Confirm New Password
                    </label>
                    <div style={{ position: 'relative' }}>
                      <input className={`profile-input${errPw.confirm_password ? ' err' : ''}`}
                        type={showConfirm ? 'text' : 'password'} placeholder="Confirm new password"
                        style={{ paddingRight: 40 }}
                        {...regPw('confirm_password', {
                          required: 'Please confirm your password',
                          validate: v => v === newPw || 'Passwords do not match',
                        })} />
                      <button type="button" className="eye-btn" onClick={() => setShowConfirm(v => !v)}>
                        {showConfirm ? <EyeOff size={14} /> : <Eye size={14} />}
                      </button>
                    </div>
                    {errPw.confirm_password && <span style={{ fontSize: 12, color: '#f87171' }}>{errPw.confirm_password.message}</span>}
                  </div>

                  {pwSuccess && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'rgba(74,222,128,0.07)', border: '1px solid rgba(74,222,128,0.2)', borderRadius: 8, padding: '10px 14px', fontSize: 13, color: '#4ade80' }}>
                      <CheckCircle2 size={13} /> Password changed successfully.
                    </div>
                  )}
                  {pwError && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'rgba(248,113,113,0.07)', border: '1px solid rgba(248,113,113,0.2)', borderRadius: 8, padding: '10px 14px', fontSize: 13, color: '#f87171' }}>
                      <AlertCircle size={13} /> {pwError}
                    </div>
                  )}

                  <button type="submit" className="save-btn">Change Password</button>
                </form>

                {/* Danger zone */}
                <div style={{ marginTop: 40, border: '1px solid rgba(248,113,113,0.15)', borderRadius: 12, overflow: 'hidden' }}>
                  <div style={{ padding: '10px 16px', background: 'rgba(248,113,113,0.05)', fontSize: 11, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#f87171', fontFamily: "'JetBrains Mono', monospace" }}>
                    Danger Zone
                  </div>
                  <div style={{ padding: 16, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
                    <div>
                      <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 4 }}>Delete Account</div>
                      <div style={{ fontSize: 13, color: '#c4c4cc' }}>Permanently remove your account and all data.</div>
                    </div>
                    <button className="delete-btn"><Trash2 size={13} /> Delete</button>
                  </div>
                </div>
              </>
            )}

            {/* ── Activity ── */}
            {activeTab === 'activity' && (
              <>
                <h2 style={{ fontSize: 20, fontWeight: 700, margin: '0 0 6px', letterSpacing: '-0.3px' }}>Activity</h2>
                <p style={{ fontSize: 14, color: '#c4c4cc', marginBottom: 28 }}>Your recent actions.</p>
                <div>
                  {ACTIVITY.map((a, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 0', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                      <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#8b5cf6', flexShrink: 0 }} />
                      <div style={{ flex: 1 }}>
                        <span style={{ fontSize: 13, fontWeight: 600 }}>{a.action}</span>
                        <span style={{ fontSize: 13, color: '#c4c4cc' }}> — {a.detail}</span>
                      </div>
                      <span style={{ fontSize: 11, color: '#b8c2d4', fontFamily: "'JetBrains Mono', monospace" }}>{a.time}</span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}