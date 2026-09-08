import { createWiseKit } from '@wise-kit/ui'
import { createApp } from 'vue'
import App from './App.vue'
import router from './router'
import '@wise-kit/ui/styles.css'
import './styles/index.css'

createApp(App).use(router).use(createWiseKit()).mount('#app')
