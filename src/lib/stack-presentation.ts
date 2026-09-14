/** Shared by the full Explore stack and its homepage miniature. */
export const MARKET_CAPS: Record<string, number> = {
  "software-models": 10.8e12, "data-centers": 7.8e12, "energy-infrastructure": 386e9,
  networking: 1.5e12, processors: 10.4e12, "memory-storage": 575e9,
  foundries: 1.3e12, "semiconductor-equipment": 706e9, "raw-materials": 180e9, cybersecurity: 450e9,
};
export const STACK_GRADIENTS: Record<string, string> = {
  "software-models": "linear-gradient(120deg, #b91c1c 0%, #ef4444 100%)",
  cybersecurity: "linear-gradient(120deg, #0f766e 0%, #14b8a6 100%)",
  "data-centers": "linear-gradient(120deg, #0e7490 0%, #22b8cf 100%)",
  "energy-infrastructure": "linear-gradient(120deg, #b45309 0%, #f59e0b 100%)",
  networking: "linear-gradient(120deg, #6d28d9 0%, #8b5cf6 100%)",
  processors: "linear-gradient(120deg, #047857 0%, #10b981 100%)",
  "memory-storage": "linear-gradient(120deg, #be185d 0%, #ec4899 100%)",
  foundries: "linear-gradient(120deg, #c2410c 0%, #f97316 100%)",
  "semiconductor-equipment": "linear-gradient(120deg, #4338ca 0%, #6366f1 100%)",
  "raw-materials": "linear-gradient(120deg, #44403c 0%, #78716c 100%)",
};
export function stackWidth(slug: string) {
  return 40 + ((MARKET_CAPS[slug] ?? 0) / Math.max(...Object.values(MARKET_CAPS))) * 60;
}
