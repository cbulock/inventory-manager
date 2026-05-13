# Copilot Instructions

## Build, test, and lint commands

```bash
npm install
npm run dev
npm run build
npm run generate
npm run preview
```

- There is currently **no test script** in `package.json`.
- There is currently **no lint script** in `package.json`.
- There is currently **no single-test command** because no test runner is configured in this repo yet.

For live data work, apply the Supabase schema and seed data before expecting the app to leave preview mode:

```bash
supabase db push
supabase db seed --file supabase/seed.sql
```

## High-level architecture

- This is a **Nuxt 4 + Supabase** app with authenticated inventory flows centered on **projects**. The main user-facing routes are `/login`, `/confirm`, `/dashboard`, and `/projects/[id]`.
- The **page layer** (`app/pages/*.vue`) is mostly orchestration/UI. Protected pages use `definePageMeta({ middleware: 'auth' })`, fetch data with `useAsyncData`, and call methods from `useInventoryData()`.
- `app/composables/useInventoryData.ts` is the main client-side data boundary. It decides whether to:
  - call the server API for live Supabase-backed data, or
  - return seeded preview data from `app/composables/useInventoryPreview.ts` when Supabase/auth is unavailable.
- The **read path** is split into thin API handlers and a shared server utility:
  - `server/api/dashboard.get.ts` and `server/api/projects/[id].get.ts` are thin wrappers
  - `server/utils/inventory.ts` performs the real read-side aggregation/shaping for dashboard and project detail payloads
  - the response shapes are defined in `app/types/inventory.ts` and reused across client/server
- The **write path** is split between route handlers and database functions:
  - server handlers validate HTTP input and call Supabase
  - item create/update/adjust flows delegate to SQL RPCs defined in `supabase/migrations/20260510232954_initial_schema.sql`
  - project item mutations are intentionally centered on database functions like `create_project_item_with_tags`, `update_project_item_with_tags`, and `adjust_project_item_quantity`
- The Supabase schema is the real authorization boundary. The migration sets up:
  - RLS policies
  - owner/editor/viewer project membership rules
  - auth triggers that mirror Google-authenticated users into `public.profiles`
  - storage and validation rules for item photo metadata and paths

## Key conventions

- **Preview fallback is only for missing/unconfigured live access.** Keep the fallback in `useInventoryData.ts`, but do not silently swap back to preview data after live-mode query or mutation failures. When live mode is active, surface the real error.
- **Keep API routes thin.** Shared read aggregation belongs in `server/utils/inventory.ts`; route files should mainly parse input, enforce required params, and call shared helpers or Supabase RPCs.
- **Reuse the shared inventory types.** `app/types/inventory.ts` is the contract between pages, composables, and server responses. Match those shapes instead of inventing route-local payload types.
- **Preserve typed Supabase calls.** Existing mutation routes use generated database types with `satisfies Database['public']['Functions'][...]['Args']` or typed table inserts. Follow that pattern instead of weakening types.
- **Tags are owner-scoped, not project-scoped.** New tag names are created under the project owner, and tag links are validated against the project owner in SQL. Do not treat tags as globally shared across unrelated owners.
- **Project membership drives edit permissions.** Read access follows project membership; edit access is limited to `owner` and `editor`. Keep UI permission checks aligned with the database functions and RLS policies.
- **Photo uploads use a stable per-item storage path.** Both client and server build the photo path as `${projectId}/${itemId}/photo` in the `item-photos` bucket. Keep metadata writes and storage object writes in sync.
- **Project types and suggestions come from seeded data.** The built-in crafting categories and suggestion lists are defined in `supabase/seed.sql`, and the UI has explicit fallback behavior when project types have not been seeded yet.
- **Cindor components are custom elements.** The app uses `cindor-*` web components globally via `cindor.client.ts`, and Nuxt is configured to treat `cindor-` tags as custom elements in `nuxt.config.ts`.
