/**
 * Locally generated demonstration price series.
 *
 * **These are not market prices.** Nothing here is fetched, copied, scaled or
 * otherwise derived from a market-data provider. Every number is produced by
 * the seeded pseudo-random walk below, from a fixed seed and constants that
 * were invented for the purpose. Running this file on a machine with no network
 * connection produces exactly the same output as running it on one with a
 * connection, and that is the point.
 *
 * The parameters are deliberately round and deliberately wrong. `VOO` is given
 * a 9% annual drift not because a broad-market index returned 9%, but because 9
 * is a round number and a demonstration needs *some* number. Calibrating these
 * to observed market statistics would make the output a derivative of market
 * data, which is the thing this file exists to avoid.
 *
 * Two shapes in the data are intentional and load-bearing:
 *
 *   - `SOXX` starts later than the others, so the comparison has to find a
 *     start date every selected fund shares rather than letting each fund
 *     begin wherever its own history does.
 *   - `XLU` is missing a run of dates, so charting has to align observations by
 *     date key. Aligning by array position would slide every later `XLU` point
 *     onto the wrong day, and the fixture makes that failure visible.
 */

export const DEMONSTRATION_LABEL = "Demonstration data — not actual market performance.";

export const DEMO_DATASET_VERSION = 1;

/** Fixed so regenerating the fixture never produces a different file. */
const GENERATED_AT = "2026-09-05T00:00:00.000Z";
const FIRST_DATE = "2019-09-02";
const LAST_DATE = "2026-08-31";

/**
 * Invented parameters, one per symbol.
 *
 * `annualDriftPercent` and `annualVolatilityPercent` shape the walk.
 * `startPrice` is 100 for every series, which no real fund's price history
 * does, so a reader who mistakes this for market data has ignored an obvious
 * tell as well as the label on every screen.
 */
interface DemoParams {
  symbol: string;
  annualDriftPercent: number;
  annualVolatilityPercent: number;
  /** Later inception, to exercise the common-start-date rule. */
  firstDate?: string;
  /** A deliberate hole, to exercise date-key alignment. */
  gap?: { from: string; to: string; reason: string };
}

const PARAMS: DemoParams[] = [
  { symbol: "VOO", annualDriftPercent: 9, annualVolatilityPercent: 15 },
  { symbol: "QQQ", annualDriftPercent: 12, annualVolatilityPercent: 20 },
  { symbol: "XLK", annualDriftPercent: 14, annualVolatilityPercent: 22 },
  { symbol: "SMH", annualDriftPercent: 18, annualVolatilityPercent: 32 },
  {
    symbol: "XLU",
    annualDriftPercent: 4,
    annualVolatilityPercent: 12,
    gap: {
      from: "2024-03-11",
      to: "2024-03-15",
      reason: "Deliberate gap in the demonstration fixture, to exercise date alignment.",
    },
  },
  { symbol: "SOXX", annualDriftPercent: 16, annualVolatilityPercent: 30, firstDate: "2022-06-01" },
];

// --- deterministic pseudo-randomness ----------------------------------------

/** FNV-1a. Any stable string hash would do; this one is short and public domain. */
function seedFrom(text: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

/** mulberry32. Small, fast, and identical on every platform. */
function mulberry32(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Box–Muller, using two uniforms. Standard normal, mean 0, variance 1. */
function standardNormal(random: () => number): number {
  let u = random();
  while (u <= Number.EPSILON) u = random();
  const v = random();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

// --- calendar ----------------------------------------------------------------

const DAY_MS = 86_400_000;

function toIso(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

/**
 * Weekdays between two dates.
 *
 * No holiday calendar: these are invented dates for invented prices, and
 * pretending they line up with a real exchange calendar would be a claim about
 * the market that this fixture is not entitled to make.
 */
function weekdays(firstDate: string, lastDate: string): string[] {
  const out: string[] = [];
  const end = Date.parse(`${lastDate}T00:00:00Z`);
  for (let ms = Date.parse(`${firstDate}T00:00:00Z`); ms <= end; ms += DAY_MS) {
    const day = new Date(ms).getUTCDay();
    if (day !== 0 && day !== 6) out.push(toIso(ms));
  }
  return out;
}

// --- generation --------------------------------------------------------------

export interface DemoSeries {
  symbol: string;
  dates: string[];
  /** Closing values of the walk. Not prices, not quotes, not adjusted anything. */
  values: number[];
  parameters: {
    annualDriftPercent: number;
    annualVolatilityPercent: number;
    startValue: number;
    seed: number;
  };
  gaps: Array<{ from: string; to: string; reason: string }>;
}

export interface DemoDataset {
  schemaVersion: number;
  /** Repeated in the file so the label travels with the bytes, not just the UI. */
  label: string;
  disclaimer: string;
  generatedAt: string;
  generator: string;
  /** True in every dataset this generator can produce. There is no other mode. */
  synthetic: true;
  method: string;
  series: Record<string, DemoSeries>;
}

function generateSeries(params: DemoParams): DemoSeries {
  const firstDate = params.firstDate ?? FIRST_DATE;
  const seed = seedFrom(`outfox-demo-v${DEMO_DATASET_VERSION}-${params.symbol}`);
  const random = mulberry32(seed);

  const calendar = weekdays(firstDate, LAST_DATE);
  const gaps = params.gap ? [params.gap] : [];
  const dates = calendar.filter((date) => {
    if (!params.gap) return true;
    return date < params.gap.from || date > params.gap.to;
  });

  // Per-step drift and shock, from annual figures over 252 nominal steps.
  const steps = 252;
  const drift = params.annualDriftPercent / 100 / steps;
  const shock = params.annualVolatilityPercent / 100 / Math.sqrt(steps);

  const startValue = 100;
  const values: number[] = [];
  let value = startValue;

  // The walk advances on the full calendar, so a gap hides observations rather
  // than compressing the series — a fund that stops reporting for a week has
  // still moved when it comes back.
  const hidden = new Set(calendar.filter((d) => !dates.includes(d)));
  for (const date of calendar) {
    const step = drift + shock * standardNormal(random);
    value *= Math.exp(step);
    if (!hidden.has(date)) values.push(Math.round(value * 100) / 100);
  }

  return {
    symbol: params.symbol,
    dates,
    values,
    parameters: {
      annualDriftPercent: params.annualDriftPercent,
      annualVolatilityPercent: params.annualVolatilityPercent,
      startValue,
      seed,
    },
    gaps,
  };
}

export function generateDemoDataset(): DemoDataset {
  const series: Record<string, DemoSeries> = {};
  for (const params of PARAMS) {
    series[params.symbol] = generateSeries(params);
  }

  return {
    schemaVersion: DEMO_DATASET_VERSION,
    label: DEMONSTRATION_LABEL,
    disclaimer:
      "Generated locally by Outfox from a fixed seed. Not fetched, copied, or " +
      "derived from any market-data provider. Does not represent the price, " +
      "return, or performance of any real fund, and must never be presented as " +
      "historical market data or as an investment result.",
    generatedAt: GENERATED_AT,
    generator: "src/lib/funds/fixtures/generate-demo-series.ts",
    synthetic: true,
    method:
      "Geometric random walk. Per-step log change is a fixed drift plus a " +
      "standard normal shock scaled by a fixed volatility, both invented for " +
      "the demonstration rather than measured from any market. Randomness is " +
      "mulberry32 seeded by an FNV-1a hash of the symbol, so output is " +
      "identical on every run and every machine.",
    series,
  };
}
