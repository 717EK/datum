/**
 * The touch interface's categories (the bar) and the tools under each (the sheet). A tool is a
 * command typed at the CAD app's command line (`cmd`) or a control-channel call (`call`).
 * Layers and View also show live controls (built in index.ts).
 */
export interface Tool {
  id: string;
  label: string;
  icon: string;
  /** Typed at the command line, as a user would ("line", "zoom e"). */
  cmd?: string;
  /** Or a control-channel call. */
  call?: { method: string; params?: object };
  /** Needs a selection first (dimmed without one). */
  needsSelection?: boolean;
}

export interface Category {
  id: string;
  label: string;
  icon: string;
  tools: Tool[];
}

const exec = (command: string, params: object = {}) => ({ method: "engine.execute", params: { command, params } });

export const CATEGORIES: Category[] = [
  {
    id: "draw",
    label: "Draw",
    icon: "draw",
    tools: [
      { id: "line", label: "Line", icon: "line", cmd: "line" },
      { id: "pline", label: "Polyline", icon: "pline", cmd: "pline" },
      { id: "rectang", label: "Rectangle", icon: "rectang", cmd: "rectang" },
      { id: "circle", label: "Circle", icon: "circle", cmd: "circle" },
      { id: "arc", label: "Arc", icon: "arc", cmd: "arc" },
      { id: "polygon", label: "Polygon", icon: "polygon", cmd: "polygon" },
      { id: "ellipse", label: "Ellipse", icon: "ellipse", cmd: "ellipse" },
      { id: "spline", label: "Spline", icon: "spline", cmd: "spline" },
      { id: "hatch", label: "Hatch", icon: "hatch", cmd: "hatch" },
      { id: "point", label: "Point", icon: "point", cmd: "point" },
      { id: "xline", label: "Guide line", icon: "xline", cmd: "xline" },
      { id: "revcloud", label: "Cloud", icon: "revcloud", cmd: "revcloud" },
    ],
  },
  {
    id: "modify",
    label: "Modify",
    icon: "modify",
    tools: [
      { id: "move", label: "Move", icon: "move", cmd: "move" },
      { id: "copy", label: "Copy", icon: "copy", cmd: "copy" },
      { id: "rotate", label: "Rotate", icon: "rotate", cmd: "rotate" },
      { id: "scale", label: "Scale", icon: "scale", cmd: "scale" },
      { id: "mirror", label: "Mirror", icon: "mirror", cmd: "mirror" },
      { id: "offset", label: "Offset", icon: "offset", cmd: "offset" },
      { id: "trim", label: "Trim", icon: "trim", cmd: "trim" },
      { id: "extend", label: "Extend", icon: "extend", cmd: "extend" },
      { id: "fillet", label: "Fillet", icon: "fillet", cmd: "fillet" },
      { id: "chamfer", label: "Chamfer", icon: "chamfer", cmd: "chamfer" },
      { id: "stretch", label: "Stretch", icon: "stretch", cmd: "stretch" },
      { id: "array", label: "Array", icon: "array", cmd: "array" },
      { id: "join", label: "Join", icon: "join", cmd: "join" },
      { id: "break", label: "Break", icon: "break", cmd: "break" },
      { id: "explode", label: "Explode", icon: "explode", cmd: "explode" },
      { id: "matchprop", label: "Match", icon: "matchprop", cmd: "matchprop" },
      { id: "erase", label: "Erase", icon: "erase", cmd: "erase" },
    ],
  },
  {
    id: "annotate",
    label: "Annotate",
    icon: "annotate",
    tools: [
      { id: "dimlinear", label: "Linear", icon: "dimlinear", cmd: "dimlinear" },
      { id: "dimaligned", label: "Aligned", icon: "dimaligned", cmd: "dimaligned" },
      { id: "dimangular", label: "Angle", icon: "dimangular", cmd: "dimangular" },
      { id: "dimradius", label: "Radius", icon: "dimradius", cmd: "dimradius" },
      { id: "dimdiameter", label: "Diameter", icon: "dimdiameter", cmd: "dimdiameter" },
      { id: "mleader", label: "Leader", icon: "mleader", cmd: "mleader" },
      { id: "text", label: "Text", icon: "text", cmd: "text" },
      { id: "mtext", label: "Paragraph", icon: "mtext", cmd: "mtext" },
      { id: "dist", label: "Measure", icon: "dist", cmd: "dist" },
      { id: "area", label: "Area", icon: "area", cmd: "area" },
    ],
  },
  { id: "layers", label: "Layers", icon: "layers", tools: [] },
  {
    id: "view",
    label: "View",
    icon: "view",
    tools: [
      { id: "extents", label: "Fit all", icon: "extents", call: exec("zoom", { mode: "extents" }) },
      { id: "window", label: "Zoom box", icon: "window", cmd: "zoom w" },
      { id: "zoomin", label: "Zoom in", icon: "zoomin", call: exec("zoom", { mode: "in" }) },
      { id: "zoomout", label: "Zoom out", icon: "zoomout", call: exec("zoom", { mode: "out" }) },
      { id: "previous", label: "Previous", icon: "previous", call: exec("zoom", { mode: "previous" }) },
    ],
  },
  {
    id: "file",
    label: "File",
    icon: "file",
    tools: [
      { id: "save", label: "Save", icon: "save", call: exec("qsave") },
      { id: "dwg", label: "Save DWG", icon: "saveas" },
      { id: "dxf", label: "Save DXF", icon: "saveas" },
      { id: "pdf", label: "PDF", icon: "pdf" },
      { id: "closedoc", label: "Close drawing", icon: "close", call: exec("close") },
    ],
  },
];

/** Drafting aids shown as switches under View: [command, label, icon, system variable that reads it]. */
export const AIDS: [string, string, string, string][] = [
  ["osnap", "Object snap", "osnap", "osmode"],
  ["ortho", "Ortho", "ortho", "orthomode"],
  ["polar", "Polar tracking", "polar", "autosnap"],
  ["grid", "Grid", "grid", "gridmode"],
  ["lwdisplay", "Lineweights", "lwdisplay", "lwdisplay"],
];
