/** "1 h 41" / "58 min": runtimes read as they do on a cinema listing. */
export function formatRuntime(minutes) {
  if (!minutes) return ''
  const hours = Math.floor(minutes / 60)
  const rest = minutes % 60
  if (!hours) return `${rest} min`
  return rest ? `${hours} h ${String(rest).padStart(2, '0')}` : `${hours} h`
}

/** "Korean, 1 h 41" then "Drama, Thriller": the two lines under a title. */
export function joinList(parts) {
  return parts.filter(Boolean).join(', ')
}
