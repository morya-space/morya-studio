<script setup lang="ts">
/**
 * 3D 地球卡（earth3D）
 * 对齐 go-view ThreeEarth01：three.js 线框球体 + 点云，可自转。
 * three 按需动态加载；颜色默认取 --m-color-primary（避免裸色）。
 */

import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import type * as THREE_NS from 'three'
import type { CardProps } from './types'

const props = defineProps<CardProps>()

const cfg = computed(() => props.schema.earth3D ?? {})

const container = ref<HTMLElement | null>(null)

let THREE: typeof THREE_NS | null = null
let renderer: THREE_NS.WebGLRenderer | null = null
let scene: THREE_NS.Scene | null = null
let camera: THREE_NS.PerspectiveCamera | null = null
let group: THREE_NS.Group | null = null
let raf = 0
let ro: ResizeObserver | null = null

function resolveColor(el: HTMLElement): string {
  if (cfg.value.color) return cfg.value.color
  const v = getComputedStyle(el).getPropertyValue('--m-color-primary').trim()
  return v || 'white'
}

async function init() {
  const el = container.value
  if (!el) return
  const T = THREE ?? (THREE = await import('three'))
  if (!container.value) return

  const width = el.clientWidth || 300
  const height = el.clientHeight || 300

  scene = new T.Scene()
  camera = new T.PerspectiveCamera(45, width / height, 0.1, 1000)
  camera.position.z = 3.2

  renderer = new T.WebGLRenderer({ alpha: true, antialias: true })
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
  renderer.setSize(width, height)
  el.appendChild(renderer.domElement)

  const color = new T.Color(resolveColor(el))
  group = new T.Group()

  const wire = new T.Mesh(
    new T.SphereGeometry(1, 32, 24),
    new T.MeshBasicMaterial({ color, wireframe: true, transparent: true, opacity: 0.28 }),
  )
  group.add(wire)

  const dotGeo = new T.BufferGeometry()
  const count = 600
  const positions = new Float32Array(count * 3)
  for (let i = 0; i < count; i++) {
    const theta = Math.acos(1 - 2 * (i + 0.5) / count)
    const phi = Math.PI * (1 + Math.sqrt(5)) * i
    positions[i * 3] = Math.sin(theta) * Math.cos(phi)
    positions[i * 3 + 1] = Math.sin(theta) * Math.sin(phi)
    positions[i * 3 + 2] = Math.cos(theta)
  }
  dotGeo.setAttribute('position', new T.BufferAttribute(positions, 3))
  group.add(new T.Points(dotGeo, new T.PointsMaterial({ color, size: 0.02 })))

  scene.add(group)

  const speed = Number(cfg.value.speed ?? 1)
  const animate = () => {
    raf = requestAnimationFrame(animate)
    if (group && camera && renderer) {
      if (cfg.value.autoRotate !== false) group.rotation.y += 0.0015 * speed
      renderer.render(scene, camera)
    }
  }
  animate()

  ro = new ResizeObserver(() => {
    if (!renderer || !camera || !container.value) return
    const w = container.value.clientWidth || 1
    const h = container.value.clientHeight || 1
    camera.aspect = w / h
    camera.updateProjectionMatrix()
    renderer.setSize(w, h)
  })
  ro.observe(el)
}

onMounted(() => { void init() })

onBeforeUnmount(() => {
  cancelAnimationFrame(raf)
  ro?.disconnect()
  ro = null
  group?.traverse(obj => {
    const mesh = obj as THREE_NS.Mesh
    mesh.geometry?.dispose?.()
    const mat = mesh.material as THREE_NS.Material | THREE_NS.Material[] | undefined
    if (Array.isArray(mat)) mat.forEach(m => m.dispose())
    else mat?.dispose?.()
  })
  renderer?.dispose()
  if (renderer?.domElement.parentElement) renderer.domElement.parentElement.removeChild(renderer.domElement)
  renderer = null
  scene = null
  camera = null
  group = null
})
</script>

<template>
  <div ref="container" class="earth-card" />
</template>

<style lang="scss" scoped>
.earth-card {
  height: 100%;
  width: 100%;
  overflow: hidden;
}
</style>
