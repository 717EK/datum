/**
 * Datum 2D — DWG / DXF viewing, built on mlightcad's cad-simple-viewer.
 *
 * This is a separate bundle (`dist/cad2d.js`) that app.ts loads on demand the
 * first time a .dwg/.dxf is opened, so the 3D app shell stays small. It
 * exposes one global, `window.DatumCad2d`, with a tiny API.
 *
 *  - DXF is parsed by the built-in converter in @mlightcad/data-model (MIT).
 *  - DWG is parsed by @mlightcad/libredwg-converter (LibreDWG → WASM, GPL-3.0)
 *    in a Web Worker; its worker + wasm live in dist/workers/ (copied by the
 *    build) and are cached lazily by the service worker.
 *  - Fonts for text entities come from mlightcad's cad-data repo on jsDelivr;
 *    the service worker caches whatever is fetched so drawings reopen offline.
 *  - The toolbar (select / pan / zoom / layers / measure / markup) is the
 *    library's own simple UI plugin, which already has phone / pad / desktop
 *    layouts and touch gestures (pinch-zoom, one-finger pan, tap-select).
 */
import {
  AcApDocManager,
  acedApplyUiTheme,
  layoutBackgroundColorFromRgb,
  AcEdOpenMode,
  LIBREDWG_PARSER_WORKER_FILE,
  MTEXT_RENDERER_WORKER_FILE,
  formatMeasurementLength,
  refreshMeasurementValueLabels,
  resetMeasurementUnitOverride,
  setMeasurementUnitOverride,
} from "@mlightcad/cad-simple-viewer";
import { AcDbDatabaseConverterManager, AcDbFileType, AcDbSystemVariables, AcDbSysVarManager } from "@mlightcad/data-model";
import { AcDbLibreDwgConverter } from "@mlightcad/libredwg-converter";
import { acuiRegisterSimpleUiPlugin } from "@mlightcad/cad-simple-ui-plugin/register";

export type Cad2dUnit = "drawing" | "mm" | "cm" | "m" | "in" | "ft" | "ft-in";

export interface Cad2dOpenResult {
  ok: boolean;
  error?: string;
}

export interface Cad2dApi {
  /** Create (once) the document manager inside `container`, with the toolbar mounted in `host`. */
  init(container: HTMLElement, host: HTMLElement, theme: "light" | "dark"): Promise<void>;
  /** Open a DWG/DXF from bytes. */
  open(name: string, bytes: ArrayBuffer): Promise<Cad2dOpenResult>;
  /** Close the current drawing (frees geometry) but keep the manager. */
  close(): Promise<void>;
  setTheme(theme: "light" | "dark"): void;
  /** Display unit for measurements; "drawing" = whatever the file's own units are. */
  setUnits(unit: Cad2dUnit): void;
  /** Format a length in drawing units with the effective measurement units (what the measure labels show). */
  formatLength(value: number): string | null;
  /** PNG data URL of the current view, or null. */
  snapshot(): string | null;
  /** Whether workers (mtext / dwg) are reachable — a deploy sanity check. */
  workersReady(): Promise<boolean>;
}

const WORKER_DIR = "./workers/";
const FONT_BASE_URL = "https://cdn.jsdelivr.net/gh/mlightcad/cad-data@main/";

let inited: Promise<void> | null = null;
let currentTheme: "light" | "dark" = "light";
// Phones/tablets: keep MTEXT layout on the main thread (less peak memory).
// Desktop: run it in the worker so heavy text sheets don't block input.
const isMobileUA = /Android|iPhone|iPad|iPod/.test(navigator.userAgent) || (/Macintosh/.test(navigator.userAgent) && navigator.maxTouchPoints > 0);

/** Drawing background follows the app theme: white paper in light mode, black in dark.
 *  The viewer inverts ACI 7 (black/white) entities to match, so lines never vanish. */
const bgRgb = () => (currentTheme === "dark" ? 0x000000 : 0xffffff);
function bgSysVars() {
  // Only PAPERBKCOLOR is safe as an open-time sysvar; MODELBKCOLOR at open
  // time breaks layout resolution in cad-simple-viewer 1.7, so model space is
  // tinted through the view setter right after the document opens.
  // COLORTHEME (1 = light, 0 = dark) is what the UI plugin follows once a
  // document is open, AutoCAD-style — without it the toolbar snaps back to dark.
  return { lwdisplay: false, colortheme: currentTheme === "light" ? 1 : 0, paperbkcolor: layoutBackgroundColorFromRgb(bgRgb()) };
}
function applyViewBackground(): void {
  const m = AcApDocManager.tryGetInstance();
  try {
    if (m?.curView) m.curView.backgroundColor = bgRgb();
  } catch {
    /* no document open */
  }
}
let currentUnit: Cad2dUnit = "drawing";

/**
 * Map the app's unit choice onto AutoCAD-style codes the library understands:
 * INSUNITS (1 in, 2 ft, 4 mm, 5 cm, 6 m) for the length unit, LUNITS for the
 * display format (2 decimal, 4 architectural) and LUPREC for precision.
 */
function applyUnits(): void {
  const m = AcApDocManager.tryGetInstance();
  if (currentUnit === "drawing") {
    resetMeasurementUnitOverride();
  } else {
    const table: Record<Exclude<Cad2dUnit, "drawing">, { lengthUnit: number; lunits: number; luprec: number }> = {
      mm: { lengthUnit: 4, lunits: 2, luprec: 1 },
      cm: { lengthUnit: 5, lunits: 2, luprec: 2 },
      m: { lengthUnit: 6, lunits: 2, luprec: 3 },
      in: { lengthUnit: 1, lunits: 2, luprec: 3 },
      ft: { lengthUnit: 2, lunits: 2, luprec: 3 },
      "ft-in": { lengthUnit: 1, lunits: 4, luprec: 4 },
    };
    setMeasurementUnitOverride(table[currentUnit]);
  }
  try {
    const db = m?.curDocument?.database;
    if (m?.curView && db) refreshMeasurementValueLabels(m.curView, db);
  } catch {
    /* no document open */
  }
}
let hostEl: HTMLElement | null = null;
let containerEl: HTMLElement | null = null;

function workerUrls() {
  const base = new URL(WORKER_DIR, document.baseURI).href;
  return {
    dwgParser: base + LIBREDWG_PARSER_WORKER_FILE,
    mtextRender: base + MTEXT_RENDERER_WORKER_FILE,
  };
}

async function doInit(container: HTMLElement, host: HTMLElement, theme: "light" | "dark"): Promise<void> {
  hostEl = host;
  containerEl = container;
  currentTheme = theme;
  const urls = workerUrls();

  // DWG is opt-in (GPL): register LibreDWG as the DWG converter.
  AcDbDatabaseConverterManager.instance.register(
    AcDbFileType.DWG,
    new AcDbLibreDwgConverter({
      convertByEntityType: false,
      useWorker: true,
      parserWorkerUrl: urls.dwgParser,
    }),
  );

  acedApplyUiTheme(theme);
  acedApplyUiTheme(theme, host);

  AcApDocManager.createInstance({
    container,
    busyIndicatorHost: host,
    autoResize: true,
    baseUrl: FONT_BASE_URL,
    // Main-thread MTEXT layout uses less peak memory — the better trade on
    // phones and tablets; the worker only helps on very text-heavy sheets.
    useMainThreadDraw: isMobileUA,
    // Fetch the fallback font chain now (while online) so the service worker
    // has it cached before the first offline drawing.
    preloadDefaultFonts: true,
    openDocumentDefaults: () => ({
      minimumChunkSize: 1000,
      mode: AcEdOpenMode.Read,
      progressiveRendering: false,
      sysVars: bgSysVars(),
    }),
    webworkerFileUrls: urls,
  });

  await acuiRegisterSimpleUiPlugin(AcApDocManager.instance.pluginManager, {
    host,
    layout: "auto",
    dockPanel: { enabled: true, defaultOpen: false, defaultHeight: 240, defaultWidth: 280 },
    toolbar: {
      placement: "right",
      items: "default",
      // Export plugins (HTML/PDF/SVG) aren't bundled; locale switching isn't needed.
      excludeItems: ["export", "locale", "theme"],
      collapsible: true,
      inCanvasParent: true,
    },
    layouts: {
      phone: {
        toolbar: {
          placement: "bottom",
          showLabels: true,
          size: "stretch",
          edgeOffset: 0,
          collapsible: false,
          inCanvasParent: true,
          subToolbar: { showLabels: true, showSeparators: false, size: "stretch", overflow: "wrap", replaceOnNested: true },
        },
      },
      pad: {
        toolbar: { placement: "bottom", showLabels: false, size: "auto", collapsible: true, inCanvasParent: true },
      },
    },
  });
}

const api: Cad2dApi = {
  init(container, host, theme) {
    if (!inited) {
      inited = doInit(container, host, theme).catch((err) => {
        inited = null;
        throw err;
      });
    }
    return inited;
  },

  async open(name, bytes) {
    if (!inited) return { ok: false, error: "2D viewer not initialised" };
    await inited;
    try {
      const ok = await AcApDocManager.instance.openDocument(name, bytes, {
        minimumChunkSize: 1000,
        mode: AcEdOpenMode.Read,
        progressiveRendering: false,
        sysVars: bgSysVars(),
      });
      if (ok) {
        applyViewBackground();
        // Opening a document clears the library's unit override — re-apply ours.
        applyUnits();
      }
      return ok ? { ok: true } : { ok: false, error: "The drawing could not be read." };
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
  },

  async close() {
    const m = AcApDocManager.tryGetInstance();
    if (!m) return;
    try {
      await m.closeDocument();
    } catch (err) {
      console.warn("[Datum 2D] close failed", err);
    }
  },

  setTheme(theme) {
    currentTheme = theme;
    acedApplyUiTheme(theme);
    if (hostEl) acedApplyUiTheme(theme, hostEl);
    // With a drawing open, the UI follows its COLORTHEME sysvar; set that too.
    const db = AcApDocManager.tryGetInstance()?.curDocument?.database;
    if (db) {
      try {
        AcDbSysVarManager.instance().setVar(AcDbSystemVariables.COLORTHEME, theme === "light" ? 1 : 0, db);
      } catch (err) {
        console.warn("[Datum 2D] COLORTHEME", err);
      }
    }
    // Re-tint the open drawing too (this also re-inverts ACI 7 entities).
    applyViewBackground();
  },

  setUnits(unit) {
    currentUnit = unit;
    applyUnits();
  },

  formatLength(value) {
    const db = AcApDocManager.tryGetInstance()?.curDocument?.database;
    if (!db) return null;
    try {
      return formatMeasurementLength(db, value);
    } catch {
      return null;
    }
  },

  snapshot() {
    const canvas = containerEl?.querySelector("canvas");
    if (!canvas) return null;
    try {
      // Force a frame so the buffer isn't stale/blank when preserveDrawingBuffer is off.
      const m = AcApDocManager.tryGetInstance();
      (m?.curView as unknown as { render?: () => void } | undefined)?.render?.();
      return canvas.toDataURL("image/png");
    } catch {
      return null;
    }
  },

  workersReady() {
    return AcApDocManager.checkWebworkerReadiness(workerUrls());
  },
};

(window as unknown as { DatumCad2d: Cad2dApi }).DatumCad2d = api;
