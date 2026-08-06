#!/usr/bin/env node
// Scrapes House STOCK Act periodic transaction reports (PTRs) from the
// official Clerk of the House disclosure site and writes structured JSON.
// Usage: node scripts/scrape-congress.mjs [--limit N]
import { writeFileSync, mkdirSync, existsSync, readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { PDFParse } from "pdf-parse";

const __dirname = dirname(fileURLToPath(import.meta.url));
const YEAR = new Date().getFullYear();
const XML_URL = `https://disclosures-clerk.house.gov/public_disc/financial-pdfs/${YEAR}FD.xml`;
const PDF_BASE = `https://disclosures-clerk.house.gov/public_disc/ptr-pdfs/${YEAR}/`;
const OUT_PATH = join(__dirname, "..", "src", "lib", "congress-live.json");
const CACHE_DIR = join(__dirname, ".cache", "ptr-pdfs");

const LIMIT = parseInt(
  process.argv.includes("--limit")
    ? process.argv[process.argv.indexOf("--limit") + 1]
    : "40",
  10
);

// Party affiliation for House members (119th Congress) who actively trade.
// Extend as new filers appear — unknown members default to null and are kept.
const PARTY_MAP = {
  "Nancy Pelosi": "D",
  "April McClain Delaney": "D",
  "Cleo Fields": "D",
  "Dan Newhouse": "R",
  "Daniel Crenshaw": "R",
  "Debbie Dingell": "D",
  "James A. Himes": "D",
  "Jared Moskowitz": "D",
  "Julie Johnson": "D",
  "Kelly Louise Morrison": "D",
  "Kevin Hern": "R",
  "Laurel Lee": "R",
  "Lloyd Doggett": "D",
  "Pete Sessions": "R",
  "Richard W. Allen": "R",
  "Robert E. Latta": "R",
  "Sam T. Liccardo": "D",
  "Lisa McClain": "R",
  "Donald Sternoff Beyer": "D",
  "Sheri Biggs": "R",
  "Adrian Smith": "R",
  "Max Miller": "R",
  "William R. Timmons": "R",
  "Mark Alford": "R",
  "Michael McCaul": "R",
  "Josh Gottheimer": "D",
  "Ro Khanna": "D",
  "Marjorie Taylor Greene": "R",
  "Tommy Tuberville": "R",
  "Markwayne Mullin": "R",
  "Pete Ricketts": "R",
  "Shelley Moore Capito": "R",
  "Mark Warner": "D",
  "Byron Donalds": "R",
  "Jonathan Jackson": "D",
  "Thomas H. Kean": "R",
  "Debbie Wasserman Schultz": "D",
  "Rick Larsen": "D",
  "Virginia Foxx": "R",
  "Robert J. Wittman": "R",
  "Richard Dean Dr McCormick": "R",
  "Tim Moore": "R",
  "Katherine M. Clark": "D",
  "Nicole Malliotakis": "R",
  "Harold Dallas Rogers": "R",
  "Rudy C. Yakym": "R",
  "John James": "R",
  "Scott H. Peters": "D",
};

async function fetchText(url) {
  const res = await fetch(url, {
    headers: { "User-Agent": "Mozilla/5.0 (compatible; research)" },
  });
  if (!res.ok) throw new Error(`${res.status} ${url}`);
  return res.text();
}

async function fetchBuffer(url) {
  const res = await fetch(url, {
    headers: { "User-Agent": "Mozilla/5.0 (compatible; research)" },
  });
  if (!res.ok) throw new Error(`${res.status} ${url}`);
  return Buffer.from(await res.arrayBuffer());
}

function parseFilings(xml) {
  const filings = [];
  const memberBlocks = xml.split("<Member>").slice(1);
  for (const block of memberBlocks) {
    const get = (tag) => {
      const m = block.match(new RegExp(`<${tag}>([^<]*)</${tag}>`));
      return m ? m[1].trim() : "";
    };
    if (get("FilingType") !== "P") continue;
    filings.push({
      name: `${get("First")} ${get("Last")}`.replace(/\s+/g, " ").trim(),
      state: get("StateDst"),
      date: get("FilingDate"),
      docid: get("DocID"),
    });
  }
  filings.sort((a, b) => new Date(b.date) - new Date(a.date));
  return filings;
}

function toISO(mdY) {
  const m = mdY.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (!m) return "";
  return `${m[3]}-${m[1].padStart(2, "0")}-${m[2].padStart(2, "0")}`;
}

function parseTrades(text, meta) {
  const trades = [];
  const clean = text.replace(/\s+/g, " ");
  const blocks = clean.split(/\b(?:SP|JT|DC)\s+(?=[A-Z])/);
  const tickerRe = /\(([A-Z]{1,5})\)\s*\[(ST|OP|CS|ET)\]/;

  for (const block of blocks) {
    const m = block.match(tickerRe);
    if (!m) continue;
    const ticker = m[1];
    const assetType = m[2];
    const after = block.slice(m.index + m[0].length, m.index + m[0].length + 30);

    let type = null;
    if (/^\s*P\b/.test(after)) type = "Buy";
    else if (/^\s*S\s*\(partial\)/.test(after) || /^\s*S\b/.test(after)) type = "Sell";
    if (!type) continue; // skip exchanges

    const amountM = block.match(/\$([\d,]+)\s*-\s*\$([\d,]+)/);
    const amount = amountM ? `$${amountM[1]} - $${amountM[2]}` : "";

    const dateM = block.slice(m.index).match(/(\d{2}\/\d{2}\/\d{4})/);
    const txDate = dateM ? toISO(dateM[1]) : "";

    const assetM = block.match(new RegExp(`^(.*?)\\(${ticker}\\)`));
    let companyName = assetM
      ? assetM[1].replace(/[^\x20-\x7E]/g, "").replace(/\s+/g, " ").trim()
      : ticker;
    // PDF header text can bleed into the first block — keep only the tail
    // after known header phrases, then trim leading filing metadata.
    companyName = companyName
      .replace(/^.*(?:Cap\.?\s*Gains\s*>\s*\$200\?|Filing ID #\d+|Amount\b)\s*/i, "")
      .replace(/^.*(?:transaction|notification)\s*date\s*/i, "")
      .replace(/ - (Common|Class [A-C] Common|Class [A-C]) Stock$/i, "")
      .replace(/ Common Stock$/i, "")
      .replace(/^\d+\s+/, "")
      .replace(/^(?:SP|JT|DC)\s+/, "")
      .trim()
      .slice(0, 60);
    if (!companyName || /Clerk of the House|Legislative Resource/i.test(companyName)) {
      companyName = ticker;
    }

    trades.push({
      id: `${meta.docid}-${trades.length}`,
      politician: meta.name,
      party: PARTY_MAP[meta.name] || null,
      chamber: "House",
      state: meta.state.replace(/\d+$/, ""),
      district: meta.state,
      ticker,
      companyName,
      type,
      amount,
      transactionDate: txDate,
      filedDate: toISO(meta.date),
      isOptions: assetType === "OP",
      source: `${PDF_BASE}${meta.docid}.pdf`,
    });
  }
  return trades;
}

async function main() {
  mkdirSync(CACHE_DIR, { recursive: true });

  console.error(`Fetching ${XML_URL} ...`);
  const xml = await fetchText(XML_URL);
  const filings = parseFilings(xml).slice(0, LIMIT);
  console.error(`Processing ${filings.length} most recent PTR filings ...`);

  const allTrades = [];
  for (const filing of filings) {
    const cachePath = join(CACHE_DIR, `${filing.docid}.pdf`);
    let buf;
    try {
      if (existsSync(cachePath)) {
        buf = readFileSync(cachePath);
      } else {
        buf = await fetchBuffer(`${PDF_BASE}${filing.docid}.pdf`);
        writeFileSync(cachePath, buf);
      }
      const parser = new PDFParse({ data: new Uint8Array(buf) });
      const { text } = await parser.getText();
      await parser.destroy();
      const trades = parseTrades(text, filing);
      allTrades.push(...trades);
      console.error(`  ${filing.name} (${filing.date}): ${trades.length} trades`);
    } catch (e) {
      console.error(`  SKIP ${filing.name} ${filing.docid}: ${e.message}`);
    }
  }

  const output = {
    updatedAt: new Date().toISOString(),
    source: "Clerk of the U.S. House of Representatives — STOCK Act PTR filings",
    tradeCount: allTrades.length,
    trades: allTrades,
  };

  writeFileSync(OUT_PATH, JSON.stringify(output, null, 2));
  console.error(`\nWrote ${allTrades.length} trades to ${OUT_PATH}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
