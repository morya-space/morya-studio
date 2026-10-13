import { defineConfig, presetWind4, presetIcons } from 'unocss'

export default defineConfig({
  presets: [
    presetWind4(),
    presetIcons({
      scale: 1.2,
      extraProperties: {
        'display': 'inline-block',
        'vertical-align': 'middle',
      },
    }),
  ],
  theme: {
    colors: {
      primary: 'var(--m-color-primary)',
      surface: 'var(--m-color-surface)',
      split: 'var(--m-color-split)',
      'text-muted': 'var(--m-color-text-muted)',
    },
  },
})
