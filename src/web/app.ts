/**
 * Datum — web / PWA entry point (TAXI Design Studio).
 *
 * A standalone shell around the same viewer the Obsidian plugin uses
 * (`mountViewer` / `mountModel`): open a local STEP / STP / STL / OBJ / FCStd
 * file (picker, drag-and-drop, "Open with…" of the installed app, or the
 * recent-files list), parse it entirely on-device, and render it. Nothing is
 * uploaded anywhere.
 *
 * The load pipeline mirrors `StepView.parseAndMount` (cache, quality tiers,
 * coarser retry, no-geometry / wireframe diagnostics) but reads from `File`
 * objects instead of the vault.
 */
import "./obsidian-shim";
import { Notice, Platform, Plugin, setIcon, setTooltip } from "obsidian";
import { OcctLoader } from "../viewer/OcctLoader";
import { deflectionForSize, paramsForDeflection, coarserDeflection, tiersForProfile, Profile } from "../viewer/params";
import { GeometryCache, cacheKey, resultBytes, CACHE_MIN_BYTES } from "../viewer/GeometryCache";
import { mountViewer, mountModel, ViewerHandle } from "../viewer/mountViewer";
import { objToStepModel, stlToStepModel } from "../viewer/MeshLoaders";
import { fcstdToStepModel } from "../viewer/FreeCadLoader";
import { formatFileSize, shouldWarnLargeModel } from "../viewer/mobileGuard";
import { hasRenderableMeshes, isWireframeOnly } from "../viewer/StepToThree";
import { METADATA_MAX_BYTES } from "../viewer/StepMeta";
import { StepViewerSettings, DEFAULT_SETTINGS } from "../settings";
import { initPwa, InstallMode, PwaHandle } from "./pwa";
import { RecentsStore, RecentEntry, entryId } from "./recents";

declare const __APP_VERSION__: string;
declare const __BUILD_HASH__: string;

export const APP_NAME = "Datum";
const APP_TAGLINE = "Open STEP, STL, OBJ and FreeCAD models — on this device, nothing uploaded.";
const COMPANY = "TAXI Design Studio";

const SUPPORTED = ["step", "stp", "stl", "obj", "fcstd"];
const ACCEPT = ".step,.stp,.stl,.obj,.fcstd,model/step,model/stl,application/sla,model/obj";
const SETTINGS_KEY = "step-viewer:settings";
const THEME_KEY = "step-viewer:theme";

type Theme = "auto" | "light" | "dark";

// File System Access API (Chromium). Typed locally — not in the DOM lib yet.
interface OpenPickerOptions {
  multiple?: boolean;
  types?: { description?: string; accept: Record<string, string[]> }[];
}
type ShowOpenFilePicker = (o?: OpenPickerOptions) => Promise<FileSystemFileHandle[]>;
const showOpenFilePicker = (window as unknown as { showOpenFilePicker?: ShowOpenFilePicker }).showOpenFilePicker;

// --- Settings ----------------------------------------------------------------

function loadSettings(): StepViewerSettings {
  let s: StepViewerSettings = { ...DEFAULT_SETTINGS };
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (raw) s = { ...s, ...(JSON.parse(raw) as Partial<StepViewerSettings>) };
  } catch {
    /* ignore */
  }
  if (!Array.isArray(s.tiers) || s.tiers.length === 0) {
    s.tiers = tiersForProfile("fastest");
    s.profile = "fastest";
  }
  return s;
}

function saveSettings(s: StepViewerSettings): void {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(s));
  } catch {
    /* ignore */
  }
}

// --- Theme -------------------------------------------------------------------

const darkQuery = window.matchMedia("(prefers-color-scheme: dark)");
function applyTheme(theme: Theme): void {
  const dark = theme === "dark" || (theme === "auto" && darkQuery.matches);
  document.body.classList.toggle("theme-dark", dark);
  document.body.classList.toggle("theme-light", !dark);
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute("content", dark ? "#1e1e1e" : "#ffffff");
}
function currentTheme(): Theme {
  const t = localStorage.getItem(THEME_KEY);
  return t === "light" || t === "dark" ? t : "auto";
}

function relativeTime(ts: number): string {
  const d = Date.now() - ts;
  const m = Math.round(d / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h} h ago`;
  const days = Math.round(h / 24);
  if (days < 7) return `${days} d ago`;
  return new Date(ts).toLocaleDateString();
}

// --- App ---------------------------------------------------------------------

class WebApp {
  private plugin = new Plugin();
  private settings = loadSettings();
  private cache = new GeometryCache();
  private recents = new RecentsStore();
  private viewer: ViewerHandle | null = null;
  private loadToken = 0;
  private currentFile: File | null = null;
  private currentEntry: RecentEntry | null = null;

  private root: HTMLElement;
  private titleEl!: HTMLElement;
  private host!: HTMLElement;
  private welcome!: HTMLElement;
  private recentsEl!: HTMLElement;
  private installBtn!: HTMLElement;
  private updateBtn!: HTMLElement;
  private fileInput!: HTMLInputElement;
  private pwa!: PwaHandle;
  private installMode: InstallMode = "unavailable";
  private installReason = "";
  private pendingUpdate: (() => void) | null = null;
  private settingsPop: HTMLElement | null = null;

  constructor(root: HTMLElement) {
    this.root = root;
    document.body.classList.toggle("is-mobile", Platform.isMobile);
    document.body.classList.toggle("is-phone", Platform.isPhone);
    applyTheme(currentTheme());
    darkQuery.addEventListener("change", () => applyTheme(currentTheme()));
    this.buildShell();
    this.wireFileSources();
    void this.renderRecents();
    this.pwa = initPwa(__APP_VERSION__, {
      onInstallMode: (mode, d) => {
        this.installMode = mode;
        this.installReason = d.reason ?? "";
        this.syncInstallButton();
      },
      onUpdateAvailable: (apply) => this.showUpdate(apply),
      onInstalled: () => new Notice(`${APP_NAME} installed. You can open CAD files with it from your file manager.`),
      onCheckState: (state) => {
        this.updateBtn.toggleClass("is-checking", state === "checking");
      },
    });
  }

  // --- Shell -------------------------------------------------------------

  private buildShell(): void {
    const r = this.root;
    r.empty();
    r.addClass("sv-app");

    const header = r.createDiv({ cls: "sv-header" });
    const brand = header.createEl("button", { cls: "sv-brand" });
    setTooltip(brand, "Home");
    brand.createSpan({ cls: "sv-logo" });
    brand.createSpan({ cls: "sv-brand-name", text: APP_NAME });
    brand.addEventListener("click", () => this.goHome());
    this.titleEl = header.createDiv({ cls: "sv-title", text: "" });

    const actions = header.createDiv({ cls: "sv-actions" });

    const openBtn = actions.createEl("button", { cls: "sv-btn sv-btn-primary" });
    setIcon(openBtn.createSpan({ cls: "sv-btn-icon" }), "folder-open");
    openBtn.createSpan({ cls: "sv-btn-label", text: "Open" });
    setTooltip(openBtn, "Open a STEP / STP / STL / OBJ / FCStd file");
    openBtn.addEventListener("click", () => void this.pickFile());

    this.updateBtn = actions.createEl("button", { cls: "sv-btn sv-btn-update" });
    setIcon(this.updateBtn.createSpan({ cls: "sv-btn-icon" }), "refresh-cw");
    this.updateBtn.createSpan({ cls: "sv-btn-label", text: "Update" });
    setTooltip(this.updateBtn, "A new version is ready — click to update");
    this.updateBtn.hide();
    this.updateBtn.addEventListener("click", () => {
      if (this.pendingUpdate) this.showUpdate(this.pendingUpdate);
    });

    this.installBtn = actions.createEl("button", { cls: "sv-btn sv-btn-install" });
    setIcon(this.installBtn.createSpan({ cls: "sv-btn-icon" }), "download");
    this.installBtn.createSpan({ cls: "sv-btn-label", text: "Install" });
    this.installBtn.addEventListener("click", () => void this.onInstallClick());
    this.installBtn.hide();

    const settingsBtn = actions.createEl("button", { cls: "sv-btn sv-btn-icon-only" });
    setIcon(settingsBtn, "settings");
    setTooltip(settingsBtn, "Settings");
    settingsBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      this.toggleSettings(settingsBtn);
    });

    // Viewer area, welcome page, and the company mark that is always in view.
    const main = r.createDiv({ cls: "sv-main" });
    this.host = main.createDiv({ cls: "step-viewer-host sv-host" });
    this.host.hide();
    this.welcome = main.createDiv({ cls: "sv-welcome" });
    this.buildWelcome();
    const mark = main.createDiv({ cls: "sv-company" });
    mark.createSpan({ cls: "sv-company-mark", attr: { role: "img", "aria-label": COMPANY } });
    setTooltip(mark, COMPANY);

    this.fileInput = r.createEl("input", { attr: { type: "file", accept: ACCEPT, hidden: "" } });
    this.fileInput.addEventListener("change", () => {
      const f = this.fileInput.files?.[0];
      if (f) void this.openFile(f);
      this.fileInput.value = "";
    });
  }

  private buildWelcome(): void {
    const w = this.welcome;
    w.empty();
    const left = w.createDiv({ cls: "sv-welcome-left" });

    // Hero: logo + name + tagline.
    const hero = left.createDiv({ cls: "sv-hero" });
    hero.createDiv({ cls: "sv-hero-logo" });
    const text = hero.createDiv({ cls: "sv-hero-text" });
    text.createEl("h1", { text: APP_NAME });
    text.createEl("p", { text: APP_TAGLINE, cls: "sv-muted" });
    text.createEl("p", { text: `by ${COMPANY}`, cls: "sv-muted sv-small sv-hero-by" });

    // The big open box (also the drop target).
    const box = left.createEl("button", { cls: "sv-dropbox" });
    const bi = box.createDiv({ cls: "sv-dropbox-icon" });
    setIcon(bi, "folder-open");
    box.createDiv({ cls: "sv-dropbox-title", text: "Open a CAD file" });
    box.createDiv({
      cls: "sv-dropbox-sub sv-muted",
      text: Platform.isMobile ? "Tap to choose a file from this device" : "Click to choose, or drop a file here",
    });
    const fmts = box.createDiv({ cls: "sv-formats" });
    for (const f of ["STEP", "STP", "STL", "OBJ", "FCStd"]) fmts.createSpan({ cls: "sv-chip", text: f });
    box.addEventListener("click", () => void this.pickFile());

    left.createDiv({ cls: "sv-muted sv-tiny sv-version", text: `v${__APP_VERSION__} · ${__BUILD_HASH__}` });

    // Recents.
    const right = w.createDiv({ cls: "sv-welcome-right" });
    const rh = right.createDiv({ cls: "sv-recent-head" });
    rh.createEl("h2", { text: "Recently opened" });
    const clear = rh.createEl("button", { cls: "sv-btn sv-btn-sm sv-recent-clear", text: "Clear" });
    clear.addEventListener("click", () => {
      void this.recents.clear().then(() => this.renderRecents());
    });
    this.recentsEl = right.createDiv({ cls: "sv-recent-list" });
  }

  private async renderRecents(): Promise<void> {
    const list = await this.recents.list();
    const el = this.recentsEl;
    el.empty();
    const clearBtn = this.welcome.querySelector(".sv-recent-clear") as HTMLElement | null;
    clearBtn?.toggle(list.length > 0);
    if (!list.length) {
      const empty = el.createDiv({ cls: "sv-recent-empty sv-muted" });
      empty.createDiv({ text: "Nothing yet." });
      empty.createDiv({ cls: "sv-small", text: "Models you open will show up here so you can reopen them with one tap." });
      return;
    }
    for (const e of list) {
      const card = el.createEl("button", { cls: "sv-recent" });
      const thumb = card.createDiv({ cls: "sv-recent-thumb" });
      if (e.thumb) {
        thumb.createEl("img", { attr: { src: e.thumb, alt: "" } });
      } else {
        setIcon(thumb, "box");
      }
      const body = card.createDiv({ cls: "sv-recent-body" });
      body.createDiv({ cls: "sv-recent-name", text: e.name });
      const canReopen = !!e.handle || e.hasBlob;
      body.createDiv({
        cls: "sv-recent-meta sv-muted",
        text: `${formatFileSize(e.size)} · ${relativeTime(e.openedAt)}${canReopen ? "" : " · open again to view"}`,
      });
      const rm = card.createEl("button", { cls: "sv-recent-rm clickable-icon" });
      setIcon(rm, "x");
      setTooltip(rm, "Remove from list");
      rm.addEventListener("click", (ev) => {
        ev.stopPropagation();
        void this.recents.remove(e.id).then(() => this.renderRecents());
      });
      card.addEventListener("click", () => void this.openRecent(e));
    }
  }

  private async openRecent(e: RecentEntry): Promise<void> {
    const file = await this.recents.reopen(e);
    if (!file) {
      new Notice(`"${e.name}" isn't stored on this device any more — please open it again.`);
      void this.pickFile();
      return;
    }
    await this.openFile(file, e.handle);
  }

  private setTitle(name: string | null): void {
    this.titleEl.setText(name ?? "");
    document.title = name ? `${name} – ${APP_NAME}` : `${APP_NAME} · ${COMPANY}`;
  }

  /** Back to the welcome page (keeps the parsed model cache; drops the scene). */
  private goHome(): void {
    this.loadToken++;
    this.teardown();
    this.currentFile = null;
    this.currentEntry = null;
    this.host.hide();
    this.welcome.show();
    this.setTitle(null);
    void this.renderRecents();
  }

  // --- File sources ------------------------------------------------------

  /** Prefer the File System Access picker (gives a re-openable handle). */
  private async pickFile(): Promise<void> {
    if (showOpenFilePicker) {
      try {
        const [h] = await showOpenFilePicker({
          multiple: false,
          types: [
            {
              description: "CAD models",
              accept: { "model/step": [".step", ".stp"], "model/stl": [".stl"], "model/obj": [".obj"], "application/x-freecad": [".fcstd"] },
            },
          ],
        });
        if (h) await this.openFile(await h.getFile(), h);
        return;
      } catch (err) {
        if ((err as Error)?.name === "AbortError") return; // user cancelled
        // Fall through to the classic input (e.g. picker blocked in an iframe).
      }
    }
    this.fileInput.click();
  }

  private wireFileSources(): void {
    // Drag & drop anywhere.
    let depth = 0;
    window.addEventListener("dragenter", (e) => {
      if (!e.dataTransfer?.types.includes("Files")) return;
      depth++;
      document.body.addClass("is-dragover");
    });
    window.addEventListener("dragleave", () => {
      depth = Math.max(0, depth - 1);
      if (depth === 0) document.body.removeClass("is-dragover");
    });
    window.addEventListener("dragover", (e) => {
      if (e.dataTransfer?.types.includes("Files")) e.preventDefault();
    });
    window.addEventListener("drop", (e) => {
      depth = 0;
      document.body.removeClass("is-dragover");
      const item = e.dataTransfer?.items?.[0];
      const f = e.dataTransfer?.files?.[0];
      if (!f) return;
      e.preventDefault();
      const getHandle = (item as DataTransferItem & { getAsFileSystemHandle?: () => Promise<FileSystemHandle | null> } | undefined)
        ?.getAsFileSystemHandle;
      if (getHandle) {
        void getHandle.call(item).then(
          (h) => this.openFile(f, h && h.kind === "file" ? (h as FileSystemFileHandle) : undefined),
          () => this.openFile(f),
        );
      } else {
        void this.openFile(f);
      }
    });

    // Installed PWA: files opened via the OS ("Open with Datum").
    const lq = (window as unknown as { launchQueue?: { setConsumer(cb: (p: { files: FileSystemFileHandle[] }) => void): void } })
      .launchQueue;
    if (lq) {
      lq.setConsumer((params) => {
        const h = params.files?.[0];
        if (!h) return;
        void h.getFile().then((f) => this.openFile(f, h));
      });
    }

    // Keyboard: Ctrl/Cmd+O opens the picker.
    window.addEventListener("keydown", (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "o") {
        e.preventDefault();
        void this.pickFile();
      }
    });
  }

  // --- Load pipeline -----------------------------------------------------

  private teardown(): void {
    this.viewer?.dispose();
    this.viewer = null;
    this.host.empty();
  }

  async openFile(file: File, handle?: FileSystemFileHandle): Promise<void> {
    const ext = (file.name.split(".").pop() ?? "").toLowerCase();
    if (!SUPPORTED.includes(ext)) {
      new Notice(`Unsupported file type ".${ext}". Open a STEP, STP, STL, OBJ or FCStd file.`);
      return;
    }
    const token = ++this.loadToken;
    this.currentFile = file;
    this.teardown();
    this.closeSettings();
    this.welcome.hide();
    this.setTitle(file.name);
    this.host.show();
    void this.recents.remember(file, handle).then((e) => {
      if (token === this.loadToken) this.currentEntry = e;
    });

    if (shouldWarnLargeModel(file.size)) {
      this.showLargeWarning(file.size, () => {
        if (token !== this.loadToken) return;
        this.host.empty();
        void this.parseAndMount(file, token);
      });
      return;
    }
    await this.parseAndMount(file, token);
  }

  private async parseAndMount(file: File, token: number, deflectionOverride?: number): Promise<void> {
    const host = this.host;
    const loadingEl = this.showLoading(file);
    const settings = this.settings;
    const deflection = deflectionOverride ?? deflectionForSize(file.size, settings.tiers);
    const useCache = settings.cacheEnabled && file.size >= CACHE_MIN_BYTES;
    const key = cacheKey(file.name, file.lastModified, file.size, deflection);
    const baseName = file.name.replace(/\.[^.]+$/, "");
    const ext = (file.name.split(".").pop() ?? "").toLowerCase();
    const mountOpts = { plugin: this.plugin, filePath: file.name, healFaces: settings.healFaces };

    try {
      if (ext === "obj" || ext === "stl") {
        const buffer = await file.arrayBuffer();
        if (token !== this.loadToken) return;
        const model =
          ext === "obj"
            ? objToStepModel(new TextDecoder().decode(buffer), baseName)
            : stlToStepModel(buffer, baseName);
        loadingEl.remove();
        this.viewer = mountModel(host, model, mountOpts);
        this.afterMount(file, token);
        return;
      }

      if (ext === "fcstd") {
        const buffer = await file.arrayBuffer();
        if (token !== this.loadToken) return;
        const model = await fcstdToStepModel(new Uint8Array(buffer), baseName, paramsForDeflection(deflection));
        if (token !== this.loadToken) return;
        loadingEl.remove();
        this.viewer = mountModel(host, model, mountOpts);
        this.afterMount(file, token);
        return;
      }

      if (useCache) {
        const cached = await this.cache.get(key);
        if (token !== this.loadToken) return;
        if (cached && hasRenderableMeshes(cached)) {
          console.info("[STEP Viewer] cache hit", file.name);
          loadingEl.remove();
          this.viewer = mountViewer(host, cached, mountOpts);
          this.afterMount(file, token);
          return;
        }
      }

      const buffer = await file.arrayBuffer();
      if (token !== this.loadToken) return;
      const bytes = new Uint8Array(buffer);
      const stepText = bytes.length > METADATA_MAX_BYTES ? undefined : new TextDecoder("latin1").decode(bytes);

      const { result, logs } = await OcctLoader.parseStep(bytes, paramsForDeflection(deflection));
      if (token !== this.loadToken) return;

      if (!hasRenderableMeshes(result)) {
        loadingEl.remove();
        this.showNoGeometry(file, token, deflection, logs, stepText);
        return;
      }

      if (useCache) {
        const maxBytes = settings.cacheMaxMB * 1024 * 1024;
        void this.cache.put(key, result, resultBytes(result)).then(() => this.cache.enforceCap(maxBytes));
      }

      loadingEl.remove();
      this.viewer = mountViewer(host, result, { ...mountOpts, stepText });
      this.afterMount(file, token);
    } catch (err) {
      if (token !== this.loadToken) return;
      loadingEl.remove();
      this.showError(file, err, token, deflection);
    }
  }

  /** Once the scene has settled, grab a small thumbnail for the recents list. */
  private afterMount(file: File, token: number): void {
    window.setTimeout(() => {
      if (token !== this.loadToken || !this.viewer) return;
      try {
        const url = this.viewer.controller.captureImage();
        const img = new Image();
        img.onload = () => {
          const W = 192;
          const H = Math.max(1, Math.round((img.height / img.width) * W));
          const c = document.createElement("canvas");
          c.width = W;
          c.height = H;
          const ctx = c.getContext("2d");
          if (!ctx) return;
          ctx.drawImage(img, 0, 0, W, H);
          void this.recents.setThumb(entryId(file), c.toDataURL("image/png"));
        };
        img.src = url;
      } catch (err) {
        console.warn("[recents] thumbnail failed", err);
      }
    }, 900);
  }

  private retryFaster(file: File, token: number, deflection: number): void {
    if (token !== this.loadToken) return;
    this.host.empty();
    void this.parseAndMount(file, token, coarserDeflection(deflection));
  }

  // --- Overlays (same markup/classes as the plugin's StepView) ------------

  private showLoading(file: File): HTMLElement {
    const el = this.host.createDiv({ cls: "step-viewer-overlay step-viewer-loading" });
    el.createDiv({ cls: "step-viewer-spinner" });
    el.createEl("div", { text: `Loading ${file.name}…`, cls: "step-viewer-message" });
    el.createEl("div", { text: formatFileSize(file.size), cls: "step-viewer-message-sub" });
    return el;
  }

  private showLargeWarning(sizeBytes: number, onProceed: () => void): void {
    const el = this.host.createDiv({ cls: "step-viewer-overlay step-viewer-empty" });
    el.createEl("div", { text: "Large model", cls: "step-viewer-message" });
    el.createEl("div", {
      text: `This file is ${formatFileSize(sizeBytes)}. On mobile, opening large models can run the viewer out of memory. Open anyway?`,
      cls: "step-viewer-message-sub",
    });
    const btn = el.createEl("button", { text: "Open anyway", cls: "mod-cta" });
    btn.addEventListener("click", onProceed);
  }

  private addRetryButton(parent: HTMLElement, file: File, token: number, deflection: number): void {
    const btn = parent.createEl("button", { text: "Try coarser (faster)", cls: "mod-cta" });
    btn.addEventListener("click", () => this.retryFaster(file, token, deflection));
  }

  private showNoGeometry(file: File, token: number, deflection: number, logs: string[] = [], stepText?: string): void {
    const el = this.host.createDiv({ cls: "step-viewer-overlay step-viewer-error" });
    const wireframe = isWireframeOnly(stepText);
    el.createEl("div", {
      text: wireframe ? "No surfaces or solids to display" : "No geometry could be displayed",
      cls: "step-viewer-message",
    });
    const outOfMemory = logs.some((l) => /memory|alloc|bad_alloc|out of/i.test(l));
    const canRetry = !wireframe && coarserDeflection(deflection) > deflection;
    let detail: string;
    if (wireframe) {
      detail =
        "This file contains only wireframe curves (edges / sketch geometry) — no surface or solid bodies — " +
        "so there is nothing to render as a 3D model. Re-export it from your CAD program with solid or surface geometry included.";
    } else if (outOfMemory) {
      detail = `This ${formatFileSize(file.size)} model ran the in-browser (WASM) parser out of memory before it could produce geometry.`;
    } else {
      detail =
        `The parser produced no usable geometry from this ${formatFileSize(file.size)} file. ` +
        "It may be too large for the in-browser (WASM) parser, or it uses entities the parser doesn't support.";
    }
    el.createEl("div", { text: detail + (canRetry ? " Retrying coarser (faster) may help." : ""), cls: "step-viewer-message-sub" });
    if (canRetry) this.addRetryButton(el, file, token, deflection);
  }

  private showError(file: File, err: unknown, token: number, deflection: number): void {
    console.error("[STEP Viewer] Failed to open", file.name, err);
    const el = this.host.createDiv({ cls: "step-viewer-overlay step-viewer-error" });
    el.createEl("div", { text: `Could not open "${file.name}".`, cls: "step-viewer-message" });
    el.createEl("div", { text: err instanceof Error ? err.message : String(err), cls: "step-viewer-message-sub" });
    if (coarserDeflection(deflection) > deflection) this.addRetryButton(el, file, token, deflection);
  }

  // --- Install / update UI -----------------------------------------------

  private syncInstallButton(): void {
    const b = this.installBtn;
    const label = b.find(".sv-btn-label") as HTMLElement | null;
    switch (this.installMode) {
      case "installed":
      case "unavailable":
        b.hide();
        break;
      case "prompt":
        b.show();
        label?.setText("Install app");
        setTooltip(b, `Install ${APP_NAME} on this device`);
        break;
      case "manual":
        b.show();
        label?.setText("Install app");
        setTooltip(b, `How to add ${APP_NAME} to your home screen / desktop`);
        break;
    }
  }

  private async onInstallClick(): Promise<void> {
    if (this.installMode === "prompt") {
      const ok = await this.pwa.install();
      if (ok) return;
    }
    this.showInstallSheet();
  }

  private showInstallSheet(): void {
    const ua = navigator.userAgent;
    const iPadOS = /Macintosh/.test(ua) && navigator.maxTouchPoints > 1;
    const kind = /iPhone|iPad|iPod/.test(ua) || iPadOS ? "ios" : /Android/.test(ua) ? "android" : "desktop";
    const isFirefox = /Firefox/.test(ua);
    const isSafari = /Safari/.test(ua) && !/Chrome|Chromium|Edg|OPR|Android/.test(ua);

    const steps: string[] =
      kind === "ios"
        ? [
            "Open this page in Safari (installation isn't offered from other iOS browsers).",
            "Tap the Share button (the square with an arrow).",
            "Scroll and tap “Add to Home Screen”, then “Add”.",
          ]
        : kind === "android"
          ? [
              "Open the browser menu (⋮).",
              "Tap “Install app” or “Add to Home screen”.",
              `Confirm — ${APP_NAME} appears in your app drawer and can open CAD files.`,
            ]
          : isFirefox
            ? [
                "Firefox on desktop doesn't support installing web apps.",
                "Open this page in Chrome or Edge and use the “Install app” button there.",
              ]
            : isSafari
              ? ["In Safari's menu choose File → “Add to Dock…”, then “Add”."]
              : [
                  "Click the install icon at the right end of the address bar (a monitor with a down-arrow),",
                  `or open the browser menu (⋮) → “Install ${APP_NAME}…”.`,
                ];

    this.modal(`Install ${APP_NAME}`, (body) => {
      body.createEl("p", {
        cls: "sv-muted",
        text: "Installed, it runs full-screen, works offline, and shows up in “Open with” for STEP / STL / OBJ files. Updates are picked up automatically.",
      });
      const ol = body.createEl("ol", { cls: "sv-steps" });
      for (const s of steps) ol.createEl("li", { text: s });
      if (this.installReason) body.createEl("p", { cls: "sv-muted sv-small", text: this.installReason });
    });
  }

  private showUpdate(apply: () => void): void {
    this.pendingUpdate = apply;
    this.updateBtn.show();
    this.modal("Update available", (body, close) => {
      body.createEl("p", { text: `A new version of ${APP_NAME} has been downloaded. Reload to switch to it — the app, its icon and styles are refreshed together.` });
      if (this.currentFile) {
        body.createEl("p", { cls: "sv-muted sv-small", text: `“${this.currentFile.name}” will be in your recent files after the update.` });
      }
      const row = body.createDiv({ cls: "sv-modal-actions" });
      const later = row.createEl("button", { cls: "sv-btn", text: "Later" });
      later.addEventListener("click", close);
      const now = row.createEl("button", { cls: "sv-btn sv-btn-primary", text: "Update now" });
      now.addEventListener("click", () => {
        now.setText("Updating…");
        (now as HTMLButtonElement).disabled = true;
        apply();
      });
    });
  }

  // --- Settings popover --------------------------------------------------

  private toggleSettings(anchor: HTMLElement): void {
    if (this.settingsPop) {
      this.closeSettings();
      return;
    }
    const pop = (this.settingsPop = document.body.createDiv({ cls: "sv-pop" }));
    const r = anchor.getBoundingClientRect();
    pop.style.top = `${r.bottom + 6}px`;
    pop.style.right = `${Math.max(8, window.innerWidth - r.right)}px`;

    const s = this.settings;
    const commit = () => saveSettings(s);

    const row = (label: string, desc?: string) => {
      const d = pop.createDiv({ cls: "sv-row" });
      const t = d.createDiv({ cls: "sv-row-text" });
      t.createDiv({ cls: "sv-row-label", text: label });
      if (desc) t.createDiv({ cls: "sv-row-desc", text: desc });
      return d.createDiv({ cls: "sv-row-ctl" });
    };

    const themeCtl = row("Theme");
    const themeSel = themeCtl.createEl("select");
    for (const [v, l] of [["auto", "System"], ["light", "Light"], ["dark", "Dark"]] as const) {
      themeSel.createEl("option", { text: l, attr: { value: v } });
    }
    themeSel.value = currentTheme();
    themeSel.addEventListener("change", () => {
      localStorage.setItem(THEME_KEY, themeSel.value);
      applyTheme(themeSel.value as Theme);
    });

    const profCtl = row("Mesh quality", "Applies the next time a model is opened.");
    const profSel = profCtl.createEl("select");
    const labels: Record<Exclude<Profile, "custom">, string> = {
      fastest: "Fastest (lightest)",
      balanced: "Balanced",
      detailed: "Detailed (slowest)",
    };
    for (const [v, l] of Object.entries(labels)) profSel.createEl("option", { text: l, attr: { value: v } });
    if (s.profile === "custom") profSel.createEl("option", { text: "Custom", attr: { value: "custom" } });
    profSel.value = s.profile;
    profSel.addEventListener("change", () => {
      const p = profSel.value as Profile;
      if (p !== "custom") {
        s.tiers = tiersForProfile(p);
        s.profile = p;
        commit();
      }
    });

    const healCtl = row("Reconstruct missing faces", "Rebuild planar faces the STEP reader couldn't tessellate.");
    const heal = healCtl.createEl("input", { attr: { type: "checkbox" } });
    heal.checked = s.healFaces;
    heal.addEventListener("change", () => {
      s.healFaces = heal.checked;
      commit();
    });

    const cacheCtl = row("Cache parsed models", "Files ≥ 15 MB are cached on this device for instant reopening.");
    const cacheCb = cacheCtl.createEl("input", { attr: { type: "checkbox" } });
    cacheCb.checked = s.cacheEnabled;
    cacheCb.addEventListener("change", () => {
      s.cacheEnabled = cacheCb.checked;
      commit();
    });

    const clearCtl = row("Clear cache", "…");
    const clearBtn = clearCtl.createEl("button", { cls: "sv-btn sv-btn-sm", text: "Clear" });
    void this.cache.totalBytes().then((b) => {
      const desc = clearCtl.parentElement?.querySelector(".sv-row-desc");
      if (desc) desc.textContent = `Currently using ${(b / (1024 * 1024)).toFixed(1)} MB.`;
    });
    clearBtn.addEventListener("click", () => {
      void this.cache.clear().then(() => {
        new Notice("Cache cleared.");
        this.closeSettings();
      });
    });

    if (this.currentFile) {
      const reopenCtl = row("Reopen current model", "Re-parse with the current quality setting.");
      const reopen = reopenCtl.createEl("button", { cls: "sv-btn sv-btn-sm", text: "Reopen" });
      reopen.addEventListener("click", () => {
        const f = this.currentFile;
        const h = this.currentEntry?.handle;
        this.closeSettings();
        if (f) void this.openFile(f, h);
      });
    }

    const updCtl = row("App version", `v${__APP_VERSION__} · ${__BUILD_HASH__}${this.installMode === "installed" ? " · installed" : ""}`);
    const chk = updCtl.createEl("button", { cls: "sv-btn sv-btn-sm", text: "Check for updates" });
    chk.addEventListener("click", () => {
      if (this.installMode === "unavailable") {
        new Notice(this.installReason || "Updates need the app to be served over https.");
        return;
      }
      chk.setText("Checking…");
      void this.pwa.checkForUpdate().then(() => {
        window.setTimeout(() => {
          if (!this.pendingUpdate) new Notice("You're on the latest version.");
          chk.setText("Check for updates");
        }, 1500);
      });
    });

    const about = pop.createDiv({ cls: "sv-about sv-muted sv-tiny" });
    about.setText(`${APP_NAME} by ${COMPANY} · viewer core by Ondřej Uhnavý (MIT) · OpenCASCADE via occt-import-js · three.js`);

    const close = (e: PointerEvent) => {
      if (!pop.contains(e.target as Node) && e.target !== anchor && !anchor.contains(e.target as Node)) this.closeSettings();
    };
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape") this.closeSettings();
    };
    document.addEventListener("pointerdown", close, true);
    document.addEventListener("keydown", key, true);
    (pop as HTMLElement & { _cleanup?: () => void })._cleanup = () => {
      document.removeEventListener("pointerdown", close, true);
      document.removeEventListener("keydown", key, true);
    };
  }

  private closeSettings(): void {
    const pop = this.settingsPop as (HTMLElement & { _cleanup?: () => void }) | null;
    if (!pop) return;
    pop._cleanup?.();
    pop.detach();
    this.settingsPop = null;
  }

  // --- Modal -------------------------------------------------------------

  private modal(title: string, build: (body: HTMLElement, close: () => void) => void): void {
    const scrim = document.body.createDiv({ cls: "sv-scrim" });
    const box = scrim.createDiv({ cls: "sv-modal" });
    const head = box.createDiv({ cls: "sv-modal-head" });
    head.createEl("h2", { text: title });
    const x = head.createEl("button", { cls: "sv-btn sv-btn-icon-only" });
    setIcon(x, "x");
    const close = () => {
      document.removeEventListener("keydown", onKey, true);
      scrim.detach();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    x.addEventListener("click", close);
    scrim.addEventListener("pointerdown", (e) => {
      if (e.target === scrim) close();
    });
    document.addEventListener("keydown", onKey, true);
    build(box.createDiv({ cls: "sv-modal-body" }), close);
  }
}

// --- Boot ----------------------------------------------------------------------

const rootEl = document.getElementById("app");
if (!rootEl) throw new Error("#app root missing");
const webApp = new WebApp(rootEl);
(window as unknown as { stepViewer: WebApp }).stepViewer = webApp;
console.info(`[STEP Viewer] ${APP_NAME} web v${__APP_VERSION__} (${__BUILD_HASH__})`);
