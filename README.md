# Mirror of Us ♡

A mobile-first, romantic camera experience made with HTML, CSS, and vanilla JavaScript. The user sees a cute reactive avatar (powered by Lottie vector animations and MediaPipe) that smiles, waves, dances, and hearts back, while taking silent, high-resolution photo snapshots every 2 seconds to your private Supabase storage.

Included is a **Secret Admin Gallery** (`gallery.html`) so you can watch incoming moments arrive live in real time, filter by gesture, inspect in full-resolution lightbox, and download them.

---

## What's Included

- **2-Second Silent Photo Engine**: Captures photos every 2 seconds via `<canvas>` without video recording overhead or iOS Safari WebM codec issues.
- **Lottie Vector Animations**: 5 animated reactions (`smile`, `wave`, `dance`, `heart`, `talk`) in `assets/` with smooth fallbacks.
- **MediaPipe AI Recognition**: Detects 2-hand hearts (`heart_shape`), waves (`wave`), dancing (`dance`), speaking (`talking`), or smiling (`low_movement`).
- **Secret Admin Gallery (`gallery.html`)**:
  - Live Auto-Stream (polls every 3s)
  - Fullscreen Lightbox with arrow key navigation
  - Action Category Filters (Hearts, Waves, Dances, Talking, Smiles)
  - Quick Download & Delete controls
  - Private signed URL generator for private buckets
- **100% Mobile & iOS Safari Compatible**: `playsinline`, `webkit-playsinline`, no microphone prompts required for photo capture.

---

## Running Locally

Because camera APIs require a secure context (HTTPS or localhost):

```bash
# Start a static web server
npx serve .
```

1. Open `http://localhost:3000` (or the network IP on your phone) for the Mirror experience.
2. Open `http://localhost:3000/gallery.html` on your laptop/phone to watch the moments arrive live!

---

## Supabase Setup & Storage Policies

1. Create a Supabase project.
2. Create a Storage bucket named `gf-moments`. Keep it private.
3. Run this SQL in your Supabase SQL Editor:

```sql
create extension if not exists pgcrypto;

-- 1. Moments metadata table
create table public.moments (
  id uuid primary key default gen_random_uuid(),
  file_url text not null,
  file_type text not null check (file_type in ('photo', 'video')),
  detected_action text not null,
  animation_shown text not null,
  created_at timestamptz not null default now()
);

-- 2. Row Level Security policies
alter table public.moments enable row level security;

-- Allow anonymous inserts (from mirror)
create policy "anonymous can insert moment metadata"
on public.moments for insert to anon with check (true);

-- Allow reads for the gallery viewer
create policy "allow reads for moments gallery"
on public.moments for select to anon using (true);

-- Allow anonymous uploads into the gf-moments bucket
create policy "anonymous can upload moments"
on storage.objects for insert to anon
with check (bucket_id = 'gf-moments');

-- Allow signed URL creation / downloads
create policy "allow read access to moments"
on storage.objects for select to anon
using (bucket_id = 'gf-moments');
```

---

## Secret Admin Gallery (`gallery.html`)

- Access the gallery by navigating directly to `/gallery.html` or tapping the small `♥` icon in the footer of the mirror.
- If your Supabase bucket is private and you don't want an anon SELECT policy, click **⚙ Supabase Keys** in the gallery header and paste your Supabase Service Role key (saved safely in your browser's `localStorage`).

---

## Deployment (Vercel)

1. Import this folder into [Vercel](https://vercel.com) (Framework: **Other** / None).
2. Set Root Directory to `./`.
3. Deploy! Because Vercel provides HTTPS out of the box, camera permissions will work instantly on all iPhones and Android devices.
