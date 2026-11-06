<template>
  <section class="callbook-section">
    <div class="section-heading">
      <div>
        <p class="eyebrow">CALLBOOK</p>
        <div class="callbook-title-row">
          <h3>CALL 本</h3>
          <v-chip v-if="songId && !loading" size="x-small" variant="tonal" color="secondary">{{ callbooks.length }} 条</v-chip>
        </div>
        <p class="muted">查看应援资料与页面图片；来源和资料内容可独立保存。</p>
      </div>
      <v-btn
        v-if="songId" icon="mdi-refresh" variant="text" size="small" color="secondary"
        aria-label="重新加载 CALL 本" :loading="loading" @click="loadCallbooks"
      />
    </div>

    <v-alert v-if="!songId" type="info" variant="tonal" density="compact">请先保存歌曲基础信息，再查看关联的 CALL 本。</v-alert>
    <div v-else-if="loading" class="relation-state"><v-progress-circular indeterminate size="24" width="2" color="primary" /> 正在加载 CALL 本…</div>
    <v-alert v-else-if="loadError" type="error" variant="tonal" density="compact">
      {{ loadError }}
      <template #append><v-btn variant="text" size="small" @click="loadCallbooks">重试</v-btn></template>
    </v-alert>
    <div v-else-if="!callbooks.length" class="relation-state">该歌曲尚未关联 CALL 本。</div>

    <div v-else class="callbook-list">
      <v-card v-for="item in callbooks" :key="item.id" class="callbook-card" variant="outlined">
        <v-card-text class="callbook-card-content">
          <div class="callbook-card-heading">
            <div>
              <strong>CALL 本 #{{ item.id }}</strong>
              <span>{{ item.pages.length }} 个页面</span>
            </div>
            <v-chip v-if="isDirty(item)" size="x-small" variant="tonal" color="warning">未保存</v-chip>
          </div>

          <v-alert v-if="item.error" type="error" variant="tonal" density="compact" closable @click:close="item.error = null">{{ item.error }}</v-alert>
          <v-text-field v-model.trim="item.source" label="资料来源 *" :rules="requiredRules" :disabled="item.saving" />
          <v-textarea
            v-model="item.metadata_text" label="CALL 本资料 *" rows="7" auto-grow
            :rules="requiredRules" :disabled="item.saving"
          />

          <div class="callbook-pages-heading">
            <div><strong>页面预览</strong><span>图片关联只读</span></div>
          </div>
          <div v-if="item.pages.length" class="callbook-pages">
            <v-card
              v-for="page in item.pages" :key="page.id" class="callbook-page" variant="tonal" tabindex="0"
              :aria-label="`查看 ${songTitle} CALL 本第 ${page.page_no} 页`"
              @click="openPreview(page)" @keydown.enter="openPreview(page)" @keydown.space.prevent="openPreview(page)"
            >
              <v-img :src="pageUrl(page)" :alt="`${songTitle} CALL 本第 ${page.page_no} 页`" aspect-ratio="0.707" cover>
                <template #placeholder><div class="image-state"><v-progress-circular indeterminate size="22" width="2" color="primary" /></div></template>
                <template #error><div class="image-state"><v-icon icon="mdi-image-broken-variant" /><span>无法加载</span></div></template>
              </v-img>
              <div class="callbook-page-meta"><strong>第 {{ page.page_no }} 页</strong><span>{{ page.image_reference }}</span></div>
            </v-card>
          </div>
          <div v-else class="relation-state compact">暂无页面图片。</div>
        </v-card-text>
        <v-card-actions class="callbook-card-actions">
          <v-spacer />
          <v-btn
            color="primary" variant="tonal" prepend-icon="mdi-content-save-outline"
            :loading="item.saving" :disabled="!isDirty(item) || !isValid(item)" @click="saveCallbook(item)"
          >保存 CALL 本</v-btn>
        </v-card-actions>
      </v-card>
    </div>

    <v-dialog v-model="previewOpen" max-width="920">
      <v-card>
        <v-card-title class="preview-title">
          <span>{{ songTitle }} · 第 {{ previewPage?.page_no }} 页</span>
          <v-btn icon="mdi-close" variant="text" aria-label="关闭图片预览" @click="previewOpen = false" />
        </v-card-title>
        <v-card-text class="preview-content">
          <v-img
            v-if="previewPage"
            class="preview-image"
            :src="pageUrl(previewPage)"
            :alt="`${songTitle} CALL 本第 ${previewPage.page_no} 页`"
            contain
          >
            <template #placeholder>
              <div class="preview-error"><v-progress-circular indeterminate size="32" width="3" color="primary" /><span>图片加载中…</span></div>
            </template>
            <template #error><div class="preview-error"><v-icon icon="mdi-image-broken-variant" size="36" /><span>图片加载失败</span></div></template>
          </v-img>
        </v-card-text>
      </v-card>
    </v-dialog>
  </section>
</template>

<script setup lang="ts">
import { isApiError, useConcertAdminApi, type CallbookDTO, type CallbookPageDTO } from '@/api'

interface EditableCallbook extends CallbookDTO {
  saving: boolean
  error: string | null
  baseline: string
}

const props = defineProps<{ songId: number | null; songTitle: string }>()
const emit = defineEmits<{ 'dirty-change': [dirty: boolean] }>()
const { concertAdminApi } = useConcertAdminApi()
const { assetUrl } = useAssetUrl()
const callbooks = ref<EditableCallbook[]>([])
const loading = ref(false)
const loadError = ref<string | null>(null)
const previewOpen = ref(false)
const previewPage = ref<CallbookPageDTO | null>(null)
let loadVersion = 0
const requiredRules = [(value: string) => !!value?.trim() || '此项为必填']
const dirty = computed(() => callbooks.value.some(isDirty))

watch(() => props.songId, () => { void loadCallbooks() }, { immediate: true })
watch(dirty, value => emit('dirty-change', value), { immediate: true })

async function loadCallbooks() {
  const version = ++loadVersion
  previewOpen.value = false
  previewPage.value = null
  loadError.value = null
  if (!props.songId) {
    callbooks.value = []
    loading.value = false
    return
  }
  loading.value = true
  try {
    const items = await concertAdminApi.getSongCallbooks(props.songId)
    if (version !== loadVersion) return
    callbooks.value = items.map(toEditableCallbook)
  } catch (caught) {
    if (version !== loadVersion) return
    callbooks.value = []
    loadError.value = isApiError(caught) ? caught.message : '暂时无法加载 CALL 本，请稍后重试。'
  } finally {
    if (version === loadVersion) loading.value = false
  }
}

async function saveCallbook(item: EditableCallbook) {
  if (item.saving || !isDirty(item) || !isValid(item)) return
  item.saving = true
  item.error = null
  try {
    const saved = await concertAdminApi.updateCallbook(item.id, {
      source: item.source.trim(),
      metadata_text: item.metadata_text.trim(),
    })
    Object.assign(item, saved, { saving: false, error: null })
    item.pages = [...saved.pages].sort((left, right) => left.page_no - right.page_no)
    item.baseline = snapshot(item)
  } catch (caught) {
    item.error = isApiError(caught) ? caught.message : 'CALL 本保存失败，请稍后重试。'
  } finally {
    item.saving = false
  }
}

function toEditableCallbook(item: CallbookDTO): EditableCallbook {
  const editable = {
    ...item,
    pages: [...item.pages].sort((left, right) => left.page_no - right.page_no),
    saving: false,
    error: null,
    baseline: '',
  } satisfies EditableCallbook
  editable.baseline = snapshot(editable)
  return editable
}

function snapshot(item: Pick<EditableCallbook, 'source' | 'metadata_text'>): string {
  return JSON.stringify({ source: item.source.trim(), metadata_text: item.metadata_text.trim() })
}
function isDirty(item: EditableCallbook): boolean { return snapshot(item) !== item.baseline }
function isValid(item: EditableCallbook): boolean { return !!item.source.trim() && !!item.metadata_text.trim() }
function pageUrl(page: CallbookPageDTO): string { return assetUrl(page.image_reference, 'callbook/pages') }
function openPreview(page: CallbookPageDTO) { previewPage.value = page; previewOpen.value = true }
</script>

<style scoped>
.callbook-section { display: grid; gap: 14px; margin-top: 8px; padding-top: 22px; border-top: 1px solid var(--site-border); }
.section-heading { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; }
.section-heading h3 { margin: 3px 0 2px; font-size: 1.12rem; }
.callbook-title-row { display: flex; align-items: center; gap: 8px; }
.relation-state { min-height: 72px; padding: 20px; border: 1px dashed var(--site-border); border-radius: 14px; display: flex; align-items: center; justify-content: center; gap: 10px; color: var(--site-muted); }
.relation-state.compact { min-height: 54px; padding: 14px; }
.callbook-list { display: grid; gap: 14px; }
.callbook-card { border-color: var(--site-border); }
.callbook-card-content { display: grid; gap: 12px; }
.callbook-card-heading, .callbook-pages-heading { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
.callbook-card-heading > div, .callbook-pages-heading > div { display: grid; gap: 2px; }
.callbook-card-heading span, .callbook-pages-heading span { color: var(--site-muted); font-size: .78rem; }
.callbook-pages { display: grid; grid-template-columns: repeat(auto-fill, minmax(132px, 1fr)); gap: 10px; }
.callbook-page { overflow: hidden; cursor: pointer; border: 1px solid transparent; transition: border-color .18s ease, transform .18s ease; }
.callbook-page:hover, .callbook-page:focus-visible { border-color: #39c5bb; transform: translateY(-1px); outline: none; }
.callbook-page-meta { padding: 9px 10px; display: grid; gap: 2px; }
.callbook-page-meta strong { font-size: .82rem; }
.callbook-page-meta span { overflow: hidden; color: var(--site-muted); font-size: .7rem; text-overflow: ellipsis; white-space: nowrap; }
.image-state { height: 100%; min-height: 150px; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 6px; color: var(--site-muted); }
.callbook-card-actions { padding: 0 16px 16px; }
.preview-title { display: flex; align-items: center; justify-content: space-between; gap: 16px; }
.preview-content { min-height: 320px; display: grid; place-items: center; background: rgb(var(--v-theme-surface-variant)); }
.preview-image { width: 100%; height: min(78vh, calc(100dvh - 180px)); min-height: 320px; }
.preview-error { width: 100%; height: 100%; min-height: 320px; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 10px; color: var(--site-muted); }
@media (max-width: 620px) {
  .section-heading { flex-direction: column; }
  .callbook-pages { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .preview-content { min-height: 240px; padding: 8px; }
  .preview-image, .preview-error { min-height: 240px; }
}
</style>
