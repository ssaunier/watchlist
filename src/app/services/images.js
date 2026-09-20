/** TMDB serves posters from its own CDN; no key needed. */
export function posterUrl(posterPath, size = 'w500') {
  return posterPath ? `https://image.tmdb.org/t/p/${size}${posterPath}` : null
}

/**
 * The privacy-enhanced embed host: no cookies until the person presses
 * play. It does not remove YouTube's ads; only a Premium account or a
 * blocker does that.
 */
export function trailerEmbedUrl(youtubeKey) {
  return youtubeKey ? `https://www.youtube-nocookie.com/embed/${youtubeKey}?autoplay=1&playsinline=1&rel=0` : null
}

export function trailerUrl(youtubeKey) {
  return youtubeKey ? `https://www.youtube.com/watch?v=${youtubeKey}` : null
}

/**
 * When TMDB has no trailer on file (common for small French releases), a
 * YouTube search for the original title, its year and "trailer" in the
 * UI's language finds the distributor's upload most of the time.
 */
export function trailerSearchUrl(movie, locale) {
  const year = (movie.primaryReleaseDate || movie.releases?.[0]?.date || '').slice(0, 4)
  const word = locale === 'fr' ? 'bande-annonce' : 'trailer'
  const query = [movie.originalTitle || movie.title, year, word].filter(Boolean).join(' ')
  return `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`
}

export function allocineUrl(allocineId) {
  return allocineId ? `https://www.allocine.fr/film/fichefilm_gen_cfilm=${allocineId}.html` : null
}
