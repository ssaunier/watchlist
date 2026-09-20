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
