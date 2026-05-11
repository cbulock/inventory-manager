// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  devtools: { enabled: true },
  modules: ['@nuxtjs/supabase'],
  css: ['cindor-ui-core/styles.css', '~/assets/css/main.css'],
  runtimeConfig: {
    public: {
      siteUrl: process.env.NUXT_PUBLIC_SITE_URL || 'http://localhost:3000',
    },
  },
  supabase: {
    redirect: false,
    types: '~/types/database.types.ts',
    redirectOptions: {
      login: '/login',
      callback: '/confirm',
      exclude: ['/login', '/confirm'],
    },
    cookieOptions: {
      maxAge: 60 * 60 * 8,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
    },
  },
  vite: {
    vue: {
      template: {
        compilerOptions: {
          isCustomElement: tag => tag.startsWith('cindor-'),
        },
      },
    },
  },
})
