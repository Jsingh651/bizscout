/**
 * In-memory cache for batches and batch leads.
 * Lives for the duration of the browser tab — no DB hits on repeat visits.
 * TTL: 5 minutes. Supports stale-while-revalidate.
 */

const TTL_MS = 5 * 60 * 1000  // 5 minutes

const _store = new Map()

function _get(key) {
    const entry = _store.get(key)
    if (!entry) return { data: null, stale: true }
    const stale = Date.now() - entry.ts > TTL_MS
    return { data: entry.data, stale }
}

function _set(key, data) {
    _store.set(key, { data, ts: Date.now() })
}

function _del(key) {
    _store.delete(key)
}

function _clear() {
    _store.clear()
}

// ── Public API ────────────────────────────────────────────────────────────────

/** Get the cached batch list (or null if not cached). */
export function getCachedBatches() {
    return _get('batches')
}

/** Store the batch list. */
export function setCachedBatches(data) {
    _set('batches', data)
}

/** Get cached leads for a specific batch hid. */
export function getCachedBatchLeads(hid) {
    return _get(`leads:${hid}`)
}

/** Store leads for a specific batch hid. */
export function setCachedBatchLeads(hid, data) {
    _set(`leads:${hid}`, data)
}

/** Update a single lead's field in every cached batch that contains it. */
export function patchCachedLead(leadId, patch) {
    for (const [key, entry] of _store.entries()) {
        if (!key.startsWith('leads:')) continue
        if (!entry.data?.leads) continue
        const updated = entry.data.leads.map(l =>
            (l.hid || l.id) === leadId ? { ...l, ...patch } : l
        )
        _set(key, { ...entry.data, leads: updated })
    }
}

/** Invalidate all caches (call after a new scrape completes). */
export function invalidateAll() {
    _clear()
}

/** Invalidate just the batch list (e.g. after a new scrape adds a batch). */
export function invalidateBatchList() {
    _del('batches')
}

/** Invalidate leads for one batch (e.g. after a pipeline change). */
export function invalidateBatchLeads(hid) {
    _del(`leads:${hid}`)
}
