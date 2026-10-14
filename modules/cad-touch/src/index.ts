/**
 * cad-touch — the touch interface for the CAD engine on phones and tablets, in the Meter phone
 * language: one bar of categories (a side rail once there's width), each opening a sheet of
 * tools; a strip above the bar for the command that's running (its prompt, its options as chips,
 * type a value, Enter, Cancel) or for what's selected; a top row with back, the drawing's name,
 * undo and redo. The pen draws on the drawing underneath; fingers pan and zoom it.
 *
 * No app imports. The page passes a session (`call` + the latest state) — e.g. cad-host's
 * `mountCadDesktop(el, { ui: "touch", onState })` — and forwards state changes to `setState`.
 */
import { icon } from "./icons";
import { AIDS, CATEGORIES, type Category, type Tool } from "./tools";
import { CSS } from "./style";

export interface CadTouchState {
  prompt: string;
  running: string | null;
  keywords: string[];
  last: string | null;
  selection: number;
  undo: boolean;
  redo: boolean;
  docs: { index: number; title: string; dirty: boolean }[];
  active: number;
}

export interface CadTouchSession {
  call(method: string, params?: object): Promise<{ ok: boolean; result?: any; error?: string }>;
}

export interface CadTouchOptions {
  /** Back tile (top left): e.g. to the app's home. Hidden when absent. */
  onBack?: () => void;
  /** Small text in the band under the bar. */
  brand?: string;
  /** Shown once per device the first time: how the pen and fingers work. */
  hintKey?: string;
}

export interface CadTouch {
  setState(state: CadTouchState): void;
  destroy(): void;
}

const el = <K extends keyof HTMLElementTagNameMap>(tag: K, cls?: string, html?: string): HTMLElementTagNameMap[K] => {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (html !== undefined) e.innerHTML = html;
  return e;
};

let styled = false;
function injectStyle(): void {
  if (styled) return;
  styled = true;
  const s = document.createElement("style");
  s.dataset.module = "cad-touch";
  s.textContent = CSS;
  document.head.appendChild(s);
}

/** "LINE Specify next point or [Undo]:" → ["LINE", "Specify next point"]. */
function splitPrompt(prompt: string, running: string | null): [string, string] {
  let p = prompt.trim();
  const cmd = (running ?? "").toUpperCase();
  if (cmd && p.toUpperCase().startsWith(cmd + " ")) p = p.slice(cmd.length + 1);
  p = p.replace(/\s*\[[^\]]*\]\s*/g, " ").replace(/\s*<[^>]*>\s*/g, " ").replace(/:\s*$/, "").trim();
  // "Specify next point or" once its [options] became chips.
  p = p.replace(/\s+or$/i, "").trim();
  return [cmd, p];
}

export function mountCadTouch(root: HTMLElement, cad: CadTouchSession, opts: CadTouchOptions = {}): CadTouch {
  injectStyle();
  root.classList.add("ct-root");
  let state: CadTouchState | null = null;
  let openCat: string | null = null;
  let typing = false;

  // --- Top row: back · name · undo · redo ---------------------------------
  const top = el("div", "ct-top");
  const back = el("button", "ct-tile", icon("back"));
  back.title = "Back";
  back.hidden = !opts.onBack;
  back.addEventListener("click", () => opts.onBack?.());
  const name = el("div", "ct-name");
  const nameB = el("b");
  const nameS = el("small", undefined, "Pencil draws · fingers move");
  name.append(nameB, nameS);
  const undoB = el("button", "ct-tile", icon("undo"));
  undoB.title = "Undo";
  const redoB = el("button", "ct-tile", icon("redo"));
  redoB.title = "Redo";
  top.append(back, name, undoB, redoB);

  // --- Bar / rail of categories --------------------------------------------
  const bar = el("nav", "ct-bar");
  const tabs = el("div", "ct-tabs");
  const tabEls = new Map<string, HTMLButtonElement>();
  for (const c of CATEGORIES) {
    const b = el("button", "ct-tab", `${icon(c.icon)}<span>${c.label}</span>`);
    b.addEventListener("click", () => toggleSheet(c));
    tabs.appendChild(b);
    tabEls.set(c.id, b);
  }
  const band = el("div", "ct-band", `<span>${opts.brand ?? "TAXI DESIGN STUDIO"}</span>`);
  bar.append(tabs, band);

  // --- Sheet ---------------------------------------------------------------
  const sheet = el("section", "ct-sheet");
  sheet.hidden = true;
  const sheetHead = el("header", "ct-sheet-head");
  const sheetTitle = el("b");
  const sheetClose = el("button", "ct-icon-btn", icon("close"));
  sheetClose.title = "Close";
  sheetClose.addEventListener("click", () => closeSheet());
  sheetHead.append(sheetTitle, sheetClose);
  const sheetBody = el("div", "ct-sheet-body");
  sheet.append(sheetHead, sheetBody);

  // --- Strip (live command / selection) and toast ---------------------------
  const strip = el("div", "ct-strip");
  strip.hidden = true;
  const toast = el("div", "ct-toast");
  toast.hidden = true;
  let toastTimer = 0;
  const say = (msg: string, ms = 2600) => {
    toast.textContent = msg;
    toast.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = window.setTimeout(() => (toast.hidden = true), ms);
  };

  const hint = el("div", "ct-hint", `<b>Apple Pencil draws and picks.</b> One finger pans · two fingers zoom · two-finger tap undoes.`);
  hint.hidden = true;
  const hintKey = opts.hintKey ?? "cad-touch:hinted";
  try {
    hint.hidden = localStorage.getItem(hintKey) === "1";
  } catch {
    /* storage blocked: show it */
  }
  hint.addEventListener("click", () => {
    hint.hidden = true;
    try {
      localStorage.setItem(hintKey, "1");
    } catch {
      /* ignore */
    }
  });

  root.append(top, strip, sheet, bar, toast, hint);

  // --- Actions ---------------------------------------------------------------
  const report = (r: { ok: boolean; result?: any; error?: string }) => {
    if (!r.ok && r.error) say(r.error);
    else if (r.result?.error) say(String(r.result.error));
    else if (typeof r.result?.message === "string") say(r.result.message);
  };
  const exec = (command: string, params: object = {}) => cad.call("engine.execute", { command, params }).then(report);
  const typed = async (text: string) => report(await cad.call("cmdline.input", { text }));
  const escape = async () => {
    await cad.call("cmdline.key", { key: "escape" });
  };
  const startCommand = async (cmd: string) => {
    if (state?.running) await escape();
    await typed(cmd);
  };
  const activeTitle = () => state?.docs.find((d) => d.index === state?.active)?.title ?? "Drawing";
  const baseName = () => activeTitle().replace(/\.(dwg|dxf)$/i, "");

  const runTool = async (t: Tool) => {
    closeSheet();
    if (t.id === "dwg") return exec("saveas", { path: `${baseName()}.dwg`, version: 2018 });
    if (t.id === "dxf") return exec("saveas", { path: `${baseName()}.dxf` });
    if (t.id === "pdf") return exec("exportpdf", { path: `${baseName()}.pdf` });
    if (t.cmd) return startCommand(t.cmd);
    if (t.call) {
      if (state?.running && t.call.method === "engine.execute") await escape();
      report(await cad.call(t.call.method, t.call.params ?? {}));
    }
  };

  undoB.addEventListener("click", async () => {
    if (state?.running) await escape();
    await exec("undo");
  });
  redoB.addEventListener("click", async () => {
    if (state?.running) await escape();
    await exec("redo");
  });

  // --- Sheets ----------------------------------------------------------------
  function closeSheet(): void {
    openCat = null;
    sheet.hidden = true;
    root.classList.remove("ct-sheet-open");
    for (const b of tabEls.values()) b.classList.remove("on");
  }

  function toggleSheet(c: Category): void {
    if (openCat === c.id) return closeSheet();
    openCat = c.id;
    for (const [id, b] of tabEls) b.classList.toggle("on", id === c.id);
    sheetTitle.textContent = c.label;
    sheetBody.replaceChildren();
    sheet.hidden = false;
    root.classList.add("ct-sheet-open");
    if (c.id === "layers") void renderLayers();
    else {
      sheetBody.appendChild(toolGrid(c.tools));
      if (c.id === "view") void renderAids();
    }
  }

  function toolGrid(tools: Tool[]): HTMLElement {
    const grid = el("div", "ct-tiles");
    for (const t of tools) {
      const b = el("button", "ct-tl", `${icon(t.icon)}<span>${t.label}</span>`);
      b.addEventListener("click", () => void runTool(t));
      grid.appendChild(b);
    }
    return grid;
  }

  async function renderLayers(): Promise<void> {
    const r = await cad.call("engine.execute", { command: "layer", params: {} });
    if (openCat !== "layers") return;
    const list = el("div", "ct-list");
    const layers: any[] = r.result?.layers ?? [];
    if (!layers.length) list.appendChild(el("div", "ct-empty", r.error ?? "No layers."));
    for (const l of layers) {
      const row = el("div", "ct-row" + (l.current ? " cur" : ""));
      const sw = el("i", "ct-swatch");
      const hex = String(l.colorRgb ?? "");
      sw.style.background = /^#?[0-9a-f]{6}$/i.test(hex) ? (hex.startsWith("#") ? hex : "#" + hex) : "#888";
      const nm = el("button", "ct-row-name", `<span>${escapeHtml(String(l.name))}</span>${l.current ? "<small>current</small>" : ""}`);
      nm.title = "Make current";
      nm.addEventListener("click", async () => {
        await exec("layer.current", { name: l.name });
        void renderLayers();
      });
      const vis = el("button", "ct-icon-btn" + (l.on === false ? " off" : ""), icon(l.on === false ? "eyeoff" : "eye"));
      vis.title = l.on === false ? "Show" : "Hide";
      vis.addEventListener("click", async () => {
        await exec("layer.set", { name: l.name, on: l.on === false });
        void renderLayers();
      });
      const lk = el("button", "ct-icon-btn" + (l.locked ? " on" : ""), icon(l.locked ? "lock" : "unlock"));
      lk.title = l.locked ? "Unlock" : "Lock";
      lk.addEventListener("click", async () => {
        await exec("layer.set", { name: l.name, locked: !l.locked });
        void renderLayers();
      });
      row.append(sw, nm, vis, lk);
      list.appendChild(row);
    }
    sheetBody.replaceChildren(list);
  }

  async function renderAids(): Promise<void> {
    const box = el("div", "ct-list");
    box.appendChild(el("div", "ct-label", "Drafting aids"));
    sheetBody.appendChild(box);
    for (const [cmd, label, ic, sysvar] of AIDS) {
      const row = el("div", "ct-row");
      const lab = el("div", "ct-row-name", `${icon(ic)}<span>${label}</span>`);
      const sw = el("button", "ct-switch");
      sw.setAttribute("role", "switch");
      const set = (on: boolean) => {
        sw.classList.toggle("on", on);
        sw.setAttribute("aria-checked", String(on));
      };
      const r = await cad.call("engine.execute", { command: "getvar", params: { name: sysvar } });
      const v = Number(r.result?.value ?? r.result);
      set(sysvar === "osmode" ? v > 0 && (v & 16384) === 0 : sysvar === "autosnap" ? (v & 8) !== 0 : v > 0);
      sw.addEventListener("click", async () => {
        const res = await cad.call("engine.execute", { command: cmd, params: {} });
        if (res.ok && typeof res.result?.on === "boolean") set(res.result.on);
        else report(res);
      });
      row.append(lab, sw);
      box.appendChild(row);
      if (openCat !== "view") return;
    }
  }

  // --- Strip -------------------------------------------------------------------
  const chip = (label: string, cls: string, onClick: () => void, ic?: string) => {
    const b = el("button", "ct-chip " + cls, ic ? `${icon(ic)}<span>${label}</span>` : `<span>${label}</span>`);
    b.addEventListener("click", onClick);
    return b;
  };

  function renderStrip(): void {
    const s = state;
    strip.replaceChildren();
    if (!s) {
      strip.hidden = true;
      return;
    }
    if (s.running) {
      const [cmd, text] = splitPrompt(s.prompt, s.running);
      const p = el("div", "ct-prompt");
      p.append(el("small", undefined, escapeHtml(cmd)), el("b", undefined, escapeHtml(text || "…")));
      strip.appendChild(p);
      const chips = el("div", "ct-chips");
      for (const k of s.keywords ?? []) chips.appendChild(chip(k, "kw", () => void typed(k)));
      strip.appendChild(chips);
      if (typing) {
        const input = el("input", "ct-input");
        input.type = "text";
        input.setAttribute("autocomplete", "off");
        input.setAttribute("autocapitalize", "off");
        input.setAttribute("autocorrect", "off");
        input.placeholder = "Value, e.g. 1200 or @1000<45";
        input.addEventListener("keydown", (e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            const v = input.value;
            typing = false;
            void typed(v);
          } else if (e.key === "Escape") {
            typing = false;
            renderStrip();
          }
        });
        strip.appendChild(input);
        setTimeout(() => input.focus(), 0);
      } else {
        strip.appendChild(chip("Type", "act", () => ((typing = true), renderStrip()), "keyboard"));
      }
      strip.appendChild(chip("Enter", "act ok", () => void typed(""), "enter"));
      strip.appendChild(chip("Cancel", "act", () => ((typing = false), void escape()), "cancel"));
      strip.hidden = false;
      return;
    }
    typing = false;
    if (s.selection > 0) {
      strip.appendChild(el("div", "ct-prompt", `<small>Selected</small><b>${s.selection} object${s.selection === 1 ? "" : "s"}</b>`));
      const acts = el("div", "ct-chips");
      for (const [cmd, label, ic] of [
        ["move", "Move", "move"],
        ["copy", "Copy", "copy"],
        ["rotate", "Rotate", "rotate"],
        ["scale", "Scale", "scale"],
        ["mirror", "Mirror", "mirror"],
        ["erase", "Erase", "erase"],
      ] as const) {
        acts.appendChild(chip(label, "act", () => void startCommand(cmd), ic));
      }
      strip.appendChild(acts);
      strip.appendChild(chip("Clear", "act", () => void escape(), "cancel"));
      strip.hidden = false;
      return;
    }
    strip.hidden = true;
  }

  function render(): void {
    const s = state;
    const title = s ? s.docs.find((d) => d.index === s.active) : undefined;
    nameB.textContent = (title?.title ?? "Drawing") + (title?.dirty ? " •" : "");
    nameS.textContent = s?.running ? `${s.running.toUpperCase()} — pencil to pick points` : s?.last ?? "Pencil draws · fingers move";
    undoB.disabled = !s?.undo;
    redoB.disabled = !s?.redo;
    renderStrip();
  }
  render();

  return {
    setState(s) {
      const changedRun = s.running !== state?.running;
      state = s;
      if (changedRun && s.running) closeSheet();
      if (s.running && !hint.hidden) hint.hidden = true;
      render();
    },
    destroy() {
      for (const e of [top, strip, sheet, bar, toast, hint]) e.remove();
      root.classList.remove("ct-root", "ct-sheet-open");
    },
  };
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] ?? c);
}
