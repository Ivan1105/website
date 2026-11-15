export const activityLabels: Record<string, string> = {
  ongoing: '进行中', ended: '已结束',
  pending: '待处理', approved: '已批准', rejected: '已拒绝', ready: '已生成', failed: '失败',
  running: '执行中', succeeded: '成功', completed: '已归档', partial: '部分失败', interrupted: '已中断',
  high: '高', medium: '中', low: '低', discovery: '首次新闻', update: '官网更新',
}
export const activityLabel = (value: string | null) => value ? activityLabels[value] ?? value : '—'
export function activityTime(value: string | null) {
  if (!value) return '—'
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? '—' : new Intl.DateTimeFormat('zh-CN', { timeZone: 'Asia/Shanghai', dateStyle: 'medium', timeStyle: 'short' }).format(date)
}
export function activityDate(value: string, end = false) {
  return value ? new Date(`${value}T${end ? '23:59:59.999' : '00:00:00.000'}+08:00`).toISOString() : undefined
}
export function activityLink(value: string | null) {
  try { const url = new URL(value ?? ''); return ['https:', 'http:'].includes(url.protocol) && !url.username && !url.password ? url.href : undefined } catch { return undefined }
}
export function normalizeMonitorUrl(value: string) {
  const url = new URL(value.trim())
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.href.length > 2048) throw new Error('请填写有效的 HTTP(S) 页面地址，最长2048字符')
  url.hash = ''
  for (const key of [...url.searchParams.keys()]) if (/^(utm_.+|fbclid|gclid)$/i.test(key)) url.searchParams.delete(key)
  return url.href
}
export function prepareMonitorPages(pages: { name: string; url: string }[]) {
  if (pages.length > 20) throw new Error('每个活动最多配置20个页面')
  const normalized = pages.map(page => {
    const name = page.name.trim()
    if (!name || name.length > 128) throw new Error('页面名称必填，最长128字符')
    try { return { name, url: normalizeMonitorUrl(page.url) } } catch { throw new Error('请填写有效的 HTTP(S) 页面地址，最长2048字符') }
  })
  if (new Set(normalized.map(page => page.url)).size !== normalized.length) throw new Error('监控页面网址不能重复')
  return normalized
}
