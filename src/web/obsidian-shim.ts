/**
 * Browser stand-in for the `obsidian` module.
 *
 * The viewer UI (toolbar, tree, annotations, …) was written against Obsidian's
 * API: its DOM helpers (`el.createDiv`, `el.toggle`, …), `setIcon`, `Notice`,
 * `Menu`, `MarkdownRenderer`, and a `Plugin` that persists data and reaches the
 * vault. The web build aliases `obsidian` → this file (see esbuild.web.mjs), so
 * every viewer source file runs unmodified in a plain browser.
 *
 * Only the surface the viewer actually touches is implemented. Anything that
 * needs a vault (exports, screenshots) becomes a browser download; note links
 * open in a new tab when they are URLs.
 */
import { createElement as lucideCreate } from "lucide";
import { ICONS } from "./icons";

// --- Globals -----------------------------------------------------------------

const g = globalThis as unknown as { activeDocument: Document; activeWindow: Window };
g.activeDocument = document;
g.activeWindow = window;

// --- DOM prototype helpers (subset of Obsidian's) ----------------------------

interface DomInfo {
  cls?: string | string[];
  text?: string | DocumentFragment;
  attr?: Record<string, string | number | boolean | null>;
  title?: string;
  parent?: Node;
  value?: string;
  type?: string;
  prepend?: boolean;
  placeholder?: string;
  href?: string;
}

function applyInfo(el: HTMLElement, o?: DomInfo | string): void {
  if (o == null) return;
  if (typeof o === "string") {
    el.className = o;
    return;
  }
  if (o.cls) el.className = Array.isArray(o.cls) ? o.cls.join(" ") : o.cls;
  if (o.text != null) {
    if (typeof o.text === "string") el.textContent = o.text;
    else el.appendChild(o.text);
  }
  if (o.attr) {
    for (const [k, v] of Object.entries(o.attr)) {
      if (v == null || v === false) el.removeAttribute(k);
      else el.setAttribute(k, String(v));
    }
  }
  if (o.title != null) el.title = o.title;
  if (o.value != null) (el as HTMLInputElement).value = o.value;
  if (o.type != null) (el as HTMLInputElement).type = o.type;
  if (o.placeholder != null) (el as HTMLInputElement).placeholder = o.placeholder;
  if (o.href != null) (el as HTMLAnchorElement).href = o.href;
}

function define(proto: object, name: string, fn: (...args: never[]) => unknown): void {
  if (Object.prototype.hasOwnProperty.call(proto, name)) return;
  Object.defineProperty(proto, name, { value: fn, writable: true, configurable: true });
}

const NP = Node.prototype as unknown as Record<string, unknown>;
const EP = Element.prototype as unknown as Record<string, unknown>;
const HP = HTMLElement.prototype as unknown as Record<string, unknown>;

define(NP, "createEl", function (this: Node, tag: string, o?: DomInfo | string, cb?: (el: HTMLElement) => void) {
  const el = document.createElement(tag);
  applyInfo(el, o);
  const parent = (typeof o === "object" && o?.parent) || this;
  if (typeof o === "object" && o?.prepend) parent.insertBefore(el, parent.firstChild);
  else parent.appendChild(el);
  cb?.(el);
  return el;
});
define(NP, "createDiv", function (this: Node, o?: DomInfo | string, cb?: (el: HTMLElement) => void) {
  return (this as unknown as { createEl: Function }).createEl("div", o, cb);
});
define(NP, "createSpan", function (this: Node, o?: DomInfo | string, cb?: (el: HTMLElement) => void) {
  return (this as unknown as { createEl: Function }).createEl("span", o, cb);
});
define(NP, "createSvg", function (this: Node, tag: string, o?: DomInfo | string) {
  const el = document.createElementNS("http://www.w3.org/2000/svg", tag);
  if (typeof o === "string") el.setAttribute("class", o);
  else if (o?.cls) el.setAttribute("class", Array.isArray(o.cls) ? o.cls.join(" ") : o.cls);
  if (typeof o === "object" && o?.attr) {
    for (const [k, v] of Object.entries(o.attr)) if (v != null) el.setAttribute(k, String(v));
  }
  this.appendChild(el);
  return el;
});
define(NP, "empty", function (this: Node) {
  while (this.lastChild) this.removeChild(this.lastChild);
});
define(NP, "detach", function (this: Node) {
  this.parentNode?.removeChild(this);
});
define(NP, "setText", function (this: Node, t: string | DocumentFragment) {
  if (typeof t === "string") this.textContent = t;
  else {
    (this as unknown as { empty(): void }).empty();
    this.appendChild(t);
  }
});
define(NP, "appendText", function (this: Node, t: string) {
  this.appendChild(document.createTextNode(t));
});
define(NP, "getText", function (this: Node) {
  return this.textContent ?? "";
});
define(NP, "indexOf", function (this: Node, child: Node) {
  return Array.prototype.indexOf.call(this.childNodes, child);
});
define(NP, "insertAfter", function (this: Node, node: Node, ref: Node | null) {
  this.insertBefore(node, ref ? ref.nextSibling : this.firstChild);
});

define(EP, "addClass", function (this: Element, ...cls: string[]) {
  this.classList.add(...cls.flatMap((c) => c.split(/\s+/)).filter(Boolean));
});
define(EP, "addClasses", function (this: Element, cls: string[]) {
  this.classList.add(...cls);
});
define(EP, "removeClass", function (this: Element, ...cls: string[]) {
  this.classList.remove(...cls.flatMap((c) => c.split(/\s+/)).filter(Boolean));
});
define(EP, "removeClasses", function (this: Element, cls: string[]) {
  this.classList.remove(...cls);
});
define(EP, "toggleClass", function (this: Element, cls: string | string[], on: boolean) {
  for (const c of Array.isArray(cls) ? cls : cls.split(/\s+/)) if (c) this.classList.toggle(c, on);
});
define(EP, "hasClass", function (this: Element, cls: string) {
  return this.classList.contains(cls);
});
define(EP, "setAttr", function (this: Element, k: string, v: string | number | boolean | null) {
  if (v == null || v === false) this.removeAttribute(k);
  else this.setAttribute(k, String(v));
});
define(EP, "setAttrs", function (this: Element, attrs: Record<string, string | number | boolean | null>) {
  for (const [k, v] of Object.entries(attrs)) (this as unknown as { setAttr: Function }).setAttr(k, v);
});
define(EP, "getAttr", function (this: Element, k: string) {
  return this.getAttribute(k);
});
define(EP, "find", function (this: Element, sel: string) {
  return this.querySelector(sel);
});
define(EP, "findAll", function (this: Element, sel: string) {
  return Array.from(this.querySelectorAll(sel));
});
define(EP, "findAllSelf", function (this: Element, sel: string) {
  const out = Array.from(this.querySelectorAll(sel));
  if (this.matches(sel)) out.unshift(this);
  return out;
});
define(EP, "matchParent", function (this: Element, sel: string, last?: Node) {
  let n: Element | null = this;
  while (n && n !== last) {
    if (n.matches(sel)) return n;
    n = n.parentElement;
  }
  return null;
});

define(HP, "show", function (this: HTMLElement) {
  this.style.display = "";
});
define(HP, "hide", function (this: HTMLElement) {
  this.style.display = "none";
});
define(HP, "toggle", function (this: HTMLElement, show: boolean) {
  this.style.display = show ? "" : "none";
});
define(HP, "isShown", function (this: HTMLElement) {
  let n: HTMLElement | null = this;
  while (n) {
    if (n.style.display === "none") return false;
    if (n === document.body) return true;
    if (!n.parentElement) return n.isConnected;
    n = n.parentElement;
  }
  return true;
});
define(HP, "setCssProps", function (this: HTMLElement, props: Record<string, string>) {
  for (const [k, v] of Object.entries(props)) this.style.setProperty(k, v);
});
define(HP, "setCssStyles", function (this: HTMLElement, styles: Record<string, string>) {
  Object.assign(this.style, styles);
});
define(HP, "onClickEvent", function (this: HTMLElement, cb: (e: MouseEvent) => void) {
  this.addEventListener("click", cb);
});

Object.defineProperty(NP, "doc", { get: () => document, configurable: true });
Object.defineProperty(NP, "win", { get: () => window, configurable: true });

// --- Icons -------------------------------------------------------------------

/** Replace `el`'s content with the named Lucide icon (Obsidian's icon set). */
export function setIcon(el: HTMLElement, iconId: string): void {
  const node = ICONS[iconId];
  while (el.lastChild) el.removeChild(el.lastChild);
  if (!node) {
    console.warn(`[STEP Viewer] unknown icon "${iconId}"`);
    return;
  }
  const svg = lucideCreate(node);
  svg.setAttribute("class", `svg-icon lucide-${iconId}`);
  svg.removeAttribute("width");
  svg.removeAttribute("height");
  el.appendChild(svg);
}

export interface TooltipOptions {
  placement?: "top" | "bottom" | "left" | "right";
  delay?: number;
}

export function setTooltip(el: HTMLElement, tooltip: string, _opts?: TooltipOptions): void {
  if (tooltip) el.setAttribute("aria-label", tooltip);
  else el.removeAttribute("aria-label");
  // Native title tooltips are the most robust cross-device option.
  el.title = tooltip;
}

// --- Platform ----------------------------------------------------------------

const ua = navigator.userAgent;
const iPadOS = /Macintosh/.test(ua) && navigator.maxTouchPoints > 0;
const isIos = /iPhone|iPad|iPod/.test(ua) || iPadOS;
const isAndroid = /Android/.test(ua);
const isPhone = (/iPhone|iPod/.test(ua) || (isAndroid && /Mobile/.test(ua))) && !iPadOS;
const isMobile = isIos || isAndroid;

export const Platform = {
  isDesktop: !isMobile,
  isMobile,
  isDesktopApp: false,
  isMobileApp: false,
  isIosApp: isIos,
  isAndroidApp: isAndroid,
  isPhone,
  isTablet: isMobile && !isPhone,
  isMacOS: /Macintosh/.test(ua) && !iPadOS,
  isWin: /Windows/.test(ua),
  isLinux: /Linux/.test(ua) && !isAndroid,
  isSafari: /Safari/.test(ua) && !/Chrome|Chromium|Edg|OPR|Android/.test(ua),
  resourcePathPrefix: "",
};

// --- Notice (toast) ----------------------------------------------------------

let noticeContainer: HTMLElement | null = null;
function ensureNoticeContainer(): HTMLElement {
  if (!noticeContainer || !noticeContainer.isConnected) {
    noticeContainer = document.body.createDiv({ cls: "notice-container" });
  }
  return noticeContainer;
}

export class Notice {
  noticeEl: HTMLElement;
  private timer: number | null = null;

  constructor(message: string | DocumentFragment, duration = 5000) {
    const c = ensureNoticeContainer();
    this.noticeEl = c.createDiv({ cls: "notice" });
    this.setMessage(message);
    this.noticeEl.addEventListener("click", () => this.hide());
    if (duration > 0) this.timer = window.setTimeout(() => this.hide(), duration);
  }

  setMessage(message: string | DocumentFragment): this {
    this.noticeEl.empty();
    if (typeof message === "string") {
      const lines = message.split("\n");
      lines.forEach((line, i) => {
        if (i) this.noticeEl.createEl("br");
        this.noticeEl.appendText(line);
      });
    } else {
      this.noticeEl.appendChild(message);
    }
    return this;
  }

  hide(): void {
    if (this.timer != null) window.clearTimeout(this.timer);
    this.noticeEl.addClass("is-leaving");
    window.setTimeout(() => this.noticeEl.detach(), 180);
  }
}

// --- Menu (context menu) -----------------------------------------------------

export class MenuItem {
  el: HTMLElement;
  private titleEl: HTMLElement;
  private iconEl: HTMLElement;
  private handler: ((e: MouseEvent | KeyboardEvent) => void) | null = null;

  constructor(private menu: Menu) {
    this.el = menu.dom.createDiv({ cls: "menu-item" });
    this.iconEl = this.el.createDiv({ cls: "menu-item-icon" });
    this.titleEl = this.el.createDiv({ cls: "menu-item-title" });
    this.el.addEventListener("click", (e) => {
      e.stopPropagation();
      this.menu.hide();
      this.handler?.(e);
    });
  }
  setTitle(t: string | DocumentFragment): this {
    this.titleEl.setText(t);
    return this;
  }
  setIcon(icon: string | null): this {
    if (icon) setIcon(this.iconEl, icon);
    else this.iconEl.empty();
    return this;
  }
  setChecked(checked: boolean | null): this {
    this.el.toggleClass("is-checked", !!checked);
    return this;
  }
  setDisabled(d: boolean): this {
    this.el.toggleClass("is-disabled", d);
    return this;
  }
  setIsLabel(l: boolean): this {
    this.el.toggleClass("is-label", l);
    return this;
  }
  setSection(_s: string): this {
    return this;
  }
  onClick(cb: (e: MouseEvent | KeyboardEvent) => void): this {
    this.handler = cb;
    return this;
  }
}

export class Menu {
  dom: HTMLElement;
  private onPointerDown = (e: PointerEvent) => {
    if (!this.dom.contains(e.target as Node)) this.hide();
  };
  private onKey = (e: KeyboardEvent) => {
    if (e.key === "Escape") this.hide();
  };

  constructor() {
    this.dom = document.createElement("div");
    this.dom.className = "menu";
  }
  addItem(cb: (item: MenuItem) => void): this {
    cb(new MenuItem(this));
    return this;
  }
  addSeparator(): this {
    this.dom.createDiv({ cls: "menu-separator" });
    return this;
  }
  setUseNativeMenu(_b: boolean): this {
    return this;
  }
  showAtPosition(pos: { x: number; y: number }): this {
    document.body.appendChild(this.dom);
    // Keep the menu on-screen.
    const r = this.dom.getBoundingClientRect();
    const x = Math.min(pos.x, window.innerWidth - r.width - 4);
    const y = Math.min(pos.y, window.innerHeight - r.height - 4);
    this.dom.style.left = `${Math.max(0, x)}px`;
    this.dom.style.top = `${Math.max(0, y)}px`;
    window.setTimeout(() => {
      document.addEventListener("pointerdown", this.onPointerDown, true);
      document.addEventListener("keydown", this.onKey, true);
    }, 0);
    return this;
  }
  showAtMouseEvent(e: MouseEvent): this {
    return this.showAtPosition({ x: e.clientX, y: e.clientY });
  }
  hide(): this {
    document.removeEventListener("pointerdown", this.onPointerDown, true);
    document.removeEventListener("keydown", this.onKey, true);
    this.dom.detach();
    return this;
  }
  close(): void {
    this.hide();
  }
}

// --- Component / MarkdownRenderer --------------------------------------------

export class Component {
  private children: Component[] = [];
  private loaded = false;
  load(): void {
    if (this.loaded) return;
    this.loaded = true;
    this.onload();
    for (const c of this.children) c.load();
  }
  onload(): void {}
  unload(): void {
    if (!this.loaded) return;
    this.loaded = false;
    for (const c of this.children) c.unload();
    this.onunload();
  }
  onunload(): void {}
  addChild<T extends Component>(c: T): T {
    this.children.push(c);
    if (this.loaded) c.load();
    return c;
  }
  removeChild<T extends Component>(c: T): T {
    const i = this.children.indexOf(c);
    if (i >= 0) {
      this.children.splice(i, 1);
      c.unload();
    }
    return c;
  }
  register(cb: () => void): void {
    void cb;
  }
  registerEvent(_e: unknown): void {}
  registerDomEvent(el: EventTarget, type: string, cb: EventListener): void {
    el.addEventListener(type, cb);
  }
  registerInterval(id: number): number {
    return id;
  }
}

export class MarkdownRenderChild extends Component {
  constructor(public containerEl: HTMLElement) {
    super();
  }
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * Small, safe Markdown subset for annotation notes: paragraphs, line breaks,
 * **bold**, *italic*, `code`, [text](url), [[wikilink]] and bare URLs.
 */
function renderInline(md: string): string {
  let s = escapeHtml(md);
  s = s.replace(/`([^`]+)`/g, "<code>$1</code>");
  s = s.replace(/\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g, (_m, target: string, label?: string) => {
    return `<a class="internal-link" data-href="${target}" href="#">${label ?? target}</a>`;
  });
  s = s.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_m, text: string, url: string) => {
    return `<a class="external-link" href="${url}" data-href="${url}" target="_blank" rel="noopener">${text}</a>`;
  });
  s = s.replace(/(^|[\s(])((https?:\/\/)[^\s<)]+)/g, (_m, pre: string, url: string) => {
    return `${pre}<a class="external-link" href="${url}" data-href="${url}" target="_blank" rel="noopener">${url}</a>`;
  });
  s = s.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  s = s.replace(/(^|[^*])\*([^*\n]+)\*/g, "$1<em>$2</em>");
  return s;
}

export const MarkdownRenderer = {
  async render(
    _app: App,
    markdown: string,
    el: HTMLElement,
    _sourcePath: string,
    _component: Component,
  ): Promise<void> {
    const paras = markdown.replace(/\r\n?/g, "\n").split(/\n{2,}/);
    el.innerHTML = paras
      .filter((p) => p.trim().length)
      .map((p) => `<p>${renderInline(p).replace(/\n/g, "<br>")}</p>`)
      .join("");
  },
  async renderMarkdown(markdown: string, el: HTMLElement, sourcePath: string, component: Component) {
    return MarkdownRenderer.render(app, markdown, el, sourcePath, component);
  },
};

// --- App / Vault / Workspace / Plugin ----------------------------------------

/** Hand the browser a file to save (replaces writing into the vault). */
export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 30_000);
}

function basename(path: string): string {
  const i = path.lastIndexOf("/");
  return i >= 0 ? path.slice(i + 1) : path;
}

export class TFile {
  constructor(
    public path: string,
    public stat: { size: number; mtime: number; ctime: number },
  ) {}
  get name(): string {
    return basename(this.path);
  }
  get basename(): string {
    return this.name.replace(/\.[^.]+$/, "");
  }
  get extension(): string {
    const m = /\.([^.]+)$/.exec(this.name);
    return m ? m[1] : "";
  }
}

class Vault {
  async create(path: string, data: string): Promise<TFile> {
    downloadBlob(new Blob([data], { type: "text/plain" }), basename(path));
    return new TFile(path, { size: data.length, mtime: Date.now(), ctime: Date.now() });
  }
  async createBinary(path: string, data: ArrayBuffer): Promise<TFile> {
    const type = /\.png$/i.test(path) ? "image/png" : "application/octet-stream";
    downloadBlob(new Blob([data], { type }), basename(path));
    return new TFile(path, { size: data.byteLength, mtime: Date.now(), ctime: Date.now() });
  }
  getAbstractFileByPath(_p: string): null {
    return null;
  }
}

class Workspace {
  async openLinkText(linktext: string, _sourcePath: string, _newLeaf?: boolean): Promise<void> {
    if (/^[a-z][a-z0-9+.-]*:\/\//i.test(linktext) || /^mailto:/i.test(linktext)) {
      window.open(linktext, "_blank", "noopener");
      return;
    }
    new Notice(`"${linktext}" is a note link — note links only work inside Obsidian.`);
  }
}

export class App {
  vault = new Vault();
  workspace = new Workspace();
}

export const app = new App();

/**
 * Plugin stand-in: `loadData`/`saveData` persist to localStorage under a
 * single key (annotations and pinned measurements live here, keyed by file
 * name — reopen the same file and its notes come back).
 */
export class Plugin extends Component {
  app: App = app;
  manifest = { id: "step-viewer", name: "STEP Viewer", version: "" };
  private storageKey: string;

  constructor(storageKey = "step-viewer:data") {
    super();
    this.storageKey = storageKey;
  }

  async loadData(): Promise<unknown> {
    try {
      const raw = localStorage.getItem(this.storageKey);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }

  async saveData(data: unknown): Promise<void> {
    try {
      localStorage.setItem(this.storageKey, JSON.stringify(data));
    } catch (err) {
      console.warn("[STEP Viewer] could not persist data", err);
    }
  }
}

// Type-only stand-ins so any stray imports compile; never instantiated here.
export class WorkspaceLeaf {}
export class FileView extends Component {}
export class PluginSettingTab {}
export class Setting {}
