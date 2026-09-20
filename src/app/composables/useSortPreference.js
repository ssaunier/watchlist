import { reactive, computed } from 'vue'
import { loadSorts, saveSorts } from '../services/storage.js'

/** Which sort each list was left on, remembered per device. */
const sorts = reactive(loadSorts())

export function useSortPreference(list, options) {
  const sort = computed({
    get: () => (options.includes(sorts[list]) ? sorts[list] : options[0]),
    set: value => {
      if (!options.includes(value)) return
      sorts[list] = value
      saveSorts({ ...sorts })
    }
  })
  return { sort, options }
}
