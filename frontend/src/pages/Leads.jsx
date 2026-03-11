import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'

function Leads() {
  const [leads, setLeads] = useState([])
  const navigate = useNavigate()

  useEffect(() => {
    fetch('http://127.0.0.1:8000/leads')
      .then(res => res.json())
      .then(data => setLeads(data))
  }, [])

  return (
    <div style={{ padding: '2rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1>Leads</h1>
        <button onClick={() => navigate('/add')}>+ Add Lead</button>
      </div>
      <table border="1" cellPadding="10" style={{ width: '100%', marginTop: '1rem' }}>
        <thead>
          <tr>
            <th>Name</th>
            <th>City</th>
            <th>Phone</th>
            <th>Website Status</th>
            <th>Score</th>
          </tr>
        </thead>
        <tbody>
          {leads.map(lead => (
            <tr key={lead.id}>
              <td>{lead.name}</td>
              <td>{lead.city}</td>
              <td>{lead.phone}</td>
              <td>{lead.website_status}</td>
              <td>{lead.score}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export default Leads