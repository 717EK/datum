# cad-desktop

The full desktop CAD interface — menus, tool sets, command line, layers and
properties palettes, layouts, 295 commands — compiled to WebAssembly. Opens
and saves **DWG** (R13–2018 read, 2000–2018 write) and **DXF** (R12–2018).
Built from `taxicad/apps/taxicad-web`.

On phones and tablets, use touch mode (below) with the `cad-touch` controls.

## Embed it
Serve the folder with the app and frame it, same origin:

```html
<iframe src="modules/cad-desktop/index.html?host=parent"></iframe>
```

## Messages (`postMessage`, same origin only)
From the page to the CAD app:

| type | fields | |
|---|---|---|
| `taxicad:fonts` | `fonts: [{ name, bytes }]` | Fonts for drawing text (see `cad-fonts`). Send before the first open. |
| `taxicad:open` | `name, bytes` (ArrayBuffer, transferable) | Open a drawing in a new tab. |
| `taxicad:call` | `id, method, params` | Any control-channel method (`cmdline.input`, `cmdline.key`, `engine.execute`, `ui.inspect`, …; see `taxicad/docs/control-protocol.md`). |

From the CAD app to the page:

| type | fields | |
|---|---|---|
| `taxicad:ready` | `version` | Listening — send fonts, then a drawing. |
| `taxicad:opened` | `name, ok, ms, entities?, warnings?, error?` | A drawing finished opening (or failed). |
| `taxicad:save` | `name, bytes` | Every file the app would download (Save, Save As, exports). The page stores it. |
| `taxicad:dirty` | `dirty` | Unsaved changes appeared / went away. |
| `taxicad:state` | `state` | Touch mode (`?ui=touch`): prompt, keywords, running command, selection, undo/redo, drawings — when it changes. |
| `taxicad:result` | `id, ok, result?, error?` | Answer to a `taxicad:call`. |
| `taxicad:failed` | `error` | The app could not start (e.g. no WebGL/WebGPU). |

## Notes
- Size: the wasm is ~29 MB (about 8 MB brotli). Cache it in the service
  worker's long-lived asset cache, not the shell precache.
- A panic inside WebAssembly stops the whole app instance (no unwinding on
  wasm32); the page should offer "reload the drawing" on `taxicad:failed` or
  when the frame stops answering.

## Touch mode
`index.html?host=parent&ui=touch`: only the drawing, edge to edge — no menus,
palettes, command line, ViewCube. Fingers pan (one) and zoom (two), a
two-finger tap undoes, a one-finger tap clicks; a pen (Apple Pencil) draws and
picks, and its hover moves the crosshair so snaps show before it touches; a
palm on the glass is ignored while the pen is down. The page draws the
controls (module `cad-touch`) and drives the app with `taxicad:call`.
