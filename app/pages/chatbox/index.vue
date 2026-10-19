<template>
  <div class="chatbox-page">
    <div class="chat-page-heading">
      <div><p class="eyebrow">A SPACE FOR IDEAS</p><h1>让对话，带来新灵感。</h1></div>
      <p class="muted">从一个问题开始。</p>
    </div>
    <div class="chatbox-container">
      <aside class="desktop-conversations surface-card" aria-label="会话列表">
        <ConversationList :conversations="conversations" :selected="currentConversationId" :pending="conversationsLoading"
          :error="conversationsError" :disabled="conversationSelectionDisabled" @select="selectConversation" />
      </aside>
      <section class="chat-area surface-card" aria-label="聊天">
        <header class="chat-header">
          <v-dialog v-model="drawerOpen" class="conversation-drawer" content-class="conversation-drawer-content"
            aria-label="会话列表" transition="slide-x-transition" max-width="340">
            <template #activator="{ props }">
              <v-btn v-bind="props" icon="mdi-menu" variant="text" class="mobile-conversations-toggle" aria-label="打开会话列表" />
            </template>
            <v-card class="drawer-card">
              <ConversationList :conversations="conversations" :selected="currentConversationId" :pending="conversationsLoading"
                :error="conversationsError" :disabled="conversationSelectionDisabled" @select="selectConversation">
                <template #actions><v-btn icon="mdi-close" variant="text" aria-label="关闭会话列表" @click="drawerOpen = false" /></template>
              </ConversationList>
            </v-card>
          </v-dialog>
          <v-avatar color="surface-variant" size="42" class="header-avatar">
            <v-img v-if="currentConversation?.avatar" :src="assetUrl(currentConversation.avatar)" alt="" cover><template #error><v-icon icon="mdi-chat-outline" /></template></v-img>
            <v-icon v-else icon="mdi-chat-outline" color="secondary" />
          </v-avatar>
          <div class="chat-header-text">
            <h2>{{ currentConversation?.display_name || '聊天空间' }}</h2>
            <p>{{ currentConversation ? '把你的想法，写在这里。' : '选择一个会话，开始交流。' }}</p>
          </div>
          <v-menu v-if="currentConversation && !authRequired" v-model="settingsMenuOpen" location="bottom end"
            :close-on-content-click="false" offset="8">
            <template #activator="{ props }">
              <v-btn v-bind="props" icon="mdi-cog-outline" variant="text" color="secondary" size="small"
                class="chat-settings-trigger" :disabled="conversationSelectionDisabled" aria-label="打开设置" />
            </template>
            <v-list class="chat-settings-menu" density="compact" aria-label="聊天设置">
              <v-list-item class="chat-setting-item settings-toggle-item" prepend-icon="mdi-bell-outline">
                <v-list-item-title>主动提醒功能</v-list-item-title>
                <v-list-item-subtitle class="chat-setting-description">
                  开启后，{{ currentConversation.display_name }}会在合适的时候主动来找你。
                </v-list-item-subtitle>
                <template #append>
                  <v-switch :model-value="currentConversation?.proactive_enabled ?? false" color="secondary"
                    density="compact" hide-details :loading="proactiveUpdating" :disabled="proactiveUpdating"
                    aria-label="主动提醒功能" @click.stop @update:model-value="updateProactiveReminder" />
                </template>
              </v-list-item>
              <v-list-item class="chat-setting-item settings-toggle-item" prepend-icon="mdi-book-open-page-variant-outline">
                <v-list-item-title>自动记录日记</v-list-item-title>
                <v-list-item-subtitle class="chat-setting-description">
                  开启后，{{ currentConversation.display_name }}会每天写下与你共度的时光。
                </v-list-item-subtitle>
                <template #append>
                  <v-switch :model-value="currentConversation?.journal_enabled ?? false" color="secondary"
                    density="compact" hide-details :loading="journalUpdating" :disabled="journalUpdating"
                    aria-label="自动记录日记" @click.stop @update:model-value="updateJournal" />
                </template>
              </v-list-item>
              <v-list-item class="chat-setting-item" prepend-icon="mdi-email-outline" @click="openEmailConfigDialog">
                <v-list-item-title>配置邮箱连接</v-list-item-title>
                <v-list-item-subtitle class="chat-setting-description">
                  连接邮箱后，可获取最新邮件并总结邮件内容。
                </v-list-item-subtitle>
              </v-list-item>
              <v-list-item class="chat-setting-item" prepend-icon="mdi-shield-key-outline" @click="openThirdPartyAuthDialog">
                <v-list-item-title>第三方服务授权</v-list-item-title>
                <v-list-item-subtitle class="chat-setting-description">
                  授权第三方服务后，可在对话中使用对应的服务能力。
                </v-list-item-subtitle>
              </v-list-item>
              <v-divider />
              <v-list-item class="chat-setting-item" prepend-icon="mdi-chat-plus-outline" :disabled="conversationSelectionDisabled"
                @click="openClearContextDialog">
                <v-list-item-title>新建会话</v-list-item-title>
                <v-list-item-subtitle class="chat-setting-description">
                  开始一段新的对话，已有记忆会继续保留。
                </v-list-item-subtitle>
              </v-list-item>
            </v-list>
          </v-menu>
        </header>
        <div ref="messagesAreaRef" class="messages-area" tabindex="0" aria-label="消息记录" :aria-busy="loading || sending">
          <div v-if="conversationsLoading || loading" class="chat-state" role="status">
            <v-progress-circular indeterminate color="secondary" size="28" width="2" /><p>正在加载{{ conversationsLoading ? '会话' : '消息' }}…</p>
          </div>
          <div v-else-if="authRequired || conversationsError || messagesError" class="chat-state" role="status">
            <span class="state-icon"><v-icon icon="mdi-alert-circle-outline" color="error" size="30" /></span>
            <h3>{{ authRequired ? '需要重新登录' : '暂时无法加载' }}</h3><p>{{ authRequired ? authErrorMessage : (conversationsError || messagesError) }}</p><p v-if="!authRequired">请稍后刷新页面再试。</p>
            <v-btn v-if="authRequired || !appStore.isLoggedIn" to="/login" variant="text" color="secondary" append-icon="mdi-arrow-right">前往登录</v-btn>
          </div>
          <div v-else-if="!currentConversation" class="chat-state">
            <span class="state-icon"><v-icon icon="mdi-chat-outline" size="32" /></span>
            <p class="eyebrow">A NEW CONVERSATION</p><h3>对话，从这里开始</h3>
            <p>暂无可用会话。{{ appStore.isLoggedIn ? '请稍后再来看看。' : '可以先登录你的账户。' }}</p>
            <v-btn v-if="!appStore.isLoggedIn" to="/login" color="primary" append-icon="mdi-arrow-right">前往登录</v-btn>
          </div>
          <div v-else-if="!currentMessages.length" class="chat-state">
            <span class="state-icon"><v-icon icon="mdi-forum-outline" size="32" /></span>
            <p class="eyebrow">A LITTLE INSPIRATION</p><h3>今天，想聊些什么？</h3><p>分享一个想法，或提出你的第一个问题。</p>
          </div>
          <template v-else>
            <div v-if="messagesHasMore || loadingMore" v-intersect="onHistoryIntersect" class="history-loader"
              role="status" :aria-label="historyLoaderLabel">
              <template v-if="loadingMore">
                <v-progress-circular indeterminate color="secondary" size="18" width="2" />
                <span>正在加载更早的消息…</span>
              </template>
              <v-btn v-else-if="historyLoadError" variant="text" color="secondary" size="small"
                prepend-icon="mdi-refresh" @click="loadOlderMessages">加载失败，点击重试</v-btn>
              <template v-else>
                <v-icon icon="mdi-history" size="18" />
                <span>继续向上查看更早的消息</span>
              </template>
            </div>
            <article v-for="msg in currentMessages" :key="msg.key" class="message-row"
              :class="{ 'message-self': msg.role === 'user', 'message-signal': msg.role === 'signal' || msg.role === 'stream-error' }"
              :aria-label="msg.role === 'user' ? '我的消息' : msg.role === 'signal' ? '系统提醒' : msg.role === 'stream-error' ? '回复错误' : '回复'">
              <div v-if="msg.role === 'signal'" class="signal-message">
                <span>触发系统提醒</span>
                <span aria-hidden="true">·</span>
                <time :datetime="msg.createdAt">{{ formatTime(msg.createdAt) }}</time>
              </div>
              <div v-else-if="msg.role === 'stream-error'" class="signal-message stream-error-message">
                <span>连接失败</span>
                <span aria-hidden="true">·</span>
                <time :datetime="msg.createdAt">{{ formatTime(msg.createdAt) }}</time>
              </div>
              <template v-else>
                <v-avatar color="surface-variant" size="32" class="message-avatar" aria-hidden="true">
                  <v-img v-if="msg.role === 'user' && appStore.userInfo?.avatar" :src="assetUrl(appStore.userInfo.avatar)" alt="" cover>
                    <template #error><v-icon icon="mdi-account-outline" size="18" /></template>
                  </v-img>
                  <v-img v-else-if="msg.role !== 'user' && currentConversation?.avatar" :src="assetUrl(currentConversation.avatar)" alt="" cover>
                    <template #error><v-icon icon="mdi-chat-outline" size="18" color="secondary" /></template>
                  </v-img>
                  <v-icon v-else :icon="msg.role === 'user' ? 'mdi-account-outline' : 'mdi-chat-outline'" size="18"
                    :color="msg.role === 'user' ? undefined : 'secondary'" />
                </v-avatar>
                <div class="message-bubble-wrapper">
                  <span class="message-author">{{ msg.role === 'user' ? '我' : currentConversation?.display_name }}</span>
                  <div class="message-bubble" :class="msg.role === 'user' ? 'bubble-self' : 'bubble-other'">
                    <div v-if="msg.loading && !msg.content && !msg.toolCalls?.length" class="reply-loading" role="status"><v-progress-circular indeterminate size="18" width="2" color="secondary" /> 正在回复…</div>
                    <p v-else-if="msg.role === 'user'" class="message-text">{{ msg.content }}</p>
                    <template v-else>
                      <div v-if="msg.content" class="message-text markdown-content" v-html="renderAssistantMessage(msg)" />
                      <div v-if="msg.toolCalls?.length" class="tool-status-list" aria-live="polite">
                        <div v-for="toolCall in msg.toolCalls" :key="toolCall.id" class="tool-status"
                          :class="`tool-status-${toolCall.status}`" role="status"
                          @animationend="removeCompletedToolCall($event, msg.key, toolCall.id, toolCall.status)">
                          <v-progress-circular v-if="toolCall.status === 'running'" indeterminate size="16" width="2" color="secondary" />
                          <v-icon v-else-if="toolCall.status === 'success'" icon="mdi-check-circle-outline" color="success" size="18" />
                          <v-icon v-else icon="mdi-alert-circle-outline" color="error" size="18" />
                          <span>{{ toolCallLabel(toolCall) }}</span>
                        </div>
                      </div>
                    </template>
                  </div>
                  <time class="message-time" :datetime="msg.createdAt">{{ formatTime(msg.createdAt) }}</time>
                </div>
              </template>
            </article>
          </template>
        </div>
        <div v-if="currentConversation && !authRequired" class="input-area">
          <form class="input-row" @submit.prevent="sendMessage">
            <v-textarea id="chat-message" v-model="inputMessage" placeholder="输入你的想法…" auto-grow rows="1" max-rows="5"
              hide-details class="message-input" :disabled="loading || creatingThread" @keydown="onMessageKeydown" />
            <v-btn type="submit" color="primary" :disabled="!inputMessage.trim() || busy" class="send-btn"
              :prepend-icon="sending ? 'mdi-dots-horizontal' : 'mdi-send-outline'">{{ sending ? '回复中' : '发送' }}</v-btn>
          </form>
          <div class="input-note"><span>Enter 发送 · Shift + Enter 换行</span><span role="status" aria-live="polite">{{ sending ? '正在接收回复…' : '' }}</span></div>
        </div>
      </section>
    </div>
    <v-dialog v-model="clearContextDialogOpen" :persistent="creatingThread" max-width="440">
      <v-card>
        <v-card-title>新建会话</v-card-title>
        <v-card-text>确认开始一段新的对话吗？当前聊天记录将结束，但已有记忆会继续保留。</v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn variant="text" :disabled="creatingThread" @click="clearContextDialogOpen = false">取消</v-btn>
          <v-btn color="primary" :loading="creatingThread" :disabled="creatingThread" @click="clearContext">新建会话</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
    <v-dialog v-model="emailConfigDialogOpen" :persistent="mailConfigBusy" fullscreen transition="dialog-bottom-transition">
      <v-card class="email-config-page">
        <v-toolbar class="email-config-toolbar" color="surface" flat>
          <v-btn icon="mdi-arrow-left" variant="text" aria-label="返回聊天" :disabled="mailConfigBusy"
            @click="closeEmailConfigDialog" />
          <v-toolbar-title>配置邮箱连接</v-toolbar-title>
          <v-btn icon="mdi-close" variant="text" aria-label="关闭邮箱连接配置" :disabled="mailConfigBusy"
            @click="closeEmailConfigDialog" />
        </v-toolbar>
        <v-divider />
        <v-card-text class="email-config-content">
          <div class="email-config-shell">
            <header class="email-config-intro">
              <span class="email-config-icon" aria-hidden="true">
                <v-icon icon="mdi-email-sync-outline" color="secondary" size="38" />
              </span>
              <div>
                <p class="eyebrow">EMAIL CONNECTION</p>
                <h2>连接你的邮箱</h2>
                <p>配置邮箱服务器后，可以获取最新邮件并总结邮件内容。</p>
              </div>
            </header>

            <div v-if="mailConfigLoading" class="email-config-state" role="status">
              <v-progress-circular indeterminate color="secondary" size="30" width="2" />
              <p>正在读取邮箱配置…</p>
            </div>

            <div v-else-if="mailConfigLoadError" class="email-config-state" role="alert">
              <v-icon icon="mdi-alert-circle-outline" color="error" size="32" />
              <h3>暂时无法读取配置</h3>
              <p>{{ mailConfigLoadError }}</p>
              <v-btn color="secondary" variant="tonal" prepend-icon="mdi-refresh" @click="loadMailConfig">
                重新加载
              </v-btn>
            </div>

            <v-form v-else class="email-config-form" @submit.prevent="saveMailConfig">
              <div class="email-config-status" aria-live="polite">
                <v-icon :icon="mailConfig ? 'mdi-check-circle-outline' : 'mdi-information-outline'"
                  :color="mailConfig ? 'success' : 'secondary'" size="24" />
                <div>
                  <strong>{{ mailConfig ? '邮箱连接已配置' : '尚未配置邮箱连接' }}</strong>
                  <span v-if="mailConfig">最近更新：{{ mailConfigUpdatedAt }}</span>
                  <span v-else>填写连接信息并保存后即可启用。</span>
                </div>
              </div>

              <v-alert v-if="mailConfigSuccess" type="success" variant="tonal" density="comfortable">
                {{ mailConfigSuccess }}
              </v-alert>
              <v-alert v-if="mailConfigSaveError" type="error" variant="tonal" density="comfortable" role="alert">
                {{ mailConfigSaveError }}
              </v-alert>

              <v-select v-model="mailForm.endpointKey" :items="mailEndpointOptions" item-title="title" item-value="key"
                class="email-endpoint-select" label="邮箱服务器" placeholder="请选择邮箱服务器"
                prepend-inner-icon="mdi-server-outline" variant="outlined" color="secondary"
                no-data-text="暂无可用邮箱服务器" :disabled="mailConfigBusy || !mailEndpoints.length"
                :error-messages="mailFieldMessages('endpoint')" @blur="mailTouched.endpoint = true">
                <template #selection>
                  <span v-if="selectedMailEndpointHost" class="email-endpoint-selection">
                    <span class="email-endpoint-host">{{ selectedMailEndpointHost }}</span>
                    <span class="email-endpoint-meta">{{ selectedMailEndpointMeta }}</span>
                  </span>
                </template>
                <template #item="{ props, item }">
                  <v-list-item v-bind="props" class="email-endpoint-option" :title="item.title"
                    :subtitle="item.subtitle" />
                </template>
              </v-select>

              <v-alert v-if="!mailEndpoints.length" type="warning" variant="tonal" density="comfortable">
                暂无可用邮箱服务器，请稍后重试。
              </v-alert>

              <v-text-field v-model="mailForm.username" label="邮箱用户名" placeholder="name@example.com"
                prepend-inner-icon="mdi-account-outline" autocomplete="username" :disabled="mailConfigBusy"
                :error-messages="mailFieldMessages('username')" @blur="mailTouched.username = true" />

              <v-text-field v-model="mailForm.password"
                :label="mailConfig?.hasPassword ? '新密码（可选）' : '邮箱密码'"
                :placeholder="mailConfig?.hasPassword ? '留空则保留当前密码' : '请输入邮箱密码'"
                :type="mailPasswordVisible ? 'text' : 'password'" prepend-inner-icon="mdi-lock-outline"
                autocomplete="new-password" :disabled="mailConfigBusy" :error-messages="mailFieldMessages('password')"
                @blur="mailTouched.password = true">
                <template #append-inner>
                  <v-btn :icon="mailPasswordVisible ? 'mdi-eye-off-outline' : 'mdi-eye-outline'" variant="text"
                    width="44" height="44" :aria-label="mailPasswordVisible ? '隐藏邮箱密码' : '显示邮箱密码'"
                    :aria-pressed="mailPasswordVisible" :disabled="mailConfigBusy"
                    @click="mailPasswordVisible = !mailPasswordVisible" />
                </template>
              </v-text-field>

              <p v-if="mailConfig?.hasPassword" class="email-password-note">
                <v-icon icon="mdi-shield-check-outline" size="18" color="success" />
                已保存邮箱密码；仅在需要更换密码时填写此项。
              </p>

              <div class="email-config-actions">
                <v-btn v-if="mailConfig" class="email-config-test-button" color="secondary" variant="tonal"
                  prepend-icon="mdi-connection" :loading="mailConnectionTesting" :disabled="mailConfigBusy"
                  @click="testMailConnection">
                  测试连接
                </v-btn>
                <v-btn variant="text" :disabled="mailConfigBusy" @click="closeEmailConfigDialog">取消</v-btn>
                <v-btn type="submit" color="primary" prepend-icon="mdi-content-save-outline"
                  :loading="mailConfigSaving" :disabled="!canSaveMailConfig">
                  保存配置
                </v-btn>
              </div>
            </v-form>
          </div>
        </v-card-text>
      </v-card>
    </v-dialog>
    <v-dialog v-model="thirdPartyAuthDialogOpen" :persistent="oauthActionPending" fullscreen
      transition="dialog-bottom-transition">
      <v-card class="email-config-page">
        <v-toolbar class="email-config-toolbar" color="surface" flat>
          <v-btn icon="mdi-arrow-left" variant="text" aria-label="返回聊天" :disabled="oauthActionPending"
            @click="closeThirdPartyAuthDialog" />
          <v-toolbar-title>第三方服务授权</v-toolbar-title>
          <v-btn icon="mdi-close" variant="text" aria-label="关闭第三方服务授权"
            :disabled="oauthActionPending" @click="closeThirdPartyAuthDialog" />
        </v-toolbar>
        <v-divider />
        <v-card-text class="email-config-content">
          <div class="email-config-shell">
            <header class="email-config-intro">
              <span class="email-config-icon" aria-hidden="true">
                <v-icon icon="mdi-connection" color="secondary" size="38" />
              </span>
              <div>
                <p class="eyebrow">THIRD-PARTY SERVICES</p>
                <h2>连接第三方服务</h2>
                <p>授权外部服务，为对话扩展更多可用能力。</p>
              </div>
            </header>

            <div v-if="oauthServicesLoading" class="email-config-state" role="status">
              <v-progress-circular indeterminate color="secondary" size="30" width="2" />
              <p>正在读取第三方服务…</p>
            </div>

            <div v-else-if="oauthServicesError" class="email-config-state" role="alert">
              <v-icon icon="mdi-alert-circle-outline" color="error" size="32" />
              <h3>暂时无法读取服务</h3>
              <p>{{ oauthServicesError }}</p>
              <v-btn color="secondary" variant="tonal" prepend-icon="mdi-refresh" @click="loadOAuthServices">
                重新加载
              </v-btn>
            </div>

            <div v-else-if="!oauthServices.length" class="email-config-state" role="status">
              <v-icon icon="mdi-connection" color="secondary" size="38" />
              <h3>暂无可用服务</h3>
              <p>当前没有可授权的第三方服务，请稍后再来看看。</p>
            </div>

            <div v-else class="oauth-service-list" aria-label="第三方服务列表">
              <article v-for="service in oauthServices" :key="service.appKey" class="oauth-service-row">
                <div class="oauth-service-main">
                  <div class="oauth-service-heading">
                    <div class="oauth-service-title">
                      <h3>{{ service.displayName }}</h3>
                      <span>{{ service.appKey }}</span>
                    </div>
                    <v-chip :color="service.connected ? 'success' : undefined" variant="tonal" size="small"
                      :prepend-icon="service.connected ? 'mdi-check-circle-outline' : 'mdi-link-off'">
                      {{ service.connected ? '已连接' : '未连接' }}
                    </v-chip>
                  </div>

                  <dl v-if="service.status || service.scope || service.expiresAt" class="oauth-service-meta">
                    <div v-if="service.status">
                      <dt>状态</dt>
                      <dd>{{ service.status }}</dd>
                    </div>
                    <div v-if="service.scope">
                      <dt>授权范围</dt>
                      <dd>{{ service.scope }}</dd>
                    </div>
                    <div v-if="service.expiresAt">
                      <dt>到期时间</dt>
                      <dd>{{ formatOAuthExpiresAt(service.expiresAt) }}</dd>
                    </div>
                  </dl>
                </div>

                <v-btn class="oauth-service-action" :color="service.connected ? 'error' : 'primary'"
                  :variant="service.connected ? 'tonal' : 'flat'"
                  :prepend-icon="service.connected ? 'mdi-link-off' : 'mdi-open-in-new'"
                  :loading="oauthAuthorizingAppKey === service.appKey || oauthRevokingAppKey === service.appKey"
                  :disabled="oauthActionPending"
                  :title="service.connected ? '取消该服务的授权' : '将在新标签页中打开授权页面'"
                  @click="service.connected ? openOAuthRevokeDialog(service) : authorizeOAuthService(service)">
                  {{ service.connected ? '取消授权' : '授权' }}
                </v-btn>
              </article>
            </div>
          </div>
        </v-card-text>
      </v-card>
    </v-dialog>
    <v-dialog v-model="oauthRevokeDialogOpen" :persistent="oauthRevokingAppKey !== null" max-width="440">
      <v-card>
        <v-card-title>取消第三方服务授权</v-card-title>
        <v-card-text>
          确认取消“{{ oauthRevokeTarget?.displayName }}”的授权吗？取消后，对话将无法继续使用该服务的能力。
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn variant="text" :disabled="oauthRevokingAppKey !== null" @click="closeOAuthRevokeDialog">保留授权</v-btn>
          <v-btn color="error" :loading="oauthRevokingAppKey !== null" :disabled="oauthRevokingAppKey !== null"
            @click="revokeOAuthAuthorization">
            取消授权
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
    <v-snackbar v-model="snackbar.show" :timeout="snackbar.timeout" class="site-snackbar" location="bottom">
      <span role="alert"><v-icon icon="mdi-alert-circle-outline" size="18" /> {{ snackbar.text }}</span>
      <template #actions><v-btn variant="text" @click="snackbar.show = false">关闭</v-btn></template>
    </v-snackbar>
  </div>
</template>

<script setup lang="ts">
import { isApiError, useChatApi, useMailApi, useOAuthApi, type ActiveRunDTO, type ChatRunStreamEvent, type ConversationDTO, type MailConfigDTO, type MailEndpointDTO, type MessageDTO, type OAuthServiceDTO, type UpdateMailConfigReq } from '@/api'
import { useAppStore } from '@/stores/app'
import { useDisplay } from 'vuetify'
import DOMPurify from 'isomorphic-dompurify'
import MarkdownIt from 'markdown-it'

useSeoMeta({ title: '聊天 · Ivan1105' })
const { chatApi } = useChatApi()
const { mailApi } = useMailApi()
const { oauthApi } = useOAuthApi()
const appStore = useAppStore()
const { mobile } = useDisplay()
const { assetUrl } = useAssetUrl()
type ToolCallStatus = 'running' | 'success' | 'error'
type MailField = 'endpoint' | 'username' | 'password'
interface MailConfigForm {
  endpointKey: string
  username: string
  password: string
}
interface MailEndpointOption {
  key: string
  title: string
  subtitle: string
  endpoint: MailEndpointDTO
}
interface ToolCallState {
  id: string
  name: string
  status: ToolCallStatus
}
type Message = Omit<MessageDTO, 'id' | 'role'> & {
  key: string
  id?: string
  role: MessageDTO['role'] | 'stream-error'
  loading?: boolean
  toolCalls?: ToolCallState[]
}
const toHistoryMessage = (message: MessageDTO | ActiveRunDTO['user_message']): Message => ({
  ...message,
  key: `history:${message.id}`,
})
const markdown = new MarkdownIt({ html: false, linkify: true, breaks: true })
const renderedMessageCache = new WeakMap<Message, { content: string, html: string }>()
const renderAssistantMessage = (message: Message) => {
  const cached = renderedMessageCache.get(message)
  if (cached?.content === message.content) return cached.html
  const html = DOMPurify.sanitize(markdown.render(message.content))
  renderedMessageCache.set(message, { content: message.content, html })
  return html
}

const conversations = ref<ConversationDTO[]>([])
const currentConversationId = ref('')
const currentMessages = ref<Message[]>([])
const inputMessage = ref('')
const messagesAreaRef = ref<HTMLElement | null>(null)
const loading = ref(false)
const conversationsLoading = ref(true)
const conversationsError = ref('')
const messagesError = ref('')
const authRequired = ref(false)
const authErrorMessage = '需要登录，或登录状态已失效，请重新登录。'
const sending = ref(false)
const loadingMore = ref(false)
const historyLoadError = ref(false)
const messagesPage = ref(0)
const messagesHasMore = ref(false)
const messagesTotal = ref(0)
const activeRunId = ref<string | null>(null)
const creatingThread = ref(false)
const clearContextDialogOpen = ref(false)
const emailConfigDialogOpen = ref(false)
const thirdPartyAuthDialogOpen = ref(false)
const oauthServices = ref<OAuthServiceDTO[]>([])
const oauthServicesLoading = ref(false)
const oauthServicesError = ref('')
const oauthAuthorizingAppKey = ref<string | null>(null)
const oauthRevokingAppKey = ref<string | null>(null)
const oauthRevokeDialogOpen = ref(false)
const oauthRevokeTarget = ref<OAuthServiceDTO | null>(null)
const oauthRefreshOnFocus = ref(false)
const mailConfig = ref<MailConfigDTO | null>(null)
const mailEndpoints = ref<MailEndpointDTO[]>([])
const mailConfigLoading = ref(false)
const mailConfigSaving = ref(false)
const mailConnectionTesting = ref(false)
const mailConfigLoadError = ref('')
const mailConfigSaveError = ref('')
const mailConfigSuccess = ref('')
const mailPasswordVisible = ref(false)
const mailForm = reactive<MailConfigForm>({
  endpointKey: '',
  username: '',
  password: '',
})
const mailTouched = reactive<Record<MailField, boolean>>({
  endpoint: false,
  username: false,
  password: false,
})
const settingsMenuOpen = ref(false)
const proactiveUpdating = ref(false)
const journalUpdating = ref(false)
const drawerOpen = ref(false)
const snackbar = reactive({ show: false, text: '', timeout: 6000 })
const showError = (text: string) => {
  snackbar.text = text
  snackbar.show = true
}
const mailEndpointKey = (endpoint: Pick<MailEndpointDTO, 'host' | 'port' | 'secure'>) => {
  return `${endpoint.host}\u0000${endpoint.port}\u0000${endpoint.secure ? '1' : '0'}`
}
const currentConversation = computed(() => conversations.value.find(c => c.name === currentConversationId.value))
const mailEndpointOptions = computed<MailEndpointOption[]>(() => mailEndpoints.value.map(endpoint => ({
  key: mailEndpointKey(endpoint),
  title: endpoint.host,
  subtitle: `${endpoint.port} · ${endpoint.secure ? 'TLS' : '非 TLS'}`,
  endpoint,
})))
const selectedMailEndpoint = computed(() => {
  return mailEndpointOptions.value.find(option => option.key === mailForm.endpointKey)?.endpoint ?? null
})
const selectedMailEndpointHost = computed(() => selectedMailEndpoint.value?.host ?? '')
const selectedMailEndpointMeta = computed(() => {
  const endpoint = selectedMailEndpoint.value
  return endpoint ? `${endpoint.port} · ${endpoint.secure ? 'TLS' : '非 TLS'}` : ''
})
const normalizedMailUsername = computed(() => mailForm.username.trim())
const mailValidationErrors = computed<Record<MailField, string | null>>(() => ({
  endpoint: selectedMailEndpoint.value ? null : '请选择邮箱服务器。',
  username: normalizedMailUsername.value ? null : '请输入邮箱用户名。',
  password: !mailConfig.value?.hasPassword && mailForm.password.length === 0 ? '首次配置必须填写邮箱密码。' : null,
}))
const mailFormDirty = computed(() => {
  if (!mailConfig.value) return true
  const endpoint = selectedMailEndpoint.value
  return !endpoint
    || endpoint.host !== mailConfig.value.host
    || endpoint.port !== mailConfig.value.port
    || endpoint.secure !== mailConfig.value.secure
    || normalizedMailUsername.value !== mailConfig.value.username
    || mailForm.password.length > 0
})
const mailConfigBusy = computed(() => mailConfigSaving.value || mailConnectionTesting.value)
const mailFormValid = computed(() => Object.values(mailValidationErrors.value).every(error => !error))
const canSaveMailConfig = computed(() => !mailConfigLoading.value
  && !mailConfigBusy.value
  && mailFormDirty.value
  && mailFormValid.value)
const mailConfigUpdatedAt = computed(() => {
  if (!mailConfig.value?.updatedAt) return '未知时间'
  const date = new Date(mailConfig.value.updatedAt)
  if (Number.isNaN(date.getTime())) return mailConfig.value.updatedAt
  return new Intl.DateTimeFormat('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date)
})
const busy = computed(() => authRequired.value || sending.value || creatingThread.value || loading.value || conversationsLoading.value)
const oauthActionPending = computed(() => oauthAuthorizingAppKey.value !== null || oauthRevokingAppKey.value !== null)
const conversationSelectionDisabled = computed(() => authRequired.value || creatingThread.value || loading.value || conversationsLoading.value)
const historyLoaderLabel = computed(() => `加载更早的消息，当前已显示 ${currentMessages.value.length} 条，共 ${messagesTotal.value} 条`)
const MESSAGES_PAGE_SIZE = 20
let messagesLoadVersion = 0
let streamVersion = 0
let mailConfigLoadVersion = 0
let oauthServicesLoadVersion = 0
let streamAbortController: AbortController | null = null
const activeStreamMessageKeys = new Set<string>()
watch(mobile, value => {
  if (!value) drawerOpen.value = false
})

const formatTime = (value: string) => {
  const date = new Date(value)
  const now = new Date()
  const hh = String(date.getHours()).padStart(2, '0')
  const mm = String(date.getMinutes()).padStart(2, '0')
  if (date.toDateString() === now.toDateString()) return `${hh}:${mm}`
  return `${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')} ${hh}:${mm}`
}
const formatOAuthExpiresAt = (value: string) => {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return new Intl.DateTimeFormat('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date)
}
const scrollToBottom = () => {
  if (messagesAreaRef.value) messagesAreaRef.value.scrollTop = messagesAreaRef.value.scrollHeight
}
const toolCallLabel = (toolCall: ToolCallState) => {
  if (toolCall.status === 'running') return `开始工具调用【${toolCall.name}】`
  return `工具请求${toolCall.status === 'success' ? '成功' : '失败'}【${toolCall.name}】`
}
const removeCompletedToolCall = (event: AnimationEvent, messageKey: string, toolCallId: string, status: ToolCallStatus) => {
  if (event.target !== event.currentTarget) return
  if (status === 'running') return
  const message = currentMessages.value.find(item => item.key === messageKey)
  const toolCall = message?.toolCalls?.find(item => item.id === toolCallId)
  if (!message || !toolCall || toolCall.status !== status) return
  message.toolCalls = message.toolCalls?.filter(item => item.id !== toolCallId)
}
const stopActiveStream = () => {
  streamVersion += 1
  streamAbortController?.abort()
  streamAbortController = null
  for (const messageKey of activeStreamMessageKeys) {
    const message = currentMessages.value.find(item => item.key === messageKey)
    if (message) {
      message.loading = false
      message.toolCalls = []
    }
  }
  activeStreamMessageKeys.clear()
  activeRunId.value = null
  sending.value = false
}
const resetMessagesPagination = () => {
  messagesLoadVersion += 1
  messagesPage.value = 0
  messagesHasMore.value = false
  messagesTotal.value = 0
  loadingMore.value = false
  historyLoadError.value = false
}
const handleUnauthorized = (error: unknown) => {
  if (!isApiError(error) || error.status !== 401) return false
  appStore.clearAuth()
  authRequired.value = true
  conversationsError.value = ''
  messagesError.value = ''
  return true
}

const resetMailTouched = () => {
  mailTouched.endpoint = false
  mailTouched.username = false
  mailTouched.password = false
}

const applyMailConfig = (config: MailConfigDTO | null) => {
  mailConfig.value = config
  const configKey = config ? mailEndpointKey(config) : ''
  const matchesConfig = mailEndpointOptions.value.some(option => option.key === configKey)
  const onlyEndpoint = !config && mailEndpointOptions.value.length === 1 ? mailEndpointOptions.value[0] : undefined
  mailForm.endpointKey = matchesConfig ? configKey : (onlyEndpoint?.key ?? '')
  mailForm.username = config?.username ?? ''
  mailForm.password = ''
  mailPasswordVisible.value = false
  resetMailTouched()
}

const mailFieldMessages = (field: MailField) => {
  const message = mailValidationErrors.value[field]
  return mailTouched[field] && message ? [message] : []
}

const touchAllMailFields = () => {
  mailTouched.endpoint = true
  mailTouched.username = true
  mailTouched.password = true
}

const loadMailConfig = async () => {
  const loadVersion = ++mailConfigLoadVersion
  mailConfigLoading.value = true
  mailConfigLoadError.value = ''
  mailConfigSaveError.value = ''
  mailConfigSuccess.value = ''

  try {
    const [config, endpoints] = await Promise.all([
      mailApi.getConfig(),
      mailApi.getEndpoints(),
    ])
    if (loadVersion !== mailConfigLoadVersion || !emailConfigDialogOpen.value) return
    mailEndpoints.value = endpoints
    applyMailConfig(config)
  } catch (error) {
    if (loadVersion !== mailConfigLoadVersion) return
    if (handleUnauthorized(error)) {
      emailConfigDialogOpen.value = false
      return
    }
    mailConfigLoadError.value = isApiError(error) ? error.message : '邮箱配置或服务器列表加载失败，请稍后重试。'
  } finally {
    if (loadVersion === mailConfigLoadVersion) mailConfigLoading.value = false
  }
}

const loadOAuthServices = async () => {
  const loadVersion = ++oauthServicesLoadVersion
  oauthServicesLoading.value = true
  oauthServicesError.value = ''
  oauthServices.value = []

  try {
    const services = await oauthApi.getServices()
    if (loadVersion !== oauthServicesLoadVersion || !thirdPartyAuthDialogOpen.value) return
    oauthServices.value = services
  } catch (error) {
    if (loadVersion !== oauthServicesLoadVersion) return
    if (handleUnauthorized(error)) {
      thirdPartyAuthDialogOpen.value = false
      return
    }
    oauthServicesError.value = isApiError(error) ? error.message : '第三方服务列表加载失败，请稍后重试。'
  } finally {
    if (loadVersion === oauthServicesLoadVersion) oauthServicesLoading.value = false
  }
}

const parseAuthorizationUrl = (value: string) => {
  const url = new URL(value)
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new Error('服务返回了不受支持的授权地址。')
  }
  return url.toString()
}

const authorizeOAuthService = async (service: OAuthServiceDTO) => {
  if (service.connected || oauthActionPending.value) return

  const authorizationWindow = window.open('about:blank', '_blank')
  if (!authorizationWindow) {
    showError('授权页面被浏览器阻止，请允许本站打开新标签页后重试。')
    return
  }

  try {
    authorizationWindow.opener = null
  } catch {
    // Some browsers prevent changing opener; navigation can still continue safely.
  }

  oauthAuthorizingAppKey.value = service.appKey
  try {
    const result = await oauthApi.authorize(service.appKey)
    const authorizationUrl = parseAuthorizationUrl(result.authorizationUrl)
    if (authorizationWindow.closed) throw new Error('授权页面已关闭，请重新发起授权。')
    authorizationWindow.location.replace(authorizationUrl)
    oauthRefreshOnFocus.value = true
  } catch (error) {
    authorizationWindow.close()
    if (handleUnauthorized(error)) {
      thirdPartyAuthDialogOpen.value = false
      return
    }
    showError(isApiError(error)
      ? error.message
      : error instanceof Error ? error.message : '授权请求失败，请稍后重试。')
  } finally {
    oauthAuthorizingAppKey.value = null
  }
}

const openOAuthRevokeDialog = (service: OAuthServiceDTO) => {
  if (!service.connected || oauthActionPending.value) return
  oauthRevokeTarget.value = service
  oauthRevokeDialogOpen.value = true
}

const closeOAuthRevokeDialog = () => {
  if (oauthRevokingAppKey.value) return
  oauthRevokeDialogOpen.value = false
  oauthRevokeTarget.value = null
}

const revokeOAuthAuthorization = async () => {
  const service = oauthRevokeTarget.value
  if (!service?.connected || oauthActionPending.value) return

  oauthRevokingAppKey.value = service.appKey
  try {
    await oauthApi.revokeAuthorization(service.appKey)
    service.connected = false
    service.status = null
    service.scope = null
    service.expiresAt = null
    oauthRevokeDialogOpen.value = false
    oauthRevokeTarget.value = null
  } catch (error) {
    if (handleUnauthorized(error)) {
      oauthRevokeDialogOpen.value = false
      oauthRevokeTarget.value = null
      thirdPartyAuthDialogOpen.value = false
      return
    }
    showError(isApiError(error) ? error.message : '取消授权失败，请稍后重试。')
  } finally {
    oauthRevokingAppKey.value = null
  }
}

const refreshOAuthServicesOnFocus = () => {
  if (!oauthRefreshOnFocus.value) return
  oauthRefreshOnFocus.value = false
  if (thirdPartyAuthDialogOpen.value) void loadOAuthServices()
}

const persistMailConfig = async (): Promise<boolean> => {
  if (!mailFormValid.value) {
    touchAllMailFields()
    return false
  }
  const endpoint = selectedMailEndpoint.value
  if (!endpoint) {
    mailTouched.endpoint = true
    return false
  }

  const req: UpdateMailConfigReq = {
    host: endpoint.host,
    port: endpoint.port,
    secure: endpoint.secure,
    username: normalizedMailUsername.value,
  }
  if (mailForm.password.length > 0) req.password = mailForm.password

  try {
    await mailApi.updateConfig(req)
    const config = await mailApi.getConfig()
    if (!config) throw new Error('保存后未读取到邮箱配置。')
    applyMailConfig(config)
    return true
  } catch (error) {
    if (handleUnauthorized(error)) {
      emailConfigDialogOpen.value = false
      return false
    }
    mailConfigSaveError.value = isApiError(error) ? error.message : '邮箱配置保存失败，请稍后重试。'
    return false
  }
}

const saveMailConfig = async () => {
  if (mailConfigBusy.value || mailConfigLoading.value || !mailFormDirty.value) return
  if (!mailFormValid.value) {
    touchAllMailFields()
    return
  }

  mailConfigSaving.value = true
  mailConfigSaveError.value = ''
  mailConfigSuccess.value = ''

  try {
    if (await persistMailConfig()) mailConfigSuccess.value = '邮箱连接配置已保存。'
  } finally {
    mailConfigSaving.value = false
  }
}

const testMailConnection = async () => {
  if (!mailConfig.value || mailConfigBusy.value || mailConfigLoading.value) return
  if (mailFormDirty.value && !mailFormValid.value) {
    touchAllMailFields()
    return
  }

  mailConnectionTesting.value = true
  mailConfigSaveError.value = ''
  mailConfigSuccess.value = ''
  let configSaved = false

  try {
    if (mailFormDirty.value) {
      mailConfigSaving.value = true
      try {
        configSaved = await persistMailConfig()
      } finally {
        mailConfigSaving.value = false
      }
      if (!configSaved) return
    }

    const result = await mailApi.testConnection()
    if (result.connected) {
      mailConfigSuccess.value = '邮箱连接测试成功。'
    } else {
      mailConfigSaveError.value = configSaved ? '配置已保存，但连接测试失败。' : '邮箱连接测试失败。'
    }
  } catch (error) {
    if (handleUnauthorized(error)) {
      emailConfigDialogOpen.value = false
      return
    }
    const message = isApiError(error) ? error.message : '邮箱连接测试失败，请稍后重试。'
    mailConfigSaveError.value = configSaved ? `配置已保存，但连接测试失败：${message}` : message
  } finally {
    mailConnectionTesting.value = false
  }
}

const loadConversations = async () => {
  conversationsLoading.value = true
  conversationsError.value = ''
  authRequired.value = false
  try {
    conversations.value = await chatApi.getConversations()
    currentConversationId.value = conversations.value[0]?.name || ''
  } catch (error) {
    conversations.value = []
    if (!handleUnauthorized(error)) conversationsError.value = '会话列表加载失败。'
  } finally {
    conversationsLoading.value = false
  }
}

const loadMessages = async () => {
  const threadId = currentConversation.value?.thread_id
  if (!threadId) return
  stopActiveStream()
  resetMessagesPagination()
  const loadVersion = messagesLoadVersion
  let activeRun: ActiveRunDTO | null = null
  loading.value = true
  messagesError.value = ''
  currentMessages.value = []
  try {
    const result = await chatApi.getMessages(threadId, 0, MESSAGES_PAGE_SIZE)
    if (loadVersion !== messagesLoadVersion || currentConversation.value?.thread_id !== threadId) return
    currentMessages.value = result.messages.map(toHistoryMessage)
    messagesPage.value = result.pagination.page
    messagesHasMore.value = result.pagination.has_more
    messagesTotal.value = result.pagination.total
    activeRun = result.active_run
    if (activeRun) {
      const userMessage = activeRun.user_message
      if (!currentMessages.value.some(message => message.id === userMessage.id)) {
        currentMessages.value.push(toHistoryMessage(userMessage))
      }
      currentMessages.value.push({
        key: `run:${activeRun.run_id}:placeholder`,
        role: 'assistant',
        content: '',
        createdAt: activeRun.started_at,
        loading: true,
      })
    }
  } catch (error) {
    if (loadVersion === messagesLoadVersion && !handleUnauthorized(error)) messagesError.value = '消息加载失败。'
  } finally {
    if (loadVersion === messagesLoadVersion) {
      loading.value = false
      await nextTick()
      scrollToBottom()
    }
  }
  if (activeRun && loadVersion === messagesLoadVersion && currentConversation.value?.thread_id === threadId) {
    void streamActiveRun(activeRun.run_id, `run:${activeRun.run_id}:placeholder`, threadId)
  }
}

const streamActiveRun = async (runId: string, replyKey: string, threadId: string) => {
  if (activeRunId.value === runId && streamAbortController) return

  stopActiveStream()
  const controller = new AbortController()
  const currentStreamVersion = streamVersion
  streamAbortController = controller
  activeRunId.value = runId
  sending.value = true

  const placeholder = currentMessages.value.find(message => message.key === replyKey)
  if (!placeholder) {
    stopActiveStream()
    return
  }
  placeholder.content = ''
  placeholder.loading = true
  placeholder.toolCalls = []
  activeStreamMessageKeys.add(replyKey)

  const initializedMessageKeys = new Set<string>()
  let placeholderClaimed = false
  let messageOrdinal = 0
  let currentStreamMessageKey: string | null = null
  let hasSeenMessageStart = false

  const ensureStreamMessage = (ordinal: number) => {
    const messageKey = `run:${runId}:message:${ordinal}`
    let message = currentMessages.value.find(item => item.key === messageKey)

    if (!placeholderClaimed) {
      placeholderClaimed = true
      if (message && message !== placeholder) {
        const placeholderIndex = currentMessages.value.indexOf(placeholder)
        if (placeholderIndex >= 0) currentMessages.value.splice(placeholderIndex, 1)
        activeStreamMessageKeys.delete(placeholder.key)
      } else {
        activeStreamMessageKeys.delete(placeholder.key)
        placeholder.key = messageKey
        message = placeholder
      }
    }

    if (!message) {
      message = {
        key: messageKey,
        role: 'assistant',
        content: '',
        createdAt: new Date().toISOString(),
        loading: true,
        toolCalls: [],
      }
      currentMessages.value.push(message)
    }

    if (!initializedMessageKeys.has(messageKey)) {
      message.content = ''
      message.loading = true
      message.toolCalls = []
      initializedMessageKeys.add(messageKey)
      activeStreamMessageKeys.add(messageKey)
    }

    return message
  }

  const ensureCurrentStreamMessage = () => {
    if (currentStreamMessageKey) {
      const currentMessage = currentMessages.value.find(item => item.key === currentStreamMessageKey)
      if (currentMessage) return currentMessage
    }

    if (messageOrdinal === 0) messageOrdinal = 1
    const message = ensureStreamMessage(messageOrdinal)
    currentStreamMessageKey = message.key
    return message
  }

  const activateNextMessage = () => {
    const previousMessage = currentStreamMessageKey
      ? currentMessages.value.find(item => item.key === currentStreamMessageKey)
      : null
    const reuseImplicitMessage = !hasSeenMessageStart && messageOrdinal === 1
    if (!reuseImplicitMessage) messageOrdinal += 1
    hasSeenMessageStart = true

    const message = ensureStreamMessage(messageOrdinal)
    if (previousMessage && previousMessage.key !== message.key) previousMessage.loading = false
    message.loading = true
    currentStreamMessageKey = message.key
    return message
  }

  const handleStreamEvent = (event: ChatRunStreamEvent) => {
    if (event.type === 'done') return

    if (event.type === 'error') {
      const errorMessageKey = `run:${runId}:error`
      currentMessages.value = currentMessages.value.filter(message => !activeStreamMessageKeys.has(message.key))
      const existingError = currentMessages.value.find(message => message.key === errorMessageKey)
      if (existingError) {
        existingError.content = event.message
        existingError.createdAt = new Date().toISOString()
      } else {
        currentMessages.value.push({
          key: errorMessageKey,
          role: 'stream-error',
          content: event.message,
          createdAt: new Date().toISOString(),
        })
      }
      activeStreamMessageKeys.clear()
      nextTick(scrollToBottom)
      return
    }

    if (event.type === 'message_start') {
      activateNextMessage()
    } else if (event.type === 'text') {
      const message = ensureCurrentStreamMessage()
      message.content += event.content
    } else if (event.type === 'tool_call') {
      const message = ensureCurrentStreamMessage()
      const existingToolCall = message.toolCalls?.find(item => item.id === event.tool_call_id)
      if (existingToolCall) {
        existingToolCall.name = event.tool_name
        existingToolCall.status = 'running'
      } else {
        message.toolCalls?.push({ id: event.tool_call_id, name: event.tool_name, status: 'running' })
      }
    } else if (event.type === 'tool_result') {
      const message = ensureCurrentStreamMessage()
      const status: ToolCallStatus = event.is_error ? 'error' : 'success'
      const existingToolCall = message.toolCalls?.find(item => item.id === event.tool_call_id)
      if (existingToolCall) {
        existingToolCall.name = event.tool_name
        existingToolCall.status = status
      } else {
        message.toolCalls?.push({ id: event.tool_call_id, name: event.tool_name, status })
      }
    }
    nextTick(scrollToBottom)
  }

  try {
    await chatApi.streamRun(runId, (event) => {
      if (currentStreamVersion !== streamVersion || currentConversation.value?.thread_id !== threadId) return
      handleStreamEvent(event)
    }, controller.signal)
  } catch (error) {
    if (currentStreamVersion === streamVersion && !controller.signal.aborted) {
      currentMessages.value = currentMessages.value.filter(message => (
        !activeStreamMessageKeys.has(message.key) || message.content.trim().length > 0
      ))
      if (!handleUnauthorized(error)) showError('回复连接中断，刷新页面可继续获取。')
    }
  } finally {
    if (currentStreamVersion === streamVersion) {
      for (const messageKey of activeStreamMessageKeys) {
        const message = currentMessages.value.find(item => item.key === messageKey)
        if (message) {
          message.loading = false
          message.toolCalls = message.toolCalls?.filter(toolCall => toolCall.status !== 'running')
        }
      }
      activeStreamMessageKeys.clear()
      streamAbortController = null
      activeRunId.value = null
      sending.value = false
      await nextTick()
      scrollToBottom()
    }
  }
}

const loadOlderMessages = async () => {
  const threadId = currentConversation.value?.thread_id
  if (!threadId || authRequired.value || loading.value || loadingMore.value || !messagesHasMore.value) return

  const loadVersion = messagesLoadVersion
  const nextPage = messagesPage.value + 1
  const messagesArea = messagesAreaRef.value
  const previousScrollHeight = messagesArea?.scrollHeight ?? 0
  const previousScrollTop = messagesArea?.scrollTop ?? 0
  loadingMore.value = true
  historyLoadError.value = false
  let loadedPage = false

  try {
    const result = await chatApi.getMessages(threadId, nextPage, MESSAGES_PAGE_SIZE)
    if (loadVersion !== messagesLoadVersion || currentConversation.value?.thread_id !== threadId) return

    const existingIds = new Set(currentMessages.value.flatMap(message => message.id ? [message.id] : []))
    const olderMessages = result.messages
      .filter(message => !existingIds.has(message.id))
      .map(toHistoryMessage)
    currentMessages.value = [...olderMessages, ...currentMessages.value]
    messagesPage.value = result.pagination.page
    messagesHasMore.value = result.pagination.has_more
    messagesTotal.value = result.pagination.total
    loadedPage = true

    await nextTick()
    if (messagesArea && messagesAreaRef.value === messagesArea) {
      messagesArea.scrollTop = messagesArea.scrollHeight - previousScrollHeight + previousScrollTop
    }
  } catch (error) {
    if (loadVersion === messagesLoadVersion && !handleUnauthorized(error)) {
      historyLoadError.value = true
      showError('更早的消息加载失败，请稍后重试。')
    }
  } finally {
    if (loadVersion === messagesLoadVersion) {
      loadingMore.value = false
      await nextTick()
      const area = messagesAreaRef.value
      if (loadedPage && messagesHasMore.value && area && area.scrollHeight <= area.clientHeight + 1) {
        void loadOlderMessages()
      }
    }
  }
}

const onHistoryIntersect = (isIntersecting: boolean) => {
  if (isIntersecting && !historyLoadError.value) void loadOlderMessages()
}

const selectConversation = async (id: string) => {
  if (conversationSelectionDisabled.value) return
  drawerOpen.value = false
  if (id === currentConversationId.value) return
  stopActiveStream()
  currentConversationId.value = id
  currentMessages.value = []
  await loadMessages()
}

const updateProactiveReminder = async (value: boolean | null) => {
  const conversation = currentConversation.value
  if (!conversation || proactiveUpdating.value) return
  const enabled = Boolean(value)
  if (enabled === conversation.proactive_enabled) return

  proactiveUpdating.value = true
  try {
    await chatApi.updateProactive({ agentId: conversation.name, enabled })
    conversation.proactive_enabled = enabled
  } catch (error) {
    if (!handleUnauthorized(error)) showError('主动提醒设置失败，请稍后重试。')
  } finally {
    proactiveUpdating.value = false
  }
}

const updateJournal = async (value: boolean | null) => {
  const conversation = currentConversation.value
  if (!conversation || journalUpdating.value) return
  const enabled = Boolean(value)
  if (enabled === conversation.journal_enabled) return

  journalUpdating.value = true
  try {
    await chatApi.updateJournal({ agentId: conversation.name, enabled })
    conversation.journal_enabled = enabled
  } catch (error) {
    if (!handleUnauthorized(error)) showError('自动记录日志设置失败，请稍后重试。')
  } finally {
    journalUpdating.value = false
  }
}

const openClearContextDialog = () => {
  settingsMenuOpen.value = false
  clearContextDialogOpen.value = true
}

const openEmailConfigDialog = () => {
  settingsMenuOpen.value = false
  emailConfigDialogOpen.value = true
  void loadMailConfig()
}

const openThirdPartyAuthDialog = () => {
  settingsMenuOpen.value = false
  thirdPartyAuthDialogOpen.value = true
  void loadOAuthServices()
}

const closeThirdPartyAuthDialog = () => {
  if (oauthActionPending.value) return
  oauthServicesLoadVersion += 1
  oauthRevokeDialogOpen.value = false
  oauthRevokeTarget.value = null
  thirdPartyAuthDialogOpen.value = false
  oauthServicesLoading.value = false
  oauthServicesError.value = ''
  oauthServices.value = []
}

const closeEmailConfigDialog = () => {
  if (mailConfigBusy.value) return
  mailConfigLoadVersion += 1
  emailConfigDialogOpen.value = false
  mailConfigLoadError.value = ''
  mailConfigSaveError.value = ''
  mailConfigSuccess.value = ''
  mailPasswordVisible.value = false
}

const clearContext = async () => {
  const conversation = currentConversation.value
  if (!conversation || creatingThread.value) return
  creatingThread.value = true
  stopActiveStream()
  try {
    const thread = await chatApi.createThread(conversation.name)
    conversation.thread_id = thread.thread_id
    resetMessagesPagination()
    currentMessages.value = []
    messagesError.value = ''
    clearContextDialogOpen.value = false
  } catch (error) {
    if (handleUnauthorized(error)) {
      clearContextDialogOpen.value = false
    } else {
      showError('上下文清空失败，请稍后重试。')
    }
  } finally {
    creatingThread.value = false
  }
}

const onMessageKeydown = (event: KeyboardEvent) => {
  if (event.key !== 'Enter' || event.shiftKey || event.ctrlKey || event.altKey || event.metaKey || event.isComposing || event.keyCode === 229) return
  event.preventDefault()
  void sendMessage()
}

const sendMessage = async () => {
  const content = inputMessage.value.trim()
  const conversation = currentConversation.value
  if (!content || busy.value || !conversation) return
  sending.value = true
  messagesError.value = ''
  const nowIso = new Date().toISOString()
  currentMessages.value.push({ key: `local:user:${crypto.randomUUID()}`, role: 'user', content, createdAt: nowIso })
  inputMessage.value = ''
  let replyKey = `local:reply:${crypto.randomUUID()}`
  currentMessages.value.push({ key: replyKey, role: 'assistant', content: '', createdAt: nowIso, loading: true })
  await nextTick()
  scrollToBottom()
  try {
    const threadId = conversation.thread_id
    const run = await chatApi.sendMessage({ content, agentId: conversation.name, threadId })
    if (currentConversation.value !== conversation || (threadId && run.thread_id !== threadId)) {
      const idx = currentMessages.value.findIndex(message => message.key === replyKey)
      if (idx >= 0 && !currentMessages.value[idx]?.content) currentMessages.value.splice(idx, 1)
      sending.value = false
      return
    }
    conversation.thread_id = run.thread_id
    const reply = currentMessages.value.find(message => message.key === replyKey)
    if (!reply) {
      sending.value = false
      return
    }
    replyKey = `run:${run.run_id}:placeholder`
    reply.key = replyKey
    void streamActiveRun(run.run_id, replyKey, run.thread_id)
  } catch (error) {
    const idx = currentMessages.value.findIndex(message => message.key === replyKey)
    if (idx >= 0 && !currentMessages.value[idx]?.content) currentMessages.value.splice(idx, 1)
    if (!handleUnauthorized(error)) showError('回复未能完成，请稍后重新发送。')
    sending.value = false
    await nextTick()
    scrollToBottom()
  }
}
onMounted(async () => {
  window.addEventListener('focus', refreshOAuthServicesOnFocus)
  await loadConversations()
  await loadMessages()
})
onBeforeUnmount(() => {
  window.removeEventListener('focus', refreshOAuthServicesOnFocus)
  stopActiveStream()
})
</script>

<style scoped>
.chatbox-page {
  max-width: 1440px;
  margin: auto;
  padding: 28px 32px 24px;
  height: calc(100dvh - var(--site-nav-height));
  min-height: 440px;
  display: flex;
  flex-direction: column;
}

.chat-page-heading {
  display: flex;
  align-items: end;
  justify-content: space-between;
  gap: var(--site-space-3);
  margin-bottom: 22px;
  flex-shrink: 0;
}

.chat-page-heading .eyebrow {
  font-size: 0.6rem;
}

.chat-page-heading h1 {
  font-size: 1.5rem;
  font-weight: 600;
  margin-top: 5px;
}

.chat-page-heading > p {
  font-size: 0.8rem;
}

.chatbox-container {
  display: flex;
  gap: 20px;
  flex: 1;
  min-height: 0;
}

.desktop-conversations {
  width: 280px;
  flex-shrink: 0;
  overflow: hidden;
}

.chat-area {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.chat-header {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 18px 24px;
  flex-shrink: 0;
  border-bottom: 1px solid var(--site-border);
}

.header-avatar {
  flex-shrink: 0;
}

.chat-header-text {
  min-width: 0;
  flex: 1;
}

.chat-header h2 {
  font-size: 1rem;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.chat-header p {
  color: var(--site-muted);
  font-size: 0.72rem;
  margin-top: 3px;
}

.chat-settings-trigger {
  flex-shrink: 0;
}

.chat-settings-menu {
  width: min(360px, calc(100vw - 24px));
  padding-block: 6px;
  border: 1px solid var(--site-border);
}

.chat-setting-item {
  min-height: 76px;
  padding-block: 10px;
}

.chat-setting-description {
  margin-top: 4px;
  color: var(--site-muted);
  font-size: 0.72rem;
  line-height: 1.55;
  white-space: normal;
  overflow: visible;
  text-overflow: clip;
  -webkit-line-clamp: unset;
}

.chat-setting-item :deep(.v-list-item__prepend) {
  align-self: start;
  padding-top: 3px;
}

.settings-toggle-item :deep(.v-list-item__append) {
  align-self: center;
  margin-inline-start: var(--site-space-3);
}

.settings-toggle-item :deep(.v-switch) {
  flex: 0 0 auto;
}

.email-config-page {
  display: flex;
  flex-direction: column;
  background: var(--site-bg) !important;
  border-radius: 0 !important;
}

.email-config-toolbar {
  flex: 0 0 auto;
  border-bottom: 0;
}

.email-config-toolbar :deep(.v-toolbar-title) {
  font-size: 1rem;
  font-weight: 700;
  text-align: center;
}

.email-config-content {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: 40px 24px;
}

.email-config-shell {
  width: min(720px, 100%);
  margin: 0 auto;
}

.email-config-intro {
  display: flex;
  align-items: center;
  gap: 20px;
  margin-bottom: 28px;
}

.email-config-icon {
  width: 72px;
  height: 72px;
  flex: 0 0 72px;
  display: grid;
  place-items: center;
  border-radius: 50%;
  background: var(--site-soft);
}

.email-config-intro h2 {
  margin-top: 6px;
  font-size: 1.5rem;
  font-weight: 650;
}

.email-config-intro > div > p:last-child {
  margin-top: 8px;
  color: var(--site-muted);
  font-size: 0.9rem;
  line-height: 1.7;
}

.email-config-state {
  min-height: 320px;
  display: grid;
  place-items: center;
  align-content: center;
  gap: 12px;
  padding: 32px;
  text-align: center;
  color: var(--site-muted);
}

.email-config-state h3 {
  color: var(--site-text);
  font-size: 1.1rem;
}

.email-config-state .v-btn {
  margin-top: 6px;
}

.oauth-service-list {
  display: grid;
  gap: 12px;
}

.oauth-service-row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: center;
  gap: 20px;
  padding: 18px;
  border: 1px solid var(--site-border);
  border-radius: 8px;
  background: var(--site-surface);
}

.oauth-service-main,
.oauth-service-title {
  min-width: 0;
}

.oauth-service-heading {
  display: flex;
  align-items: center;
  gap: 12px;
}

.oauth-service-title {
  flex: 1;
}

.oauth-service-title h3 {
  font-size: 1rem;
  line-height: 1.45;
  overflow-wrap: anywhere;
}

.oauth-service-title span {
  display: block;
  margin-top: 3px;
  color: var(--site-muted);
  font-family: var(--font-mono);
  font-size: 0.72rem;
  overflow-wrap: anywhere;
}

.oauth-service-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 8px 18px;
  margin-top: 14px;
}

.oauth-service-meta > div {
  display: flex;
  min-width: 0;
  gap: 6px;
  font-size: 0.75rem;
  line-height: 1.55;
}

.oauth-service-meta dt {
  flex: 0 0 auto;
  color: var(--site-muted);
}

.oauth-service-meta dd {
  min-width: 0;
  color: var(--site-text);
  overflow-wrap: anywhere;
}

.oauth-service-action {
  min-width: 108px;
}

.email-config-form {
  display: grid;
  gap: 18px;
}

.email-config-status {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 14px 16px;
  border: 1px solid var(--site-border);
  border-radius: 8px;
  background: var(--site-surface);
}

.email-config-status > div {
  min-width: 0;
  display: grid;
  gap: 3px;
}

.email-config-status strong {
  font-size: 0.9rem;
}

.email-config-status span {
  color: var(--site-muted);
  font-size: 0.75rem;
}

.email-endpoint-select :deep(.v-field__input),
.email-endpoint-select :deep(.v-select__selection) {
  min-width: 0;
}

.email-endpoint-select :deep(.v-select__selection) {
  width: 100%;
  max-width: 100%;
}

.email-endpoint-selection {
  min-width: 0;
  width: 100%;
  display: flex;
  align-items: center;
  gap: 12px;
}

.email-endpoint-host {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.email-endpoint-meta {
  flex: 0 0 auto;
  margin-left: auto;
  color: var(--site-muted);
  font-size: 0.75rem;
  white-space: nowrap;
}

.email-endpoint-option :deep(.v-list-item-subtitle) {
  margin-top: 2px;
  color: var(--site-muted);
  font-size: 0.75rem;
}

.email-password-note {
  color: var(--site-muted);
  font-size: 0.75rem;
}

.email-password-note {
  display: flex;
  align-items: center;
  gap: 7px;
  margin-top: -8px;
}

.email-config-actions {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  padding-top: 4px;
}

.email-config-test-button {
  margin-right: auto;
}

.messages-area {
  min-height: 0;
  min-width: 0;
  flex: 1;
  overflow-y: auto;
  overscroll-behavior: contain;
  padding: var(--site-space-3);
  display: flex;
  flex-direction: column;
  gap: var(--site-space-3);
  scrollbar-width: thin;
  scrollbar-color: #9bbeb6 transparent;
}

.messages-area:focus-visible {
  outline-offset: -4px;
}

.chat-state {
  margin: auto;
  text-align: center;
  padding: 28px 12px;
  max-width: 440px;
  color: var(--site-muted);
}

.chat-state h3 {
  margin: 10px 0;
  color: var(--site-text);
  font-size: 1.5rem;
  font-weight: 550;
}

.chat-state p {
  font-size: 0.88rem;
  line-height: 1.85;
}

.chat-state .eyebrow {
  font-size: 0.6rem;
}

.chat-state .v-btn {
  margin-top: 22px;
}

.state-icon {
  display: grid;
  place-items: center;
  width: 72px;
  height: 72px;
  margin: 0 auto 22px;
  border: 1px solid var(--site-border);
  border-radius: 24px;
  background: var(--site-soft);
  color: var(--site-accent);
}

.message-row {
  display: flex;
  align-items: start;
  gap: 10px;
  flex-shrink: 0;
  min-width: 0;
}

.message-self {
  justify-content: flex-end;
}

.message-signal {
  width: 100%;
  justify-content: center;
  padding-block: 2px;
}

.signal-message {
  display: flex;
  align-items: center;
  justify-content: center;
  flex-wrap: wrap;
  gap: 6px;
  max-width: min(760px, 100%);
  color: var(--site-muted);
  font-size: 0.72rem;
  line-height: 1.5;
  text-align: center;
  overflow-wrap: anywhere;
}

.stream-error-message {
  color: rgb(var(--v-theme-error));
}

.message-avatar {
  margin-top: 25px;
  flex-shrink: 0;
}

.message-self .message-avatar {
  order: 2;
}

.message-bubble-wrapper {
  display: flex;
  flex-direction: column;
  align-items: start;
  min-width: 0;
  max-width: min(760px, 85%);
}

.message-self .message-bubble-wrapper {
  align-items: end;
}

.message-author {
  color: var(--site-muted);
  font-size: 0.72rem;
  margin-bottom: 6px;
}

.message-bubble {
  max-width: 100%;
  min-width: 0;
  padding: 14px 18px;
  border: 1px solid var(--site-border);
  border-radius: 0 16px 16px 16px;
}

.bubble-other {
  background: var(--site-bg);
}

.bubble-self {
  background: #ddf3ed;
  border-color: #c4e8df;
  border-radius: 16px 0 16px 16px;
}

.message-text {
  font-size: 1rem;
  line-height: 1.8;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
  margin: 0;
}

.message-time {
  font-size: 0.67rem;
  color: var(--site-muted);
  margin-top: 6px;
}

.reply-loading {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 0.85rem;
  color: var(--site-muted);
}

.tool-status-list {
  display: flex;
  flex-direction: column;
  gap: 7px;
  margin-top: 10px;
}

.tool-status-list:first-child {
  margin-top: 0;
}

.tool-status {
  display: flex;
  align-items: center;
  gap: 8px;
  min-height: 24px;
  font-size: 0.78rem;
  line-height: 1.5;
  color: var(--site-muted);
  overflow-wrap: anywhere;
}

.tool-status-success {
  color: rgb(var(--v-theme-success));
  animation: tool-status-expire 2s ease forwards;
}

.tool-status-error {
  color: rgb(var(--v-theme-error));
  animation: tool-status-expire 2s ease forwards;
}

@keyframes tool-status-expire {
  0%, 78% {
    opacity: 1;
  }

  100% {
    opacity: 0;
  }
}

@media (prefers-reduced-motion: reduce) {
  .tool-status-success,
  .tool-status-error {
    animation-name: tool-status-expire-reduced;
  }
}

@keyframes tool-status-expire-reduced {
  from, to {
    opacity: 1;
  }
}

.history-loader {
  min-height: 36px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--site-space-1);
  flex-shrink: 0;
  color: var(--site-muted);
  font-size: 0.72rem;
}

.markdown-content {
  white-space: normal;
}

.markdown-content :deep(p), .markdown-content :deep(ul), .markdown-content :deep(ol), .markdown-content :deep(blockquote), .markdown-content :deep(pre), .markdown-content :deep(table) {
  margin: 0 0 0.85em;
}

.markdown-content :deep(:last-child) {
  margin-bottom: 0;
}

.markdown-content :deep(h1), .markdown-content :deep(h2), .markdown-content :deep(h3), .markdown-content :deep(h4), .markdown-content :deep(h5), .markdown-content :deep(h6) {
  margin: 1em 0 0.5em;
  font-size: 1.1em;
  line-height: 1.5;
}

.markdown-content :deep(ul), .markdown-content :deep(ol) {
  padding-left: 1.5em;
}

.markdown-content :deep(blockquote) {
  border-left: 3px solid var(--site-primary);
  padding-left: 14px;
  color: var(--site-muted);
}

.markdown-content :deep(code) {
  font-family: var(--font-mono);
  font-size: 0.87em;
  background: #e1eeea;
  padding: 2px 5px;
  border-radius: 4px;
}

.markdown-content :deep(pre) {
  max-width: 100%;
  overflow-x: auto;
  padding: 14px;
  background: #e7f1ee;
  border: 1px solid var(--site-border);
  border-radius: 8px;
  white-space: pre;
  overflow-wrap: normal;
}

.markdown-content :deep(pre code) {
  padding: 0;
  background: transparent;
}

.markdown-content :deep(table) {
  display: block;
  max-width: 100%;
  overflow-x: auto;
  border-collapse: collapse;
  white-space: nowrap;
  overflow-wrap: normal;
}

.markdown-content :deep(th), .markdown-content :deep(td) {
  padding: 8px 12px;
  border: 1px solid #bdd6ce;
}

.markdown-content :deep(th) {
  background: var(--site-soft);
}

.markdown-content :deep(a) {
  color: var(--site-accent);
  text-decoration: underline;
  text-underline-offset: 3px;
}

.markdown-content :deep(img) {
  max-width: 100%;
  height: auto;
}

.markdown-content :deep(hr) {
  border: 0;
  border-top: 1px solid var(--site-border);
  margin-block: 16px;
}

.input-area {
  padding: 18px 24px 12px;
  border-top: 1px solid var(--site-border);
  flex-shrink: 0;
}

.composer-label {
  display: block;
  margin-bottom: 6px;
  color: var(--site-muted);
  font-size: 0.75rem;
}

.input-row {
  display: flex;
  align-items: end;
  gap: 12px;
}

.message-input {
  min-width: 0;
}

.send-btn {
  min-width: 100px;
  height: 56px !important;
}

.input-note {
  display: flex;
  flex-wrap: wrap;
  justify-content: space-between;
  gap: 4px;
  color: var(--site-muted);
  font-size: 0.65rem;
  margin-top: var(--site-space-1);
  min-height: 18px;
}

.mobile-conversations-toggle {
  display: none;
}

.drawer-card {
  height: 100%;
  border-radius: 0 20px 20px 0 !important;
}

@media (max-width: 959px) {
  .chatbox-page {
    padding: 20px 20px 16px;
  }
  .desktop-conversations {
    display: none;
  }
  .mobile-conversations-toggle {
    display: inline-grid;
    flex-shrink: 0;
  }
  .chat-header {
    padding: 14px 16px;
    gap: 10px;
  }
}

@media (max-width: 600px) {
  .chatbox-page {
    padding: 12px 12px max(12px, env(safe-area-inset-bottom));
    min-height: 0;
  }
  .chat-page-heading {
    display: none;
  }
  .chat-area {
    border-radius: 16px;
  }
  .chat-header {
    padding: var(--site-space-1);
    gap: 6px;
  }
  .header-avatar {
    display: none;
  }
  .chat-header h2 {
    font-size: 0.9rem;
  }
  .chat-header p {
    font-size: 0.65rem;
  }
  .chat-settings-trigger {
    width: 36px;
    height: 36px;
  }
  .messages-area {
    padding: 16px 12px;
    gap: 20px;
  }
  .message-bubble-wrapper {
    max-width: calc(100% - 42px);
  }
  .message-bubble {
    padding: 11px 13px;
  }
  .input-area {
    padding: 12px 10px 8px;
  }
  .input-row {
    gap: var(--site-space-1);
  }
  .send-btn {
    min-width: 76px;
    padding-inline: 12px;
    font-size: 0.8rem;
  }
  .send-btn :deep(.v-btn__prepend) {
    display: none;
  }
  .chat-state h3 {
    font-size: 1.25rem;
  }
  .chat-state p {
    font-size: 0.8rem;
  }
  .email-config-content {
    padding: 24px 20px max(24px, env(safe-area-inset-bottom));
  }
  .email-config-intro {
    align-items: flex-start;
    gap: 14px;
    margin-bottom: 24px;
  }
  .email-config-icon {
    width: 56px;
    height: 56px;
    flex-basis: 56px;
  }
  .email-config-intro h2 {
    font-size: 1.25rem;
  }
  .oauth-service-row {
    grid-template-columns: minmax(0, 1fr);
    gap: 16px;
    padding: 16px;
  }
  .oauth-service-heading {
    align-items: flex-start;
  }
  .oauth-service-action {
    width: 100%;
  }
  .email-config-actions .v-btn:last-child {
    flex: 1;
  }
  .email-config-actions {
    flex-wrap: wrap;
  }
  .email-config-test-button {
    width: 100%;
    margin-right: 0;
  }
}

@media (max-height: 550px) {
  .chat-page-heading {
    display: none;
  }
  .chatbox-page {
    min-height: 0;
    padding-block: var(--site-space-1);
  }
  .input-note {
    display: none;
  }
  .chat-header {
    padding-block: 6px;
  }
  .input-area {
    padding-block: var(--site-space-1);
  }
  .chat-state {
    padding-block: var(--site-space-1);
  }
  .state-icon {
    display: none;
  }
}
</style>
