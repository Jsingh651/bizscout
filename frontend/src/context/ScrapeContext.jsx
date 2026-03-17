import { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react'

const API = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000'

const ScrapeContext = createContext(null)

export function ScrapeProvider({ children }) {
  const [job, setJob]               = useState(null)
  const [jobId, setJobId]           = useState(null)
  const [scrapeQuery, setScrapeQuery]       = useState(null)
  const [scrapeLocation, setScrapeLocation] = useState(null)
  const [completedBatchId, setCompletedBatchId] = useState(null)
  const [showResults, setShowResults]       = useState(false)
  const pollRef = useRef(null)

  const fetchBatchesRef = useRef(null)

  // Allow Leads page to register a "refetch batches" callback
  const registerRefetch = useCallback((fn) => {
    fetchBatchesRef.current = fn
  }, [])

  // Start a new scrape
  const startScrape = useCallback((query, location, noWebOnly) => {
    setScrapeQuery(query)
    setScrapeLocation(location)
    setJob({ status: 'queued', message: 'Job queued...', progress: 0 })
    setShowResults(false)
    setCompletedBatchId(null)

    fetch(`${API}/scrape/start`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({
        query: query.value,
        location: location.value,
        no_website_only: noWebOnly,
      }),
    })
      .then(r => r.json())
      .then(data => setJobId(data.job_id))
      .catch(err => setJob({ status: 'error', message: String(err), progress: 0 }))
  }, [])

  const stopScrape = useCallback(() => {
    if (!jobId) return
    fetch(`${API}/scrape/stop/${jobId}`, { method: 'POST', credentials: 'include' }).catch(() => {})
  }, [jobId])

  const dismissJob = useCallback(() => {
    setJob(null)
    setJobId(null)
    setScrapeQuery(null)
    setScrapeLocation(null)
    setShowResults(false)
    setCompletedBatchId(null)
  }, [])

  // Polling — runs globally regardless of which page is active
  useEffect(() => {
    if (!jobId) return

    const poll = () => {
      fetch(`${API}/scrape/status/${jobId}`, { credentials: 'include' })
        .then(r => r.json())
        .then(data => {
          setJob(data)
          if (data.status === 'done' || data.status === 'stopped') {
            clearInterval(pollRef.current)
            // Trigger batch refetch if Leads page is mounted
            if (fetchBatchesRef.current) fetchBatchesRef.current()
            // Find the new batch after a short delay
            setTimeout(() => {
              fetch(`${API}/batches`, { credentials: 'include' })
                .then(r => r.json())
                .then(arr => {
                  if (!Array.isArray(arr)) return
                  const match = arr.find(
                    b =>
                      b.query.toLowerCase() === scrapeQuery?.value?.toLowerCase() &&
                      b.location.toLowerCase() === scrapeLocation?.value?.toLowerCase()
                  )
                  if (match) {
                    setCompletedBatchId(match.id)
                    setShowResults(true)
                  }
                })
            }, 800)
          }
          if (data.status === 'error') clearInterval(pollRef.current)
        })
        .catch(() => {})
    }

    poll()
    pollRef.current = setInterval(poll, 2000)
    return () => clearInterval(pollRef.current)
  }, [jobId, scrapeQuery, scrapeLocation])

  const isScraping = job?.status === 'queued' || job?.status === 'running'

  return (
    <ScrapeContext.Provider value={{
      job, jobId, scrapeQuery, scrapeLocation,
      completedBatchId, showResults, isScraping,
      startScrape, stopScrape, dismissJob, setShowResults,
      registerRefetch,
    }}>
      {children}
    </ScrapeContext.Provider>
  )
}

export const useScrape = () => useContext(ScrapeContext)