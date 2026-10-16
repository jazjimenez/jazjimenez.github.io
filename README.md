# Jaztin's personal website

It opens on a welcome page over a "dollhouse" view of a cozy Filipino bedroom; **Enter the room** flies you in to sit at my desk. Look left (window), center (desk) or right (records, books, bed) with the on-screen arrows, by resting the cursor at a screen edge, with ← →, or by swiping on phones. My actual desk setup is on the desk: an external monitor hooked up to my MacBook (on a laptop stand), a Bluetooth keyboard, and a mouse on a mousepad. Click the monitor (or the MacBook) and you lean in to a Mac-style desktop with my projects, credentials, resume, a terminal, and a live TagaBaybay demo.

- **Corkboard:** on the wall by the desk. Click it to zoom in on my sticky notes, photos and a ticket stub (Esc or ← Back to step back).
- **Room:** half-open capiz window (decorative) with a Manila street view (sky follows real Manila time and weather, and sunlight falls through it onto the floor), parol (day/night switch), desk lamp (cozy mode: just the lamp, screens and window), a stack of my papers on the desk (click for the list), baybayin scroll, jeepney, architect desk lamp, mesh-back office chair, record player, the real posters of my Letterboxd top 4, modern upholstered bed, acoustic guitar on a stand, bookshelf, aparador, and a wall clock on Manila time.
- **Computer:** Projects folder, About Me, Resume.pdf, Credentials, TagaBaybay app, Terminal (`help`, `ls`, `open tagabaybay`, `nativize computer`…), Films, Contact.
- **Simple version:** scroll down from the welcome page (the faint "Simple version ⌄" arrow) for a one-page, résumé-style profile. It's written to be easy to skim and easy for AI résumé screeners to parse: the full text is baked into the page's HTML at build time (no JavaScript needed), plus schema.org data and plain-text copies at `/profile.md` and `/llms.txt`. Browsers without WebGL get just this page.

Built with React, Three.js (React Three Fiber), and Vite. The room's lighting is **baked in Blender** (sunlight, bounce light, soft shadows, night lamps) and drawn as texture × lightmap (WEBP, ~60 KB–1 MB each), so it looks close to a photo and runs on almost anything. See [blender/README.md](blender/README.md). It's fully static, so it can be hosted on GitHub Pages.

## Run it locally

```bash
cd site
npm install
npm run dev
```

## Edit the content

Everything you'd want to change lives in **`site/src/data/content.ts`**: your bio, links, projects, credentials, and the text that pops up for each room object. Search that file for `TODO` to find the placeholders. Anything still marked TODO (or written as "(TODO …)") is left out of the public simple version, profile.md and llms.txt automatically, so half-finished details never show up to a recruiter. The simple version also uses `profile.summary`, `profile.lookingFor`, `skills` and `education`.

- **Corkboard:** `corkboard` in `content.ts` holds the sticky notes and photo captions. For a real photo, put it in `site/public/corkboard/` and set its `src` (e.g. `src: 'corkboard/sunset.jpg'`). The board is drawn live in the browser, so no re-bake is needed.
- **Posters:** `letterboxd.favorites` in `content.ts`. Each film's `posterUrl` is a TMDB image (`https://image.tmdb.org/t/p/w500/...`, find it on the film's themoviedb.org page). Also loaded live, so no re-bake.
- **Resume:** drop your PDF at `site/public/resume.pdf`.
- **TagaBaybay examples:** `site/src/data/tagabaybay.ts` (precomputed traces from the project's demo).

## Shareable links

- `/` opens the welcome page (dollhouse view → "Enter the room")
- `/#room` skips the welcome page and starts seated at the desk
- `/#laptop` goes straight to the desktop
- `/#simple` scrolls straight to the simple version

## Deploy to GitHub Pages

1. Push this folder to a GitHub repo (name it `<username>.github.io` for a root URL, or anything else for `<username>.github.io/<repo>/`).
2. In the repo, go to **Settings → Pages → Source** and pick **GitHub Actions**.
3. Every push to `main` builds and publishes the site automatically (`.github/workflows/deploy.yml`).
