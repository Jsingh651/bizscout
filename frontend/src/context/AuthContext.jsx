import { createContext, useContext, useState, useEffect } from 'react'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  // Try to restore a cached user immediately so protected routes don't flash
  const [user, setUser] = useState(() => {
    try {
      const raw = localStorage.getItem('user')
      return raw ? JSON.parse(raw) : null
    } catch {
      return null
    }
  })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Validate session with the backend in the background. If it succeeds
    // we replace the cached user with the authoritative server response.
    fetch('http://127.0.0.1:8000/auth/me', { credentials: 'include' })
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (data) {
          const userData = { id: data.id, email: data.email, full_name: data.full_name }
          setUser(userData)
          try { localStorage.setItem('user', JSON.stringify(userData)) } catch {}
          if (data.access_token) {
            try {
              sessionStorage.setItem('access_token', data.access_token)
              localStorage.setItem('access_token', data.access_token)
            } catch (_) {}
          }
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const login = (userData) => {
    setUser(userData)
    try { localStorage.setItem('user', JSON.stringify(userData)) } catch {}
  }

  const logout = () => {
    fetch('http://127.0.0.1:8000/auth/logout', { method: 'POST', credentials: 'include' })
    setUser(null)
    try {
      localStorage.removeItem('user')
      localStorage.removeItem('access_token')
      sessionStorage.removeItem('access_token')
    } catch {}
  }

  return (
    <AuthContext.Provider value={{ user, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)