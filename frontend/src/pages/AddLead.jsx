import { useState } from 'react'
import { useNavigate } from 'react-router-dom'

const API = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000'

function AddLead() {
  const navigate = useNavigate()
  const [form, setForm] = useState({
    name: '', city: '', phone: '', website_status: 'NO WEBSITE', score: 0
  })

  const handleSubmit = () => {
    fetch(`${API}/leads`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...form, score: parseInt(form.score) })
    })
      .then(res => res.json())
      .then(() => navigate('/leads'))
  }

  return (
    <div style={{ padding: '2rem' }}>
      <h1>Add New Lead</h1>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', maxWidth: '400px' }}>
        <input placeholder="Business Name" value={form.name}
          onChange={e => setForm({ ...form, name: e.target.value })} />
        <input placeholder="City" value={form.city}
          onChange={e => setForm({ ...form, city: e.target.value })} />
        <input placeholder="Phone" value={form.phone}
          onChange={e => setForm({ ...form, phone: e.target.value })} />
        <select value={form.website_status}
          onChange={e => setForm({ ...form, website_status: e.target.value })}>
          <option>NO WEBSITE</option>
          <option>HAS WEBSITE</option>
        </select>
        <input placeholder="Score (0-100)" type="number" value={form.score}
          onChange={e => setForm({ ...form, score: e.target.value })} />
        <button onClick={handleSubmit}>Save Lead</button>
        <button onClick={() => navigate('/leads')}>Cancel</button>
      </div>
    </div>
  )
}

export default AddLead