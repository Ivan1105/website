<template>
  <section class="map-picker">
    <div class="map-heading">
      <div>
        <h3>地图定位</h3>
        <p>点击地图或拖动标记，可自动回填经纬度（高德 GCJ-02 坐标）。</p>
      </div>
      <v-btn
        v-if="hasPosition"
        :href="amapMarkerUrl"
        target="_blank"
        rel="noopener noreferrer"
        variant="text"
        size="small"
        prepend-icon="mdi-map-marker-outline"
      >在高德地图打开</v-btn>
    </div>

    <v-alert v-if="!isConfigured" type="info" variant="tonal" density="compact">
      配置 NUXT_PUBLIC_AMAP_KEY，并设置安全密钥或服务代理后即可显示地图。
    </v-alert>
    <v-alert v-else-if="loadError" type="error" variant="tonal" density="compact">
      {{ loadError }}
    </v-alert>
    <div v-else class="map-frame">
      <div ref="mapContainer" class="map-container" aria-label="场地地图定位" />
      <div v-if="loading" class="map-state">
        <v-progress-circular indeterminate color="primary" size="28" width="3" />
        正在加载地图…
      </div>
      <div v-else-if="!hasPosition" class="map-tip">点击地图选择场地位置</div>
    </div>
  </section>
</template>

<script setup lang="ts">
import {
  loadAMap,
  type AMapMap,
  type AMapMarker,
  type AMapPosition,
  type AMapPositionEvent,
} from '@/utils/amap'

const latitude = defineModel<number | null>('latitude', { required: true })
const longitude = defineModel<number | null>('longitude', { required: true })
const props = defineProps<{ name?: string }>()
const runtimeConfig = useRuntimeConfig()
const mapContainer = shallowRef<HTMLElement | null>(null)
const loading = shallowRef(false)
const loadError = shallowRef<string | null>(null)
let map: AMapMap | null = null
let marker: AMapMarker | null = null

const amapConfig = runtimeConfig.public.amap
const isConfigured = !!amapConfig.key && (!!amapConfig.securityJsCode || !!amapConfig.serviceHost)
const hasPosition = computed(() => isCoordinate(longitude.value, -180, 180) && isCoordinate(latitude.value, -90, 90))
const currentPosition = computed<AMapPosition | null>(() => hasPosition.value ? [Number(longitude.value), Number(latitude.value)] : null)
const amapMarkerUrl = computed(() => {
  const position = currentPosition.value
  if (!position) return ''
  const params = new URLSearchParams({
    position: `${position[0]},${position[1]}`,
    name: props.name?.trim() || '场地位置',
    coordinate: 'gaode',
    callnative: '0',
  })
  return `https://uri.amap.com/marker?${params.toString()}`
})

onMounted(() => {
  if (isConfigured) void initializeMap()
})

watch(currentPosition, (position) => {
  if (!map || !marker || !position) return
  marker.setPosition(position)
  map.setCenter(position)
})

onBeforeUnmount(() => {
  if (map) map.off('click', selectPosition)
  if (marker) marker.off('dragend', selectPosition)
  map?.destroy()
  map = null
  marker = null
})

async function initializeMap() {
  if (!mapContainer.value) return
  loading.value = true
  loadError.value = null
  try {
    const AMap = await loadAMap(amapConfig.key, amapConfig.serviceHost
      ? { serviceHost: amapConfig.serviceHost }
      : { securityJsCode: amapConfig.securityJsCode })
    const position = currentPosition.value ?? [139.6917, 35.6895]
    map = new AMap.Map(mapContainer.value, { center: position, zoom: currentPosition.value ? 15 : 4 })
    marker = new AMap.Marker({ position, draggable: true })
    map.add(marker)
    map.on('click', selectPosition)
    marker.on('dragend', selectPosition)
  } catch (caught) {
    loadError.value = caught instanceof Error ? caught.message : '高德地图加载失败，请检查 API 配置。'
  } finally {
    loading.value = false
  }
}

function selectPosition(event: AMapPositionEvent) {
  const position: AMapPosition = [roundCoordinate(event.lnglat.getLng()), roundCoordinate(event.lnglat.getLat())]
  longitude.value = position[0]
  latitude.value = position[1]
  marker?.setPosition(position)
  map?.setZoomAndCenter(15, position)
}

function isCoordinate(value: number | null, min: number, max: number): boolean {
  return value !== null && Number.isFinite(Number(value)) && Number(value) >= min && Number(value) <= max
}

function roundCoordinate(value: number): number {
  return Number(value.toFixed(7))
}
</script>

<style scoped>
.map-picker { display: grid; gap: 12px; }
.map-heading { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; }
.map-heading h3 { margin: 0; font-size: 1rem; }
.map-heading p { margin: 3px 0 0; color: var(--site-muted); font-size: .875rem; }
.map-frame { position: relative; min-height: 280px; overflow: hidden; border: 1px solid var(--site-border); border-radius: 14px; background: rgb(var(--v-theme-surface-variant)); }
.map-container { width: 100%; height: 280px; }
.map-state { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; gap: 10px; background: rgba(var(--v-theme-surface), .82); color: var(--site-muted); }
.map-tip { position: absolute; left: 50%; bottom: 14px; transform: translateX(-50%); padding: 7px 12px; border-radius: 999px; background: rgba(24, 59, 56, .82); color: #fff; font-size: .8rem; pointer-events: none; }
@media (max-width: 620px) { .map-heading { display: grid; } .map-heading :deep(.v-btn) { justify-self: start; } }
</style>
