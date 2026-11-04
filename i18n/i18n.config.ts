import { zhHans } from 'vuetify/locale'

export default defineI18nConfig(() => ({
  legacy: false,
  locale: 'zh',
  fallbackLocale: 'zh',
  messages: {
    zh: {
      $vuetify: zhHans,
      noData: {
        mailServers: '暂无可用邮箱服务器',
        producers: '暂无匹配的 P主，可直接输入新名称',
        songs: '暂无匹配的歌曲',
        sources: '暂无匹配的资料来源',
        tours: '暂无匹配的巡演',
        venues: '暂无匹配的场地',
      },
    },
    'zh-CN': {
      $vuetify: zhHans,
      noData: {
        mailServers: '暂无可用邮箱服务器',
        producers: '暂无匹配的 P主，可直接输入新名称',
        songs: '暂无匹配的歌曲',
        sources: '暂无匹配的资料来源',
        tours: '暂无匹配的巡演',
        venues: '暂无匹配的场地',
      },
    },
  },
}))
