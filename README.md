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

### Bookmarklet — the whole board, no scrolling (recommended)

Drag the **🖼️ Grab Images** button out of the plugin's paste box onto your
bookmarks bar, once. Then open your moodboard and click that bookmark.

It scrolls the page for you, top to bottom, collecting images as they load, and
stops on its own when the board runs out. A small panel in the corner counts up
and has a **Stop** button if you've seen enough. When it finishes, hit **Copy**,
switch to Figma, **click the plugin's paste box once**, and `Ctrl/Cmd + V`.

That click matters: Figma doesn't hand keyboard focus to a plugin when you switch
back from the browser, so without it `Ctrl/Cmd + V` goes to the canvas and nothing
happens.

### Copy-paste (fine for a screenful)

Select the page with `Ctrl/Cmd + A`, copy with `Ctrl/Cmd + C`, then click the paste
box in the plugin and `Ctrl/Cmd + V`. Faster than the bookmarklet when you only
want what's already on screen, but it gets **only** what's on screen, and it comes
back empty on Pinterest (see below).

Also accepts: dragged images, a pasted list of image URLs, and local files via
**choose files**.

## How it works

### The bookmarklet

Three things happen at once when you click it:

- **It drives the scroll.** A virtualised grid keeps only ~30–60 pins in the DOM
  at a time, and the site only requests the next batch when you approach the
  bottom. So there is no snapshot to take — the bookmarklet scrolls in ~85%
  viewport steps, pausing between each so lazy loaders fire, and stops after a
  few seconds of the page neither growing nor yielding anything new.
- **It harvests continuously.** A `MutationObserver` records every `<img>` the
  moment it's inserted, because the grid will recycle that node away long before
  any later sweep would see it. CSS background images are swept once at the end
  (`getComputedStyle` on every node is far too slow to repeat each step).
- **It reads the JSON the page fetches anyway.** `fetch` and `XMLHttpRequest` are
  wrapped for the duration, so pin data the site loads while scrolling is parsed
  for image records — an object with a `url` next to a `width`. That's where the
  full-resolution URL and true pixel size live; the DOM only ever exposes the
  thumbnail. Nothing extra is requested and no response is consumed — the clone is
  read, never the original. Pins already on the page at click time come from the
  server-rendered state blob instead.

When the same image turns up more than once, the largest variant wins, whichever
arrived first. Without that, Pinterest's thumbnail — always seen first — would
lock out the original of the very same pin.

The panel's **Copy** button is a button rather than an automatic copy because
browsers require a fresh click to write to the clipboard, and the scroll loop has
long since spent the one that launched it.

### The plugin

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
- Downloads run six at a time, in batches. Sequential downloads were fine for a
  dozen images and unusable for a whole board. Batching (rather than a rolling
  pool) keeps images in the order you picked them and caps how many decoded
  images are held in memory at once.
- Bytes go to the main thread, become `RectangleNode`s with image fills, and get
  packed into the shortest column each time (masonry).

## Known limits

- **Copy-paste only sees one screenful**, and fails outright on sites using
  `user-select: none` on their image grid (Pinterest's pin cards, notably) — those
  images are never in what gets copied, regardless of how the HTML is parsed. The
  bookmarklet is the answer to both.
- **The bookmarklet takes real time on a big board.** It has to scroll the page
  the way you would, because that scrolling is what makes the site request the
  next batch. Budget roughly a second per two screens; the Stop button ends it
  early and keeps whatever it has.
- **Firefox may refuse to run it.** Bookmarklets on sites with a strict CSP are
  blocked by a [Firefox bug open since 2012](https://bugzilla.mozilla.org/show_bug.cgi?id=866522)
  and still unfixed. Chrome and Edge run them fine. Nothing here loads external
  script, which is the other common way bookmarklets get blocked.
- **No board URL field.** Pasting a Pinterest board *link* cannot work from inside
  a plugin. Pinterest's paging endpoint (`BoardFeedResource`) rejects requests that
  don't carry a bookmark cursor from a previous response — verified, it returns
  `403 Invalid Resource Request` — and it sends no CORS headers, so the plugin
  can't read it even with a valid cursor. Every "paste a board URL" plugin on the
  Community runs a server-side scraper. The bookmarklet needs no infrastructure
  and works on every site rather than just Pinterest.
- **Figma Design only.** `createRectangle` throws in FigJam and Slides.
- **Third-party proxy.** Image URLs (not your Figma content) pass through
  `images.weserv.nl` when the source host blocks CORS. Swap `PROXY` in `ui.html`
  for your own Cloudflare Worker if you would rather not rely on it.
- **CSS background images** — the copy-paste path only sees `background-image` when
  it's an inline `style=""` attribute, not when it comes from a CSS class (clipboard
  HTML doesn't carry stylesheets). The bookmarklet doesn't have this limitation: it
  reads `getComputedStyle()` on the live page, which resolves class-based
  backgrounds too.
- **Some images have no original.** Board covers and related-board tiles are only
  ever served small (`/236x/`, `/474x/`); no `/originals/` version exists. The
  bookmarklet takes the largest available and the plugin still retries `/originals/`
  at download time, falling back if it 404s.
