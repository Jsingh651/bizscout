import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { useAuth } from '../context/AuthContext'
import { Mail, Lock, Eye, EyeOff, AlertCircle, ArrowRight, MapPin, Zap, TrendingUp } from 'lucide-react'

const API = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000'

function FullScreenCanvas() {
  const canvasRef = useRef(null)

  useEffect(() => {
    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')
    let animId

    const resize = () => {
      canvas.width = window.innerWidth
      canvas.height = window.innerHeight
    }
    resize()
    window.addEventListener('resize', resize)

    // Stars across the entire screen
    const stars = Array.from({ length: 120 }, () => ({
      x: Math.random() * window.innerWidth,
      y: Math.random() * window.innerHeight,
      r: Math.random() * 1.3 + 0.2,
      speed: Math.random() * 0.25 + 0.05,
      opacity: Math.random() * 0.22 + 0.04,
      hue: Math.random() > 0.5 ? '167,139,250' : '129,140,248',
    }))

    // Network nodes — concentrated more on the left
    const nodes = Array.from({ length: 16 }, (_, i) => ({
      x: i < 10
        ? Math.random() * (window.innerWidth * 0.6)
        : Math.random() * window.innerWidth,
      y: Math.random() * window.innerHeight,
      r: Math.random() * 2.2 + 0.8,
      dx: (Math.random() - 0.5) * 0.35,
      dy: (Math.random() - 0.5) * 0.35,
    }))

    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height)

      // Node connections
      nodes.forEach((n, i) => {
        nodes.slice(i + 1).forEach(m => {
          const dist = Math.hypot(n.x - m.x, n.y - m.y)
          if (dist < 160) {
            // Fade connections on the right side
            const rightFade = Math.max(0, 1 - (Math.max(n.x, m.x) / canvas.width - 0.45) * 3)
            ctx.beginPath()
            ctx.moveTo(n.x, n.y)
            ctx.lineTo(m.x, m.y)
            ctx.strokeStyle = `rgba(139,92,246,${0.09 * (1 - dist / 160) * rightFade})`
            ctx.lineWidth = 0.8
            ctx.stroke()
          }
        })
      })

      // Nodes — fade out toward right
      nodes.forEach(n => {
        n.x += n.dx; n.y += n.dy
        if (n.x < 0 || n.x > canvas.width) n.dx *= -1
        if (n.y < 0 || n.y > canvas.height) n.dy *= -1
        const rightFade = Math.max(0, 1 - (n.x / canvas.width - 0.45) * 3)
        ctx.beginPath()
        ctx.arc(n.x, n.y, n.r, 0, Math.PI * 2)
        ctx.fillStyle = `rgba(139,92,246,${0.4 * rightFade})`
        ctx.fill()
      })

      // Stars everywhere
      stars.forEach(p => {
        p.y -= p.speed
        if (p.y < -2) { p.y = canvas.height + 2; p.x = Math.random() * canvas.width }
        ctx.beginPath()
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2)
        ctx.fillStyle = `rgba(${p.hue},${p.opacity})`
        ctx.fill()
      })

      animId = requestAnimationFrame(draw)
    }
    draw()

    return () => { cancelAnimationFrame(animId); window.removeEventListener('resize', resize) }
  }, [])

  return (
    <canvas ref={canvasRef} style={{
      position: 'fixed', inset: 0, zIndex: 0, pointerEvents: 'none',
    }} />
  )
}

export default function Login() {
  const navigate = useNavigate()
  const { login } = useAuth()
  const [serverError, setServerError] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)

  const { register, handleSubmit, formState: { errors } } = useForm()

  const onSubmit = async (data) => {
    setLoading(true)
    setServerError('')
    try {
      const res = await fetch(`${API}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(data),
      })
      const json = await res.json()
      if (!res.ok) { setServerError(json.detail); return }
      if (json.access_token) {
        try {
          sessionStorage.setItem('access_token', json.access_token)
          localStorage.setItem('access_token', json.access_token)
        } catch (_) {}
      }
      login(json.user || json)
      navigate('/leads')
    } catch {
      setServerError('Something went wrong. Try again.')
    } finally {
      setLoading(false)
    }
  }

  const stats = [
    { icon: MapPin, value: '420+', label: 'Cities covered' },
    { icon: Zap, value: '89k+', label: 'No-website leads' },
    { icon: TrendingUp, value: '94%', label: 'Score accuracy' },
  ]

  return (
    <div style={{
      minHeight: '100vh',
      fontFamily: "'Outfit', sans-serif",
      position: 'relative', overflow: 'hidden',
      // Seamless gradient: deep navy-purple left → near-black right
      background: 'linear-gradient(110deg, #0d0b1a 0%, #0c0b16 35%, #09090f 65%, #09090f 100%)',
    }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@400;500;600;700;800;900&family=JetBrains+Mono:wght@400;700&display=swap');
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        html, body { scrollbar-width: none; overflow-x: hidden; }
        html::-webkit-scrollbar { display: none; }

        @keyframes fadeUp  { from{opacity:0;transform:translateY(20px)} to{opacity:1;transform:translateY(0)} }
        @keyframes slideIn { from{opacity:0;transform:translateX(20px)} to{opacity:1;transform:translateX(0)} }
        @keyframes pulse   { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:0.4;transform:scale(0.8)} }

        .left-content  { animation: fadeUp  0.6s cubic-bezier(0.16,1,0.3,1) 0.05s both; }
        .right-content { animation: slideIn 0.6s cubic-bezier(0.16,1,0.3,1) 0.15s both; }

        .auth-input {
          width: 100%;
          background: rgba(255,255,255,0.04);
          border: 1px solid rgba(255,255,255,0.08);
          border-radius: 10px; color: #f4f4f5;
          font-family: 'Outfit', sans-serif; font-size: 0.95rem;
          padding: 14px 16px 14px 46px; outline: none;
          transition: border-color 0.2s, box-shadow 0.2s, background 0.2s;
          backdrop-filter: blur(4px);
        }
        .auth-input:focus {
          border-color: rgba(139,92,246,0.6);
          box-shadow: 0 0 0 3px rgba(139,92,246,0.1);
          background: rgba(255,255,255,0.06);
        }
        .auth-input.has-error { border-color: rgba(248,113,113,0.4); }
    .auth-input.has-error:focus { box-shadow: 0 0 0 3px rgba(248,113,113,0.08); }
  .auth-input::placeholder { color: #9aa0a6; }

        .submit-btn {
          width: 100%; background: linear-gradient(135deg, #8b5cf6, #6366f1);
          color: #fff; border: none; border-radius: 10px;
          padding: 15px; font-size: 0.975rem; font-weight: 700;
          cursor: pointer; font-family: 'Outfit', sans-serif;
          display: flex; align-items: center; justify-content: center; gap: 8px;
          transition: opacity 0.2s, transform 0.15s, box-shadow 0.2s;
          position: relative; overflow: hidden; letter-spacing: 0.2px;
        }
        .submit-btn::after {
          content: ''; position: absolute; inset: 0;
          background: linear-gradient(135deg, rgba(255,255,255,0.1), transparent);
          pointer-events: none;
        }
        .submit-btn:hover:not(:disabled) {
          opacity: 0.88; transform: translateY(-2px);
          box-shadow: 0 14px 36px rgba(139,92,246,0.4);
        }
        .submit-btn:disabled { opacity: 0.45; cursor: not-allowed; }

        .eye-btn {
          position: absolute; right: 14px; top: 50%; transform: translateY(-50%);
          background: none; border: none; cursor: pointer;
          color: #e4e4e7; display: flex; padding: 0; transition: color 0.2s;
        }
  .eye-btn:hover { color: #e4e4e7; }

        .ghost-btn {
          width: 100%; background: rgba(255,255,255,0.02);
          border: 1px solid rgba(255,255,255,0.07); border-radius: 10px;
          padding: 14px; color: #e4e4e7;
          font-family: 'Outfit', sans-serif; font-size: 0.95rem; font-weight: 600;
          cursor: pointer; transition: all 0.2s; backdrop-filter: blur(4px);
        }
        .ghost-btn:hover { border-color: rgba(139,92,246,0.3); color: #a78bfa; background: rgba(139,92,246,0.04); }

        .nav-back {
          background: none; border: none; cursor: pointer;
          color: #e4e4e7; font-family: 'Outfit', sans-serif;
          font-size: 0.82rem; padding: 0; transition: color 0.2s;
        }
  .nav-back:hover { color: #cfcfd6; }
      `}</style>

      <FullScreenCanvas />

      {/* Purple glow blobs — left side only */}
      <div style={{
        position: 'fixed', top: '10%', left: '-5%', zIndex: 0, pointerEvents: 'none',
        width: '500px', height: '500px', borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(139,92,246,0.1) 0%, transparent 70%)',
        filter: 'blur(60px)',
      }} />
      <div style={{
        position: 'fixed', bottom: '5%', left: '20%', zIndex: 0, pointerEvents: 'none',
        width: '360px', height: '360px', borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(99,102,241,0.08) 0%, transparent 70%)',
        filter: 'blur(50px)',
      }} />

      {/* Grid — fades across full width */}
      <div style={{
        position: 'fixed', inset: 0, zIndex: 0, pointerEvents: 'none', opacity: 0.22,
        backgroundImage: 'linear-gradient(rgba(139,92,246,0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(139,92,246,0.05) 1px, transparent 1px)',
        backgroundSize: '72px 72px',
        maskImage: 'radial-gradient(ellipse 90% 70% at 30% 30%, black 0%, transparent 100%)',
      }} />

      {/* Back button */}
      <div style={{ position: 'fixed', top: '28px', left: '36px', zIndex: 10 }}>
        <button className="nav-back" onClick={() => navigate('/')}>← BizScout</button>
      </div>

      {/* Split layout — NO border, pure positioning */}
      <div style={{
        position: 'relative', zIndex: 1,
        minHeight: '100vh',
        display: 'grid', gridTemplateColumns: '1fr 1fr',
      }}>

        {/* LEFT — branding */}
        <div className="left-content" style={{
          display: 'flex', flexDirection: 'column',
          justifyContent: 'center', padding: '120px 96px 80px 160px',
          gap: '0',
        }}>
          {/* Logo */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '64px' }}>
            <div style={{
              width: '36px', height: '36px', borderRadius: '10px',
              background: 'linear-gradient(135deg, #8b5cf6, #6366f1)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontWeight: '900', fontSize: '0.9rem', color: '#fff',
              boxShadow: '0 4px 20px rgba(139,92,246,0.4)',
            }}>B</div>
            <span style={{ fontWeight: '800', fontSize: '1.1rem', color: '#fafafa', letterSpacing: '-0.5px' }}>BizScout</span>
          </div>

          {/* Badge */}
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: '7px',
            background: 'rgba(139,92,246,0.08)', border: '1px solid rgba(139,92,246,0.18)',
            borderRadius: '6px', padding: '5px 12px', marginBottom: '24px',
            width: 'fit-content',
          }}>
            <div style={{ width: '5px', height: '5px', borderRadius: '50%', background: '#8b5cf6', animation: 'pulse 1.5s infinite' }} />
            <span style={{ color: '#a78bfa', fontSize: '0.64rem', fontWeight: '700', letterSpacing: '2px', textTransform: 'uppercase', fontFamily: 'JetBrains Mono, monospace' }}>
              AI Lead Intelligence
            </span>
          </div>

          <h2 style={{
            fontSize: 'clamp(2rem, 3vw, 3rem)', fontWeight: '900',
            letterSpacing: '-2.5px', lineHeight: 1.06, color: '#fafafa', marginBottom: '18px',
          }}>
            Find businesses<br />
            <span style={{
              background: 'linear-gradient(90deg, #a78bfa, #818cf8)',
              WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
            }}>before anyone else</span>
          </h2>

          <p style={{ color: '#e4e4e7', fontSize: '0.9rem', lineHeight: 1.8, maxWidth: '320px', marginBottom: '48px' }}>
            Scrape Google Maps, detect missing websites, score every lead with AI — close more deals faster.
          </p>

          {/* Stats */}
          <div style={{
            display: 'flex', flexDirection: 'column', gap: '14px',
            padding: '22px 24px',
            background: 'rgba(255,255,255,0.02)',
            border: '1px solid rgba(255,255,255,0.05)',
            borderRadius: '14px',
            backdropFilter: 'blur(12px)',
            width: 'fit-content', minWidth: '260px',
          }}>
            {stats.map(({ icon: Icon, value, label }) => (
              <div key={label} style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                <div style={{
                  width: '32px', height: '32px', borderRadius: '8px', flexShrink: 0,
                  background: 'rgba(139,92,246,0.08)', border: '1px solid rgba(139,92,246,0.14)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <Icon size={13} color="#8b5cf6" strokeWidth={1.5} />
                </div>
                <div>
                  <div style={{ color: '#a78bfa', fontWeight: '800', fontSize: '0.95rem', fontFamily: 'JetBrains Mono, monospace', letterSpacing: '-0.5px' }}>{value}</div>
                  <div style={{ color: '#e4e4e7', fontSize: '0.67rem', textTransform: 'uppercase', letterSpacing: '1.2px' }}>{label}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* RIGHT — form, no border, transparent bg so canvas shows through */}
        <div className="right-content" style={{
          display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center',
          padding: '100px 60px 60px',
        }}>
          <div style={{ width: '100%', maxWidth: '390px' }}>

            <div style={{ marginBottom: '36px' }}>
              <p style={{
                color: '#e4e4e7', fontSize: '0.68rem', fontWeight: '700',
                fontFamily: 'JetBrains Mono, monospace', letterSpacing: '2.5px',
                textTransform: 'uppercase', marginBottom: '10px',
              }}>Welcome back</p>
              <h1 style={{
                fontSize: '2.4rem', fontWeight: '900',
                letterSpacing: '-2.5px', color: '#fafafa', lineHeight: 1.08,
              }}>Sign in to<br />your account</h1>
            </div>

            {serverError && (
              <div style={{
                display: 'flex', alignItems: 'center', gap: '9px',
                background: 'rgba(248,113,113,0.06)', border: '1px solid rgba(248,113,113,0.16)',
                borderRadius: '10px', padding: '12px 15px', marginBottom: '22px',
              }}>
                <AlertCircle size={14} color="#f87171" strokeWidth={1.5} />
                <span style={{ color: '#f87171', fontSize: '0.83rem' }}>{serverError}</span>
              </div>
            )}

            <form onSubmit={handleSubmit(onSubmit)} style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
              <div>
                <label style={{
                  display: 'block', color: '#e4e4e7', fontSize: '0.68rem', fontWeight: '700',
                  letterSpacing: '1.8px', marginBottom: '8px',
                  fontFamily: 'JetBrains Mono, monospace', textTransform: 'uppercase',
                }}>Email address</label>
                <div style={{ position: 'relative' }}>
                  <Mail size={14} color="#e4e4e7" strokeWidth={1.5} style={{
                    position: 'absolute', left: '15px', top: '50%',
                    transform: 'translateY(-50%)', pointerEvents: 'none',
                  }} />
                  <input
                    className={`auth-input ${errors.email ? 'has-error' : ''}`}
                    placeholder="you@example.com"
                    type="email" autoComplete="email"
                    {...register('email', {
                      required: 'Email is required',
                      pattern: {
                        value: /^[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}$/,
                        message: 'Enter a valid email address',
                      },
                    })}
                  />
                </div>
                {errors.email && (
                  <p style={{ color: '#f87171', fontSize: '0.74rem', marginTop: '6px', display: 'flex', alignItems: 'center', gap: '5px' }}>
                    <AlertCircle size={11} strokeWidth={2} /> {errors.email.message}
                  </p>
                )}
              </div>

              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <label style={{
                    color: '#e4e4e7', fontSize: '0.68rem', fontWeight: '700',
                    letterSpacing: '1.8px', fontFamily: 'JetBrains Mono, monospace', textTransform: 'uppercase',
                  }}>Password</label>
                  <span
                    style={{ color: '#e4e4e7', fontSize: '0.74rem', cursor: 'pointer', transition: 'color 0.2s' }}
                    onMouseEnter={e => e.target.style.color = '#a78bfa'}
                    onMouseLeave={e => e.target.style.color = '#e4e4e7'}
                  >Forgot password?</span>
                </div>
                <div style={{ position: 'relative' }}>
                  <Lock size={14} color="#e4e4e7" strokeWidth={1.5} style={{
                    position: 'absolute', left: '15px', top: '50%',
                    transform: 'translateY(-50%)', pointerEvents: 'none',
                  }} />
                  <input
                    className={`auth-input ${errors.password ? 'has-error' : ''}`}
                    placeholder="••••••••"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="current-password"
                    style={{ paddingRight: '46px' }}
                    {...register('password', { required: 'Password is required' })}
                  />
                  <button type="button" className="eye-btn" onClick={() => setShowPassword(p => !p)}>
                    {showPassword ? <EyeOff size={14} strokeWidth={1.5} /> : <Eye size={14} strokeWidth={1.5} />}
                  </button>
                </div>
                {errors.password && (
                  <p style={{ color: '#f87171', fontSize: '0.74rem', marginTop: '6px', display: 'flex', alignItems: 'center', gap: '5px' }}>
                    <AlertCircle size={11} strokeWidth={2} /> {errors.password.message}
                  </p>
                )}
              </div>

              <button type="submit" className="submit-btn" disabled={loading} style={{ marginTop: '6px' }}>
                {loading ? 'Signing in...' : <><span>Sign in</span><ArrowRight size={15} strokeWidth={2} /></>}
              </button>
            </form>

            <div style={{ display: 'flex', alignItems: 'center', gap: '14px', margin: '26px 0' }}>
              <div style={{ flex: 1, height: '1px', background: 'rgba(255,255,255,0.05)' }} />
              <span style={{ color: '#e4e4e7', fontSize: '0.65rem', fontFamily: 'JetBrains Mono, monospace', letterSpacing: '1.5px', whiteSpace: 'nowrap' }}>NEW HERE?</span>
              <div style={{ flex: 1, height: '1px', background: 'rgba(255,255,255,0.05)' }} />
            </div>

            <button className="ghost-btn" onClick={() => navigate('/register')}>
              Create an account →
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}