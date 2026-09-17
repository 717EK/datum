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
  AcEdOpenMode,
  LIBREDWG_PARSER_WORKER_FILE,
  MTEXT_RENDERER_WORKER_FILE,
} from "@mlightcad/cad-simple-viewer";
import { AcDbDatabaseConverterManager, AcDbFileType } from "@mlightcad/data-model";
import { AcDbLibreDwgConverter } from "@mlightcad/libredwg-converter";
import { acuiRegisterSimpleUiPlugin } from "@mlightcad/cad-simple-ui-plugin/register";

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
  /** PNG data URL of the current view, or null. */
  snapshot(): string | null;
  /** Whether workers (mtext / dwg) are reachable — a deploy sanity check. */
  workersReady(): Promise<boolean>;
}

const WORKER_DIR = "./workers/";
const FONT_BASE_URL = "https://cdn.jsdelivr.net/gh/mlightcad/cad-data@main/";

let inited: Promise<void> | null = null;
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

  acedApplyUiTheme(theme, host);

  AcApDocManager.createInstance({
    container,
    busyIndicatorHost: host,
    autoResize: true,
    baseUrl: FONT_BASE_URL,
    // Main-thread MTEXT layout uses less peak memory — the better trade on
    // phones and tablets; the worker only helps on very text-heavy sheets.
    useMainThreadDraw: true,
    openDocumentDefaults: () => ({
      minimumChunkSize: 1000,
      mode: AcEdOpenMode.Read,
      progressiveRendering: false,
      sysVars: { lwdisplay: false },
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
        sysVars: { lwdisplay: false },
      });
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
    if (hostEl) acedApplyUiTheme(theme, hostEl);
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
