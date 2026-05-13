// https://nuxt.com/docs/api/configuration/nuxt-config
const nitroConfig = process.env.NETLIFY ? { preset: "netlify" as const } : {};
const hasPublicSupabaseConfig = Boolean(
  (process.env.NUXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL)
  && (
    process.env.NUXT_PUBLIC_SUPABASE_KEY
    || process.env.SUPABASE_KEY
    || process.env.SUPABASE_PUBLISHABLE_KEY
    || process.env.SUPABASE_ANON_KEY
    || process.env.NUXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
    || process.env.NUXT_PUBLIC_SUPABASE_ANON_KEY
  ),
);

export default defineNuxtConfig({
  compatibilityDate: "2025-07-15",
  devtools: { enabled: true },
  modules: ["@nuxtjs/supabase"],
  css: ["cindor-ui-core/styles.css", "~/assets/css/main.css"],
  nitro: nitroConfig,
  runtimeConfig: {
    smtp: {
      from: process.env.NUXT_SMTP_FROM || "",
      fromName: process.env.NUXT_SMTP_FROM_NAME || "Inventory Manager",
      host: process.env.NUXT_SMTP_HOST || "",
      pass: process.env.NUXT_SMTP_PASS || "",
      port: Number(process.env.NUXT_SMTP_PORT || 587),
      secure: process.env.NUXT_SMTP_SECURE === "true",
      user: process.env.NUXT_SMTP_USER || "",
    },
    public: {
      hasPublicSupabaseConfig,
      siteUrl: process.env.NUXT_PUBLIC_SITE_URL || "http://localhost:3000",
    },
  },
  supabase: {
    key: process.env.NUXT_PUBLIC_SUPABASE_KEY
      || process.env.SUPABASE_KEY
      || process.env.SUPABASE_PUBLISHABLE_KEY
      || process.env.SUPABASE_ANON_KEY
      || process.env.NUXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
      || process.env.NUXT_PUBLIC_SUPABASE_ANON_KEY
      || 'inventory-manager-preview-anon-key',
    redirect: false,
    types: "~/types/database.types.ts",
    url: process.env.NUXT_PUBLIC_SUPABASE_URL
      || process.env.SUPABASE_URL
      || 'https://inventory-manager-preview.supabase.co',
    redirectOptions: {
      login: "/login",
      callback: "/confirm",
      exclude: ["/login", "/confirm"],
    },
    cookieOptions: {
      maxAge: 60 * 60 * 8,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
    },
  },
  vite: {
    optimizeDeps: {
      include: ["cindor-ui-core", "cindor-ui-vue"],
    },
    vue: {
      template: {
        compilerOptions: {
          isCustomElement: (tag) => tag.startsWith("cindor-"),
        },
      },
    },
  },
});
