export interface BlogPost {
  slug: string;
  title: string;
  excerpt: string;
  category: string;
  date: string;
  readTime: string;
  tags: string[];
  content: string;
}

export const blogPosts: BlogPost[] = [
  {
    slug: "ai-supply-chain-explained",
    title: "The AI Supply Chain Explained: From Sand to Superintelligence",
    excerpt: "A complete breakdown of the 10 layers that make artificial intelligence possible — and who controls each one.",
    category: "Guide",
    date: "2026-08-05",
    readTime: "12 min",
    tags: ["AI", "Supply Chain", "Infrastructure", "Investing"],
    content: `The AI revolution isn't just about software. Behind every ChatGPT response, every autonomous vehicle decision, and every AI-generated image lies a vast physical supply chain that stretches from mines in the Congo to fabs in Taiwan to data centers in Virginia.

## The 10 Layers of AI Infrastructure

### 1. Raw Materials
Everything starts with sand — specifically, ultra-pure silicon. But the AI supply chain also depends on rare earth elements, gallium, germanium, copper, and lithium. China controls 60% of rare earth processing, making this layer a geopolitical chokepoint.

### 2. Semiconductor Equipment
Only a handful of companies make the machines that make chips. ASML holds a monopoly on EUV lithography — each machine costs $380M and weighs 180 tons. Without ASML, advanced chips cannot be manufactured.

### 3. Foundries
TSMC fabricates over 90% of the world's most advanced chips. A single leading-edge fab costs $20B+ and takes 3 years to build. This is the most concentrated chokepoint in the entire AI supply chain.

### 4. Processors
NVIDIA controls 94% of the AI accelerator market through its GPU + CUDA ecosystem. AMD and custom silicon from Google (TPU) and Amazon (Trainium) are attempting to break this dominance.

### 5. Memory & Storage
AI training requires massive amounts of high-bandwidth memory (HBM). SK Hynix holds 50%+ of the HBM3E market, with Micron and Samsung competing for the rest.

### 6. Networking
AI clusters connect thousands of GPUs through 400G/800G networking. Arista Networks and Broadcom dominate this layer, with InfiniBand and custom Ethernet competing for supremacy.

### 7. Energy Infrastructure
A single AI data center can consume 100MW — enough to power 80,000 homes. Nuclear and natural gas are the only baseload sources that can scale to meet demand.

### 8. Data Centers
Hyperscale data centers are the factories of the AI age. Companies like Equinix and Digital Realty provide the physical infrastructure where AI models are trained and served.

### 9. Software & Models
The model layer captures the most value but has the thinnest moats. OpenAI, Google, Meta, and Anthropic are in an arms race, while enterprise software companies race to integrate AI into their products.

### 10. Cybersecurity
As AI infrastructure grows, so does the attack surface. CrowdStrike, Palo Alto Networks, and Zscaler protect the data, models, and infrastructure that make AI possible.

## Why This Matters for Investors

Understanding the AI supply chain gives you an edge that most investors lack. While the market focuses on headline names like NVIDIA and Microsoft, the real alpha is in understanding bottlenecks, dependencies, and concentration risks across all 10 layers.`,
  },
  {
    slug: "nvidia-cuda-moat",
    title: "NVIDIA's CUDA Moat: Why 94% Market Share Isn't Going Away",
    excerpt: "The technical reasons NVIDIA's dominance in AI accelerators is more durable than most investors realize.",
    category: "Deep Dive",
    date: "2026-07-28",
    readTime: "10 min",
    tags: ["NVIDIA", "CUDA", "GPUs", "Processors"],
    content: `NVIDIA's 94% share of the AI accelerator market isn't just about having the best hardware. It's about a 20-year software ecosystem that competitors cannot replicate overnight.

## What is CUDA?

CUDA (Compute Unified Device Architecture) is NVIDIA's parallel computing platform. Launched in 2006, it allows developers to use NVIDIA GPUs for general-purpose computing. Today, virtually every AI framework — PyTorch, TensorFlow, JAX — is built on CUDA.

## The Ecosystem Lock-In

CUDA isn't just a library. It's an entire ecosystem:

- **cuDNN**: Optimized primitives for deep learning
- **TensorRT**: Inference optimization engine
- **NCCL**: Multi-GPU communication library
- **Triton Inference Server**: Production deployment platform

Rewriting code from CUDA to AMD's ROCm or Intel's oneAPI isn't just a port — it's a re-architecture of the entire training and inference pipeline.

## The Competitive Response

AMD's ROCm is improving but remains 2-3 years behind CUDA in ecosystem maturity. Google's TPUs are competitive for training but limited to Google Cloud. Custom silicon from Amazon (Trainium) and Microsoft (Maia) targets specific workloads.

## Investment Implications

NVIDIA's moat is software, not hardware. As long as CUDA remains the default development platform, NVIDIA can command premium pricing. The risk isn't a better chip — it's a paradigm shift that makes CUDA irrelevant.`,
  },
  {
    slug: "cybersecurity-ai-infrastructure",
    title: "The $500B Problem: Securing AI Infrastructure",
    excerpt: "Why cybersecurity is the most underappreciated layer of the AI supply chain — and which companies are positioned to benefit.",
    category: "Sector Analysis",
    date: "2026-07-22",
    readTime: "9 min",
    tags: ["Cybersecurity", "AI Security", "CrowdStrike", "Palo Alto Networks"],
    content: `As AI infrastructure scales, the attack surface grows exponentially. The cybersecurity market is projected to reach $500B by 2030, driven by three factors unique to the AI era.

## AI Creates New Attack Vectors

1. **Model poisoning**: Corrupting training data to compromise model outputs
2. **Prompt injection**: Manipulating AI systems through crafted inputs
3. **Data exfiltration**: Stealing proprietary training data worth billions
4. **Infrastructure attacks**: Targeting the GPU clusters and data centers that power AI

## The Key Players

### CrowdStrike (CRWD)
AI-native endpoint security with the Falcon platform. Their advantage: they've been using AI for threat detection since before it was trendy.

### Palo Alto Networks (PANW)
Cortex XSIAM uses AI to automate SOC operations. Their platform approach — network, cloud, and endpoint security — aligns perfectly with protecting AI infrastructure.

### Zscaler (ZS)
Zero trust architecture is essential for securing AI workloads that span multiple clouds and data centers.

### Cloudflare (NET)
Protecting AI APIs at the edge. As AI inference moves closer to users, Cloudflare's network becomes critical infrastructure.

## Investment Thesis

Cybersecurity spending grows as a percentage of total IT spending during threat escalation periods. With AI creating entirely new attack categories, we're entering a sustained growth cycle for security companies.`,
  },
  {
    slug: "energy-bottleneck-ai",
    title: "The Energy Bottleneck: Why Power Is the Real Constraint on AI Growth",
    excerpt: "AI data centers need 10x more power than traditional compute. Nuclear and natural gas are the only solutions at scale.",
    category: "Analysis",
    date: "2026-07-15",
    readTime: "7 min",
    tags: ["Energy", "Nuclear", "Data Centers", "Infrastructure"],
    content: `The AI industry's dirtiest secret: there isn't enough electricity to power the future of artificial intelligence. Not even close.

## The Scale of the Problem

A single NVIDIA H100 GPU consumes 700W. A training cluster with 10,000 GPUs needs 7MW just for the chips — add cooling and networking and you're at 15-20MW per cluster. A hyperscale AI data center needs 100-500MW.

For context, 500MW is enough to power a city of 400,000 people.

## Why Renewables Aren't Enough

Solar and wind are intermittent. AI training runs 24/7 for weeks or months. You can't pause a $100M training run because the wind stopped. AI needs baseload power — consistent, reliable, always-on electricity.

## The Nuclear Renaissance

Constellation Energy's deal with Microsoft to restart Three Mile Island is the canary in the coal mine. Nuclear provides carbon-free baseload power, and the AI industry is willing to pay premium prices for it.

Key beneficiaries: Constellation Energy (CEG), Vistra (VST), and NRG Energy (NRG).

## Natural Gas Bridge

While new nuclear takes 10+ years to build, natural gas is the immediate solution. GE Vernova (GEV) and Quanta Services (PWR) are building the gas turbines and grid infrastructure needed today.

## Investment Implications

Energy infrastructure companies are trading at a fraction of AI software valuations, despite being the fundamental bottleneck. This is the most underappreciated layer of the AI supply chain.`,
  },
];

export function getBlogPost(slug: string): BlogPost | undefined {
  return blogPosts.find((p) => p.slug === slug);
}
