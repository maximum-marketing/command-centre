# Command Centre

A personal task, priority, and workflow manager for Devlin Lounges, Chesterfield Lounges,
Maximum Marketing Solutions, and Small Business Therapy.

## What's in this version (Phase 1)

- Add tasks with a title, business, priority (High / Medium / Low), and optional due date/time
- Tasks are colour-coded by business and grouped by priority — low priority tasks stay visible, never hidden
- Voice-add: tap the mic and speak a task (uses your browser's built-in speech recognition)
- Sub-task workflows: open "Steps / workflow" on any task to break it into steps with a progress bar
- Today's time-block planner (e.g. "SEO — 9 to 12") and a mini calendar showing which days have tasks due
- Overdue tasks turn red and re-notify every 2 hours until completed or rescheduled
- Installable as an app icon on phone or desktop, and works fully offline (all data is stored on your device)

**Not yet included:** syncing between two devices. Right now, each device keeps its own local
copy. Cross-device sync needs a small backend (e.g. a free Supabase project) — a good Phase 2
step once you've used this for a bit and are happy with how it works.

## How to publish it (no coding tools required)

1. Upload all the files in this folder to your `command-centre` GitHub repo (drag and drop
   into the "uploading an existing file" screen).
2. In the repo, go to **Settings → Pages**.
3. Under "Build and deployment", set **Source** to "Deploy from a branch", branch `main`, folder `/ (root)`.
4. Save. GitHub will give you a live web address within a minute or two, something like
   `https://yourusername.github.io/command-centre/`.
5. Open that address on your phone and desktop. On mobile, your browser should offer
   "Add to Home Screen"; on desktop Chrome/Edge, look for an install icon in the address bar.

## Notes

- Voice input works in Chrome and Edge on both desktop and Android. It's not supported in Safari/iOS yet — typing still works everywhere.
- Notifications need to be allowed when the browser asks — that's what powers the overdue reminders.
- Because everything is stored locally in the browser, clearing your browser's site data will
  erase your tasks. Worth keeping in mind until sync is added.
