import { ref } from 'vue'

/** Which film the sheet shows, and which trailer plays, for a view. */
export function useSheet() {
  const selected = ref(null)
  const trailer = ref(null)

  return {
    selected,
    trailer,
    open: movie => (selected.value = movie),
    close: () => (selected.value = null),
    playTrailer: movie => (trailer.value = movie),
    stopTrailer: () => (trailer.value = null)
  }
}
