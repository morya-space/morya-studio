<script setup lang="ts">
/**
 * 文本卡（text）
 * 渲染轻量 Markdown / 纯文本内容。内容属用户数据，非 i18n。
 */

import { computed } from 'vue'
import CardShell from './CardShell.vue'
import type { CardProps, CardEmits } from './types'

const props = defineProps<CardProps>()
const emit = defineEmits<CardEmits>()

function escapeHtml(input: string): string {
  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

/** 行内样式：code / 粗体 / 斜体 / 链接 */
function inline(text: string): string {
  return text
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/\*([^*]+)\*/g, '<em>$1</em>')
    .replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>')
}

/** 轻量 Markdown → 安全 HTML（先转义再应用样式） */
function renderMarkdown(content: string): string {
  const lines = escapeHtml(content).split('\n')
  const out: string[] = []
  let listType: 'ul' | 'ol' | null = null

  const closeList = () => {
    if (listType) {
      out.push(`</${listType}>`)
      listType = null
    }
  }

  for (const raw of lines) {
    const line = raw.trimEnd()
    if (line.trim() === '') {
      closeList()
      continue
    }

    const heading = /^(#{1,4})\s+(.*)$/.exec(line)
    if (heading) {
      closeList()
      const level = heading[1].length
      out.push(`<h${level}>${inline(heading[2])}</h${level}>`)
      continue
    }

    const ul = /^[-*]\s+(.*)$/.exec(line)
    const ol = /^\d+[.)]\s+(.*)$/.exec(line)
    if (ul || ol) {
      const type = ul ? 'ul' : 'ol'
      if (listType !== type) {
        closeList()
        out.push(`<${type}>`)
        listType = type
      }
      out.push(`<li>${inline((ul ?? ol)![1])}</li>`)
      continue
    }

    closeList()
    out.push(`<p>${inline(line)}</p>`)
  }
  closeList()
  return out.join('\n')
}

const rendered = computed(() => {
  const content = props.schema.text?.content ?? ''
  if (!content) return ''
  return props.schema.text?.markdown === false ? escapeHtml(content) : renderMarkdown(content)
})

const textStyle = computed(() => {
  const t = props.schema.text ?? {}
  const style: Record<string, string> = {}
  if (t.fontSize) style.fontSize = `${t.fontSize}px`
  if (t.color) style.color = t.color
  if (t.align) style.textAlign = t.align
  if (t.fontWeight) style.fontWeight = t.fontWeight
  if (t.letterSpacing) style.letterSpacing = `${t.letterSpacing}px`
  if (t.backgroundColor) style.background = t.backgroundColor
  if (t.borderWidth) style.border = `${t.borderWidth}px solid ${t.borderColor ?? 'var(--m-color-border)'}`
  if (t.borderRadius) style.borderRadius = `${t.borderRadius}px`
  if (t.gradient) {
    style.backgroundImage = t.color ? `linear-gradient(90deg, ${t.color}, transparent)` : 'var(--m-gradient-brand)'
    style['-webkit-background-clip'] = 'text'
    style.backgroundClip = 'text'
    style.color = 'transparent'
  }
  return style
})
</script>

<template>
  <CardShell
    :title="schema.title"
    :subtitle="schema.subtitle"
    :loading="loading"
    :error="error"
    :empty="!rendered"
    :state-text="schema.stateText"
    :actions="schema.actions"
    @retry="emit('retry')"
    @action="emit('action', $event)"
  >
    <a
      v-if="schema.text?.link"
      class="text-card text-card--link"
      :style="textStyle"
      :href="schema.text.link"
      target="_blank"
      rel="noopener noreferrer"
      v-html="rendered"
    />
    <div v-else class="text-card" :style="textStyle" v-html="rendered" />
  </CardShell>
</template>

<style scoped>
.text-card {
  display: block;
  font-size: 14px;
  line-height: 1.7;
  color: var(--m-color-text);
  word-break: break-word;
  text-decoration: none;
}

.text-card--link:hover {
  opacity: 0.85;
}

.text-card :deep(h1),
.text-card :deep(h2),
.text-card :deep(h3),
.text-card :deep(h4) {
  margin: 0.6em 0 0.3em;
  font-weight: 700;
  color: var(--m-color-text);
}

.text-card :deep(h1) { font-size: 22px; }
.text-card :deep(h2) { font-size: 18px; }
.text-card :deep(h3) { font-size: 16px; }
.text-card :deep(h4) { font-size: 14px; }

.text-card :deep(p) {
  margin: 0.4em 0;
}

.text-card :deep(ul),
.text-card :deep(ol) {
  margin: 0.4em 0;
  padding-left: 1.4em;
}

.text-card :deep(code) {
  padding: 1px 6px;
  border-radius: var(--m-radius-xs, 4px);
  background: var(--m-color-fill-light);
  color: var(--m-color-text);
  font-family: var(--m-font-mono, monospace);
  font-size: 0.9em;
}

.text-card :deep(a) {
  color: var(--m-color-primary);
}
</style>
