import { describe, expect, it, vi } from 'vitest'
import { decide, useSwipe, KEEP, PASS } from '../../src/app/composables/useSwipe.js'

describe('decide', () => {
  it('needs a third of the width either way', () => {
    expect(decide(150, 360)).toBe(KEEP)
    expect(decide(-150, 360)).toBe(PASS)
    expect(decide(100, 360)).toBeNull()
    expect(decide(-100, 360)).toBeNull()
    expect(decide(150, 0)).toBeNull()
  })
})

function pointer(overrides) {
  return { pointerId: 1, pointerType: 'touch', button: 0, clientX: 100, clientY: 300, currentTarget: { getBoundingClientRect: () => ({ width: 360 }), setPointerCapture() {} }, ...overrides }
}

describe('useSwipe', () => {
  it('tilts the card as it drags and springs back from a short drag', () => {
    const onDecide = vi.fn()
    const swipe = useSwipe(onDecide)
    swipe.handlers.pointerdown(pointer({}))
    swipe.handlers.pointermove(pointer({ clientX: 160, clientY: 320 }))
    expect(swipe.style.value.transform).toMatch(/translate\(60px, 7px\) rotate\(2\.33/)
    expect(swipe.moved.value).toBe(true)
    expect(swipe.keepOpacity.value).toBeCloseTo(60 / (360 * 0.32))
    swipe.handlers.pointerup(pointer({ clientX: 160 }))
    expect(onDecide).not.toHaveBeenCalled()
    expect(swipe.style.value.transform).toBe('translate(0px, 0px) rotate(0deg)')
  })

  it('flies off and reports the direction after a long drag', () => {
    vi.useFakeTimers()
    const onDecide = vi.fn()
    const swipe = useSwipe(onDecide)
    swipe.handlers.pointerdown(pointer({}))
    swipe.handlers.pointermove(pointer({ clientX: -100 }))
    swipe.handlers.pointerup(pointer({ clientX: -100 }))
    expect(swipe.state.leaving).toBe(PASS)
    expect(swipe.passOpacity.value).toBe(1)
    vi.runAllTimers()
    expect(onDecide).toHaveBeenCalledWith(PASS)
    expect(swipe.state.leaving).toBeNull()
    vi.useRealTimers()
  })

  it('lets a button fly the card the same way, once', () => {
    vi.useFakeTimers()
    const onDecide = vi.fn()
    const swipe = useSwipe(onDecide)
    swipe.flyOut(KEEP)
    swipe.flyOut(PASS)
    vi.runAllTimers()
    expect(onDecide).toHaveBeenCalledTimes(1)
    expect(onDecide).toHaveBeenCalledWith(KEEP)
    vi.useRealTimers()
  })

  it('ignores a pointer that is not the one being dragged, and secondary mouse buttons', () => {
    const swipe = useSwipe(vi.fn())
    swipe.handlers.pointerdown(pointer({ pointerType: 'mouse', button: 2 }))
    expect(swipe.state.dragging).toBe(false)
    swipe.handlers.pointerdown(pointer({}))
    swipe.handlers.pointermove(pointer({ pointerId: 2, clientX: 300 }))
    expect(swipe.state.dx).toBe(0)
  })
})
