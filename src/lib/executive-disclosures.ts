export const trumpReport = {
  filer: "Donald J. Trump",
  signedDate: "2026-09-17",
  ogeReceivedDate: "2026-09-25",
  certifiedDate: "2026-10-06",
  sourceUrl: "https://www.whitehouse.gov/wp-content/uploads/2026/11/President-Donald-J.-Trump-Periodic-Transaction-Report-09.17.26.pdf",
  sha256: "2e667abb21d0d737f0860ba7ec18d5896e5974eec8895d21e451ee5718b010b2",
  indexedPages: [16, 17],
  pdfPages: 18,
} as const;

type Side = "purchase" | "sale";
type AmountBand = 0 | 1 | 2 | 3 | 4 | 5 | 6;
type SourceRow = readonly [number, string, Side, string, AmountBand, string?];
const bands = [
  [1_001, 15_000], [15_001, 50_000], [50_001, 100_000], [100_001, 250_000],
  [250_001, 500_000], [500_001, 1_000_000], [1_000_001, 5_000_000],
] as const;

// All numbered transactions on the two visually checked pages, in source order.
// Optional symbols are issuer search aliases, not source-reported share classes.
const page16: readonly SourceRow[] = [
  [463, "Boeing", "sale", "2026-08-21", 5, "BA"],
  [464, "Lennox International", "sale", "2026-08-21", 5, "LII"],
  [465, "Home Depot", "sale", "2026-08-21", 5, "HD"],
  [466, "Zoetis", "sale", "2026-08-21", 5, "ZTS"],
  [467, "T-Mobile US", "sale", "2026-08-21", 5, "TMUS"],
  [468, "Datadog", "sale", "2026-08-21", 5, "DDOG"],
  [469, "CDW", "sale", "2026-08-21", 5, "CDW"],
  [470, "TransDigm Group", "sale", "2026-08-21", 5, "TDG"],
  [471, "Dell Technologies", "sale", "2026-08-21", 5, "DELL"],
  [472, "Palo Alto Networks", "sale", "2026-08-21", 5, "PANW"],
  [473, "Nvidia", "sale", "2026-08-21", 5, "NVDA"],
  [474, "Kimberly-Clark", "sale", "2026-08-21", 5, "KMB"],
  [475, "Church & Dwight", "sale", "2026-08-21", 6, "CHD"],
  [476, "Advanced Micro Devices", "sale", "2026-08-21", 6, "AMD"],
  [477, "L3Harris Technologies", "purchase", "2026-08-17", 1, "LHX"],
  [478, "Abbott Laboratories", "purchase", "2026-08-17", 0, "ABT"],
  [479, "D.R. Horton", "purchase", "2026-08-17", 1, "DHI"],
  [480, "GE HealthCare Technologies", "purchase", "2026-08-17", 0, "GEHC"],
  [481, "Microsoft", "purchase", "2026-08-17", 5, "MSFT"],
  [482, "CME Group", "purchase", "2026-08-17", 1, "CME"],
  [483, "Lennar", "purchase", "2026-08-17", 0, "LEN"],
  [484, "Boeing", "purchase", "2026-08-17", 1, "BA"],
  [485, "Qnity Electronics", "purchase", "2026-08-17", 1],
  [486, "Vistra", "purchase", "2026-08-17", 1, "VST"],
  [487, "Zoetis", "purchase", "2026-08-17", 0, "ZTS"],
  [488, "AT&T", "purchase", "2026-08-17", 1, "T"],
  [489, "McDonald's", "purchase", "2026-08-17", 1, "MCD"],
  [490, "Lowe's", "purchase", "2026-08-17", 1, "LOW"],
  [491, "TE Connectivity", "purchase", "2026-08-17", 1, "TEL"],
  [492, "Procter & Gamble", "purchase", "2026-08-17", 1, "PG"],
  [493, "Accenture", "purchase", "2026-08-17", 1, "ACN"],
  [494, "Amazon", "purchase", "2026-08-17", 4, "AMZN"],
  [495, "Costco Wholesale", "purchase", "2026-08-17", 0, "COST"],
];

const page17: readonly SourceRow[] = [
  [496, "EQT", "purchase", "2026-08-17", 0, "EQT"],
  [497, "CBRE Group", "purchase", "2026-08-17", 1, "CBRE"],
  [498, "PepsiCo", "purchase", "2026-08-17", 1, "PEP"],
  [499, "International Business Machines", "purchase", "2026-08-17", 1, "IBM"],
  [500, "Salesforce", "purchase", "2026-08-17", 1, "CRM"],
  [501, "Walt Disney", "purchase", "2026-08-17", 1, "DIS"],
  [502, "ServiceNow", "purchase", "2026-08-17", 1, "NOW"],
  [503, "CRH", "purchase", "2026-08-17", 1, "CRH"],
  [504, "Kroger", "purchase", "2026-08-17", 0, "KR"],
  [505, "Oracle", "purchase", "2026-08-17", 1, "ORCL"],
  [506, "Palantir Technologies", "purchase", "2026-08-17", 2, "PLTR"],
  [507, "Meta Platforms", "purchase", "2026-08-17", 3, "META"],
  [508, "Nvidia", "purchase", "2026-08-17", 5, "NVDA"],
  [509, "Uber Technologies", "purchase", "2026-08-17", 1, "UBER"],
  [510, "Alphabet", "purchase", "2026-08-17", 3, "GOOG GOOGL Google"],
  [511, "Alphabet", "purchase", "2026-08-17", 3, "GOOG GOOGL Google"],
  [512, "Comcast", "purchase", "2026-08-17", 1, "CMCSA"],
  [513, "Boston Scientific", "purchase", "2026-08-17", 1, "BSX"],
  [514, "Netflix", "purchase", "2026-08-17", 2, "NFLX"],
  [515, "Stryker", "purchase", "2026-08-17", 1, "SYK"],
  [516, "iShares Russell 1000 ETF", "sale", "2026-08-17", 6, "IWB"],
  [517, "Space Exploration Technologies senior unsecured notes, 5.350%, due July 15, 2031", "purchase", "2026-08-18", 6, "SpaceX"],
];

export const executiveRows = ([[16, page16], [17, page17]] as const).flatMap(
  ([page, rows]) => rows.map(([line, name, side, tradedAt, band, aliases]) => ({
    line, page, name, side, tradedAt, aliases: aliases ?? "",
    amountLow: bands[band][0], amountHigh: bands[band][1],
    sourceUrl: `${trumpReport.sourceUrl}#page=${page}`,
  })),
);

type Params = Record<string, string | string[] | undefined>;
const first = (value: Params[string]) => (Array.isArray(value) ? value[0] : value) ?? "";
const normalize = (value: string) => value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
const pageSize = 15;

export function queryExecutiveRows(params: Params) {
  const q = first(params.q).trim().slice(0, 100);
  const requestedSide = first(params.side);
  const side = requestedSide === "purchase" || requestedSide === "sale" ? requestedSide : "all";
  const terms = normalize(q).split(" ").filter(Boolean);
  const matches = executiveRows.filter((row) => {
    if (side !== "all" && row.side !== side) return false;
    const name = normalize(row.name);
    const aliases = normalize(row.aliases).split(" ");
    return terms.every((term) => name.includes(term) || aliases.includes(term));
  }).sort((a, b) => b.tradedAt.localeCompare(a.tradedAt) || a.line - b.line);
  const pageCount = Math.max(1, Math.ceil(matches.length / pageSize));
  const rawPage = first(params.page);
  const page = /^\d+$/.test(rawPage) ? Math.min(pageCount, Math.max(1, Number(rawPage))) : 1;
  return { q, side, page, pageCount, total: matches.length, rows: matches.slice((page - 1) * pageSize, page * pageSize) };
}
