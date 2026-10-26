// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2025-12-21',
  devtools: { enabled: true },

  // ssr: false,
  modules: ['@nuxt/fonts', 'vuetify-nuxt-module', '@pinia/nuxt', '@nuxtjs/i18n'],

  postcss: {
    plugins: {
      '@tailwindcss/postcss': {},
    },
  },

  vite: {
    build: {
      cssMinify: 'lightningcss',
    },
  },

  css: [
    'vuetify/styles',
    'assets/styles/tailwind.css',
    'assets/styles/theme.css',
  ],

  vuetify: {
    moduleOptions: {
      styles: {
        configFile: 'assets/styles/settings.scss',
        colors: false,
        utilities: false,
      },
    },
    vuetifyOptions: {
      theme: {
        defaultTheme: 'light',
        utilities: true,
        themes: {
          light: {
            dark: false,
            colors: {
              primary: '#39c5bb',
              'on-primary': '#183B38',
              secondary: '#18776F',
              background: '#F5FBFA',
              surface: '#FFFFFF',
              'surface-variant': '#E9F6F3',
              'on-background': '#183B38',
              'on-surface': '#183B38',
              'on-surface-variant': '#526F6C',
              error: '#B73848',
              success: '#247347',
              warning: '#8B5C0A',
              info: '#266C91',
            },
          },
        },
      },
      defaults: {
        VBtn: { rounded: 'lg', elevation: 0, height: 44 },
        VCard: { rounded: 'xl', elevation: 0 },
        VTextField: { color: 'secondary', variant: 'outlined' },
        VTextarea: { color: 'secondary', variant: 'outlined' },
      },
      display: {
        mobileBreakpoint: 'md',
        thresholds: {
          xs: 0, sm: 600, md: 960, lg: 1280, xl: 1920, xxl: 2560,
        },
      },
    },
  },

  i18n: {
    defaultLocale: 'en',
    vueI18n: './i18n.config.ts',
  },

  app: {
    head: {
      htmlAttrs: { lang: 'zh-CN' },
      meta: [{ name: 'viewport', content: 'width=device-width, initial-scale=1, interactive-widget=resizes-content' }],
    },
  },

  runtimeConfig: {
    public: {
      // 会被 NUXT_PUBLIC_API_BASE 环境变量自动覆盖
      apiUrl: '',
      ossUrl: '',
      firebase: {
        apiKey: '',
        authDomain: '',
        projectId: '',
        storageBucket: '',
        messagingSenderId: '',
        appId: '',
        vapidKey: '',
      },
    },
  },
})
