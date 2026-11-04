<template>
  <div class="admin-home site-container">
    <section class="admin-home-shell" aria-labelledby="admin-home-title">
      <header class="admin-home-heading">
        <p class="eyebrow">ADMIN / 管理中心</p>
        <h1 id="admin-home-title">选择管理区域<span>。</span></h1>
        <p class="muted">管理用户账户，或维护 Miku 的演唱会资料库。</p>
      </header>
      <div class="admin-home-grid">
        <nuxt-link to="/admin/users" class="admin-entry surface-card">
          <span class="admin-entry-icon"><v-icon icon="mdi-account-group-outline" size="30" /></span>
          <div><p class="eyebrow">USERS</p><h2>用户管理</h2><p class="muted">查看用户、调整账户状态并重置密码。</p></div>
          <v-icon icon="mdi-arrow-right" class="admin-entry-arrow" />
        </nuxt-link>
        <nuxt-link to="/admin/knowledge" class="admin-entry surface-card admin-entry-primary">
          <span class="admin-entry-icon"><v-icon icon="mdi-database-edit-outline" size="30" /></span>
          <div><p class="eyebrow">KNOWLEDGE</p><h2>资料库维护</h2><p class="muted">维护巡演、场次、歌单、场地、歌曲与来源。</p></div>
          <v-icon icon="mdi-arrow-right" class="admin-entry-arrow" />
        </nuxt-link>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
useSeoMeta({ title: '管理中心 · Ivan1105' })
</script>

<style scoped>
.admin-home { padding-block: 64px 88px; }
.admin-home-shell { max-width: 1080px; margin-inline: auto; }
.admin-home-heading { margin-bottom: 32px; }
.admin-home-heading h1 { margin: 6px 0 10px; font-size: clamp(2rem, 5vw, 3.6rem); letter-spacing: -.05em; }
.admin-home-heading h1 span { color: #39c5bb; }
.admin-home-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 20px; }
.admin-entry { min-height: 210px; padding: 28px; display: grid; grid-template-columns: auto 1fr auto; align-items: start; gap: 20px; color: var(--site-text); text-decoration: none; border: 1px solid var(--site-border); transition: transform 180ms ease, border-color 180ms ease, box-shadow 180ms ease; }
.admin-entry:hover { transform: translateY(-3px); border-color: #39c5bb; box-shadow: 0 20px 50px rgb(24 59 56 / 10%); }
.admin-entry-primary { background: linear-gradient(145deg, #fff 45%, rgb(57 197 187 / 12%)); }
.admin-entry-icon { width: 58px; height: 58px; border-radius: 18px; display: grid; place-items: center; color: #183b38; background: rgb(57 197 187 / 24%); }
.admin-entry h2 { margin: 4px 0 10px; font-size: 1.45rem; }
.admin-entry-arrow { align-self: center; color: var(--site-muted); }
@media (max-width: 760px) { .admin-home { padding-block: 40px 64px; } .admin-home-grid { grid-template-columns: 1fr; } .admin-entry { min-height: 180px; padding: 22px; } }
</style>
