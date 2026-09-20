import { ref } from 'vue'
import { login as requestLogin, logout as requestLogout, setUnauthorizedHandler } from '../services/api.js'

/**
 * Whether the household's password has been given. Unknown until the first
 * API call answers; false the moment any call comes back 401, which drops
 * the login screen over the app until the password is entered again.
 */
const locked = ref(false)

setUnauthorizedHandler(() => (locked.value = true))

async function login(password) {
  await requestLogin(password)
  // Start over with a fresh session rather than resuming half-loaded lists.
  location.reload()
}

async function logout() {
  await requestLogout()
  location.reload()
}

export function useAuth() {
  return { locked, login, logout }
}
