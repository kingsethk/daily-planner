# Progrex

A daily planner with cloud sync via Supabase.

## Setup (one time)

### 1. Run the database schema
- Go to your Supabase dashboard → SQL Editor → New Query
- Copy everything from `supabase/schema.sql` and paste it in
- Click Run

### 2. Enable Email auth
- Supabase dashboard → Authentication → Providers
- Make sure Email is enabled (it is by default)
- For magic links to work, confirm "Enable email confirmations" is ON

### 3. Set your site URL (important for magic links)
- Supabase dashboard → Authentication → URL Configuration
- Set Site URL to: `https://kingsethk.github.io/daily-planner/`
- Add to Redirect URLs: `https://kingsethk.github.io/daily-planner/`

### 4. Upload to GitHub
- Push all files in this folder to your repo
- Make sure `index.html` is at the root
- GitHub Pages will serve it automatically

## File structure
```
progrex/
├── index.html       ← main app shell + auth screen
├── css/
│   └── style.css    ← all styles
├── js/
│   ├── config.js    ← Supabase URL + anon key
│   ├── db.js        ← all database operations
│   ├── auth.js      ← login/signup/magic link
│   ├── app.js       ← state management + Supabase integration
│   └── ui.js        ← all render functions
└── supabase/
    └── schema.sql   ← run this in Supabase SQL editor
```

## How offline works
- All writes go to localStorage instantly
- Then sync to Supabase in the background
- If offline, writes queue up and sync when back online
- On new device: log in → data loads from cloud automatically
