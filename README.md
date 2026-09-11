# Free Time Manager

Turn your class/work timetable into a smart weekly study plan. Add your fixed
commitments (by hand or by scanning a photo/PDF of your timetable), rate how
hard each subject is, and the planner fills your free time with study
sessions — giving harder subjects more time than easy ones — while capping
how much of each day it uses so you keep real free time too.

Installable as a PWA on desktop and mobile, with your data synced across
devices via Supabase.

## Features

- **Timetable import** — for a native (non-scanned) PDF, reads the PDF's own
  text layer and layout to reconstruct the day/time grid directly (far more
  accurate than OCR); falls back to on-device OCR (Tesseract.js) for photos
  or scanned PDFs. Either way you get an editable review table before
  anything is saved.
- **"Par quinzaine" / biweekly classes** — when two classes are detected in
  the exact same slot for the same student group (the classic sign of a
  class that only meets every other week), the app flags the pair and asks
  which week each one falls on. You can also set this manually on any entry.
- **Subjects with difficulty ratings** — rate each subject 1–5; harder
  subjects get proportionally more study time. You can also pin a subject to
  a fixed weekly minute target instead.
- **Automatic weekly planner** — computes your free time around the
  timetable and allocates study sessions into it, capped by a daily study
  goal so it never eats your whole day. Fills your stated "most productive
  hours" first; skips short gaps squeezed between back-to-back classes
  (configurable, default 4h) so real breaks stay breaks; and schedules a
  review session right before each class (once it's linked to a subject) so
  you walk in prepared. Your major/program intensity can suggest a sensible
  daily study goal to start from.
- **Exams** — add exam dates per subject, either by hand or by scanning a
  photo/PDF of an exam schedule (same on-device OCR/PDF pipeline as the
  timetable import, with an editable review table before saving). The
  planner automatically shifts more study time to a subject the closer its
  exam gets (a flat boost within exam week, tapering off over the 3 weeks
  before), pulling time away from subjects without one coming up.
- **"When do you want to study?" prompt** — before generating a plan, pick
  your preferred study window for the week (a preset like morning/evening,
  or a custom range), instead of the app assuming everyone wants to study at
  the same time of day. Optionally save it as your default.
- **Drag-and-drop + direct editing** — rearrange any generated session by
  dragging it to a new day/time, or open its ⋯ menu to edit the day, start
  time, and duration precisely (e.g. shrink a session because you finished
  early or stretch it because you need more time), start a focus session,
  mark it complete, or remove it.
- **Focus/study timer** — tap a planned session to start a full-screen
  countdown timer with pause/resume, a quick "+10 min" extension, and a
  "Done" button that saves your actual studied time. Stopping early asks why
  (too tired, got distracted, ran out of time, changed my mind, or a custom
  reason) so you can see patterns later.
- **Progress dashboard** — minutes studied per subject, weekly trend, plan
  adherence, and a day streak.
- **Reminders** — browser notifications shortly before a session starts, called out
  distinctly ("Review time is near") for the strategic pre-class review sessions so
  they don't blend in with regular study time.
- **Honest feedback on stopping early** — if you abort a focus session, after you
  give a reason the app reacts to it directly, and gets firmer if the same reason
  keeps repeating within two weeks (e.g. "got distracted" three times running gets
  called out as a pattern, not treated as a one-off).
- **"Why is this here?"** — click any planned session to see a one-line explanation
  of why the planner put it there (difficulty, an approaching deadline, your
  productive hours, or a fixed weekly target), instead of a plan you have to trust
  blindly.
- **Assignment/syllabus deadline import** — same scan-a-photo-or-PDF import as
  exams, but for homework and deliverable due dates; assignments get the same
  deadline-urgency ramp-up as exams, pulling extra study time toward a subject
  the closer its next due date gets.
- **Catch-up on missed time** — when a focus session gets aborted, the planner
  looks for the best remaining slot this week to make up that lost time for the
  same subject, and offers to add it with one click (or dismiss it).
- **Falling-behind alerts** — mid-week, not just in hindsight: if a subject's
  completed time is meaningfully behind how much of the week has already gone
  by, a banner calls it out while there's still time to act.
- **Compare free time with a classmate** — turn on sharing to get a short code,
  then anyone with it can see the windows this week when you're both actually
  free — handy for planning group study. Only bare busy/free times are ever
  shared, never subjects, sessions, or any other personal data.
- **Post-exam retrospective** — once an exam's date has passed, rate how it went
  (1-5 stars) right from the exam list, building a record of outcomes over time.
- **Installable PWA** — add to your home screen / dock on desktop or mobile;
  works offline for the app shell.
- **Account sync** — sign in with email, and your data follows you across
  devices via Supabase.

## Tech stack

- React + TypeScript + Vite, Tailwind CSS v4
- Supabase (Postgres + Auth) for accounts and data sync
- Tesseract.js + pdf.js for client-side OCR timetable import
- @dnd-kit for drag-and-drop
- Recharts for the progress charts
- vite-plugin-pwa for installability and offline caching

## Setup

### 1. Create a Supabase project

1. Go to [supabase.com](https://supabase.com) and create a new project (the
   free tier is enough).
2. In the SQL editor, run the contents of [`supabase/schema.sql`](supabase/schema.sql).
   This creates all tables, row-level security policies, and a trigger that
   sets up default settings for every new user.
   - **Already have a project running this app?** Don't re-run `schema.sql` —
     instead run every file under [`supabase/migrations/`](supabase/migrations) once,
     in order, to bring your existing tables up to date.
3. In **Project Settings → API**, copy your **Project URL** and **anon public
   key**.
4. In **Authentication → Providers**, email sign-up is enabled by default —
   no extra config needed. (Optionally disable "Confirm email" during local
   testing so new accounts can sign in immediately.)

### 2. Configure the app

```bash
cp .env.example .env.local
```

Edit `.env.local`:

```
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-public-key
```

### 3. Install and run

```bash
npm install
npm run dev
```

Open the printed local URL, sign up for an account, and you're in.

### 4. Build for production

```bash
npm run build
npm run preview   # sanity-check the production build locally
```

`npm run build` outputs a static site in `dist/` — deploy it anywhere that
serves static files (Vercel, Netlify, Cloudflare Pages, GitHub Pages, your
own server, etc.). Because it's a PWA, visitors can install it straight from
the browser on desktop or mobile once it's served over HTTPS.

### 5. Run tests

```bash
npm run test
```

Covers the core free-time/allocation algorithm in `src/lib/planner.ts`.

## How the planner algorithm works

1. **Free time** (`computeFreeSlots`) — for each day, start from your
   configured "available hours" window (Settings → Day starts/ends at) and
   subtract every timetable block, merging overlaps first.
2. **Allocation** (`allocateStudyPlan`) — each subject gets a weekly minute
   target: subjects with an explicit weekly target use that directly;
   everyone else splits the remaining pool proportionally to their
   difficulty rating (a 5 gets 2.5x the time of a 2). Sessions are then
   placed chronologically into free slots between the min/max session length
   you configured, rotating between subjects so the week doesn't get
   front-loaded, and a break is inserted between sessions.
3. **Daily cap** — no single day gets more than your "Daily study goal"
   setting's worth of study time, so free time actually stays free.
4. **Biweekly filtering** — before any of the above, entries marked "every
   other week" are dropped unless the week being planned matches their
   parity (`getWeekParity`, anchored to the ISO week number). So a
   `par quinzaine` class only blocks time — and only shows on the
   timetable/planner grids — on the weeks it actually happens.

Both steps are pure functions with unit tests in `src/lib/planner.test.ts`.

## Project structure

```
src/
  components/     Layout, WeekGrid, PlannerGrid (drag-and-drop), ProtectedRoute
  lib/             Supabase client + data API, planner algorithm, OCR, auth context, hooks
  pages/           One file per route: Planner, Timetable, Subjects, Stats, Settings, Auth
  types/           Shared TypeScript types
supabase/
  schema.sql       Full database schema + RLS policies
```
