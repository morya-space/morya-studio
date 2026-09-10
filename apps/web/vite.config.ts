import vue from '@vitejs/plugin-vue'
import UnoCSS from 'unocss/vite'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [vue(), UnoCSS()],
  resolve: {
    dedupe: ['vue'],
  },
  server: {
    port: 5181,
    strictPort: true,
  },
})
