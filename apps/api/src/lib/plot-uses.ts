/** Plot use types for the land ledger + map. Keep ids stable; labels live in i18n. */

export const PLOT_USES = [
  { id: "yard", color: "#6b4a2e" },
  { id: "garden", color: "#3d8c4a" },
  { id: "orchard", color: "#2e6b3c" },
  { id: "vineyard", color: "#6b3d5a" },
  { id: "hay", color: "#d4a017" },
  { id: "pasture", color: "#6b8f3d" },
  { id: "arable", color: "#8a6a3d" },
  { id: "greenhouse", color: "#4a8a8a" },
  { id: "polytunnel", color: "#5a9a8a" },
  { id: "nursery", color: "#5c8c4a" },
  { id: "botanic", color: "#2f6f5e" },
  { id: "research", color: "#4a6b8a" },
  { id: "herbs", color: "#7a9a4a" },
  { id: "berries", color: "#8a3d5a" },
  { id: "hops", color: "#6a8a3d" },
  { id: "forest", color: "#2d4a32" },
  { id: "pond", color: "#005288" },
  { id: "equipment", color: "#8a8a96" },
  { id: "bees", color: "#c4a035" },
  { id: "livestock", color: "#8a5a3a" },
  { id: "compost", color: "#5a4030" },
  { id: "fallow", color: "#8a8070" },
  { id: "other", color: "#5a5a5a" },
] as const;

export type PlotUseId = (typeof PLOT_USES)[number]["id"];

export function plotUseColor(use: string | null | undefined): string {
  const hit = PLOT_USES.find((u) => u.id === use);
  return hit?.color ?? "#6b4a2e";
}

export function plotUseOptionsHtml(selected?: string | null): string {
  return PLOT_USES.map((u) => {
    const sel = u.id === selected ? " selected" : "";
    return `<option value="${u.id}"${sel} data-i18n="plot_use_${u.id}">${u.id}</option>`;
  }).join("");
}
