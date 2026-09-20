import { env, exports } from 'cloudflare:workers'
import { beforeEach, describe, expect, it } from 'vitest'
import { safeEqual, sessionToken, SESSION_COOKIE } from '../../src/worker/auth.ts'
import { isLocalHost } from '../../src/worker/index.ts'
import { resetDb } from './fixtures.ts'

const worker = exports.default
const PASSWORD = 'open-sesame' // set in vitest.worker.config.ts

beforeEach(() => resetDb(env.DB))

describe('safeEqual', () => {
  it('compares strings without caring how far they match', () => {
    expect(safeEqual('grettir', 'grettir')).toBe(true)
    expect(safeEqual('grettir', 'grettiR')).toBe(false)
    expect(safeEqual('grettir', 'grettir ')).toBe(false)
    expect(safeEqual('', '')).toBe(true)
  })
})

describe('the door', () => {
  const login = (password: unknown, url = 'https://watchlist.test/api/login') =>
    worker.fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ password }) })

  it('refuses the API without the password', async () => {
    const api = await worker.fetch('https://watchlist.test/api/counts')
    expect(api.status).toBe(401)
    expect(await api.json()).toEqual({ error: 'unauthorized' })
  })

  it('sells a cookie for the password', async () => {
    const response = await login(PASSWORD)
    expect(response.status).toBe(200)
    const cookie = response.headers.get('Set-Cookie')!
    expect(cookie).toMatch(new RegExp(`^${SESSION_COOKIE}=${await sessionToken(PASSWORD)}; Path=/; Max-Age=\\d+; HttpOnly; SameSite=Lax; Secure$`))

    const counts = await worker.fetch('https://watchlist.test/api/counts', { headers: { Cookie: cookie.split(';')[0] } })
    expect(counts.status).toBe(200)
  })

  it('leaves Secure off over plain http, for a phone on the local network', async () => {
    const response = await login(PASSWORD, 'http://192.168.1.16:5173/api/login')
    expect(response.status).toBe(200)
    expect(response.headers.get('Set-Cookie')).not.toMatch(/Secure/)
  })

  it('refuses a wrong password, or none', async () => {
    for (const attempt of ['nope', '', 42, null]) {
      const response = await login(attempt)
      expect(response.status).toBe(401)
      expect(response.headers.get('Set-Cookie')).toBeNull()
    }
    expect((await worker.fetch('https://watchlist.test/api/login', { method: 'POST', body: 'not json' })).status).toBe(401)
  })

  it('accepts the password as a bearer token, for scripts', async () => {
    const response = await worker.fetch('https://watchlist.test/api/movies?status=watchlist', { headers: { Authorization: `Bearer ${PASSWORD}` } })
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual([])
    expect((await worker.fetch('https://watchlist.test/api/counts', { headers: { Authorization: 'Bearer nope' } })).status).toBe(401)
  })

  it('does not accept a stale cookie once the password changed', async () => {
    const old = await sessionToken('previous-password')
    const response = await worker.fetch('https://watchlist.test/api/counts', { headers: { Cookie: `${SESSION_COOKIE}=${old}` } })
    expect(response.status).toBe(401)
  })

  it('logs out by clearing the cookie', async () => {
    const response = await worker.fetch('https://watchlist.test/api/logout', { method: 'POST' })
    expect(response.status).toBe(200)
    expect(response.headers.get('Set-Cookie')).toMatch(new RegExp(`^${SESSION_COOKIE}=; Path=/; Max-Age=0`))
  })
})

describe('plain http', () => {
  it('is sent to https, for pages and the API alike', async () => {
    for (const path of ['/', '/watchlist', '/api/counts']) {
      const response = await worker.fetch(`http://watchlist.saunier.me${path}?x=1`, { redirect: 'manual' })
      expect(response.status).toBe(301)
      expect(response.headers.get('Location')).toBe(`https://watchlist.saunier.me${path}?x=1`)
    }
  })

  it('is left alone on this machine and on the home network', async () => {
    for (const host of ['localhost:5173', '127.0.0.1:5173', '192.168.1.16:5173', '10.0.0.2', '172.20.0.1']) {
      const response = await worker.fetch(`http://${host}/api/counts`, { headers: { Authorization: `Bearer ${PASSWORD}` } })
      expect(response.status).toBe(200)
    }
    expect(isLocalHost('172.32.0.1')).toBe(false)
    expect(isLocalHost('watchlist.saunier.me')).toBe(false)
  })

  it('answers 404 in JSON for an unknown API path, not the app’s page', async () => {
    const response = await worker.fetch('https://watchlist.saunier.me/api/nothing', { headers: { Authorization: `Bearer ${PASSWORD}` } })
    expect(response.status).toBe(404)
    expect(await response.json()).toEqual({ error: 'not found' })
  })
})
