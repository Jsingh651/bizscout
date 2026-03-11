import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import Leads from './pages/Leads'
import AddLead from './pages/AddLead'

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Navigate to="/leads" />} />
        <Route path="/leads" element={<Leads />} />
        <Route path="/add" element={<AddLead />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App