# Datum (STEP Viewer PWA) — Claude handoff

**Datum** by TAXI Design Studio: a fork of
[ondreu/STEP-viewer](https://github.com/ondreu/STEP-viewer) (an **Obsidian
plugin**, MIT, v1.13.0) with a second build target added — a standalone,
installable web app that opens STEP/STP/STL/OBJ/FCStd files locally on phone,
tablet and PC. Git: `origin` = https://github.com/717EK/datum (**public**, main);
`upstream` = the original repo (full history kept).

## State (2026-10-14) — DWG/DXF editing on the CAD engine module
Keyword: **`continue datum`**. Live: https://datum-viewer.vercel.app (pushes to `main` deploy;
Vercel CLI is logged OUT on this rebuilt PC — read deploy status via the GitHub API).
- **DWG/DXF open in a real CAD editor** built from TAXI's module library
  (`../modules`, repo 717EK/taxi-modules, private): a TAXI-branded fork of an
  MIT Rust CAD engine (`modules/taxicad`, see its UPSTREAM.md) compiled to
  WebAssembly. Copies live in `./modules/` — never edit them here; change the
  library, bump, `node ../modules/tools/modules.mjs add <name> .`:
  `cad-desktop` (built wasm app in an iframe, `?host=parent[&ui=touch]`),
  `cad-host` (TS: mount, open, call, state, saves), `cad-touch` (TS: Meter-style
  touch controls), `cad-fonts` (Liberation as Arial/Times/Courier).
  `.gitattributes`: `modules/** -text` (index.html carries integrity hashes).
- **Desktop**: full CAD interface (menus, tool sets, palettes, command line,
  295 commands). Drawings open as tabs and survive Home. Save writes back to the
  opened file (FS Access handle), else a save dialog, else a download; unsaved
  guard on unload. Verified: DWG 2018 saved in the browser reopens with the same
  74,318 entities; offline open; the 156 MB Meter DXF the old viewer showed
  blank opens. TAXI mark moves into the header in CAD mode.
- **Phones/tablets**: touch CAD — header hidden, drawing full screen, bottom
  bar (phone) / left rail (≥700×500) with Draw · Modify · Annotate · Layers ·
  View · File, sheets of tools, a strip for the running command (prompt,
  keyword chips, Type, Enter, Cancel) or the selection. Pencil draws and picks
  (hover → crosshair/snaps); one finger pans, two zoom, two-finger tap = undo,
  one-finger tap = click; palm ignored while the pen is down. Verified headless
  with emulated touch + pen. **Not yet on a real iPad.**
- Settings → "DWG / DXF open in": Automatic / Full CAD / Touch CAD / Light
  viewer (the old mlightcad + LibreDWG viewer, `src/web/cad2d.ts`, kept as a
  fallback; removing it later drops GPL from the web build).
- SW: `modules/` served from the long-lived asset cache, including the CAD
  frame's own navigation; lazy assets refresh only where already used.

## Earlier state (2026-09-17)
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
| `src/web/app.ts` | Shell: header (Datum brand → home, Open / Update / Install / Settings), welcome page (hero + big open box + recents), company wordmark **top-left** in every mode (CSS mask of `public/brand/tds-wordmark.svg`, tinted via `--sv-brand`; 3D left rail and 2D dock panel are inset below it), `showOpenFilePicker` with `<input>` fallback, drag-drop (+handles), `launchQueue` ("Open with"), Ctrl+O, load pipeline ported from `src/view/StepView.ts`, thumbnail capture after mount, settings popover, modals. |
| `src/web/cad2d.ts` | 2D viewer module → `dist/cad2d.js`, loaded by app.ts via `<script>` on first DWG/DXF; exposes `window.DatumCad2d` (`init / open / close / setTheme / snapshot`). Registers LibreDWG for DWG, fonts from `cdn.jsdelivr.net/gh/mlightcad/cad-data` (SW caches them), UI plugin with `excludeItems: export/locale/theme`. The plugin restyles its host → app.ts hands it the inner `.sv-cad2d-ui` wrapper (explicit 100% size), never the absolute host. |
| `public/sw.template.js` | Two caches: versioned shell precache + long-lived `step-viewer-assets` for `cad2d.js`, `workers/*` (keyed by `?v=<own hash>`, refreshed in the background on activate, purged when the hash changes) and the cad-data fonts. |
| `src/web/recents.ts` | Recently-opened store (IndexedDB `step-viewer-recents`): FileSystemFileHandle on Chromium, else the file bytes (≤64 MB each, ≤256 MB total, LRU), 12 entries, 192px thumbnail. `reopen()` must be called from a user gesture (handle permission). |
| `src/viewer/ViewerController.ts` | Viewer-core changes: `LONG_PRESS_MS` / `DOUBLE_TAP_*` / `PEN_GRACE_MS`; `onPalmGuard` (capture-phase on host, drops touch while a pen is down); long-press → `openContextMenu`; double-tap → `onDoubleClick` (native dblclick right after is ignored); `formatMm`/`num` now delegate to `units.ts`; `TransformControls.getHelper()` (three r169+). |
| `src/viewer/units.ts` | **Display units (added 2026-09-17)**: `setLengthUnit(mm/cm/m/in/ft/ft-in)` + `formatLength/Value/Area/Volume`, feet-inches to 1/16". Internal values stay mm. Used by ViewerController, PartInfoPanel, MeasurementLayer (`refreshUnits()` re-labels pinned captions); `ViewerHandle.refreshUnits()` in mountViewer. Default mm → Obsidian plugin unchanged. |
| (units, web side) | app.ts: header `<select class="sv-units">` (hidden ≤600px) + Settings rows "Display units" (localStorage `step-viewer:units`; `"drawing"` = follow DWG/DXF, mm for 3D) and "STL / OBJ files are in" (`step-viewer:mesh-unit`, scale baked into geometry at load). cad2d.ts `setUnits()` maps to INSUNITS/LUNITS/LUPREC via `setMeasurementUnitOverride` + `refreshMeasurementValueLabels`, re-applied after every open (the library resets overrides per document). The library forces decimal when display unit ≠ drawing INSUNITS → `cadViewerUnitsPlugin` in esbuild.web.mjs rewrites its `kt()` length formatter in memory (exact-match guard on the 1.7.0 text; a bump fails the build) so ft-in survives conversion ("~ 3'-3 3/8\""). `DatumCad2d.formatLength(v)` exists for tests. `ViewerController.refreshMeasureReadout()` re-emits the transient distance readout on unit change. |
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
1. Real iPad + Apple Pencil test (Safari and installed): pen vs palm, hover,
   the keyboard for Type, dialogs a command opens (finger tap = click), memory
   on big drawings (the 156 MB DXF needs ~2.3 GB in the engine).
2. Meter link (his call: "both ways"): drawings stored with a Meter project on
   the Meter service; Datum lists/opens/saves them; the editor inside Meter via
   cad-host. Worker changes deploy only on his go (Meter release rule).
3. Engine memory: box the 5 biggest entity kinds (672 → ~360 B/entity), see
   ../modules/taxicad/UPSTREAM.md. wasm size 27.7 MB (~8 MB brotli).
4. Remove the light viewer once touch CAD is proven on devices (drops GPL).
5. Older: test installed on Android/iPhone/Windows; recents thumbnails for CAD
   drawings (no snapshot from the frame yet).
