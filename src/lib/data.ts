export interface Stock {
  ticker: string;
  name: string;
  description: string;
  country: string;
  price?: number;
  change?: number;
}

export interface Layer {
  slug: string;
  name: string;
  description: string;
  keyInsight: string;
  emojis: string[];
  color: string;
  stocks: Stock[];
}

const layerDefinitions: Layer[] = [
  {
    slug: "software-models",
    name: "Software & Models",
    description: "Foundation models, AI platforms, and enterprise software",
    keyInsight:
      "Model developers and software platforms compete through model quality, distribution, proprietary data, developer ecosystems, and the cost of serving users.",
    emojis: ["🤖", "🛠️", "📱", "🚀"],
    color: "#EF4444",
    stocks: [
      { ticker: "MSFT", name: "Microsoft", description: "Azure AI, OpenAI partnership, Copilot", country: "US" },
      { ticker: "GOOGL", name: "Alphabet", description: "Gemini, DeepMind, Google Cloud AI", country: "US" },
      { ticker: "META", name: "Meta Platforms", description: "LLaMA open-source models, AI-powered ads", country: "US" },
      { ticker: "AMZN", name: "Amazon", description: "AWS Bedrock, Anthropic investment, Trainium", country: "US" },
      { ticker: "CRM", name: "Salesforce", description: "Einstein AI, Agentforce platform", country: "US" },
      { ticker: "ORCL", name: "Oracle", description: "OCI AI services, database AI integration", country: "US" },
      { ticker: "NOW", name: "ServiceNow", description: "Now Assist AI, workflow automation", country: "US" },
      { ticker: "SNOW", name: "Snowflake", description: "Cortex AI, data cloud for LLMs", country: "US" },
      { ticker: "PLTR", name: "Palantir", description: "AIP platform, government & enterprise AI", country: "US" },
      { ticker: "AI", name: "C3.ai", description: "Enterprise AI applications platform", country: "US" },
      { ticker: "PATH", name: "UiPath", description: "AI-powered robotic process automation", country: "US" },
      { ticker: "DDOG", name: "Datadog", description: "AI observability and monitoring", country: "US" },
      { ticker: "MDB", name: "MongoDB", description: "Vector search for AI applications", country: "US" },
      { ticker: "ADBE", name: "Adobe", description: "Firefly generative AI, creative tools", country: "US" },
      { ticker: "SAP", name: "SAP", description: "Joule AI copilot, enterprise AI", country: "DE" },
    ],
  },
  {
    slug: "data-centers",
    name: "Data Centers",
    description: "Hyperscale facilities and colocation for AI workloads",
    keyInsight:
      "Dense AI computing is increasing demand for power, cooling, land, and high-speed connectivity—making data-center capacity a key constraint on deployment.",
    emojis: ["🏢", "🖥️", "⚡"],
    color: "#3B82F6",
    stocks: [
      { ticker: "EQIX", name: "Equinix", description: "Global data center REIT, 260+ facilities", country: "US" },
      { ticker: "DLR", name: "Digital Realty", description: "Data center colocation and interconnection", country: "US" },
      { ticker: "AMT", name: "American Tower", description: "Data center and cell tower infrastructure", country: "US" },
      { ticker: "GDS", name: "GDS Holdings", description: "China's leading data center operator", country: "CN" },
      { ticker: "VNET", name: "VNET Group", description: "Carrier-neutral data centers in China", country: "CN" },
      { ticker: "VRT", name: "Vertiv", description: "Data center cooling and power management", country: "US" },
    ],
  },
  {
    slug: "energy-infrastructure",
    name: "Energy Infrastructure",
    description: "Power generation and grid infrastructure for AI compute",
    keyInsight:
      "AI data centers need large amounts of dependable electricity, creating opportunities and constraints across generation, transmission, grid equipment, and construction.",
    emojis: ["⚡", "☢️", "🔋", "🌊"],
    color: "#F59E0B",
    stocks: [
      { ticker: "VST", name: "Vistra", description: "Nuclear + natural gas power for data centers", country: "US" },
      { ticker: "CEG", name: "Constellation Energy", description: "Largest US nuclear fleet, Microsoft deal", country: "US" },
      { ticker: "NRG", name: "NRG Energy", description: "Power generation for hyperscale compute", country: "US" },
      { ticker: "ETR", name: "Entergy", description: "Nuclear power and grid infrastructure", country: "US" },
      { ticker: "FSLR", name: "First Solar", description: "Utility-scale solar for data centers", country: "US" },
      { ticker: "GEV", name: "GE Vernova", description: "Gas turbines and grid equipment", country: "US" },
      { ticker: "PWR", name: "Quanta Services", description: "Grid construction and electrical infrastructure", country: "US" },
      { ticker: "EMR", name: "Emerson Electric", description: "Power management and automation", country: "US" },
    ],
  },
  {
    slug: "networking",
    name: "Networking",
    description: "High-speed interconnects, switches, and optical networking",
    keyInsight:
      "Large AI clusters depend on low-latency, high-bandwidth connections between accelerators, making switching, optical links, and interconnect design essential to system performance.",
    emojis: ["🌐", "📡", "🔗"],
    color: "#8B5CF6",
    stocks: [
      { ticker: "CSCO", name: "Cisco Systems", description: "Enterprise networking, Silicon One", country: "US" },
      { ticker: "ANET", name: "Arista Networks", description: "AI data center switches, 800G Ethernet", country: "US" },
      { ticker: "LITE", name: "Lumentum", description: "Optical transceivers for AI networking", country: "US" },
      { ticker: "COHR", name: "Coherent", description: "800G optical transceivers, datacom lasers", country: "US" },
      { ticker: "CIEN", name: "Ciena", description: "Optical networking platforms", country: "US" },
      { ticker: "CALX", name: "Calix", description: "Cloud networking platforms", country: "US" },
      { ticker: "HPE", name: "Hewlett Packard Enterprise", description: "AI networking and compute", country: "US" },
    ],
  },
  {
    slug: "processors",
    name: "Processors",
    description: "GPUs, TPUs, AI accelerators — the engines of intelligence",
    keyInsight:
      "Accelerator competition depends on more than chip specifications: software ecosystems, developer adoption, networking, supply, and total operating cost all shape demand.",
    emojis: ["🧠", "⚙️", "💻"],
    color: "#10B981",
    stocks: [
      { ticker: "NVDA", name: "NVIDIA", description: "AI accelerators, CUDA software, and high-speed networking", country: "US" },
      { ticker: "AMD", name: "AMD", description: "MI series GPUs, ROCm ecosystem", country: "US" },
      { ticker: "AVGO", name: "Broadcom", description: "Custom AI silicon for hyperscalers", country: "US" },
      { ticker: "QCOM", name: "Qualcomm", description: "Edge AI and mobile inference", country: "US" },
      { ticker: "ARM", name: "ARM Holdings", description: "Chip architecture licensing", country: "UK" },
      { ticker: "INTC", name: "Intel", description: "Gaudi AI accelerators, x86 processors", country: "US" },
      { ticker: "MRVL", name: "Marvell Technology", description: "Custom AI accelerators", country: "US" },
      { ticker: "SMCI", name: "Super Micro Computer", description: "AI server systems and GPU platforms", country: "US" },
      { ticker: "GOOG", name: "Google (TPU)", description: "TPU custom silicon for AI training", country: "US" },
    ],
  },
  {
    slug: "memory-storage",
    name: "Memory & Storage",
    description: "HBM, DRAM, NAND — feeding data to AI accelerators",
    keyInsight:
      "High-bandwidth memory and fast storage feed data to accelerators; packaging capacity, product qualification, and manufacturing yields can constrain supply.",
    emojis: ["🧠", "💾"],
    color: "#EC4899",
    stocks: [
      { ticker: "MU", name: "Micron Technology", description: "HBM3E, DRAM, and NAND for AI", country: "US" },
      { ticker: "WDC", name: "Western Digital", description: "Enterprise SSDs for AI storage", country: "US" },
      { ticker: "STX", name: "Seagate Technology", description: "Mass storage for AI data lakes", country: "US" },
      { ticker: "NTAP", name: "NetApp", description: "AI data management and storage", country: "US" },
      { ticker: "PSTG", name: "Everpure (formerly Pure Storage)", description: "All-flash storage for AI workloads", country: "US" },
      { ticker: "TXN", name: "Texas Instruments", description: "Analog chips and embedded processing", country: "US" },
      { ticker: "SWKS", name: "Skyworks Solutions", description: "Analog semiconductors", country: "US" },
    ],
  },
  {
    slug: "foundries",
    name: "Foundries",
    description: "Semiconductor manufacturing — the factories of intelligence",
    keyInsight:
      "Leading-edge chip manufacturing requires scarce technical expertise, specialized equipment, large capital commitments, and years of coordinated capacity planning.",
    emojis: ["🏭", "🔧", "⚗️"],
    color: "#F97316",
    stocks: [
      { ticker: "TSM", name: "TSMC", description: "Leading-edge contract chip manufacturing for major designers", country: "TW" },
      { ticker: "INTC", name: "Intel Foundry", description: "IDM 2.0 strategy, US chip manufacturing", country: "US" },
      { ticker: "UMC", name: "United Microelectronics", description: "Mature node foundry services", country: "TW" },
      { ticker: "GFS", name: "GlobalFoundries", description: "Specialty and mature node chips", country: "US" },
      { ticker: "SSNLF", name: "Samsung Electronics", description: "Memory and logic foundry", country: "KR" },
    ],
  },
  {
    slug: "semiconductor-equipment",
    name: "Semiconductor Equipment",
    description: "The machines that make the machines that make chips",
    keyInsight:
      "Advanced chip production depends on a small group of specialized equipment suppliers across lithography, deposition, etch, inspection, and testing.",
    emojis: ["🧪", "🔬", "⚗️"],
    color: "#6366F1",
    stocks: [
      { ticker: "ASML", name: "ASML", description: "Lithography systems used in advanced semiconductor manufacturing", country: "NL" },
      { ticker: "AMAT", name: "Applied Materials", description: "Deposition, etch, and inspection equipment", country: "US" },
      { ticker: "LRCX", name: "Lam Research", description: "Etch and deposition for advanced nodes", country: "US" },
      { ticker: "KLAC", name: "KLA Corporation", description: "Semiconductor inspection and metrology", country: "US" },
      { ticker: "TER", name: "Teradyne", description: "Semiconductor test equipment", country: "US" },
      { ticker: "ONTO", name: "Onto Innovation", description: "Process control for chipmaking", country: "US" },
      { ticker: "CAMT", name: "Camtek", description: "Inspection and metrology systems", country: "IL" },
    ],
  },
  {
    slug: "raw-materials",
    name: "Raw Materials",
    description: "Silicon, rare earths, and critical minerals for chip manufacturing",
    keyInsight:
      "Semiconductor and electrical supply chains depend on geographically concentrated minerals, refined materials, chemicals, and gases that can be exposed to trade restrictions.",
    emojis: ["🔶", "☢️", "⬜", "💎"],
    color: "#78716C",
    stocks: [
      { ticker: "ALB", name: "Albemarle", description: "Lithium and specialty chemicals", country: "US" },
      { ticker: "MP", name: "MP Materials", description: "US rare earth mining and processing", country: "US" },
      { ticker: "SQM", name: "Sociedad Química y Minera", description: "Lithium and specialty chemicals", country: "CL" },
      { ticker: "FCX", name: "Freeport-McMoRan", description: "Copper for electrical infrastructure", country: "US" },
      { ticker: "NEM", name: "Newmont", description: "Gold and copper mining", country: "US" },
      { ticker: "VALE", name: "Vale", description: "Iron ore and nickel for electronics", country: "BR" },
      { ticker: "BHP", name: "BHP Group", description: "Diversified mining, copper focus", country: "AU" },
      { ticker: "RIO", name: "Rio Tinto", description: "Aluminum and copper for semiconductors", country: "AU" },
      { ticker: "SCCO", name: "Southern Copper", description: "Copper mining for electrical use", country: "MX" },
      { ticker: "TECK", name: "Teck Resources", description: "Copper and zinc mining", country: "CA" },
      { ticker: "AA", name: "Alcoa", description: "Aluminum production", country: "US" },
    ],
  },
  {
    slug: "cybersecurity",
    name: "Cybersecurity",
    description: "Protecting AI infrastructure, data, and models from adversaries",
    keyInsight:
      "AI expands both defensive capabilities and attack surfaces, increasing the importance of identity, endpoint, network, cloud, application, data, and model security.",
    emojis: ["🛡️", "🔒", "🔑", "🕵️"],
    color: "#DC2626",
    stocks: [
      { ticker: "CRWD", name: "CrowdStrike", description: "AI-native endpoint security, Falcon platform", country: "US" },
      { ticker: "PANW", name: "Palo Alto Networks", description: "AI-powered security, Cortex XSIAM, and CyberArk identity security", country: "US" },
      { ticker: "ZS", name: "Zscaler", description: "Zero trust cloud security for AI workloads", country: "US" },
      { ticker: "FTNT", name: "Fortinet", description: "AI-driven firewalls and threat detection", country: "US" },
      { ticker: "S", name: "SentinelOne", description: "Autonomous AI-powered threat response", country: "US" },
      { ticker: "NET", name: "Cloudflare", description: "Edge security, DDoS protection for AI APIs", country: "US" },
      { ticker: "OKTA", name: "Okta", description: "Identity and access management", country: "US" },
      { ticker: "VRNS", name: "Varonis Systems", description: "Data security and AI threat detection", country: "US" },
      { ticker: "QLYS", name: "Qualys", description: "Cloud security and vulnerability management", country: "US" },
    ],
  },
];

// The stack reads from the customer-facing application layer down to its inputs.
// Cybersecurity belongs near software because it protects every layer below it,
// but it uses the same visual treatment as the others to avoid implying a rating.
const layerOrder = [
  "software-models",
  "cybersecurity",
  "data-centers",
  "energy-infrastructure",
  "networking",
  "processors",
  "memory-storage",
  "foundries",
  "semiconductor-equipment",
  "raw-materials",
];

export const layers: Layer[] = layerOrder.map((slug) => {
  const layer = layerDefinitions.find((item) => item.slug === slug);
  if (!layer) throw new Error(`Missing layer definition: ${slug}`);
  return layer;
});

export function getAllTickers(): string[] {
  const seen = new Set<string>();
  const tickers: string[] = [];
  for (const layer of layers) {
    for (const stock of layer.stocks) {
      if (!seen.has(stock.ticker)) {
        seen.add(stock.ticker);
        tickers.push(stock.ticker);
      }
    }
  }
  return tickers;
}

export function getLayerBySlug(slug: string): Layer | undefined {
  return layers.find((l) => l.slug === slug);
}
