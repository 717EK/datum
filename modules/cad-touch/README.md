# cad-touch

The touch interface for the CAD engine on phones and tablets, in Meter's phone
language. Plain TypeScript + DOM, no dependencies, no app imports.

- **Bar of categories** (phones: bottom; tablets ≥ 700 × 500: a rail down the
  left): Draw · Modify · Annotate · Layers · View · File. Each opens a sheet of
  tools (half height above the bar; a side panel on tablets).
- **Strip** above the bar while a command runs: its prompt, its options as
  chips ("Close", "Undo", …), Type (a value: `1200`, `@1000<45`), Enter,
  Cancel. With objects selected and no command: Move, Copy, Rotate, Scale,
  Mirror, Erase, Clear.
- **Top row**: back (optional), the drawing's name (• = unsaved), undo, redo.
- **Layers** sheet: make current, show/hide, lock. **View**: fit all, zoom
  box/in/out/previous, and switches for object snap, ortho, polar, grid,
  lineweights. **File**: Save, Save DWG (2018), Save DXF, PDF, Close drawing.

The pen and fingers are handled inside the drawing (cad-desktop in touch
mode): the Pencil draws and picks (hover previews snaps), one finger pans,
two fingers zoom, a two-finger tap undoes, a one-finger tap clicks.

```ts
import { mountCadDesktop } from "./modules/cad-host/src/index";
import { mountCadTouch } from "./modules/cad-touch/src/index";

let touch;
const cad = mountCadDesktop(host, { base, fontsBase, ui: "touch", onState: (s) => touch?.setState(s) });
touch = mountCadTouch(host, cad, { onBack: () => goHome() });
```

`host` must be positioned (`position: relative/absolute`); the touch chrome is
laid over the drawing frame. Colours are CSS variables on `.ct-root`
(`--ct-bar`, `--ct-accent`, …).
