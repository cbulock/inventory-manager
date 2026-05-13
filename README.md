# Inventory Manager

Nuxt 4 foundation for a shared inventory app built around project-specific inventory, Supabase auth/data, and the Cindor component library.

## What is already wired

- Nuxt 4 app scaffold
- Supabase module integration with Google OAuth entry flow
- Cindor web-component registration and global styles, with the Vue wrapper package installed for upcoming component wrappers
- Auth-aware routing with dedicated login and callback screens
- Project-centric dashboard and project detail pages that read from Supabase when configured, with preview fallback data when it is not
- Initial Supabase schema, seed data, storage bucket rules, and RLS policies for the project-centric inventory model
- Live project creation plus project-item create, edit, delete, tagging, photo upload, and quantity-adjustment flows wired against the Supabase schema

## Tech stack

- Nuxt 4
- `@nuxtjs/supabase`
- Supabase Auth / Postgres / Storage
- `cindor-ui-core`
- `cindor-ui-vue`

## Environment setup

Copy `.env.example` to `.env` and fill in your Supabase project values.

```bash
copy .env.example .env
```

Required variables:

```env
NUXT_PUBLIC_SITE_URL=http://localhost:3000
NUXT_PUBLIC_SUPABASE_URL=https://your-project-ref.supabase.co
NUXT_PUBLIC_SUPABASE_KEY=your-supabase-publishable-key
```

Optional for server-side Supabase access:

```env
NUXT_SUPABASE_SECRET_KEY=your-supabase-secret-key
```

Optional for project invite email delivery:

```env
NUXT_SMTP_HOST=smtp.example.com
NUXT_SMTP_PORT=587
NUXT_SMTP_SECURE=false
NUXT_SMTP_USER=your-smtp-username
NUXT_SMTP_PASS=your-smtp-password
NUXT_SMTP_FROM=inventory@example.com
NUXT_SMTP_FROM_NAME=Inventory Manager
```

If you deploy on Netlify, configure the same values as Netlify environment variables so invite emails can be sent from the hosted server runtime.

## Run locally

```bash
npm install
npm run dev
```

## Apply the Supabase schema

Apply the migrations in `supabase/migrations`, then run `supabase/seed.sql` against your Supabase project before expecting live data to load.

If you are using the Supabase CLI, the usual flow is:

```bash
supabase db push
supabase db seed --file supabase/seed.sql
```

If you are not using the CLI in this repo yet, run the migration SQL files from the Supabase SQL editor in timestamp order, then run the seed file.

The current migrations are:

- `supabase/migrations/20260510232954_initial_schema.sql`
- `supabase/migrations/20260512145000_project_invites.sql`

## Invite emails

Project invites are created from the app and delivered through SMTP using the server runtime. For local development or Netlify deployment, set the SMTP variables above before expecting invite emails to send successfully.

Invite acceptance also depends on the invite schema migration being applied.

## Current app shape

- `/login` - Google sign-in entry point
- `/confirm` - OAuth callback handoff
- `/dashboard` - project list, low-stock summary, and project creation
- `/projects/[id]` - project inventory view, built-in suggestions, item creation, and collaborator management
- `/invites/[token]` - authenticated invite review and accept/decline flow

## Database foundation

- `supabase/migrations/20260510232954_initial_schema.sql` creates the initial schema
- `supabase/migrations/20260512145000_project_invites.sql` adds pending email invites for collaborators
- `supabase/seed.sql` seeds built-in project types including Crafting, Knitting, Crochet, Card Making, Jewelry, Sewing, Embroidery, and Painting & Mixed Media
- Google-authenticated users are mirrored into `public.profiles` automatically through auth triggers
- Projects are private by default and use `owner`, `editor`, and `viewer` roles in `project_members`
- Pending collaborator invites are stored separately until accepted, declined, or revoked
- Item photos are stored in the `item-photos` bucket and use stable per-item paths under `project-id/item-id/photo`

The schema currently covers:

- `profiles`
- `project_types`
- `suggested_items`
- `projects`
- `project_members`
- `project_invites`
- `project_items`
- `item_tags`
- `item_tag_links`
- `item_photos`
- `item_adjustments`

## Important note

The app now uses live Supabase reads and create flows when the environment is configured and the schema has been applied. It still falls back to preview data only when Supabase is unavailable or unconfigured. Once live mode is active, query and mutation failures are surfaced explicitly instead of silently swapping to preview data.

The largest remaining product gaps are project editing/deletion and broader collaboration management beyond the current invite flow.
