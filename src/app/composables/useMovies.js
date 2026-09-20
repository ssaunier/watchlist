import { reactive, ref, computed } from 'vue'
import { listMovies, patchMovie, getStatus, UnauthorizedError } from '../services/api.js'

/**
 * One store for the four lists, shared by every view. A list is fetched the
 * first time its view asks for it and again after it has been invalidated:
 * moving a film out of a list removes it there on the spot, while the list
 * it moves into is simply forgotten and refetched on the next visit.
 */
const lists = reactive({ new: null, watchlist: null, watched: null, archived: null })
const loading = reactive({ new: false, watchlist: false, watched: false, archived: false })
const counts = reactive({ new: 0, watchlist: 0, watched: 0, archived: 0 })
const lastSync = ref(null)
const countries = ref('')
const error = ref(null)

async function load(status, { force = false } = {}) {
  if (lists[status] && !force) return lists[status]
  loading[status] = true
  error.value = null
  try {
    lists[status] = await listMovies(status)
    counts[status] = lists[status].length
    return lists[status]
  } catch (e) {
    if (!(e instanceof UnauthorizedError)) error.value = e.message
    throw e
  } finally {
    loading[status] = false
  }
}

async function refreshStatus() {
  try {
    const status = await getStatus()
    Object.assign(counts, status.counts)
    lastSync.value = status.lastSync
    countries.value = status.countries
  } catch (e) {
    if (!(e instanceof UnauthorizedError)) error.value = e.message
  }
}

function remove(status, tmdbId) {
  if (!lists[status]) return
  const index = lists[status].findIndex(movie => movie.tmdbId === tmdbId)
  if (index >= 0) lists[status].splice(index, 1)
}

/**
 * Moves a film to another list, optimistically: it leaves the current list
 * before the server answers and comes back if the server refuses.
 */
async function move(movie, status, extra = {}) {
  const from = movie.status
  const snapshot = lists[from] ? [...lists[from]] : null
  remove(from, movie.tmdbId)
  counts[from] = Math.max(0, counts[from] - 1)
  counts[status] += 1
  lists[status] = null
  try {
    const updated = await patchMovie(movie.tmdbId, { status, ...extra })
    Object.assign(movie, updated)
    return updated
  } catch (e) {
    if (snapshot) lists[from] = snapshot
    counts[from] += 1
    counts[status] = Math.max(0, counts[status] - 1)
    error.value = e.message
    throw e
  }
}

/**
 * Puts a film just decided on back at the top of New. Unlike `move`, the
 * list is edited in place rather than forgotten, so the card reappears
 * where it was without a reload.
 */
async function undo(movie) {
  const from = movie.status
  const updated = await patchMovie(movie.tmdbId, { status: 'new' })
  Object.assign(movie, updated)
  remove(from, movie.tmdbId)
  counts[from] = Math.max(0, counts[from] - 1)
  counts.new += 1
  if (lists.new && !lists.new.some(entry => entry.tmdbId === movie.tmdbId)) lists.new.unshift(movie)
  return updated
}

/** Edits the rating or note of a film in place, without moving it. */
async function update(movie, patch) {
  const updated = await patchMovie(movie.tmdbId, patch)
  Object.assign(movie, updated)
  return updated
}

export function useMovies() {
  return {
    lists,
    loading,
    counts,
    lastSync,
    countries,
    error,
    load,
    refreshStatus,
    move,
    undo,
    update,
    archivedCount: computed(() => counts.archived)
  }
}
