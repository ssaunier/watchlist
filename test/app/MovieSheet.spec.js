import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import { i18n } from '../../src/app/i18n/index.js'
import MovieSheet from '../../src/app/components/MovieSheet.vue'
import PosterTile from '../../src/app/components/PosterTile.vue'
import NewTile from '../../src/app/components/NewTile.vue'

const movie = {
  tmdbId: 1,
  title: 'Sham',
  originalTitle: '샴',
  originalLanguage: 'ko',
  overview: 'A short synopsis.',
  genres: [{ id: 53, name: 'Thriller' }, { id: 424242, name: 'Genre inconnu' }],
  runtime: 101,
  posterPath: '/p.jpg',
  primaryReleaseDate: '2026-09-16',
  trailerYoutubeKey: 'abc',
  voteCount: 3,
  releases: [{ country: 'FR', date: '2026-09-16', type: 3 }],
  status: 'new',
  rating: null,
  note: null,
  watchedAt: null
}

// jsdom has no <dialog> implementation of showModal.
HTMLDialogElement.prototype.showModal ??= function () { this.setAttribute('open', '') }
HTMLDialogElement.prototype.close ??= function () { this.removeAttribute('open') }

function render(component, props, locale = 'en', slots = {}) {
  i18n.global.locale.value = locale
  return mount(component, { props, global: { plugins: [i18n] }, slots, attachTo: document.body })
}

describe('MovieSheet', () => {
  it('shows the film’s language, original title, runtime, genres and synopsis, and offers the trailer', async () => {
    const wrapper = render(MovieSheet, { movie: null }, 'en', { default: '<button>Act</button>' })
    await wrapper.setProps({ movie })
    const text = wrapper.text()
    expect(text).toContain('Korean, 1 h 41')
    expect(text).toContain('Thriller, Genre inconnu')
    expect(text).toContain('샴')
    expect(text).toContain('A short synopsis.')
    expect(text).toContain('In cinemas Sep 16, 2026')
    expect(text).toContain('Act')
    await wrapper.find('button').trigger('click')
    expect(wrapper.emitted('trailer')[0][0]).toEqual(movie)
    wrapper.unmount()
  })

  it('offers a YouTube search when TMDB has no trailer, above the synopsis', async () => {
    const wrapper = render(MovieSheet, { movie: null }, 'fr')
    await wrapper.setProps({ movie: { ...movie, trailerYoutubeKey: null } })
    const link = wrapper.find('a[target="_blank"]')
    expect(link.attributes('href')).toBe('https://www.youtube.com/results?search_query=%EC%83%B4%202026%20bande-annonce')
    expect(link.text()).toContain('Chercher la bande-annonce')
    const html = wrapper.html()
    expect(html.indexOf('bande-annonce')).toBeLessThan(html.indexOf('A short synopsis.'))
    wrapper.unmount()
  })

  it('shows Allociné’s ratings in the reader’s number format, with a link to the page', async () => {
    const wrapper = render(MovieSheet, { movie: null }, 'fr')
    await wrapper.setProps({ movie: { ...movie, pressRating: 3.9, publicRating: 3.8, allocineId: 1000018854 } })
    expect(wrapper.text()).toMatch(/3,9\s*presse/)
    expect(wrapper.text()).toMatch(/3,8\s*spectateurs/)
    expect(wrapper.find('a[href="https://www.allocine.fr/film/fichefilm_gen_cfilm=1000018854.html"]').exists()).toBe(true)
    wrapper.unmount()

    const english = render(MovieSheet, { movie: null }, 'en')
    await english.setProps({ movie: { ...movie, pressRating: 3.9, publicRating: null } })
    expect(english.text()).toMatch(/3\.9\s*press/)
    expect(english.text()).not.toContain('audience')
    english.unmount()
  })

  it('speaks French, with a capitalised language name', async () => {
    const wrapper = render(MovieSheet, { movie: null }, 'fr')
    await wrapper.setProps({ movie })
    expect(wrapper.text()).toContain('Coréen, 1 h 41')
    expect(wrapper.text()).toContain('En salle le 16 sept. 2026')
    wrapper.unmount()
  })

  it('shows the rating, the date and the note once watched', async () => {
    const wrapper = render(MovieSheet, { movie: null })
    await wrapper.setProps({ movie: { ...movie, status: 'watched', rating: 8, watchedAt: '2026-10-02T20:00:00Z', note: 'Loved it' } })
    expect(wrapper.text()).toContain('8 out of 10')
    expect(wrapper.text()).toContain('Watched Oct 2, 2026')
    expect(wrapper.text()).toContain('Loved it')
    wrapper.unmount()
  })
})

describe('PosterTile', () => {
  it('captions with the language, runtime and genres for a film to watch and the rating for a watched one', () => {
    const toWatch = render(PosterTile, { movie: { ...movie, status: 'watchlist' } }).text()
    expect(toWatch).toContain('Korean, 1 h 41')
    expect(toWatch).toContain('Thriller, Genre inconnu')
    const watched = render(PosterTile, { movie: { ...movie, status: 'watched', rating: 7 } }).text()
    expect(watched).toContain('7/10')
    expect(watched).not.toContain('Korean')
  })

  it('emits the film when tapped', async () => {
    const wrapper = render(PosterTile, { movie })
    await wrapper.find('button').trigger('click')
    expect(wrapper.emitted('select')[0][0]).toEqual(movie)
  })
})

describe('NewTile', () => {
  it('opens on the poster and decides with the buttons', async () => {
    const wrapper = render(NewTile, { movie })
    const buttons = wrapper.findAll('button')
    await buttons[0].trigger('click')
    await buttons[1].trigger('click')
    await buttons[2].trigger('click')
    expect(wrapper.emitted('open')).toHaveLength(1)
    expect(wrapper.emitted('pass')).toHaveLength(1)
    expect(wrapper.emitted('keep')).toHaveLength(1)
    expect(wrapper.text()).toContain('Korean, 1 h 41')
  })
})
