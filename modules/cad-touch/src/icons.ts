/**
 * Icons for the touch CAD interface: 24×24, stroke = currentColor, drawn for this module
 * (no third-party artwork). Keys are referenced by tools in `tools.ts`.
 */
const S = 'fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"';
const dot = (x: number, y: number) => `<circle cx="${x}" cy="${y}" r="1.6" fill="currentColor"/>`;

export const ICONS: Record<string, string> = {
  // Bar
  draw: `<path ${S} d="M4 20l3.5-1 10-10-2.5-2.5-10 10z"/><path ${S} d="M13.5 6.5l2.5 2.5M4 20h16"/>`,
  modify: `<path ${S} d="M12 3v18M3 12h18M12 3l-2.5 2.5M12 3l2.5 2.5M12 21l-2.5-2.5M12 21l2.5-2.5M3 12l2.5-2.5M3 12l2.5 2.5M21 12l-2.5-2.5M21 12l-2.5 2.5"/>`,
  annotate: `<path ${S} d="M4 17h16M4 17v-3M20 17v-3M7 17l-1.5-1.5M7 17l-1.5 1.5M17 17l1.5-1.5M17 17l1.5 1.5M8 10h8M12 6v4"/>`,
  layers: `<path ${S} d="M12 3.5l8.5 4.5-8.5 4.5L3.5 8zM3.5 12.5L12 17l8.5-4.5M3.5 16.5L12 21l8.5-4.5"/>`,
  view: `<path ${S} d="M4 8V4h4M16 4h4v4M20 16v4h-4M8 20H4v-4"/><circle cx="12" cy="12" r="3" ${S}/>`,
  file: `<path ${S} d="M6 3.5h8l4 4v13H6zM14 3.5v4h4M9 13h6M9 16.5h6"/>`,
  // Draw
  line: `<path ${S} d="M5 19L19 5"/>${dot(5, 19)}${dot(19, 5)}`,
  pline: `<path ${S} d="M3.5 18l5-9 5 6 6.5-10"/>${dot(3.5, 18)}${dot(20, 5)}`,
  circle: `<circle cx="12" cy="12" r="8" ${S}/>${dot(12, 12)}`,
  arc: `<path ${S} d="M4 17a9 9 0 0 1 16 0"/>${dot(4, 17)}${dot(20, 17)}${dot(12, 8)}`,
  rectang: `<rect x="3.5" y="6" width="17" height="12" rx="1" ${S}/>`,
  polygon: `<path ${S} d="M12 3.5l7.4 4.25v8.5L12 20.5l-7.4-4.25v-8.5z"/>`,
  ellipse: `<ellipse cx="12" cy="12" rx="9" ry="5.5" ${S}/>`,
  spline: `<path ${S} d="M3 16c3-9 6-9 9 0s6 9 9 0"/>`,
  hatch: `<rect x="4" y="4" width="16" height="16" rx="1" ${S}/><path ${S} d="M4 12l8-8M4 20L20 4M12 20l8-8"/>`,
  point: `<path ${S} d="M12 6v12M6 12h12"/>${dot(12, 12)}`,
  xline: `<path ${S} d="M2 18L22 6" stroke-dasharray="0"/><path ${S} d="M9 13.8l6-3.6"/>`,
  revcloud: `<path ${S} d="M5 15a2.5 2.5 0 0 1 0-5 3 3 0 0 1 5-2.5 3 3 0 0 1 5 0 2.5 2.5 0 0 1 4 3 2.5 2.5 0 0 1-1 4.5 3 3 0 0 1-5 1 3 3 0 0 1-5 0 2.5 2.5 0 0 1-3-1z"/>`,
  // Modify
  move: `<path ${S} d="M12 3v18M3 12h18M12 3l-2.5 2.5M12 3l2.5 2.5M12 21l-2.5-2.5M12 21l2.5-2.5M3 12l2.5-2.5M3 12l2.5 2.5M21 12l-2.5-2.5M21 12l-2.5 2.5"/>`,
  copy: `<rect x="8" y="8" width="12" height="12" rx="1.5" ${S}/><path ${S} d="M16 8V5.5A1.5 1.5 0 0 0 14.5 4h-9A1.5 1.5 0 0 0 4 5.5v9A1.5 1.5 0 0 0 5.5 16H8"/>`,
  rotate: `<path ${S} d="M20 12a8 8 0 1 1-2.3-5.6M20 4v4h-4"/>`,
  scale: `<rect x="3.5" y="10.5" width="10" height="10" rx="1" ${S}/><path ${S} d="M13 11l7-7M14.5 4H20v5.5"/>`,
  mirror: `<path ${S} d="M12 3v18" stroke-dasharray="2 2.5"/><path ${S} d="M9 7L3.5 17H9zM15 7l5.5 10H15z"/>`,
  offset: `<path ${S} d="M4 18c4-1 6-5 8-9s5-5 8-5"/><path ${S} d="M4 21c5-1 8-6 9.5-9.5S17 8 20 8" opacity=".6"/>`,
  trim: `<path ${S} d="M4 12h7"/><path ${S} d="M11 12h9" stroke-dasharray="2 2.5" opacity=".7"/><path ${S} d="M14 4v16"/>`,
  extend: `<path ${S} d="M4 12h9"/><path ${S} d="M13 12h6" stroke-dasharray="2 2.5"/><path ${S} d="M20 4v16M16 9.5l3 2.5-3 2.5"/>`,
  fillet: `<path ${S} d="M4 20V12a8 8 0 0 1 8-8h8"/>`,
  chamfer: `<path ${S} d="M4 20v-9l7-7h9"/>`,
  erase: `<path ${S} d="M8.5 20h11M5.7 15.3l8.6-8.6a1.5 1.5 0 0 1 2.1 0l2.9 2.9a1.5 1.5 0 0 1 0 2.1L12 19.5H9.9l-4.2-4.2zM9.5 11.5l4.5 4.5"/>`,
  explode: `<path ${S} d="M12 3v4M12 17v4M3 12h4M17 12h4M5.6 5.6l2.8 2.8M15.6 15.6l2.8 2.8M5.6 18.4l2.8-2.8M15.6 8.4l2.8-2.8"/>`,
  array: `<rect x="4" y="4" width="5" height="5" ${S}/><rect x="15" y="4" width="5" height="5" ${S}/><rect x="4" y="15" width="5" height="5" ${S}/><rect x="15" y="15" width="5" height="5" ${S}/>`,
  stretch: `<path ${S} d="M3.5 7h9v10h-9z"/><path ${S} d="M12.5 7H20v10h-7.5" stroke-dasharray="2 2"/><path ${S} d="M15 12h6M18.5 9.5L21 12l-2.5 2.5"/>`,
  join: `<path ${S} d="M3 16l6-6M15 14l6-6"/><path ${S} d="M9 10c2-2 4 6 6 4"/>`,
  break: `<path ${S} d="M3 12h7M14 12h7"/>${dot(10, 12)}${dot(14, 12)}`,
  matchprop: `<path ${S} d="M4 20l6-6M14 4l6 6-8 8-6-6zM9 9l6 6"/>`,
  // Annotate
  dimlinear: `<path ${S} d="M4 6v12M20 6v12M4 12h16M7 9.5L4 12l3 2.5M17 9.5l3 2.5-3 2.5"/>`,
  dimaligned: `<path ${S} d="M5 19L19 5M3 15l4 4M15 3l4 4M8 16l-3 3M16 8l3-3"/>`,
  dimangular: `<path ${S} d="M4 20h16M4 20L15 6"/><path ${S} d="M12 20a8 8 0 0 0-2.5-6"/>`,
  dimradius: `<circle cx="12" cy="12" r="8" ${S}/><path ${S} d="M12 12l5.5-5.5M15 6.5h3v3"/>`,
  dimdiameter: `<circle cx="12" cy="12" r="8" ${S}/><path ${S} d="M6.3 17.7L17.7 6.3M14.7 6.3h3v3M9.3 17.7h-3v-3"/>`,
  mleader: `<path ${S} d="M4 20l8-8h8M4 20l1-4M4 20l4-1"/>`,
  text: `<path ${S} d="M5 6V4.5h14V6M12 4.5V20M9 20h6"/>`,
  mtext: `<path ${S} d="M4 5h9M8.5 5v9M15 9h5M15 13h5M4 17h16M4 20.5h10"/>`,
  dist: `<path ${S} d="M3.5 16.5L16.5 3.5l4 4-13 13zM7.5 12.5l2 2M10.5 9.5l2 2M13.5 6.5l2 2"/>`,
  area: `<path ${S} d="M4 18l4-12 8 2 4 10z"/><path ${S} d="M8 14h8" opacity=".6"/>`,
  // View
  extents: `<path ${S} d="M4 8V4h4M16 4h4v4M20 16v4h-4M8 20H4v-4"/>`,
  zoomin: `<circle cx="10.5" cy="10.5" r="6.5" ${S}/><path ${S} d="M15.5 15.5L20 20M10.5 8v5M8 10.5h5"/>`,
  zoomout: `<circle cx="10.5" cy="10.5" r="6.5" ${S}/><path ${S} d="M15.5 15.5L20 20M8 10.5h5"/>`,
  window: `<rect x="4" y="4" width="16" height="16" rx="1" ${S} stroke-dasharray="3 2.4"/>`,
  previous: `<path ${S} d="M9 14.5L4.5 10 9 5.5M4.5 10H14a5.5 5.5 0 0 1 0 11h-3"/>`,
  osnap: `<rect x="8" y="8" width="8" height="8" ${S}/><path ${S} d="M12 2v4M12 18v4M2 12h4M18 12h4"/>`,
  ortho: `<path ${S} d="M5 4v15h15"/><path ${S} d="M5 15h4v4"/>`,
  polar: `<path ${S} d="M4 20h16M4 20L18 8"/><path ${S} d="M10 20a6 6 0 0 0-1.7-4.2" stroke-dasharray="1.5 2"/>`,
  grid: `<path ${S} d="M4 4h16v16H4zM4 9.3h16M4 14.6h16M9.3 4v16M14.6 4v16"/>`,
  lwdisplay: `<path ${S} d="M4 7h16" stroke-width="1"/><path ${S} d="M4 12h16" stroke-width="2.2"/><path ${S} d="M4 17.5h16" stroke-width="3.4"/>`,
  // File
  save: `<path ${S} d="M5 4h11l3 3v13H5zM8 4v5h7V4M8 20v-6h8v6"/>`,
  saveas: `<path ${S} d="M5 4h11l3 3v6M5 4v16h7M8 4v5h7V4"/><path ${S} d="M14 20l5-5 2 2-5 5h-2z"/>`,
  pdf: `<path ${S} d="M6 3.5h8l4 4v13H6zM14 3.5v4h4"/><path ${S} d="M8.5 16v-4h1.5a1.2 1.2 0 0 1 0 2.4H8.5M12.5 12v4h1a1.6 1.6 0 0 0 1.6-1.6v-.8A1.6 1.6 0 0 0 13.5 12z"/>`,
  close: `<path ${S} d="M6.5 6.5l11 11M17.5 6.5l-11 11"/>`,
  // Chrome
  back: `<path ${S} d="M15 18l-6-6 6-6"/>`,
  undo: `<path ${S} d="M9 14.5L4.5 10 9 5.5M4.5 10H14a5.5 5.5 0 0 1 0 11h-3"/>`,
  redo: `<path ${S} d="M15 14.5l4.5-4.5L15 5.5M19.5 10H10a5.5 5.5 0 0 0 0 11h3"/>`,
  enter: `<path ${S} d="M5 12.5l4.5 4.5L19 7.5"/>`,
  cancel: `<path ${S} d="M6.5 6.5l11 11M17.5 6.5l-11 11"/>`,
  keyboard: `<rect x="2.5" y="6" width="19" height="12" rx="2" ${S}/><path ${S} d="M6 10h.01M9.5 10h.01M13 10h.01M16.5 10h.01M6.5 14h11"/>`,
  eye: `<path ${S} d="M3 12s3.8-6 9-6 9 6 9 6-3.8 6-9 6-9-6-9-6z"/><circle cx="12" cy="12" r="2.6" ${S}/>`,
  eyeoff: `<path ${S} d="M4 4l16 16M9.9 6.3A9 9 0 0 1 12 6c5.2 0 9 6 9 6a16 16 0 0 1-2.9 3.5M6.5 7.4C4.2 9.1 3 12 3 12s3.8 6 9 6a8.4 8.4 0 0 0 3.7-.9"/>`,
  lock: `<rect x="5" y="11" width="14" height="9" rx="1.5" ${S}/><path ${S} d="M8 11V8a4 4 0 0 1 8 0v3"/>`,
  unlock: `<rect x="5" y="11" width="14" height="9" rx="1.5" ${S}/><path ${S} d="M8 11V8a4 4 0 0 1 7.5-2"/>`,
  check: `<path ${S} d="M5 12.5l4.5 4.5L19 7.5"/>`,
  more: `<circle cx="6" cy="12" r="1.4" fill="currentColor"/><circle cx="12" cy="12" r="1.4" fill="currentColor"/><circle cx="18" cy="12" r="1.4" fill="currentColor"/>`,
};

export function icon(name: string): string {
  return `<svg viewBox="0 0 24 24" aria-hidden="true">${ICONS[name] ?? ICONS.more}</svg>`;
}
