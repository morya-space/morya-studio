import { createMoryaUI } from 'morya-ui'
import { createApp } from 'vue'
import App from './App.vue'
import router from './router'
import { restoreSession } from './services/auth'
import 'morya-ui/styles.css'
import './styles/index.css'
import 'virtual:uno.css'

await restoreSession()
createApp(App).use(router).use(createMoryaUI()).mount('#app')
