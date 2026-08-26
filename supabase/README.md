# Supabase setup (Phase 2 cloud accounts)

One-time setup. Takes ~5 minutes. Do steps 1–4; send Claude the two values from step 2.

### 1. Create the project
1. Go to **[supabase.com](https://supabase.com)** → sign up (free) → **New project**.
2. Name it `party-quest`, pick a strong database password (save it somewhere), choose the nearest
   region → **Create new project**. Wait ~1 min for it to provision.

### 2. Copy the two public keys → send them to Claude
- **Project Settings** (gear, bottom-left) → **API**.
- Copy the **Project URL** and the **`anon` `public` key**.
- These are safe to share and safe to ship in the app — the security is in the database rules, not
  the key. **Do NOT send the `service_role` key** (that one is secret).

### 3. Make sign-up instant (turn off email confirmation)
- **Authentication** → **Providers** → **Email** → turn **"Confirm email"** OFF → **Save**.
  (This lets you and your wife sign up and be logged in immediately, with no confirmation email.)

### 4. Create the tables + security rules
- **SQL Editor** → **New query** → paste the entire contents of **`schema.sql`** → **Run**.
- You should see "Success. No rows returned."

That's it. Once Claude has the URL + anon key, cloud sync goes live on the deployed app.
