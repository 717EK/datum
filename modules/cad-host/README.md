# cad-host

TypeScript glue for embedding the `cad-desktop` module (full desktop CAD
interface) in a page. No dependencies, no app imports.

```ts
import { mountCadDesktop } from "./modules/cad-host/src/index";

const cad = mountCadDesktop(container, {
  base: "modules/cad-desktop/",      // served with the app, same origin
  fontsBase: "modules/cad-fonts/",   // optional; sent before the first drawing
  onSave: async (name, bytes) => { /* write to a file handle, a project, or download */ },
  onDirty: (dirty) => { /* e.g. guard leaving the page */ },
  onFailed: (error) => { /* show it; offer a reload */ },
});
const r = await cad.open("plan.dwg", await file.arrayBuffer()); // { ok, ms, entities, warnings, error }
```

- `open` transfers the buffer (it is unusable afterwards) and resolves when the
  engine has opened the drawing — the cue to hide a spinner.
- Several `open`s add tabs inside the CAD app.
- `onSave` gets every file the app produces (Save, Save As, PNG/PDF/SVG
  exports). Default: a browser download.
- `destroy()` removes the frame; unsaved work in it is gone — check `dirty`.

Same-origin only: the page and `cad-desktop` must be served from one origin.
