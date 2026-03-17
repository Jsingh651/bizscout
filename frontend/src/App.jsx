import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from './context/AuthContext'
import Home from './pages/Home'
import Login from './pages/Login'
import Register from './pages/Register'
import Leads from './pages/Leads'
import AddLead from './pages/AddLead'
import Profile from './pages/Profile'
import Batches from './pages/Batches'
import Pipeline from './pages/Pipeline'
import Analytics from './pages/Analytics'
import Meetings from './pages/Meetings'
import LeadDetail from './pages/LeadDetail'
import ContractPage from './pages/ContractPage'
import SignContractPage from './pages/SignContractPage'
import ContractsPage from './pages/ContractsPage'
import PaymentPage from './pages/PaymentPage'
import PaymentsPage from './pages/PaymentsPage'
import ScrapeStatusBar from './components/ScrapeStatusBar'

function ProtectedRoute({ children }) {
  const { user, loading } = useAuth()
  if (loading) return null
  if (!user) return <Navigate to="/login" />
  return children
}

function App() {
  return (
    <BrowserRouter>
      <ScrapeStatusBar />
      <Routes>
        {/* Public */}
        <Route path="/"              element={<Home />} />
        <Route path="/login"         element={<Login />} />
        <Route path="/register"      element={<Register />} />
        <Route path="/sign/:token"   element={<SignContractPage />} />
        <Route path="/pay/:token"    element={<PaymentPage />} />

        {/* Protected */}
        <Route path="/contract/:id"  element={<ProtectedRoute><ContractPage /></ProtectedRoute>} />
        <Route path="/contracts"     element={<ProtectedRoute><ContractsPage /></ProtectedRoute>} />
        <Route path="/leads"         element={<ProtectedRoute><Leads /></ProtectedRoute>} />
        <Route path="/leads/:id"     element={<ProtectedRoute><LeadDetail /></ProtectedRoute>} />
        <Route path="/add"           element={<ProtectedRoute><AddLead /></ProtectedRoute>} />
        <Route path="/profile"       element={<ProtectedRoute><Profile /></ProtectedRoute>} />
        <Route path="/batches"       element={<ProtectedRoute><Batches /></ProtectedRoute>} />
        <Route path="/pipeline"      element={<ProtectedRoute><Pipeline /></ProtectedRoute>} />
        <Route path="/analytics"     element={<ProtectedRoute><Analytics /></ProtectedRoute>} />
        <Route path="/meetings"      element={<ProtectedRoute><Meetings /></ProtectedRoute>} />
        <Route path="/payments"      element={<ProtectedRoute><PaymentsPage /></ProtectedRoute>} />

        {/* Catch-all */}
        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App