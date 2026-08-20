# Moodboard Grabber

Figma plugin. Paste a moodboard from your browser, get the images on your canvas
in a masonry layout. Works with Pinterest, Behance, Dribbble, Are.na, Google Images,
Cosmos — anything that renders `<img>` tags.

## Install (local, no build step)

1. Figma desktop app → menu → **Plugins → Development → Import plugin from manifest…**
2. Pick `manifest.json` in this folder.
3. Run it from **Plugins → Development → Moodboard Grabber**.

No npm, no bundler, no account. Three files: `manifest.json`, `code.js`, `ui.html`.

## Use

### Copy-paste (works on most sites)

1. Open your board in the browser. Scroll so the pins you want are on screen
   (Pinterest only keeps visible pins in the DOM — off-screen ones do not exist yet).
2. `Ctrl/Cmd + A`, then `Ctrl/Cmd + C`.
3. Switch to Figma, open the plugin, **click the paste box once** (Figma doesn't hand
   keyboard focus to a plugin automatically when you switch back from the browser —
   without a click, `Ctrl/Cmd + V` goes to the canvas instead of the plugin and nothing
   happens), then press `Ctrl/Cmd + V`.
4. Thumbnails appear. Click any to deselect. Set columns / width / gap. Hit **Import**.

Also accepts: dragged images, a pasted list of image URLs, and local files via
**choose files**.

### Bookmarklet (use this if copy-paste comes back empty — e.g. Pinterest)

Pinterest (and other sites with draggable card grids) sets `user-select: none` on
the grid so drag gestures work. That makes the browser's own `Ctrl/Cmd+A` selection
skip that whole part of the page — the images never reach the clipboard, so no
amount of parsing on the plugin side can recover them.

The plugin's paste box has a **🖼️ Grab Images** button — drag it to your bookmarks
bar once. Then, on the moodboard page, click that bookmark: it reads the live page
DOM directly (bypassing the clipboard and `Ctrl/Cmd+A` entirely) and copies a plain
list of image URLs to your clipboard. Switch back to the plugin, click the paste
box, and `Ctrl/Cmd + V` that list in — it's handled the same as any other paste.

## How it works

- The paste carries `text/html`. The plugin parses it and pulls `img[src]`,
  `srcset` (largest candidate), `<picture><source>`, inline `background-image`,
  and links ending in an image extension.
- Pinterest thumbnails (`/236x/`, `/474x/`) are rewritten to `/originals/`, with
  `/1200x/` → `/736x/` → the original URL as fallbacks if that 404s.
- Duplicates are collapsed on the pin hash, so the same image at three sizes
  counts once. Anything under 120px is dropped (avatars, icons, spinners).
- Downloads try the host directly first. Hosts that send no CORS headers —
  `i.pinimg.com` is one — go through `images.weserv.nl`, a free public image proxy,
  which also clamps anything over Figma's 4096px limit and re-encodes WebP/AVIF.
- Bytes go to the main thread, become `RectangleNode`s with image fills, and get
  packed into the shortest column each time (masonry).

## Known limits

- **Only what you can see.** Pinterest virtualises its grid, so one copy (or one
  bookmarklet click) grabs the ~30–60 rendered pins. For a big board, paste/click,
  scroll, paste/click again — the list accumulates and dedupes.
- **Copy-paste fails outright on sites using `user-select: none`** on their image
  grid (Pinterest's pin cards, notably) — the images are never in what gets copied,
  regardless of how the HTML is parsed. Use the bookmarklet on those sites instead.
- **No board URL field.** Pasting a Pinterest board *link* cannot work from inside a
  plugin: the board page is JS-rendered (its raw HTML contains zero pin URLs) and
  Pinterest's internal API sends no CORS headers, so the plugin cannot read it.
  Every "paste a board URL" plugin on the Community runs a server-side scraper for
  this. Adding one here means hosting a service and fighting Pinterest's bot
  detection; the copy-paste route needs no infrastructure and works on every site
  rather than just Pinterest.
- **Figma Design only.** `createRectangle` throws in FigJam and Slides.
- **Third-party proxy.** Image URLs (not your Figma content) pass through
  `images.weserv.nl` when the source host blocks CORS. Swap `PROXY` in `ui.html`
  for your own Cloudflare Worker if you would rather not rely on it.
- **CSS background images** — the copy-paste path only sees `background-image` when
  it's an inline `style=""` attribute, not when it comes from a CSS class (clipboard
  HTML doesn't carry stylesheets). The bookmarklet doesn't have this limitation: it
  reads `getComputedStyle()` on the live page, which resolves class-based
  backgrounds too.
