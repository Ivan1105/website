export type AMapPosition = [longitude: number, latitude: number]

export interface AMapLngLat {
  getLng: () => number
  getLat: () => number
}

export interface AMapPositionEvent {
  lnglat: AMapLngLat
}

export interface AMapMap {
  add: (overlay: AMapMarker) => void
  destroy: () => void
  off: (event: 'click', handler: (event: AMapPositionEvent) => void) => void
  on: (event: 'click', handler: (event: AMapPositionEvent) => void) => void
  setCenter: (position: AMapPosition) => void
  setZoomAndCenter: (zoom: number, position: AMapPosition) => void
}

export interface AMapMarker {
  off: (event: 'dragend', handler: (event: AMapPositionEvent) => void) => void
  on: (event: 'dragend', handler: (event: AMapPositionEvent) => void) => void
  setPosition: (position: AMapPosition) => void
}

export interface AMapNamespace {
  Map: new (container: HTMLElement, options: { center: AMapPosition; zoom: number }) => AMapMap
  Marker: new (options: { draggable: boolean; position: AMapPosition }) => AMapMarker
}

interface AMapSecurityConfig {
  securityJsCode?: string
  serviceHost?: string
}

declare global {
  interface Window {
    AMap?: AMapNamespace
    _AMapSecurityConfig?: AMapSecurityConfig
  }
}

let loaderPromise: Promise<AMapNamespace> | null = null

export function loadAMap(key: string, security: AMapSecurityConfig): Promise<AMapNamespace> {
  if (window.AMap) return Promise.resolve(window.AMap)
  if (loaderPromise) return loaderPromise

  const pending = new Promise<AMapNamespace>((resolve, reject) => {
    window._AMapSecurityConfig = security
    const script = document.createElement('script')
    script.src = `https://webapi.amap.com/maps?v=2.0&key=${encodeURIComponent(key)}`
    script.async = true
    script.onload = () => window.AMap ? resolve(window.AMap) : reject(new Error('高德地图 API 未正确初始化'))
    script.onerror = () => reject(new Error('高德地图 API 加载失败'))
    document.head.append(script)
  }).catch((error: unknown) => {
    loaderPromise = null
    throw error
  })

  loaderPromise = pending
  return pending
}
