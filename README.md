# HIJ Cue

Internal task tracker for the Hope in Jesus (HIJ) media, worship and production team.

- **Mobile team view** (`/`) — pick your name (no password), My / All tasks, detail, status, comments, file attachments
- **Admin panel** (`/admin`) — email/password login, task CRUD, team management, filters, files, comments

Stack: Next.js · Supabase · shadcn/ui · Vercel-ready

## Setup

1. **Run the schema** in Supabase → SQL Editor → paste and run `supabase/schema.sql`  
   (creates tables, RLS, storage bucket, seed people + tasks)

2. **Add service role key** to `.env.local`  
   Supabase → Project Settings → API → `service_role` (or secret key):

   ```
   SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
   ```

3. **Seed admin auth users**

   ```bash
   npm run seed:admins
   ```

   Creates / resets:
   - `pr.anish@hij.com`
   - `sushma@hij.church`
   - `deepak@hij.church`  
   Password: `CueAdmin2026!` (override with `ADMIN_SEED_PASSWORD`)

4. **Env already set** (publishable):

   ```
   NEXT_PUBLIC_SUPABASE_URL=https://zubfhrxvjvpcgcseyrqt.supabase.co
   NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=…
   ```

5. Deploy on Vercel — set the same env vars (including `SUPABASE_SERVICE_ROLE_KEY` for server actions that need it; publishable keys for the client).

## Design

Tokens and overdue treatment follow `Cue design plan` / `HIJ Cue` mockups:

- Ink `#101729`, late oxblood `#8C3B34` full-row band
- Archivo + IBM Plex Mono
- Status as text only (no colour pills)

## Scripts

| Command | Purpose |
|---|---|
| `npm run seed:admins` | Create/link admin Auth users |
| `npm run build` | Production build |
