# Datum (STEP Viewer PWA) — Claude handoff

**Datum** by TAXI Design Studio: a fork of
[ondreu/STEP-viewer](https://github.com/ondreu/STEP-viewer) (an **Obsidian
plugin**, MIT, v1.13.0) with a second build target added — a standalone,
installable web app that opens STEP/STP/STL/OBJ/FCStd files locally on phone,
tablet and PC. Git: `origin` = https://github.com/717EK/datum (**public**, main);
`upstream` = the original repo (full history kept).

## State (2026-09-17, evening)
- **Verified in headless Chrome** (puppeteer-core, scratchpad only): welcome
  page (2 columns wide / 1 centred column ≤860px), recents with thumbnails +
  reopen + persistence across reload, STL + a 31 MB STEP (~25 s, 94 meshes),
  OBJ export download, SW install without spurious reload, "Update available"
  modal → one reload → old cache purged, offline reload; **touch**: long-press
  → context menu, double-tap → frame part + tree opens.
- **LIVE at https://datum-viewer.vercel.app** (Vercel project `datum`, account
  `717ek`, CLI logged in on this PC; GitHub repo connected → pushes to `main`
  auto-deploy; `npx vercel --prod` also works).
- **DWG / DXF (2D) added 2026-09-17 (late)**: `src/web/cad2d.ts` → separate
  bundle `dist/cad2d.js` (4.1 MB) on mlightcad `cad-simple-viewer` 1.7.0 +
  `cad-simple-ui-plugin` (toolbar with phone/pad/desktop layouts, touch built
  in) + `libredwg-converter` 3.14.7 (DWG, **GPL-3.0**, 10 MB wasm). Verified
  headless: DXF + two DWGs open in ~3 s, 2D↔3D switching, recents thumbnails
  for drawings, offline DWG open from the lazy asset cache. Whole project moved
  to **three 0.172** (their peer dep); the only 3D-core change was
  `TransformControls` → `getHelper()` (r169 API) for the section gizmos.
- Not yet tested on a real phone / iPad.
- The Obsidian plugin build (`npm run build` → `main.js`) still passes;
  `tsconfig.json` excludes `src/web/**`.

## Layout
| Path | Role |
|---|---|
| `src/web/obsidian-shim.ts` | Browser stand-in for the `obsidian` module: DOM prototype helpers (`createDiv`, `toggle`, `isShown`…), `setIcon` (Lucide), `Notice`, `Menu`, `MarkdownRenderer` (small safe subset), `Plugin` (localStorage `loadData/saveData`), `app.vault.create/createBinary` → browser download, `openLinkText` → new tab. |
| `src/web/icons.ts` | The Lucide icons referenced by id. **If the viewer starts using a new icon id, add it here** — unknown ids log a warning and render blank. |
| `src/web/app.ts` | Shell: header (Datum brand → home, Open / Update / Install / Settings), welcome page (hero + big open box + recents), company wordmark bottom-left (CSS mask of `public/brand/tds-wordmark.svg`, tinted via `--sv-brand`), `showOpenFilePicker` with `<input>` fallback, drag-drop (+handles), `launchQueue` ("Open with"), Ctrl+O, load pipeline ported from `src/view/StepView.ts`, thumbnail capture after mount, settings popover, modals. |
| `src/web/cad2d.ts` | 2D viewer module → `dist/cad2d.js`, loaded by app.ts via `<script>` on first DWG/DXF; exposes `window.DatumCad2d` (`init / open / close / setTheme / snapshot`). Registers LibreDWG for DWG, fonts from `cdn.jsdelivr.net/gh/mlightcad/cad-data` (SW caches them), UI plugin with `excludeItems: export/locale/theme`. The plugin restyles its host → app.ts hands it the inner `.sv-cad2d-ui` wrapper (explicit 100% size), never the absolute host. |
| `public/sw.template.js` | Two caches: versioned shell precache + long-lived `step-viewer-assets` for `cad2d.js`, `workers/*` (keyed by `?v=<own hash>`, refreshed in the background on activate, purged when the hash changes) and the cad-data fonts. |
| `src/web/recents.ts` | Recently-opened store (IndexedDB `step-viewer-recents`): FileSystemFileHandle on Chromium, else the file bytes (≤64 MB each, ≤256 MB total, LRU), 12 entries, 192px thumbnail. `reopen()` must be called from a user gesture (handle permission). |
| `src/viewer/ViewerController.ts` | **Only viewer-core file touched**: `LONG_PRESS_MS` / `DOUBLE_TAP_*` / `PEN_GRACE_MS`; `onPalmGuard` (capture-phase on host, drops touch while a pen is down); long-press → `openContextMenu`; double-tap → `onDoubleClick` (native dblclick right after is ignored). |
| `src/web/pwa.ts` | SW registration (`updateViaCache: "none"`), install modes `installed / prompt / manual / unavailable`, update detection (`updatefound` + `reg.waiting`), periodic checks (hourly, focus, visibility, online), `SKIP_WAITING` → one reload (only if a controller existed or an update was requested). |
| `src/web/web.css` | Obsidian CSS variables (light + dark), base widgets (`clickable-icon`, `mod-cta`, `.menu`, `.notice`), shell styles. Concatenated after `styles.css`. |
| `public/` | `index.html` (`__HASH__` placeholders), `manifest.webmanifest` (file_handlers, maskable icon), `sw.template.js`, `icons/` (generated). |
| `scripts/make-icons.mjs` | Procedural PNG/SVG icon generator (no image libs). |
| `esbuild.web.mjs` | Web build: alias `obsidian`→shim, inline gz WASM + inline worker (same plugins as the plugin build), Node builtins external, content hash over dist → `sw.js` VERSION + precache list, `version.json`. `--serve` = dev server on :8787. |
| `tsconfig.web.json` | Typechecks web + viewer sources with `paths: { obsidian: [shim] }`. |
| `vercel.json` | Vercel static build (`npm ci` → `npm run build:web` → `dist`), no-cache headers for `sw.js`, `/`, `index.html`, manifest. (Inherited GH Pages + plugin-release workflows were removed; see tag `pwa-v1.13.0-web1` if Pages is ever wanted.) |

## Build / verify
```sh
npm install
npm run build:web        # typecheck + bundle → dist/
npm run dev:web          # watch + serve http://localhost:8787
npm run build            # original Obsidian plugin (main.js) — must still pass
```
Verify in a browser (Chrome): open a file, check console has no
`unknown icon` warnings; DevTools → Application → Service Workers shows one
active worker and one `step-viewer-<version>` cache.

## Gotchas learned
- **Hash must be deterministic**: `version.json` (timestamp) is excluded from
  the hash; `__BUILD_HASH__` uses the git short SHA (`-dev` when dirty).
  Otherwise every rebuild = a new "update" and the modal nags.
- **First SW install fires `controllerchange`** (clients.claim) — don't reload
  on it unless a controller existed before, or the page double-loads.
- **Update modal blocks clicks** (scrim) — during automated tests, make sure
  no update is pending or the first click closes the modal instead.
- occt-import-js's emscripten glue `require("fs"/"path")` in dead Node
  branches → Node builtins must be `external` in the web build too.
- `Platform.isMobile` is UA-based (like Obsidian); puppeteer viewport
  emulation doesn't flip it. `body.is-mobile` scales the cube/buttons.
- npm 11.16 on this PC gates postinstall scripts (`npm approve-scripts esbuild`
  or `node node_modules/esbuild/install.js`) — CI on Node 22 doesn't.
- mlightcad bundles import `three/examples/jsm/...` **without `.js`** →
  `threeExamplesPlugin` in esbuild.web.mjs appends it. `tsconfig.web.json`
  uses `moduleResolution: bundler` for their `/register` subpath export.
- **Licensing (decided 2026-09-17)**: personal use, repo **public/open source**. Repo code = MIT (LICENSE); the built web app = GPL-3.0 because of LibreDWG (LICENSE.GPL-3.0, LICENSES.md); the app links to the source from Settings. No proprietary parser needed.
- **2D theme/background**: the UI plugin follows the drawing's COLORTHEME sysvar
  once a doc is open (1=light) — set it in open sysVars and via AcDbSysVarManager
  on switches. MODELBKCOLOR as an open-time sysvar breaks layout resolution in
  cad-simple-viewer 1.7 → only PAPERBKCOLOR at open; model bg via
  `curView.backgroundColor` after open (also re-inverts ACI 7 lines).
- App default theme is **light** (changed 2026-09-17); "Follow system" is opt-in.
- The black "INP Issue" card Vivek saw was the **Vercel Toolbar** (only shown to
  logged-in team members); disabled via the project API
  (`enableProductionFeedback: false`). Its INP measurement itself was real
  (2D canvas handlers on the main thread) → MTEXT now runs in the worker on
  desktop (`useMainThreadDraw: isMobileUA`).
- **Mobile file pickers grey out CAD files** when `<input accept>` lists MIME
  types/extensions iOS/Android don't know (.dwg/.dxf, even .step). On mobile the
  input has **no accept** and `showOpenFilePicker` is skipped; `openFile`
  validates the extension. iPadOS detection = Macintosh UA + maxTouchPoints > 0.
- Source files are CRLF: shell heredoc/sed patches break; use the Edit tool.
- **Vercel blocks deploys whose commit author isn't a GitHub account it knows**
  (`COMMIT_AUTHOR_REQUIRED`, state BLOCKED, no build logs) once the project is
  Git-connected — that applies to CLI deploys too. This repo's git identity is
  therefore `717EK <11254250+717EK@users.noreply.github.com>` (repo-local
  config); commit as that or the deploy silently stalls.

## Next
1. Deploy to Vercel (see State). Then test installed on Android Chrome,
   iPhone/iPad Safari (Add to Home Screen; Apple Pencil: long-press menu,
   palm rejection, double-tap) and Windows Edge/Chrome, incl. "Open with"
   a .step file and reopening from Recents after a restart.
2. Real-device memory check: the 4 GB WASM heap patch is desktop-minded;
   phones will hit the "Large model" warning at 12 MB and may still OOM.
3. Nice-to-haves: multiple open models/tabs, share-target, WASM as a separate
   cached file instead of base64-inlined (app.js is 4.7 MB; ~3.5 MB gzipped),
   re-capture the recents thumbnail when the view changes.
