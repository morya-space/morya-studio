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
      info: 'var(--m-color-info)',
      success: 'var(--m-color-success)',
      warning: 'var(--m-color-warning)',
      danger: 'var(--m-color-danger)',
      surface: 'var(--m-color-surface)',
      'page-bg': 'var(--m-color-page-bg)',
      border: 'var(--m-color-border)',
      split: 'var(--m-color-split)',
      'fill-light': 'var(--m-color-fill-light)',
      'fill-lighter': 'var(--m-color-fill-lighter)',
      text: 'var(--m-color-text)',
      'text-muted': 'var(--m-color-text-muted)',
    },
  },
  shortcuts: {
    /** 主色图标芯片（页头 / 统计卡图标位），色值全部走 --m-* token */
    'chip-primary': 'flex flex-none items-center justify-center rounded-[var(--m-radius-lg)] bg-[color-mix(in_srgb,var(--m-color-primary)_12%,transparent)] text-primary',
  },
})
