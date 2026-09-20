import { ref } from 'vue'

/** True on screens wide enough for a mouse and a grid; false on a phone. */
const query = typeof matchMedia === 'function' ? matchMedia('(min-width: 768px)') : null
const isDesktop = ref(query ? query.matches : false)
query?.addEventListener('change', event => (isDesktop.value = event.matches))

export function useBreakpoint() {
  return { isDesktop }
}
