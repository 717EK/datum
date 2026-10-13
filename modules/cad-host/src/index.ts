/**
 * cad-host — embed the `cad-desktop` module (the full desktop CAD interface,
 * WebAssembly) in any page, and talk to it with promises instead of raw
 * postMessage. No app imports; the page passes in where things are and what to
 * do with saved files.
 *
 *   const cad = mountCadDesktop(el, { base: "modules/cad-desktop/", fontsBase: "modules/cad-fonts/",
 *                                     onSave: (name, bytes) => store(name, bytes) });
 *   const r = await cad.open("plan.dwg", await file.arrayBuffer());
 */

export interface CadOpened {
  name: string;
  ok: boolean;
  /** Time the engine spent opening, in ms. */
  ms: number;
  entities?: number;
  /** What a partial read left out (DWG records it couldn't decode). */
  warnings?: string[];
  error?: string;
}

export interface CadDesktopOptions {
  /** URL of the cad-desktop folder, ending in "/". */
  base: string;
  /** URL of the cad-fonts folder, ending in "/". Its fonts go to the engine before the first drawing. */
  fontsBase?: string;
  /** Every file the CAD app produces (Save, Save As, exports). Default: a browser download. */
  onSave?: (name: string, bytes: ArrayBuffer) => void | Promise<void>;
  /** Unsaved changes appeared (true) or went away (false). */
  onDirty?: (dirty: boolean) => void;
  /** The CAD app could not start, or stopped answering. */
  onFailed?: (error: string) => void;
  /** Accessible title of the frame. */
  title?: string;
}

export interface CadDesktop {
  readonly frame: HTMLIFrameElement;
  /** Resolves when the app is listening (and has its fonts); rejects if it failed to start. */
  readonly ready: Promise<void>;
  /** Open a drawing in a new tab of the CAD app. The buffer is transferred (unusable afterwards). */
  open(name: string, bytes: ArrayBuffer): Promise<CadOpened>;
  /** Whether any open drawing has unsaved changes. */
  readonly dirty: boolean;
  focus(): void;
  destroy(): void;
}

type FontItem = { name: string; bytes: ArrayBuffer };
const fontCache = new Map<string, Promise<FontItem[]>>();

/** Fetch a cad-fonts folder once per page; every alias gets its own copy (each is transferred). */
function loadFonts(fontsBase: string): Promise<FontItem[]> {
  let p = fontCache.get(fontsBase);
  if (!p) {
    p = (async () => {
      const list = (await (await fetch(fontsBase + "fonts.json")).json()) as { fonts: { file: string; names: string[] }[] };
      const out: FontItem[] = [];
      await Promise.all(
        list.fonts.map(async (f) => {
          const res = await fetch(fontsBase + f.file);
          if (!res.ok) return;
          const bytes = await res.arrayBuffer();
          for (const name of f.names) out.push({ name, bytes });
        }),
      );
      return out;
    })().catch((e) => {
      fontCache.delete(fontsBase);
      console.warn("[cad-host] fonts not loaded; text will use the drafting font", e);
      return [];
    });
    fontCache.set(fontsBase, p);
  }
  return p;
}

function download(name: string, bytes: ArrayBuffer): void {
  const url = URL.createObjectURL(new Blob([bytes], { type: "application/octet-stream" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.style.display = "none";
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

export function mountCadDesktop(container: HTMLElement, opts: CadDesktopOptions): CadDesktop {
  const frame = document.createElement("iframe");
  frame.className = "cad-host-frame";
  frame.title = opts.title ?? "CAD drawing";
  frame.setAttribute("allow", "clipboard-read; clipboard-write; fullscreen");
  frame.style.cssText = "border:0;display:block;width:100%;height:100%;background:#22282f";
  frame.src = new URL(opts.base + "index.html?host=parent", location.href).href;
  container.appendChild(frame);

  let dirty = false;
  let readyResolve!: () => void;
  let readyReject!: (e: Error) => void;
  let isReady = false;
  const ready = new Promise<void>((res, rej) => {
    readyResolve = res;
    readyReject = rej;
  });
  ready.catch(() => {});
  const pending: ((r: CadOpened) => void)[] = [];

  const onMessage = async (e: MessageEvent) => {
    if (e.source !== frame.contentWindow || e.origin !== location.origin) return;
    const d = (e.data ?? {}) as Record<string, unknown>;
    switch (d.type) {
      case "taxicad:ready": {
        if (opts.fontsBase) {
          const fonts = await loadFonts(opts.fontsBase);
          // Copies: the same file serves several names, and the bytes are copied on the other side.
          frame.contentWindow?.postMessage({ type: "taxicad:fonts", fonts: fonts.map((f) => ({ name: f.name, bytes: f.bytes })) }, location.origin);
        }
        isReady = true;
        readyResolve();
        break;
      }
      case "taxicad:opened": {
        const r: CadOpened = {
          name: String(d.name ?? ""),
          ok: d.ok === true,
          ms: Number(d.ms ?? 0),
          entities: typeof d.entities === "number" ? d.entities : undefined,
          warnings: Array.isArray(d.warnings) ? (d.warnings as string[]) : undefined,
          error: typeof d.error === "string" ? d.error : undefined,
        };
        pending.shift()?.(r);
        break;
      }
      case "taxicad:save": {
        const name = String(d.name ?? "Drawing.dxf");
        const bytes = d.bytes as ArrayBuffer;
        try {
          await (opts.onSave ?? download)(name, bytes);
        } catch (err) {
          console.error("[cad-host] saving failed", err);
          download(name, bytes);
        }
        break;
      }
      case "taxicad:dirty":
        dirty = d.dirty === true;
        opts.onDirty?.(dirty);
        break;
      case "taxicad:failed": {
        const err = String(d.error ?? "the CAD app could not start");
        if (!isReady) readyReject(new Error(err));
        opts.onFailed?.(err);
        break;
      }
    }
  };
  window.addEventListener("message", onMessage);

  return {
    frame,
    ready,
    get dirty() {
      return dirty;
    },
    async open(name, bytes) {
      await ready;
      return new Promise<CadOpened>((resolve) => {
        pending.push(resolve);
        frame.contentWindow?.postMessage({ type: "taxicad:open", name, bytes }, location.origin, [bytes]);
      });
    },
    focus() {
      frame.focus();
      frame.contentWindow?.focus();
    },
    destroy() {
      window.removeEventListener("message", onMessage);
      for (const p of pending.splice(0)) p({ name: "", ok: false, ms: 0, error: "closed" });
      frame.remove();
    },
  };
}
