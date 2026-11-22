import { accentOf } from "@shared/catalog";

export const C = {
  cream: "#fbf1dc",
  paper: "#fffaef",
  oat: "#f3e6cb",
  ink: "#2a211c",
  cocoa: "#6b5a4e",
  line: "rgba(42,33,28,0.28)",
  faint: "rgba(42,33,28,0.1)",
  sakura: "#f6c3cf",
  matcha: "#cde4be",
  ramune: "#bcdfee",
  fuji: "#d8cbf0",
  yuzu: "#f8e29c",
  momo: "#fad0b5",
  berry: "#c2456a",
};

export const F = { medium: "MPlus500", bold: "MPlus700", black: "MPlus800" };
export const NOTE = [C.yuzu, C.ramune, C.sakura, C.matcha, C.fuji, C.momo];
export const accentHex = (id?: string | null) => accentOf(id).hex;
export const BORDER = 1.5;
