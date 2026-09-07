import { createRoostDesign } from '@roost-design/ui'
import { createApp } from 'vue'
import App from './App.vue'
import router from './router'
import '@roost-design/ui/styles.css'
import './styles/index.css'

createApp(App).use(router).use(createRoostDesign()).mount('#app')
