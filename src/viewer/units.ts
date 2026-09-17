/**
 * Display units for lengths, areas and volumes.
 *
 * The viewer works in millimetres internally (OCCT normalises STEP to mm; STL
 * and OBJ carry no unit and are taken as mm unless the host rescales them).
 * Everything the user *sees* goes through these formatters, so switching the
 * unit re-labels measurements, part sizes, volumes and areas without touching
 * geometry. Default is mm — the Obsidian plugin never changes it.
 */

export type LengthUnit = "mm" | "cm" | "m" | "in" | "ft" | "ft-in";

export const LENGTH_UNITS: { id: LengthUnit; label: string }[] = [
  { id: "mm", label: "Millimetres (mm)" },
  { id: "cm", label: "Centimetres (cm)" },
  { id: "m", label: "Metres (m)" },
  { id: "in", label: "Inches (decimal)" },
  { id: "ft", label: "Feet (decimal)" },
  { id: "ft-in", label: "Feet & inches (architectural)" },
];

/** Millimetres per unit. */
const MM_PER: Record<Exclude<LengthUnit, "ft-in">, number> = {
  mm: 1,
  cm: 10,
  m: 1000,
  in: 25.4,
  ft: 304.8,
};

let current: LengthUnit = "mm";
const listeners = new Set<(u: LengthUnit) => void>();

export function getLengthUnit(): LengthUnit {
  return current;
}

export function setLengthUnit(u: LengthUnit): void {
  if (u === current) return;
  current = u;
  for (const l of listeners) l(u);
}

/** Be told when the unit changes (to re-label existing readouts). */
export function onLengthUnitChange(cb: (u: LengthUnit) => void): () => void {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

/** Short symbol for the current unit ("mm", "in", "ft" …). */
export function unitSymbol(u: LengthUnit = current): string {
  switch (u) {
    case "mm":
      return "mm";
    case "cm":
      return "cm";
    case "m":
      return "m";
    case "in":
      return "in";
    case "ft":
      return "ft";
    case "ft-in":
      return ""; // architectural values carry their own ' and " marks
  }
}

/** Convert a millimetre value to the current unit (decimal units only). */
export function toUnit(mm: number, u: LengthUnit = current): number {
  return mm / MM_PER[u === "ft-in" ? "in" : u];
}

function decimals(u: LengthUnit): number {
  switch (u) {
    case "mm":
      return 2;
    case "cm":
      return 2;
    case "m":
      return 3;
    case "in":
      return 3;
    case "ft":
      return 3;
    case "ft-in":
      return 0;
  }
}

/** 5'-3 1/2" style, to the nearest 1/16". */
export function formatFeetInches(mm: number): string {
  const sign = mm < 0 ? "-" : "";
  let totalSixteenths = Math.round((Math.abs(mm) / 25.4) * 16);
  const feet = Math.floor(totalSixteenths / (12 * 16));
  totalSixteenths -= feet * 12 * 16;
  const inches = Math.floor(totalSixteenths / 16);
  let n = totalSixteenths - inches * 16;
  let d = 16;
  while (n > 0 && n % 2 === 0) {
    n /= 2;
    d /= 2;
  }
  const frac = n > 0 ? `${inches > 0 || feet > 0 ? " " : ""}${n}/${d}` : "";
  if (feet === 0) return `${sign}${inches > 0 || !frac ? inches : ""}${frac}"`;
  return `${sign}${feet}'-${inches}${frac}"`;
}

/** Full length with unit, e.g. "12.50 mm", "1.234 m", "3.150 in", 2'-6 1/2". */
export function formatLength(mm: number, u: LengthUnit = current): string {
  if (u === "ft-in") return formatFeetInches(mm);
  if (u === "mm" && Math.abs(mm) >= 1000) return `${(mm / 1000).toFixed(3)} m`;
  return `${toUnit(mm, u).toFixed(decimals(u))} ${unitSymbol(u)}`;
}

/** Compact unit-less number for per-axis components (pair with unitSymbol()). */
export function formatLengthValue(mm: number, u: LengthUnit = current): string {
  if (u === "ft-in") return formatFeetInches(mm);
  const v = toUnit(mm, u);
  if (u === "mm") return Math.abs(v) >= 100 ? v.toFixed(0) : v.toFixed(1);
  const d = decimals(u);
  return Math.abs(v) >= 100 ? v.toFixed(Math.max(0, d - 2)) : v.toFixed(d);
}

/** Area from mm². Metric picks mm²/cm²/m²; imperial uses in²/ft². */
export function formatArea(mm2: number, u: LengthUnit = current): string {
  switch (u) {
    case "in":
      return `${(mm2 / (25.4 * 25.4)).toFixed(2)} in²`;
    case "ft":
    case "ft-in":
      return mm2 >= 92903 ? `${(mm2 / 92903.04).toFixed(2)} ft²` : `${(mm2 / (25.4 * 25.4)).toFixed(2)} in²`;
    case "m":
      return mm2 >= 10000 ? `${(mm2 / 1e6).toFixed(3)} m²` : `${(mm2 / 100).toFixed(2)} cm²`;
    case "cm":
      return `${(mm2 / 100).toFixed(2)} cm²`;
    default:
      if (mm2 >= 100) return `${(mm2 / 100).toFixed(2)} cm²`;
      return `${mm2.toFixed(1)} mm²`;
  }
}

/** Volume from mm³. Metric picks mm³/cm³/m³; imperial uses in³/ft³. */
export function formatVolume(mm3: number, u: LengthUnit = current): string {
  switch (u) {
    case "in":
      return `${(mm3 / 16387.064).toFixed(3)} in³`;
    case "ft":
    case "ft-in":
      return mm3 >= 28316846 ? `${(mm3 / 28316846.6).toFixed(3)} ft³` : `${(mm3 / 16387.064).toFixed(3)} in³`;
    case "m":
      return mm3 >= 1e6 ? `${(mm3 / 1e9).toFixed(4)} m³` : `${(mm3 / 1000).toFixed(2)} cm³`;
    case "cm":
      return `${(mm3 / 1000).toFixed(2)} cm³`;
    default:
      if (mm3 >= 1000) return `${(mm3 / 1000).toFixed(2)} cm³`;
      return `${mm3.toFixed(1)} mm³`;
  }
}
