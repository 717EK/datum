# STEP Viewer — web app / PWA (Claude handoff)

Fork of [ondreu/STEP-viewer](https://github.com/ondreu/STEP-viewer) (an
**Obsidian plugin**, MIT, v1.13.0) with a second build target added:
a standalone, installable web app that opens STEP/STP/STL/OBJ/FCStd files
locally on phone, tablet and PC. Git remote `upstream` = the original repo;
`origin` is not set yet (add Vivek's own repo when pushing).

## State (2026-09-17)
- **Built + verified in headless Chrome** (puppeteer-core, scratchpad only):
  STL loads; a 31 MB STEP assembly parses in the worker (~25 s, 94 meshes);
  toolbar / tree / context menu / part-info / settings all work; OBJ export
  downloads; service worker installs without a spurious reload; a rebuilt
  deploy triggers the "Update available" modal; "Update now" reloads once,
  purges the old cache, serves new assets; offline reload works.
- **Not yet tested on a real phone / installed** — needs an HTTPS deploy first
  (GitHub Pages workflow is in place, not yet pushed/enabled).
- The Obsidian plugin build (`npm run build` → `main.js`) still works
  untouched; `tsconfig.json` excludes `src/web/**`.

## Layout
| Path | Role |
|---|---|
| `src/web/obsidian-shim.ts` | Browser stand-in for the `obsidian` module: DOM prototype helpers (`createDiv`, `toggle`, `isShown`…), `setIcon` (Lucide), `Notice`, `Menu`, `MarkdownRenderer` (small safe subset), `Plugin` (localStorage `loadData/saveData`), `app.vault.create/createBinary` → browser download, `openLinkText` → new tab. |
| `src/web/icons.ts` | The Lucide icons referenced by id. **If the viewer starts using a new icon id, add it here** — unknown ids log a warning and render blank. |
| `src/web/app.ts` | Shell: header (Open / Update / Install / Settings), empty state, drag-drop, `launchQueue` ("Open with"), Ctrl+O, load pipeline ported from `src/view/StepView.ts`, settings popover, modals. |
| `src/web/pwa.ts` | SW registration (`updateViaCache: "none"`), install modes `installed / prompt / manual / unavailable`, update detection (`updatefound` + `reg.waiting`), periodic checks (hourly, focus, visibility, online), `SKIP_WAITING` → one reload (only if a controller existed or an update was requested). |
| `src/web/web.css` | Obsidian CSS variables (light + dark), base widgets (`clickable-icon`, `mod-cta`, `.menu`, `.notice`), shell styles. Concatenated after `styles.css`. |
| `public/` | `index.html` (`__HASH__` placeholders), `manifest.webmanifest` (file_handlers, maskable icon), `sw.template.js`, `icons/` (generated). |
| `scripts/make-icons.mjs` | Procedural PNG/SVG icon generator (no image libs). |
| `esbuild.web.mjs` | Web build: alias `obsidian`→shim, inline gz WASM + inline worker (same plugins as the plugin build), Node builtins external, content hash over dist → `sw.js` VERSION + precache list, `version.json`. `--serve` = dev server on :8787. |
| `tsconfig.web.json` | Typechecks web + viewer sources with `paths: { obsidian: [shim] }`. |
| `.github/workflows/pages.yml` | Build `dist/` and deploy to GitHub Pages on push to main. |

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

## Next
1. Push to a private repo on GitHub (717EK), enable Pages → Actions source,
   test install on Android (Chrome), iPhone (Safari → Add to Home Screen)
   and Windows (Edge/Chrome install icon), and "Open with" a .step file.
2. Real-device memory check: the 4 GB WASM heap patch is desktop-minded;
   phones will hit the "Large model" warning at 12 MB and may still OOM.
3. Nice-to-haves: recent files list (File System Access handles), multiple
   open models/tabs, share-target, WASM as a separate cached file instead of
   base64-inlined (app.js is 4.7 MB; served gzipped it's ~3.5 MB).
