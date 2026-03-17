/**
 * api.js — centralized API client for BizScout
 *
 * Usage:
 *   import api from '../utils/api'
 *
 *   const leads     = await api.get('/leads')
 *   const lead      = await api.get(`/leads/${id}`)
 *   const newLead   = await api.post('/leads', { name, city, ... })
 *   const updated   = await api.patch(`/leads/${id}`, { pipeline_stage })
 *
 * Auth is handled automatically — reads from sessionStorage/localStorage/cookie.
 * On 401, clears stored tokens so the user gets redirected to login naturally.
 */

const BASE_URL = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000'

function getAuthHeaders() {
  const token =
    sessionStorage.getItem('access_token') ||
    localStorage.getItem('access_token')
  return token ? { Authorization: `Bearer ${token}` } : {}
}

function handleUnauthorized() {
  // Clear stale tokens — AuthContext will redirect to /login on next protected route
  sessionStorage.removeItem('access_token')
  localStorage.removeItem('access_token')
  localStorage.removeItem('user')
}

async function request(method, path, body, options = {}) {
  const headers = {
    ...getAuthHeaders(),
    ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
    ...options.headers,
  }

  const config = {
    method,
    headers,
    credentials: 'include', // always send cookies
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  }

  const res = await fetch(`${BASE_URL}${path}`, config)

  // Handle auth errors globally
  if (res.status === 401) {
    handleUnauthorized()
    throw new ApiError(401, 'Not authenticated')
  }

  // For 204 No Content
  if (res.status === 204) return null

  const data = await res.json()

  if (!res.ok) {
    throw new ApiError(res.status, data.detail || 'Request failed', data)
  }

  return data
}

export class ApiError extends Error {
  constructor(status, message, data = null) {
    super(message)
    this.status = status
    this.data   = data
  }
}

const api = {
  /** Base URL — useful for building URLs in components */
  baseUrl: BASE_URL,

  get:    (path, options)        => request('GET',    path, undefined, options),
  post:   (path, body, options)  => request('POST',   path, body,      options),
  patch:  (path, body, options)  => request('PATCH',  path, body,      options),
  put:    (path, body, options)  => request('PUT',    path, body,      options),
  delete: (path, options)        => request('DELETE', path, undefined, options),
}

export default api