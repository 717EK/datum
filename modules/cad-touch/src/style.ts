/**
 * Styles for cad-touch, in Meter's phone language (dark bar, labelled tabs, half-height sheets,
 * a strip above the bar for the live tool, the TAXI band). Colours are CSS variables the page may
 * override on `.ct-root`. Phones: bottom bar. Tablets (≥ 700 × 500): a rail down the left and
 * the sheet as a side panel next to it, the way SketchUp for iPad does it.
 */
export const CSS = `
.ct-root {
  --ct-bar: #22262b; --ct-ink: #e9ecef; --ct-muted: #8d959e; --ct-rule: #393f46;
  --ct-sheet: #2b3036; --ct-accent: #0b78c8; --ct-accent-ink: #ffffff; --ct-accent-soft: #5db5f4;
  --ct-wash: rgba(11, 120, 200, .18);
  --ct-safe-t: env(safe-area-inset-top, 0px); --ct-safe-b: env(safe-area-inset-bottom, 0px);
  --ct-safe-l: env(safe-area-inset-left, 0px); --ct-safe-r: env(safe-area-inset-right, 0px);
  --ct-tabs-h: 56px; --ct-band-h: 22px; --ct-rail-w: 84px; --ct-panel-w: 340px;
  font: 500 14px/1.25 system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
  -webkit-tap-highlight-color: transparent;
}
.ct-root button { font: inherit; color: inherit; background: none; border: 0; padding: 0; cursor: pointer; touch-action: manipulation; }
.ct-root svg { display: block; flex: none; }
.ct-root [hidden] { display: none !important; }

/* Top row: back · name · undo · redo */
.ct-top { position: absolute; z-index: 30; top: calc(var(--ct-safe-t) + 8px); left: calc(var(--ct-safe-l) + 8px); right: calc(var(--ct-safe-r) + 8px);
  height: 44px; display: flex; gap: 8px; pointer-events: none; }
.ct-top > * { pointer-events: auto; }
.ct-tile { flex: none; width: 44px; height: 44px; border-radius: 8px; background: var(--ct-bar) !important; color: var(--ct-ink) !important; display: grid; place-items: center; }
.ct-tile svg { width: 22px; height: 22px; }
.ct-tile:disabled { color: var(--ct-muted) !important; opacity: .55; cursor: default; }
.ct-name { flex: 0 1 auto; min-width: 0; max-width: 46ch; border-radius: 8px; background: var(--ct-bar); color: var(--ct-ink);
  display: flex; flex-direction: column; justify-content: center; padding: 0 12px; gap: 2px; margin-right: auto; }
.ct-name b { font-weight: 600; font-size: 15px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.ct-name small { font-size: 11px; color: var(--ct-accent-soft); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }

/* Bar of categories */
.ct-bar { position: absolute; z-index: 40; left: 0; right: 0; bottom: 0; background: var(--ct-bar); color: var(--ct-ink);
  padding: 0 var(--ct-safe-r) var(--ct-safe-b) var(--ct-safe-l); }
.ct-tabs { display: grid; grid-template-columns: repeat(6, 1fr); height: var(--ct-tabs-h); padding: 0 4px; }
.ct-tab { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 3px; border-radius: 9px; margin: 4px 2px;
  font-size: 10px !important; font-weight: 500; color: var(--ct-ink) !important; min-width: 44px; }
.ct-tab svg { width: 22px; height: 22px; }
.ct-tab.on { background: var(--ct-accent) !important; color: var(--ct-accent-ink) !important; }
.ct-band { height: var(--ct-band-h); display: flex; align-items: flex-start; justify-content: center; }
.ct-band span { font: 700 8.5px/1 system-ui, sans-serif; letter-spacing: .34em; color: var(--ct-muted); white-space: nowrap; }

/* Sheet above the bar */
.ct-sheet { position: absolute; z-index: 35; left: 0; right: 0; bottom: calc(var(--ct-tabs-h) + var(--ct-band-h) + var(--ct-safe-b));
  max-height: 52%; display: flex; flex-direction: column; background: var(--ct-sheet); color: var(--ct-ink);
  border-radius: 14px 14px 0 0; box-shadow: 0 -10px 30px rgba(0, 0, 0, .25); }
.ct-sheet-head { flex: none; display: flex; align-items: center; justify-content: space-between; height: 48px; padding: 0 8px 0 16px; border-bottom: 1px solid var(--ct-rule); }
.ct-sheet-head b { font-size: 17px; font-weight: 600; }
.ct-sheet-body { overflow: auto; overscroll-behavior: contain; padding-bottom: 8px; }
.ct-tiles { display: grid; grid-template-columns: repeat(auto-fill, minmax(84px, 1fr)); gap: 8px; padding: 12px 14px; }
.ct-tl { border: 1px solid var(--ct-rule) !important; border-radius: 9px; padding: 10px 2px 8px !important; min-height: 72px;
  display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 6px; font-size: 11.5px !important; text-align: center; }
.ct-tl svg { width: 28px; height: 28px; }
.ct-tl:active { background: var(--ct-wash) !important; border-color: var(--ct-accent) !important; }
.ct-icon-btn { width: 44px; height: 44px; display: grid; place-items: center; border-radius: 8px; color: var(--ct-ink) !important; }
.ct-icon-btn svg { width: 20px; height: 20px; }
.ct-icon-btn.off { color: var(--ct-muted) !important; }
.ct-icon-btn.on { color: var(--ct-accent-soft) !important; }
.ct-list { display: flex; flex-direction: column; }
.ct-label { padding: 12px 16px 6px; font: 600 10px/1 ui-monospace, Consolas, monospace; letter-spacing: .1em; text-transform: uppercase; color: var(--ct-muted); }
.ct-row { display: flex; align-items: center; gap: 8px; min-height: 48px; padding: 0 8px 0 16px; border-top: 1px solid var(--ct-rule); }
.ct-row.cur { background: var(--ct-wash); }
.ct-row-name { flex: 1; min-width: 0; display: flex; align-items: center; gap: 10px; text-align: left; min-height: 44px; font-size: 13.5px !important; }
.ct-row-name span { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.ct-row-name small { color: var(--ct-accent-soft); font-size: 10.5px; margin-left: 6px; }
.ct-row-name svg { width: 20px; height: 20px; color: var(--ct-muted); }
.ct-swatch { flex: none; width: 14px; height: 14px; border-radius: 3px; box-shadow: inset 0 0 0 1px rgba(255,255,255,.25); }
.ct-switch { flex: none; position: relative; width: 44px; height: 26px; border-radius: 99px !important; background: var(--ct-rule) !important; margin-right: 8px; }
.ct-switch::after { content: ""; position: absolute; top: 3px; left: 3px; width: 20px; height: 20px; border-radius: 50%; background: var(--ct-ink); transition: left .15s; }
.ct-switch.on { background: var(--ct-accent) !important; }
.ct-switch.on::after { left: 21px; }
.ct-empty { padding: 16px; color: var(--ct-muted); }

/* Strip for the live command / the selection */
.ct-strip { position: absolute; z-index: 38; left: calc(var(--ct-safe-l) + 8px); right: calc(var(--ct-safe-r) + 8px);
  bottom: calc(var(--ct-tabs-h) + var(--ct-band-h) + var(--ct-safe-b) + 8px); min-height: 56px; display: flex; align-items: center; gap: 4px;
  padding: 4px 6px; border-radius: 11px; background: var(--ct-bar); color: var(--ct-ink); box-shadow: 0 6px 24px rgba(0, 0, 0, .3); overflow-x: auto; }
.ct-sheet-open .ct-strip, .ct-sheet-open .ct-hint { display: none; }
.ct-prompt { flex: 0 1 auto; min-width: 96px; max-width: 42%; display: flex; flex-direction: column; gap: 2px; padding: 0 8px; }
.ct-prompt small { font: 600 10px/1 ui-monospace, Consolas, monospace; letter-spacing: .08em; color: var(--ct-accent-soft); }
.ct-prompt b { font-size: 14px; font-weight: 600; line-height: 1.2; }
.ct-chips { flex: 1 1 auto; display: flex; gap: 4px; overflow-x: auto; min-width: 0; }
.ct-chip { flex: none; height: 46px; min-width: 46px; padding: 0 10px !important; border-radius: 9px; display: flex; flex-direction: column;
  align-items: center; justify-content: center; gap: 3px; font-size: 10px !important; color: var(--ct-ink) !important; }
.ct-chip svg { width: 20px; height: 20px; }
.ct-chip.kw { flex-direction: row; font-size: 13px !important; border: 1px solid var(--ct-rule) !important; height: 40px; }
.ct-chip.ok { background: var(--ct-accent) !important; color: var(--ct-accent-ink) !important; }
.ct-input { flex: 1 1 160px; min-width: 140px; height: 42px; border-radius: 9px; border: 1px solid var(--ct-accent); background: var(--ct-sheet);
  color: var(--ct-ink); padding: 0 12px; font: 500 16px/1 ui-monospace, Consolas, monospace; outline: none; }

.ct-toast { position: absolute; z-index: 50; left: 50%; transform: translateX(-50%); top: calc(var(--ct-safe-t) + 62px); max-width: min(90%, 520px);
  padding: 8px 14px; border-radius: 10px; background: var(--ct-bar); color: var(--ct-ink); font-size: 13px; box-shadow: 0 6px 24px rgba(0,0,0,.3); }
.ct-hint { position: absolute; z-index: 37; left: calc(var(--ct-safe-l) + 8px); right: calc(var(--ct-safe-r) + 8px);
  bottom: calc(var(--ct-tabs-h) + var(--ct-band-h) + var(--ct-safe-b) + 8px); padding: 12px 14px; border-radius: 11px;
  background: var(--ct-sheet); color: var(--ct-ink); font-size: 13px; border-left: 3px solid var(--ct-accent); cursor: pointer; }
.ct-hint b { font-weight: 600; }

/* Tablets: rail down the left, sheet as a side panel. */
@media (min-width: 700px) and (min-height: 500px) {
  .ct-bar { top: 0; right: auto; width: calc(var(--ct-rail-w) + var(--ct-safe-l)); display: flex; flex-direction: column;
    padding: calc(var(--ct-safe-t) + 8px) 0 calc(var(--ct-safe-b) + 10px) var(--ct-safe-l); }
  .ct-tabs { grid-template-columns: 1fr; grid-auto-rows: 64px; height: auto; padding: 0 6px; }
  .ct-tab { margin: 3px 0; font-size: 11px !important; }
  .ct-band { margin-top: auto; height: auto; padding: 0 6px; }
  .ct-band span { white-space: normal; text-align: center; letter-spacing: .22em; line-height: 1.6; font-size: 7.5px; }
  .ct-top { left: calc(var(--ct-safe-l) + var(--ct-rail-w) + 10px); }
  .ct-sheet { top: 0; bottom: 0; left: calc(var(--ct-safe-l) + var(--ct-rail-w)); right: auto; width: var(--ct-panel-w); max-height: none;
    border-radius: 0; padding-top: var(--ct-safe-t); border-right: 1px solid var(--ct-rule); box-shadow: 10px 0 30px rgba(0,0,0,.25); }
  .ct-sheet-open .ct-top { left: calc(var(--ct-safe-l) + var(--ct-rail-w) + var(--ct-panel-w) + 10px); }
  .ct-strip, .ct-hint { left: calc(var(--ct-safe-l) + var(--ct-rail-w) + 12px); right: calc(var(--ct-safe-r) + 12px);
    bottom: calc(var(--ct-safe-b) + 12px); max-width: 980px; }
  .ct-sheet-open .ct-strip { display: flex; left: calc(var(--ct-safe-l) + var(--ct-rail-w) + var(--ct-panel-w) + 12px); }
  .ct-toast { left: calc(50% + var(--ct-rail-w) / 2); }
}
`;
