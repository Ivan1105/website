<template>
  <Teleport to="body">
    <div ref="host">
      <div ref="source" hidden>
        <img v-for="(url, i) in images" :key="i" :src="url" :alt="`聊天图片 ${i + 1}`" />
      </div>
      <Teleport v-if="overlay" :to="overlay">
        <p v-if="status !== 'loaded'" class="preview-status" :class="{ 'preview-loading': status === 'loading' }" role="status">
          {{ status === 'loading' ? '图片加载中…' : '图片加载失败' }}
        </p>
        <p v-if="downloadError" class="preview-download-error" role="status">{{ downloadError }}</p>
        <div ref="controls" class="preview-controls" role="group" aria-label="图片预览控制">
          <template v-if="hasMultiple">
            <button type="button" aria-label="上一张图片" title="上一张图片" :disabled="index === 0" @click="viewer?.prev()">
              <v-icon icon="mdi-chevron-left" size="22" aria-hidden="true" />
            </button>
            <span class="preview-position" aria-live="polite">{{ index + 1 }} / {{ images.length }}</span>
            <button type="button" aria-label="下一张图片" title="下一张图片" :disabled="index === images.length - 1" @click="viewer?.next()">
              <v-icon icon="mdi-chevron-right" size="22" aria-hidden="true" />
            </button>
          </template>
          <button type="button" aria-label="缩小图片" title="缩小图片" :disabled="status !== 'loaded' || zoomLevel <= 1.001"
            @click="viewer?.zoom(-0.2)">
            <v-icon icon="mdi-magnify-minus-outline" size="20" aria-hidden="true" />
          </button>
          <button type="button" class="preview-reset" aria-label="恢复适配" title="恢复适配"
            :disabled="status !== 'loaded' || zoomLevel <= 1.001" @click="resetPreview">
            {{ Math.round(zoomLevel * 100) }}%
          </button>
          <button type="button" aria-label="放大图片" title="放大图片" :disabled="status !== 'loaded' || zoomLevel >= 3.999"
            @click="viewer?.zoom(0.2)">
            <v-icon icon="mdi-magnify-plus-outline" size="20" aria-hidden="true" />
          </button>
          <button type="button" aria-label="下载原图" :title="downloading ? '正在下载原图…' : '下载原图'"
            :disabled="status !== 'loaded' || downloading" @click="downloadOriginal">
            <v-progress-circular v-if="downloading" indeterminate size="18" width="2" aria-hidden="true" />
            <v-icon v-else icon="mdi-download-outline" size="20" aria-hidden="true" />
          </button>
          <button type="button" aria-label="关闭图片预览" title="关闭图片预览" @click="viewer?.hide()">
            <v-icon icon="mdi-close" size="20" aria-hidden="true" />
          </button>
        </div>
      </Teleport>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import Viewer from 'viewerjs'
import 'viewerjs/dist/viewer.css'
import { createChatImagePreviewMotion } from '@/utils/chat-image-preview-motion'

const props = defineProps<{
  images: readonly string[]
  thumbnails: readonly HTMLImageElement[]
  initialIndex: number
}>()
const emit = defineEmits<{ closed: [] }>()
const host = ref<HTMLDivElement | null>(null)
const source = ref<HTMLDivElement | null>(null)
const overlay = shallowRef<HTMLElement | null>(null)
const controls = ref<HTMLDivElement | null>(null)
const index = ref(props.initialIndex)
const status = ref<'loading' | 'loaded' | 'error'>('loading')
const zoomLevel = ref(1)
const downloading = ref(false)
const downloadError = ref('')
const hasMultiple = props.images.length > 1
const motion = createChatImagePreviewMotion()

let viewer: Viewer | undefined
let activeImage: HTMLImageElement | undefined
let fitRatio = 1
let zoomedIn = false
let swipeEnabled = hasMultiple
let shouldExpand = true
let closing = false
let allowImmediateHide = false
let disposing = false
let chromeStart: number | undefined

function clearChromeStart() {
  if (chromeStart !== undefined) window.clearTimeout(chromeStart)
  chromeStart = undefined
}

function setSwipeEnabled(enabled: boolean) {
  if (swipeEnabled === enabled) return
  swipeEnabled = enabled
  viewer?.update({ slideOnTouch: enabled })
}

function resetPreview() {
  viewer?.reset()
  zoomLevel.value = 1
  zoomedIn = false
  setSwipeEnabled(hasMultiple)
}

async function downloadOriginal() {
  const url = props.images[index.value]
  if (!url || downloading.value || status.value !== 'loaded') return
  downloading.value = true
  downloadError.value = ''
  try {
    const response = await fetch(url, { credentials: 'omit' })
    if (!response.ok) throw new Error('Download request failed')
    const file = await response.blob()
    const localUrl = URL.createObjectURL(file)
    const link = document.createElement('a')
    link.href = localUrl
    link.download = new URL(url, window.location.href).pathname.split('/').pop() || 'chat-image'
    document.body.appendChild(link)
    link.click()
    link.remove()
    window.setTimeout(() => URL.revokeObjectURL(localUrl), 1000)
  } catch {
    downloadError.value = '原图下载失败，请重试。'
  } finally {
    downloading.value = false
  }
}

function constrainPosition(x: number, y: number) {
  const canvas = activeImage?.parentElement
  if (!activeImage || !canvas || !zoomedIn) return
  const clamp = (value: number, gap: number) => gap >= 0 ? gap / 2 : Math.max(gap, Math.min(0, value))
  const left = clamp(x, canvas.clientWidth - parseFloat(activeImage.style.width))
  const top = clamp(y, canvas.clientHeight - parseFloat(activeImage.style.height))
  if (Math.abs(left - x) > 0.5 || Math.abs(top - y) > 0.5) return { left, top }
}

onMounted(() => {
  if (!source.value || !host.value) return
  viewer = new Viewer(source.value, {
    container: host.value,
    initialViewIndex: props.initialIndex,
    zIndex: 2400,
    // A hidden navbar still needs its image sources for Viewer.update().
    navbar: { show: false },
    title: false,
    navigation: false,
    toolbar: false,
    button: false,
    loop: false,
    preload: false,
    rotatable: false,
    scalable: false,
    slideOnTouch: hasMultiple,
    slideOnWheel: false,
    zoomRatio: 0.05,
    minZoomRatio: () => fitRatio,
    maxZoomRatio: () => fitRatio * 4,
    // We animate the image separately from the library's close lifecycle.
    transition: { hide: false, move: false, view: false, zoom: false },
    shown() {
      overlay.value = host.value?.querySelector<HTMLElement>('.viewer-container') ?? null
      if (!overlay.value) return
      overlay.value.removeAttribute('aria-labelledby')
      overlay.value.setAttribute('aria-label', '图片预览')
      motion.prepare(overlay.value)
      // Reveal the controls even if the original image takes time to load.
      chromeStart = window.setTimeout(() => {
        chromeStart = undefined
        motion.open(controls.value)
      }, 120)
    },
    hide(event) {
      if (allowImmediateHide) return
      if (closing) {
        event.preventDefault()
        return
      }
      clearChromeStart()
      const image = status.value === 'loaded' ? activeImage : undefined
      closing = motion.close(controls.value, image, props.thumbnails[index.value], () => {
        allowImmediateHide = true
        viewer?.hide(true)
      })
      if (closing) event.preventDefault()
    },
    hidden() {
      clearChromeStart()
      motion.cancel()
      if (!disposing) emit('closed')
    },
    view(event) {
      if (closing) {
        event.preventDefault()
        return
      }
      const { image, index: nextIndex, originalEvent } = event.detail
      if (nextIndex !== index.value) {
        shouldExpand = false
        const fromSwipe = originalEvent?.type === 'touchend'
          || (originalEvent instanceof PointerEvent && originalEvent.pointerType === 'touch' && originalEvent.type === 'pointerup')
        motion.startSwitch(status.value === 'loaded' ? activeImage : undefined, Math.sign(nextIndex - index.value), fromSwipe)
      } else {
        motion.cancelImage()
      }
      activeImage = image
      index.value = nextIndex
      status.value = 'loading'
      zoomLevel.value = 1
      downloadError.value = ''
      const showError = () => {
        if (activeImage !== image) return
        status.value = 'error'
        motion.finishSwitch()
      }
      if (image.complete && !image.naturalWidth) showError()
      else image.addEventListener('error', showError, { once: true })
    },
    viewed(event) {
      const { image } = event.detail
      if (!image.naturalWidth) {
        status.value = 'error'
        motion.finishSwitch()
        return
      }
      fitRatio = parseFloat(image.style.width) / image.naturalWidth
      zoomedIn = false
      setSwipeEnabled(hasMultiple)
      status.value = 'loaded'
      if (shouldExpand) {
        shouldExpand = false
        clearChromeStart()
        const thumbnail = props.thumbnails[index.value]
        void nextTick(() => {
          if (!closing && !disposing && activeImage === image) motion.open(controls.value, image, thumbnail)
        })
      } else {
        motion.finishSwitch(image)
      }
    },
    zoom(event) {
      if (closing) event.preventDefault()
      else motion.cancelImage()
    },
    zoomed(event) {
      zoomLevel.value = event.detail.ratio / fitRatio
      zoomedIn = event.detail.ratio > fitRatio + 0.001
      setSwipeEnabled(hasMultiple && !zoomedIn)
      if (!activeImage) return
      const bounds = constrainPosition(parseFloat(activeImage.style.marginLeft), parseFloat(activeImage.style.marginTop))
      if (bounds) viewer?.moveTo(bounds.left, bounds.top)
    },
    move(event) {
      if (closing) {
        event.preventDefault()
        return
      }
      motion.cancelImage()
      const bounds = constrainPosition(event.detail.x, event.detail.y)
      if (!bounds) return
      event.preventDefault()
      viewer?.moveTo(bounds.left, bounds.top)
    },
  })
  viewer.show(true)
})

onBeforeUnmount(() => {
  disposing = true
  allowImmediateHide = true
  clearChromeStart()
  motion.cancel()
  viewer?.destroy()
})
</script>

<style scoped>
.preview-status {
  position: absolute;
  z-index: 2;
  left: 50%;
  margin: 0;
  transform: translateX(-50%);
  color: #fff;
  font-size: 0.875rem;
  line-height: 1.4;
  pointer-events: none;
  top: 50%;
}

.preview-loading {
  margin-top: 28px;
}

.preview-controls {
  position: absolute;
  z-index: 2;
  bottom: max(32px, env(safe-area-inset-bottom));
  left: 50%;
  opacity: 0;
  display: flex;
  align-items: center;
  gap: 2px;
  padding: 4px;
  border: 1px solid rgb(255 255 255 / 25%);
  border-radius: 12px;
  background: rgb(24 30 30 / 95%);
  color: #fff;
  box-shadow: 0 4px 18px rgb(0 0 0 / 35%);
  transform: translateX(-50%);
  white-space: nowrap;
  font-size: 0.875rem;
  line-height: 1.4;
  font-variant-numeric: tabular-nums;
}

@media (prefers-reduced-motion: reduce) {
  .preview-controls {
    opacity: 1;
  }
}

.preview-controls button {
  display: grid;
  min-width: 36px;
  height: 36px;
  padding: 0 4px;
  place-items: center;
  border: 0;
  border-radius: 8px;
  background: transparent;
  color: inherit;
  cursor: pointer;
}

.preview-controls button:hover:not(:disabled),
.preview-controls button:focus-visible {
  background: rgb(255 255 255 / 16%);
}

.preview-controls button:disabled {
  opacity: 0.45;
  cursor: default;
}

.preview-position {
  min-width: 34px;
  text-align: center;
}

.preview-controls .preview-reset {
  min-width: 46px;
}

.preview-download-error {
  position: absolute;
  z-index: 2;
  bottom: calc(max(32px, env(safe-area-inset-bottom)) + 54px);
  left: 50%;
  max-width: calc(100% - 24px);
  margin: 0;
  padding: 6px 10px;
  transform: translateX(-50%);
  border-radius: 8px;
  background: rgb(24 30 30 / 95%);
  color: #fff;
  font-size: 0.875rem;
  line-height: 1.4;
}

@media (max-width: 360px) {
  .preview-controls {
    gap: 1px;
  }

  .preview-controls button {
    min-width: 32px;
  }

  .preview-controls .preview-reset {
    min-width: 42px;
  }
}
</style>
