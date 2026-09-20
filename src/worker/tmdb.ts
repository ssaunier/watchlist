/**
 * The thin slice of TMDB this app reads. Two calls: the discover feed that
 * lists what reached cinemas in a country, and the details of one film.
 * https://developer.themoviedb.org/reference
 */

const API = 'https://api.themoviedb.org/3'

/** A film as the discover feed lists it. `release_date` is the regional date when `region` was passed. */
export interface DiscoverMovie {
  id: number
  title: string
  original_title: string
  original_language: string
  overview: string
  genre_ids: number[]
  poster_path: string | null
  release_date: string
  vote_average: number
  vote_count: number
  popularity: number
}

export interface DiscoverPage {
  page: number
  total_pages: number
  total_results: number
  results: DiscoverMovie[]
}

export interface Video {
  key: string
  site: string
  type: string
  iso_639_1: string
  official?: boolean
  published_at?: string
}

export interface ReleaseDate {
  type: number
  release_date: string
  note?: string
}

/** Details with the two sub-resources the sync appends. */
export interface MovieDetails {
  id: number
  title: string
  original_title: string
  original_language: string
  overview: string
  genres: { id: number; name: string }[]
  runtime: number | null
  poster_path: string | null
  release_date: string
  vote_average: number
  vote_count: number
  videos?: { results: Video[] }
  release_dates?: { results: { iso_3166_1: string; release_dates: ReleaseDate[] }[] }
}

export interface DiscoverParams {
  region: string
  from: string
  to: string
  page?: number
  language?: string
}

export interface MovieParams {
  /** Language of the titles, overview and genre names. */
  language?: string
  /** The film's own language, so its original-version trailer is included. */
  originalLanguage?: string
}

export interface TmdbClient {
  discover(params: DiscoverParams): Promise<DiscoverPage>
  movie(id: number, params?: MovieParams): Promise<MovieDetails>
}

/** Theatrical (3) before limited theatrical (2): with `region`, the first matching type is the date returned. */
const RELEASE_TYPES = '3|2'

export function createTmdbClient(token: string, fetchImpl: typeof fetch = fetch): TmdbClient {
  async function get<T>(path: string, query: Record<string, string>): Promise<T> {
    const url = new URL(`${API}${path}`)
    for (const [key, value] of Object.entries(query)) url.searchParams.set(key, value)
    const response = await fetchImpl(url, {
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' }
    })
    if (!response.ok) throw new Error(`TMDB returned ${response.status} for ${path}`)
    return response.json() as Promise<T>
  }

  return {
    discover({ region, from, to, page = 1, language = 'fr-FR' }) {
      return get<DiscoverPage>('/discover/movie', {
        region,
        language,
        with_release_type: RELEASE_TYPES,
        'release_date.gte': from,
        'release_date.lte': to,
        sort_by: 'popularity.desc',
        include_adult: 'false',
        include_video: 'false',
        page: String(page)
      })
    },

    movie(id, { language = 'fr-FR', originalLanguage } = {}) {
      // Trailers are filed under the language they are spoken in; without
      // this only `language`'s trailers come back, i.e. the French dub.
      const videoLanguages = new Set([originalLanguage, 'en', language.split('-')[0], 'null'].filter(Boolean) as string[])
      return get<MovieDetails>(`/movie/${id}`, {
        language,
        append_to_response: 'videos,release_dates',
        include_video_language: [...videoLanguages].join(',')
      })
    }
  }
}
