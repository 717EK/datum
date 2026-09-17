# Licences

Datum is open source. Two licences apply, depending on what you take:

## The code in this repository — MIT

Everything written here (the original STEP Viewer plugin by Ondřej Uhnavý and
the Datum web/PWA additions by TAXI Design Studio) is licensed under the MIT
licence in [`LICENSE`](./LICENSE).

## The built web app (`dist/`, https://datum-viewer.vercel.app) — GPL-3.0

The web build bundles **LibreDWG** (via `@mlightcad/libredwg-converter`) to read
`.dwg` files. LibreDWG is licensed under the **GNU GPL v3.0**, so the combined
web application as distributed is licensed under the GPL-3.0 — see
[`LICENSE.GPL-3.0`](./LICENSE.GPL-3.0). The complete corresponding source is
this repository: https://github.com/717EK/datum

If you want an MIT-only build, leave DWG out: remove
`@mlightcad/libredwg-converter` and the `AcDbLibreDwgConverter` registration
in `src/web/cad2d.ts`. DXF, STEP, STL, OBJ and FCStd remain fully supported.

## Third-party components

| Component | Licence | Used for |
|---|---|---|
| [occt-import-js](https://github.com/kovacsv/occt-import-js) (OpenCASCADE → WASM) | LGPL-2.1 | STEP / BREP parsing |
| [three.js](https://threejs.org/) | MIT | 3D and 2D rendering |
| [@mlightcad/cad-simple-viewer](https://github.com/mlightcad/cad-viewer), cad-simple-ui-plugin, data-model, three-renderer, mtext-renderer | MIT | DWG/DXF viewer, DXF parsing, 2D toolbar |
| [@mlightcad/libredwg-converter](https://github.com/mlightcad/cad-viewer) ([LibreDWG](https://www.gnu.org/software/libredwg/)) | GPL-3.0 | DWG parsing |
| [Lucide](https://lucide.dev/) | ISC | Icons |
| [fflate](https://github.com/101arrowz/fflate) | MIT | FreeCAD (.FCStd) unzip |
| mlightcad [cad-data](https://github.com/mlightcad/cad-data) fonts (fetched at runtime) | see that repo | Text in drawings |

The TAXI Design Studio name and wordmark are trademarks of TAXI Design Studio
and are not covered by the licences above.
