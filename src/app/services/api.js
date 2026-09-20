/** The Worker's JSON API, same origin. Errors carry the server's message. */

let onUnauthorized = () => {}

/** Called on any 401, so the app can ask for the password. */
export function setUnauthorizedHandler(handler) {
  onUnauthorized = handler
}

export class UnauthorizedError extends Error {}

async function request(path, init = {}) {
  const response = await fetch(path, {
    ...init,
    headers: { Accept: 'application/json', ...(init.body ? { 'Content-Type': 'application/json' } : {}), ...init.headers }
  })
  const body = await response.json().catch(() => null)
  if (response.status === 401 && path !== '/api/login') {
    onUnauthorized()
    throw new UnauthorizedError(body?.error || 'unauthorized')
  }
  if (!response.ok) throw new Error(body?.error || `${response.status} ${response.statusText}`)
  return body
}

export function listMovies(status) {
  return request(`/api/movies?status=${encodeURIComponent(status)}`)
}

export function patchMovie(tmdbId, patch) {
  return request(`/api/movies/${tmdbId}`, { method: 'PATCH', body: JSON.stringify(patch) })
}

export function getStatus() {
  return request('/api/status')
}

export function login(password) {
  return request('/api/login', { method: 'POST', body: JSON.stringify({ password }) })
}

export function logout() {
  return request('/api/logout', { method: 'POST' })
}
