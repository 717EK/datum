# cad-desktop

The full desktop CAD interface — menus, tool sets, command line, layers and
properties palettes, layouts, 295 commands — compiled to WebAssembly. Opens
and saves **DWG** (R13–2018 read, 2000–2018 write) and **DXF** (R12–2018).
Built from `taxicad/apps/taxicad-web`.

Meant for keyboard + mouse screens. Phones and tablets get the touch
interface on the same engine instead.

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

From the CAD app to the page:

| type | fields | |
|---|---|---|
| `taxicad:ready` | `version` | Listening — send fonts, then a drawing. |
| `taxicad:opened` | `name, ok, ms, entities?, warnings?, error?` | A drawing finished opening (or failed). |
| `taxicad:save` | `name, bytes` | Every file the app would download (Save, Save As, exports). The page stores it. |
| `taxicad:dirty` | `dirty` | Unsaved changes appeared / went away. |
| `taxicad:failed` | `error` | The app could not start (e.g. no WebGL/WebGPU). |

## Notes
- Size: the wasm is ~29 MB (about 8 MB brotli). Cache it in the service
  worker's long-lived asset cache, not the shell precache.
- A panic inside WebAssembly stops the whole app instance (no unwinding on
  wasm32); the page should offer "reload the drawing" on `taxicad:failed` or
  when the frame stops answering.
