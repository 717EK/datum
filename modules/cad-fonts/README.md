# cad-fonts

Fonts for drawing text when the CAD engine runs in a browser, which has no
installed fonts to look up. Without them, text falls back to the engine's
single-stroke drafting font.

- `fonts/` — Liberation Sans (regular, bold, italic, bold italic), Serif
  (regular, bold) and Mono (regular), v2.1.5. Metric-compatible with Arial,
  Times New Roman and Courier New, so a line of text keeps its length.
- `fonts.json` — which names each file answers to (the font file a text style
  asks for, e.g. Meter's DWG export uses `arial.ttf` and `arialbd.ttf`).

## Use
Serve the folder with the app (a service worker should cache it), fetch
`fonts.json`, then each file, and hand them to the engine **before the first
drawing opens** — with `cad-desktop`:

```js
const list = await (await fetch(base + "fonts.json")).json();
const fonts = [];
for (const f of list.fonts) {
  const bytes = await (await fetch(base + f.file)).arrayBuffer();
  for (const name of f.names) fonts.push({ name, bytes: bytes.slice(0) });
}
frame.contentWindow.postMessage({ type: "taxicad:fonts", fonts }, origin);
```

Licence: SIL Open Font License 1.1 (`LICENSE-OFL.txt`), © Red Hat / Liberation
Fonts project. Redistributable with the licence; not sold on their own.
