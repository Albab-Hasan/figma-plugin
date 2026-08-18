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

1. Open your board in the browser. Scroll so the pins you want are on screen
   (Pinterest only keeps visible pins in the DOM — off-screen ones do not exist yet).
2. `Ctrl/Cmd + A`, then `Ctrl/Cmd + C`.
3. Switch to Figma, open the plugin, press `Ctrl/Cmd + V`.
4. Thumbnails appear. Click any to deselect. Set columns / width / gap. Hit **Import**.

Also accepts: dragged images, a pasted list of image URLs, and local files via
**choose files**.

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

- **Only what you can see.** Pinterest virtualises its grid, so one copy grabs the
  ~30–60 rendered pins. For a big board, paste, scroll, paste again — the list
  accumulates and dedupes.
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
- **CSS background images** on sites that render photos as `div` backgrounds are
  only caught when the style is inline.
