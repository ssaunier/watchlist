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
  it('captions with the release for a film to watch and the rating for a watched one', () => {
    expect(render(PosterTile, { movie }).text()).toMatch(/Sham.*ago|Sham.*in \d/)
    expect(render(PosterTile, { movie: { ...movie, status: 'watched', rating: 7 } }).text()).toContain('7/10')
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
