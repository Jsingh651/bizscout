import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from './context/AuthContext'
import Home     from './pages/Home'
import Login    from './pages/Login'
import Register from './pages/Register'
import Leads    from './pages/Leads'
import AddLead  from './pages/AddLead'
import Profile  from './pages/Profile'
import Batches  from './pages/Batches'

function ProtectedRoute({ children }) {
  const { user, loading } = useAuth()
  if (loading) return null
  if (!user) return <Navigate to="/login" />
  return children
}

function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Public */}
        <Route path="/"         element={<Home />} />
        <Route path="/login"    element={<Login />} />
        <Route path="/register" element={<Register />} />

        {/* Protected */}
        <Route path="/leads"   element={<ProtectedRoute><Leads /></ProtectedRoute>} />
        <Route path="/add"     element={<ProtectedRoute><AddLead /></ProtectedRoute>} />
        <Route path="/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
        <Route path="/batches" element={<ProtectedRoute><Batches /></ProtectedRoute>} />

        {/* Catch-all */}
        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App