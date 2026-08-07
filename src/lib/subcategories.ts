// Subcategory breakdown for each stack layer. Market caps are approximate
// (in $B) and editorial — used for bubble sizing and hover context, not
// precise accounting.

export interface Subcategory {
  name: string;
  icon: string; // lucide icon name, resolved in StackVisualization
  cap: number; // approx market cap in $B
  description: string;
}

export const SUBCATEGORIES: Record<string, Subcategory[]> = {
  "software-models": [
    { name: "Foundation Models", icon: "Bot", cap: 6500, description: "General-purpose AI models from hyperscalers and labs" },
    { name: "Developer Tools", icon: "Wrench", cap: 1200, description: "The infrastructure used to build AI applications" },
    { name: "AI Applications", icon: "AppWindow", cap: 2300, description: "Software with AI woven into the product" },
    { name: "Growth Software", icon: "TrendingUp", cap: 800, description: "High-growth names re-rating on AI adoption" },
  ],
  "data-centers": [
    { name: "Hyperscale Cloud", icon: "Server", cap: 6900, description: "The clouds where models are trained and served" },
    { name: "Colocation & REITs", icon: "Building2", cap: 600, description: "Landlords of the AI buildout" },
    { name: "Edge & CDN", icon: "Globe", cap: 300, description: "Inference moving closer to users" },
  ],
  "energy-infrastructure": [
    { name: "Utilities & Grid", icon: "Zap", cap: 200, description: "Baseload power and transmission for compute" },
    { name: "Nuclear", icon: "Atom", cap: 120, description: "Carbon-free baseload — the AI power play" },
    { name: "Gas & Builders", icon: "Flame", cap: 66, description: "Turbines and crews bridging the power gap" },
  ],
  networking: [
    { name: "Switching & Ethernet", icon: "Network", cap: 900, description: "Connecting thousands of GPUs into one computer" },
    { name: "Optical & Interconnect", icon: "Cable", cap: 300, description: "Light-speed links between racks and regions" },
    { name: "Telecom Backbone", icon: "Antenna", cap: 300, description: "The long-haul pipes underneath everything" },
  ],
  processors: [
    { name: "GPUs & Accelerators", icon: "Cpu", cap: 9000, description: "The chips the whole boom runs on" },
    { name: "Custom Silicon", icon: "CircuitBoard", cap: 1000, description: "Hyperscalers designing their own chips" },
    { name: "CPUs & Compute", icon: "Binary", cap: 400, description: "General-purpose compute around the accelerators" },
  ],
  "memory-storage": [
    { name: "High-Bandwidth Memory", icon: "MemoryStick", cap: 400, description: "HBM — the scarcest input in AI hardware" },
    { name: "Flash & SSD", icon: "HardDrive", cap: 175, description: "Feeding data to training clusters" },
  ],
  foundries: [
    { name: "Leading-Edge Fabs", icon: "Factory", cap: 1150, description: "The 3nm-and-below chokepoint" },
    { name: "Specialty Foundries", icon: "Boxes", cap: 150, description: "Mature nodes that everything else needs" },
  ],
  "semiconductor-equipment": [
    { name: "Lithography", icon: "Microscope", cap: 400, description: "EUV machines — a literal monopoly" },
    { name: "Deposition & Etch", icon: "FlaskConical", cap: 200, description: "Layer-by-layer chip construction" },
    { name: "Metrology & Test", icon: "Ruler", cap: 106, description: "Measuring what can't be seen" },
  ],
  "raw-materials": [
    { name: "Silicon & Wafers", icon: "Gem", cap: 60, description: "Ultra-pure substrates every chip starts from" },
    { name: "Rare Earths & Metals", icon: "Mountain", cap: 70, description: "The geopolitical pressure point" },
    { name: "Chemicals & Gases", icon: "TestTube", cap: 50, description: "Specialty inputs with no substitutes" },
  ],
  cybersecurity: [
    { name: "Endpoint & XDR", icon: "Shield", cap: 180, description: "Defending the machines building AI" },
    { name: "Network & Cloud Security", icon: "Lock", cap: 170, description: "Zero trust for sprawling AI workloads" },
    { name: "Identity & Access", icon: "KeyRound", cap: 100, description: "Who—and what—gets to touch the models" },
  ],
};
