<template>
  <div class="conversation-panel">
    <div class="list-heading">
      <div><p class="eyebrow">CONVERSATIONS</p><h2>会话列表</h2></div>
      <slot name="actions"><span class="list-count">{{ conversations.length }}</span></slot>
    </div>
    <div v-if="pending" class="list-state" role="status"><v-progress-circular indeterminate size="22" width="2" color="secondary" /><p>正在加载会话…</p></div>
    <div v-else-if="error" class="list-state" role="status"><v-icon icon="mdi-alert-circle-outline" color="error" /><p>{{ error }}</p></div>
    <div v-else-if="!conversations.length" class="list-state"><v-icon icon="mdi-chat-outline" /><p>暂无可用会话</p></div>
    <v-list v-else class="conversation-items" aria-label="选择会话">
      <v-list-item v-for="conv in conversations" :key="conv.name" :active="selected === conv.name"
        :disabled="disabled" :aria-current="selected === conv.name ? 'true' : undefined"
        class="conversation-item" color="secondary" @click="$emit('select', conv.name)">
        <template #prepend>
          <v-avatar color="surface-variant" size="40">
            <v-img v-if="conv.avatar" :src="assetUrl(conv.avatar)" alt="" cover><template #error><v-icon icon="mdi-account-outline" /></template></v-img>
            <v-icon v-else icon="mdi-account-outline" />
          </v-avatar>
        </template>
        <v-list-item-title>{{ conv.display_name }}</v-list-item-title>
        <v-list-item-subtitle>
          {{ selected === conv.name ? '当前会话' : unreadByThread[conv.thread_id || ''] ? `${unreadByThread[conv.thread_id || '']} 条未读` : '开始对话' }}
        </v-list-item-subtitle>
        <template #append>
          <v-icon v-if="selected === conv.name" icon="mdi-check" size="18" />
          <span v-else-if="unreadByThread[conv.thread_id || '']" class="unread-badge" :aria-label="`${unreadByThread[conv.thread_id || '']} 条未读消息`">
            {{ Math.min(unreadByThread[conv.thread_id || ''] || 0, 99) }}{{ (unreadByThread[conv.thread_id || ''] || 0) > 99 ? '+' : '' }}
          </span>
        </template>
      </v-list-item>
    </v-list>
    <div class="list-footer"><span aria-hidden="true">01 /</span> 给每一个想法，一点回应。</div>
  </div>
</template>

<script setup lang="ts">
import type { ConversationDTO } from '@/api'
defineProps<{
  conversations: ConversationDTO[]
  selected: string
  pending: boolean
  error: string
  disabled: boolean
  unreadByThread: Record<string, number>
}>()
defineEmits<{ select: [id: string] }>()
const { assetUrl } = useAssetUrl()
</script>

<style scoped>
.conversation-panel {
  height: 100%;
  min-height: 0;
  display: flex;
  flex-direction: column;
}

.list-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 26px 22px 20px;
  gap: 12px;
  border-bottom: 1px solid var(--site-border);
}

.list-heading .eyebrow {
  font-size: 0.6rem;
}

.list-heading h2 {
  font-size: 1.1rem;
  margin-top: 5px;
}

.list-count {
  display: grid;
  place-items: center;
  min-width: 28px;
  height: 28px;
  background: var(--site-soft);
  color: var(--site-accent);
  border-radius: 8px;
  font-size: 0.75rem;
}

.conversation-items {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: 12px;
  background: transparent;
}

.conversation-item {
  min-height: 76px;
  margin-bottom: var(--site-space-1);
  border-radius: var(--site-radius);
}

.conversation-item :deep(.v-list-item-title) {
  font-size: 0.9rem;
  font-weight: 600;
}

.conversation-item :deep(.v-list-item-subtitle) {
  font-size: 0.75rem;
  color: var(--site-muted);
  opacity: 1;
  margin-top: 4px;
}

.unread-badge {
  display: inline-grid;
  place-items: center;
  min-width: 22px;
  height: 22px;
  padding-inline: 6px;
  border-radius: 999px;
  background: rgb(var(--v-theme-primary));
  color: rgb(var(--v-theme-on-primary));
  font-size: 0.68rem;
  font-weight: 700;
}

.list-state {
  padding: 32px 20px;
  text-align: center;
  color: var(--site-muted);
  font-size: 0.85rem;
}

.list-state p {
  margin-top: 10px;
}

.list-footer {
  margin-top: auto;
  padding: 20px;
  border-top: 1px solid var(--site-border);
  color: var(--site-muted);
  font-size: 0.68rem;
}

.list-footer span {
  margin-right: 10px;
  color: var(--site-accent);
  font-family: var(--font-mono);
}
</style>
