import { lazy, Suspense } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from './context/AuthContext'

// ── Route-level code splitting ────────────────────────────────────────────────
// Each page is loaded only when first visited, keeping the initial bundle small.
const Home            = lazy(() => import('./pages/Home'))
const Login           = lazy(() => import('./pages/Login'))
const Register        = lazy(() => import('./pages/Register'))
const Leads           = lazy(() => import('./pages/Leads'))
const AddLead         = lazy(() => import('./pages/AddLead'))
const Profile         = lazy(() => import('./pages/Profile'))
const Batches         = lazy(() => import('./pages/Batches'))
const Pipeline        = lazy(() => import('./pages/Pipeline'))
const Analytics       = lazy(() => import('./pages/Analytics'))
const Meetings        = lazy(() => import('./pages/Meetings'))
const LeadDetail      = lazy(() => import('./pages/LeadDetail'))
const ContractPage    = lazy(() => import('./pages/ContractPage'))
const SignContractPage = lazy(() => import('./pages/SignContractPage'))
const ContractsPage   = lazy(() => import('./pages/ContractsPage'))
const PaymentPage     = lazy(() => import('./pages/PaymentPage'))
const PaymentsPage    = lazy(() => import('./pages/PaymentsPage'))
const Domains         = lazy(() => import('./pages/Domains'))
const ApprovalPage    = lazy(() => import('./pages/ApprovalPage'))
const ScrapeStatusBar = lazy(() => import('./components/ScrapeStatusBar'))

function ProtectedRoute({ children }) {
  const { user, loading } = useAuth()
  if (loading) return null
  if (!user) return <Navigate to="/login" />
  return children
}

function App() {
  return (
    <BrowserRouter>
      <Suspense fallback={null}>
        <ScrapeStatusBar />
        <Routes>
          {/* Public */}
          <Route path="/"               element={<Home />} />
          <Route path="/login"          element={<Login />} />
          <Route path="/register"       element={<Register />} />
          <Route path="/sign/:token"    element={<SignContractPage />} />
          <Route path="/pay/:token"     element={<PaymentPage />} />
          <Route path="/approve/:token" element={<ApprovalPage />} />

          {/* Protected */}
          <Route path="/domains"       element={<ProtectedRoute><Domains /></ProtectedRoute>} />
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
      </Suspense>
    </BrowserRouter>
  )
}

export default App
