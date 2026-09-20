import { createRouter, createWebHistory } from 'vue-router'
import NewView from './views/NewView.vue'
import WatchlistView from './views/WatchlistView.vue'
import WatchedView from './views/WatchedView.vue'
import ArchiveView from './views/ArchiveView.vue'

export const routes = [
  { path: '/', name: 'new', component: NewView },
  { path: '/watchlist', name: 'watchlist', component: WatchlistView },
  { path: '/watched', name: 'watched', component: WatchedView },
  { path: '/archive', name: 'archived', component: ArchiveView }
]

// Real paths rather than a hash router: the Worker serves index.html for any
// path that is not a file (see wrangler.jsonc), so every URL deep-links.
export const router = createRouter({
  history: createWebHistory(),
  routes,
  scrollBehavior(to, from, savedPosition) {
    return savedPosition || { top: 0 }
  }
})
