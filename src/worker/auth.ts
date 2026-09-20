/**
 * One shared password for the household, kept in the APP_PASSWORD secret.
 * The browser gets a cookie derived from the password (an HMAC, so the
 * cookie reveals nothing and changing the password signs everyone out);
 * scripts send the password itself as a bearer token.
 */

export const SESSION_COOKIE = 'watchlist_session'
const SESSION_MAX_AGE = 60 * 60 * 24 * 365
const SESSION_MESSAGE = 'watchlist session v1'

const encoder = new TextEncoder()

export async function sessionToken(password: string): Promise<string> {
  const key = await crypto.subtle.importKey('raw', encoder.encode(password), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(SESSION_MESSAGE))
  return [...new Uint8Array(signature)].map(byte => byte.toString(16).padStart(2, '0')).join('')
}

/** Compares in constant time, so a wrong guess takes as long as a nearly right one. */
export function safeEqual(a: string, b: string): boolean {
  const left = encoder.encode(a)
  const right = encoder.encode(b)
  let diff = left.length ^ right.length
  for (let i = 0; i < Math.max(left.length, right.length); i++) diff |= (left[i] ?? 0) ^ (right[i] ?? 0)
  return diff === 0
}

function cookieValue(request: Request, name: string): string | null {
  const header = request.headers.get('Cookie') ?? ''
  for (const part of header.split(';')) {
    const [key, ...rest] = part.trim().split('=')
    if (key === name) return rest.join('=')
  }
  return null
}

export async function isAuthorized(request: Request, password: string): Promise<boolean> {
  const bearer = request.headers.get('Authorization')?.match(/^Bearer\s+(.+)$/i)?.[1]
  if (bearer) return safeEqual(bearer, password)
  const cookie = cookieValue(request, SESSION_COOKIE)
  if (cookie) return safeEqual(cookie, await sessionToken(password))
  return false
}

/** `Secure` only over https: a phone on the local network talks to `vite dev` in plain http. */
export function sessionCookie(token: string, secure: boolean): string {
  return `${SESSION_COOKIE}=${token}; Path=/; Max-Age=${SESSION_MAX_AGE}; HttpOnly; SameSite=Lax${secure ? '; Secure' : ''}`
}

export function clearedSessionCookie(secure: boolean): string {
  return `${SESSION_COOKIE}=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax${secure ? '; Secure' : ''}`
}
