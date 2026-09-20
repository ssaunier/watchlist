import { createApp } from 'vue'
import App from './App.vue'
import { router } from './router.js'
import { i18n } from './i18n/index.js'
import './style.css'

createApp(App).use(i18n).use(router).mount('#app')
