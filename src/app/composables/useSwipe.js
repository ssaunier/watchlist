import { computed, reactive } from 'vue'

export const KEEP = 'keep'
export const PASS = 'pass'

/** How far, as a share of the card's width, a card must travel to count. */
export const THRESHOLD = 0.32

/** What a release at `dx` pixels means for a card `width` pixels wide. */
export function decide(dx, width, threshold = THRESHOLD) {
  if (width <= 0) return null
  if (dx > width * threshold) return KEEP
  if (dx < -width * threshold) return PASS
  return null
}

const clamp = (value, min, max) => Math.min(max, Math.max(min, value))

/**
 * The gesture behind the deck: drag the top card, tilt it as it goes, show
 * the "keep" or "pass" stamp as it nears the edge, and either fly it off or
 * spring it back on release. `onDecide(direction)` fires once the card is
 * gone. The same fly-off serves the buttons, so a tap and a swipe end alike.
 */
export function useSwipe(onDecide, { flyDuration = 320 } = {}) {
  const state = reactive({ dx: 0, dy: 0, width: 0, dragging: false, leaving: null, pointerId: null, startX: 0, startY: 0 })

  const progress = computed(() => (state.width ? clamp(state.dx / (state.width * THRESHOLD), -1, 1) : 0))
  const keepOpacity = computed(() => clamp(progress.value, 0, 1))
  const passOpacity = computed(() => clamp(-progress.value, 0, 1))

  const style = computed(() => {
    const rotate = state.width ? (state.dx / state.width) * 14 : 0
    return {
      transform: `translate(${state.dx}px, ${state.dy}px) rotate(${rotate}deg)`,
      transition: state.dragging ? 'none' : `transform ${state.leaving ? flyDuration : 260}ms ${state.leaving ? 'ease-in' : 'cubic-bezier(.2,.9,.3,1.2)'}`
    }
  })

  function reset() {
    Object.assign(state, { dx: 0, dy: 0, dragging: false, leaving: null, pointerId: null })
  }

  function flyOut(direction) {
    if (state.leaving) return
    const reduced = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches
    state.leaving = direction
    state.dragging = false
    const distance = (state.width || 400) * 1.6
    state.dx = direction === KEEP ? distance : -distance
    state.dy = state.dy * 0.5
    setTimeout(() => {
      onDecide(direction)
      reset()
    }, reduced ? 0 : flyDuration)
  }

  function onPointerDown(event) {
    if (state.leaving || (event.pointerType === 'mouse' && event.button !== 0)) return
    state.width = event.currentTarget.getBoundingClientRect().width
    state.pointerId = event.pointerId
    state.startX = event.clientX
    state.startY = event.clientY
    state.dragging = true
    event.currentTarget.setPointerCapture?.(event.pointerId)
  }

  function onPointerMove(event) {
    if (!state.dragging || event.pointerId !== state.pointerId) return
    state.dx = event.clientX - state.startX
    state.dy = (event.clientY - state.startY) * 0.35
  }

  function onPointerUp(event) {
    if (!state.dragging || event.pointerId !== state.pointerId) return
    const direction = decide(state.dx, state.width)
    if (direction) flyOut(direction)
    else reset()
  }

  /** True while a drag has clearly started: a tap on the card should not also count as a click. */
  const moved = computed(() => Math.abs(state.dx) > 6 || Math.abs(state.dy) > 6)

  return {
    state,
    style,
    keepOpacity,
    passOpacity,
    moved,
    flyOut,
    handlers: { pointerdown: onPointerDown, pointermove: onPointerMove, pointerup: onPointerUp, pointercancel: onPointerUp }
  }
}
