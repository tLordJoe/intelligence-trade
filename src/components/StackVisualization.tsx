"use client";


import { useState } from "react";
import { layers } from "@/lib/data";
import { SUBCATEGORIES } from "@/lib/subcategories";
import {
  Bot, Wrench, AppWindow, TrendingUp, Server, Building2, Globe, Zap, Atom,
  Flame, Network, Cable, Antenna, Cpu, CircuitBoard, Binary, MemoryStick,
  HardDrive, Factory, Boxes, Microscope, FlaskConical, Ruler, Gem, Mountain,
  TestTube, Shield, Lock, KeyRound, type LucideIcon,
} from "lucide-react";


const ICONS: Record<string, LucideIcon> = {
  Bot, Wrench, AppWindow, TrendingUp, Server, Building2, Globe, Zap, Atom,
  Flame, Network, Cable, Antenna, Cpu, CircuitBoard, Binary, MemoryStick,
  HardDrive, Factory, Boxes, Microscope, FlaskConical, Ruler, Gem, Mountain,
  TestTube, Shield, Lock, KeyRound,
};


function formatMarketCap(val: number): string {
  if (val >= 1e12) return `$${(val / 1e12).toFixed(1)}T`;
  if (val >= 1e9) return `$${(val / 1e9).toFixed(0)}B`;
  return `$${(val / 1e6).toFixed(0)}M`;
}


function formatCapB(capB: number): string {
  if (capB >= 1000) return `$${(capB / 1000).toFixed(1)}T`;
  return `$${capB.toFixed(0)}B`;
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


const STACK_GRADIENTS: Record<string, string> = {
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


const SUBCATEGORY_LEADERS: Record<string, string[]> = {
  "Foundation Models": ["MSFT", "AMZN"],
  "Developer Tools": ["MSFT", "NOW"],
  "AI Applications": ["ADBE", "CRM"],
  "Growth Software": ["PLTR", "SNOW"],
  "Endpoint & XDR": ["CRWD", "S"],
  "Network & Cloud Security": ["PANW", "ZS"],
  "Identity & Access": ["PANW", "OKTA"],
  "Hyperscale Cloud": ["AMZN", "MSFT"],
  "Colocation & REITs": ["EQIX", "DLR"],
  "Edge & CDN": ["NET", "AKAM"],
  "Utilities & Grid": ["VST", "CEG"],
  Nuclear: ["CEG", "CCJ"],
  "Gas & Builders": ["GEV", "PWR"],
  "Switching & Ethernet": ["AVGO", "ANET"],
  "Optical & Interconnect": ["COHR", "LITE"],
  "Telecom Backbone": ["CSCO", "NOK"],
  "GPUs & Accelerators": ["NVDA", "AMD"],
  "Custom Silicon": ["AVGO", "GOOGL"],
  "CPUs & Compute": ["INTC", "QCOM"],
  "High-Bandwidth Memory": ["MU", "SKM"],
  "Flash & SSD": ["WDC", "STX"],
  "Leading-Edge Fabs": ["TSM", "SSNLF"],
  "Specialty Foundries": ["GFS", "UMC"],
  Lithography: ["ASML"],
  "Deposition & Etch": ["AMAT", "LRCX"],
  "Metrology & Test": ["KLAC", "TER"],
  "Silicon & Wafers": ["SUMCO", "WAFD"],
  "Rare Earths & Metals": ["MP", "ALB"],
  "Chemicals & Gases": ["LIN", "APD"],
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
  const [hoveredBubble, setHoveredBubble] = useState<string | null>(null);


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
            Bar width = market cap · bubbles = subcategories. Hover to preview,
            click to pin.
          </p>
        </div>


        <div className="space-y-2" onMouseLeave={() => onHoverLayer(null)}>
          {layers.map((layer) => {
            const cap = MARKET_CAPS[layer.slug] || 0;
            // 40% floor + proportional 60% keeps small layers legible
            const width = 40 + (cap / maxCap) * 60;
            const isFocused = focus === layer.slug;
            const isPinned = activeLayer === layer.slug;
            const subs = SUBCATEGORIES[layer.slug] || [];
            const maxSubCap = Math.max(...subs.map((s) => s.cap), 1);


            return (
              <div key={layer.slug} className="relative">
                <button
                  type="button"
                  className="stack-bar rounded-xl px-3.5 py-3 text-left w-full"
                  aria-pressed={isPinned}
                  style={{
                    width: `${width}%`,
                    background: STACK_GRADIENTS[layer.slug] ?? layer.color,
                    opacity: highlightLayer && !isFocused ? 0.62 : 1,
                    border: isPinned ? "2px solid var(--text)" : "2px solid transparent",
                    minWidth: "230px",
                    marginInline: "auto",
                  }}
                  onClick={() => onSelectLayer(layer.slug)}
                  onMouseEnter={() => onHoverLayer(layer.slug)}
                  onFocus={() => onHoverLayer(layer.slug)}
                  onBlur={() => onHoverLayer(null)}
                >
                  <span className="relative z-10 flex min-h-5 w-full items-start justify-between gap-3">
                    <span className="min-w-0 pr-2 text-white font-bold text-xs md:text-sm uppercase tracking-wide leading-tight">
                      {layer.name}
                    </span>
                    <span className="flex items-center gap-2 text-white shrink-0">
                      <span className="text-xs md:text-sm font-bold">
                      {formatMarketCap(cap)}
                      </span>
                      <span className="text-xs opacity-75">({layer.stocks.length})</span>
                    </span>
                  </span>


                  <span className="mt-2 flex min-h-7 items-center gap-1.5">
                    {subs.map((sub) => {
                      // Smaller bubbles preserve the label and keep narrow bars readable.
                      const size = 20 + (sub.cap / maxSubCap) * 10;
                      const Icon = ICONS[sub.icon] || Gem;
                      const key = `${layer.slug}:${sub.name}`;
                      const leaders = SUBCATEGORY_LEADERS[sub.name] ?? [];
                      return (
                        <span key={key} className="relative inline-flex">
                          <span
                            className="subcategory-bubble"
                            aria-label={`${sub.name}, ${formatCapB(sub.cap)} market cap. ${sub.description}`}
                            style={{
                              width: size,
                              height: size,
                              transform: hoveredBubble === key ? "scale(1.14)" : "scale(1)",
                            }}
                            onMouseEnter={() => setHoveredBubble(key)}
                            onMouseLeave={() => setHoveredBubble(null)}
                          >
                            <Icon size={size * 0.44} color="#fff" strokeWidth={2.1} />
                          </span>
                          {hoveredBubble === key && (
                            <span className="bubble-tooltip">
                              <strong><Icon size={14} strokeWidth={2.2} /> {sub.name}</strong>
                              <span className="bubble-stat"><small>Market cap</small><b>{formatCapB(sub.cap)}</b></span>
                              {leaders.length > 0 && (
                                <span className="bubble-leaders"><small>Leading names</small><b>{leaders.join("  ·  ")}</b></span>
                              )}
                            </span>
                          )}
                        </span>
                      );
                    })}
                  </span>
                </button>
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
