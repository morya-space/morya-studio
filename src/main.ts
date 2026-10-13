import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import router from './router'
import { i18n } from './locales'
import { registerBuiltinCards } from './components/cards'
import 'virtual:uno.css'
import 'morya-ui/styles.css'
import './styles/app.css'
import 'virtual:svg-icons-register'

// 应用启动时注册内置卡片（供 SchemaRenderer 使用）
registerBuiltinCards()

const app = createApp(App)
const pinia = createPinia()

app.use(pinia)
app.use(router)
app.use(i18n)

app.mount('#app')
