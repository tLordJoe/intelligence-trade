"use client";

import { layers } from "@/lib/data";

function formatMarketCap(val: number): string {
  if (val >= 1e12) return `$${(val / 1e12).toFixed(1)}T`;
  if (val >= 1e9) return `$${(val / 1e9).toFixed(0)}B`;
  return `$${(val / 1e6).toFixed(0)}M`;
}

const MARKET_CAPS: Record<string, number> = {
  "software-models": 10.8e12,
  "data-centers": 7.8e12,
  "energy-infrastructure": 386e9,
  networking: 1.5e12,
  processors: 10.4e12,
  "memory-storage": 575e9,
  foundries: 1.3e12,
  "semiconductor-equipment": 706e9,
  "raw-materials": 180e9,
  cybersecurity: 450e9,
};

// What each subcategory icon means, for hover tooltips
const EMOJI_LABELS: Record<string, string> = {
  "🤖": "AI models & agents",
  "🛠️": "Developer tools",
  "📱": "Consumer applications",
  "🚀": "High-growth software",
  "🏢": "Hyperscale data centers",
  "🖥️": "Colocation & hosting",
  "⚡": "Power & grid",
  "☢️": "Nuclear energy",
  "🔋": "Batteries & storage",
  "🌊": "Cooling & hydro",
  "🌐": "Internet backbone",
  "📡": "Optical & telecom",
  "🔗": "Interconnects",
  "🧠": "Accelerators & memory chips",
  "⚙️": "Custom silicon",
  "💻": "CPUs & compute",
  "💾": "Storage",
  "🏭": "Fabrication plants",
  "🔧": "Fab equipment",
  "⚗️": "Process chemicals",
  "🧪": "Specialty chemicals",
  "🔬": "Lithography & metrology",
  "🔶": "Silicon & substrates",
  "⬜": "Wafers",
  "💎": "Rare materials",
  "🛡️": "Endpoint security",
  "🔒": "Zero trust & encryption",
  "🔑": "Identity & access",
  "🕵️": "Threat intelligence",
};

interface Props {
  activeLayer: string | null;
  highlightLayer: string | null;
  onSelectLayer: (slug: string) => void;
  onHoverLayer: (slug: string | null) => void;
}

export default function StackVisualization({
  activeLayer,
  highlightLayer,
  onSelectLayer,
  onHoverLayer,
}: Props) {
  const maxCap = Math.max(...Object.values(MARKET_CAPS));
  const focus = highlightLayer ?? activeLayer;

  return (
    <section className="px-4 md:px-8 py-8">
      <div
        className="rounded-lg border p-4 md:p-6"
        style={{ backgroundColor: "var(--bg-card)", borderColor: "var(--border)" }}
      >
        <div className="mb-6">
          <div className="kicker mb-1">The AI Stack</div>
          <h2 className="text-xl font-bold" style={{ color: "var(--text)" }}>
            Ten layers, one supply chain
          </h2>
          <p className="text-xs mt-1" style={{ color: "var(--text-dim)" }}>
            Bar width = total market cap. Hover to preview a layer, click to pin it.
          </p>
        </div>

        <div className="space-y-2" onMouseLeave={() => onHoverLayer(null)}>
          {layers.map((layer) => {
            const cap = MARKET_CAPS[layer.slug] || 0;
            const width = Math.max((cap / maxCap) * 100, 8);
            const isFocused = focus === layer.slug;
            const isPinned = activeLayer === layer.slug;
            const isHovered = highlightLayer === layer.slug;

            return (
              <div key={layer.slug} className="relative">
                <button
                  type="button"
                  className="stack-bar rounded-md px-3 py-2.5 flex items-center justify-between text-left"
                  style={{
                    width: `${width}%`,
                    backgroundColor: layer.color,
                    opacity: focus && !isFocused ? 0.35 : 1,
                    border: isPinned ? "2px solid var(--text)" : "2px solid transparent",
                    minWidth: "200px",
                  }}
                  onClick={() => onSelectLayer(layer.slug)}
                  onMouseEnter={() => onHoverLayer(layer.slug)}
                  onFocus={() => onHoverLayer(layer.slug)}
                  onBlur={() => onHoverLayer(null)}
                >
                  <span className="flex items-center gap-2 min-w-0">
                    <span className="text-white font-semibold text-xs md:text-sm uppercase tracking-wide truncate">
                      {layer.name}
                    </span>
                    <span
                      className="items-center gap-1 shrink-0"
                      style={{ display: width > 45 ? "flex" : "none" }}
                    >
                      {layer.emojis.map((e, i) => (
                        <span
                          key={i}
                          title={EMOJI_LABELS[e] || e}
                          className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] leading-none"
                          style={{ backgroundColor: "rgba(255,255,255,0.35)" }}
                        >
                          {e}
                        </span>
                      ))}
                    </span>
                  </span>
                  <span className="flex items-center gap-2 text-white shrink-0">
                    <span className="text-xs md:text-sm font-bold">
                      {formatMarketCap(cap)}
                    </span>
                    <span className="text-xs opacity-70">({layer.stocks.length})</span>
                  </span>
                </button>

                {isHovered && (
                  <div
                    className="fade-in hidden md:block absolute z-20 rounded-lg border p-3 pointer-events-none"
                    style={{
                      left: `${Math.min(width + 2, 55)}%`,
                      top: "50%",
                      transform: "translateY(-50%)",
                      width: "270px",
                      backgroundColor: "var(--bg-card)",
                      borderColor: "var(--border)",
                      boxShadow: "0 8px 24px rgb(16 24 40 / 16%)",
                    }}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <span className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ backgroundColor: layer.color }} />
                      <span className="text-xs font-bold" style={{ color: "var(--text)" }}>
                        {layer.name}
                      </span>
                    </div>
                    <p className="text-[11px] leading-relaxed mb-1.5" style={{ color: "var(--text-dim)" }}>
                      {layer.description}
                    </p>
                    <div className="text-[10px] font-semibold" style={{ color: "var(--accent)" }}>
                      {formatMarketCap(cap)} across {layer.stocks.length} companies · Click to pin
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <div className="mt-4 text-xs" style={{ color: "var(--text-dim)" }}>
          Market caps are approximate sums of tracked companies per layer.
        </div>
      </div>
    </section>
  );
}
