import test from "node:test";
import assert from "node:assert/strict";
import { parseFilingRows } from "../src/lib/house-parser.ts";
import { assessHouseSymbolCoverage } from "../src/lib/house-coverage.ts";
import { assessRun } from "../src/lib/congress-gates.ts";
import { emptyCounts } from "../src/lib/congress-schema.ts";

test("R2: three ownerless rows cannot silently masquerade as one complete row", () => {
  // Reduced structural reproduction of source 20034894: separate accounts,
  // same ticker/date/amount, blank Owner column. Full original remains evidence.
  const row = "NVIDIA Corporation - Common Stock (NVDA) [ST] P 06/26/2026 06/26/2026 $1,001 - $15,000";
  const text = [row, "F S : New S O : Account A", row, "F S : New S O : Account B", row].join("\n");
  const parsed = parseFilingRows(text);
  const coverage = assessHouseSymbolCoverage(text, parsed);
  assert.equal(coverage.mentions, 3);
  // Either the parser recovers all rows or the conservation check blocks it.
  assert.equal(coverage.accounted + coverage.unaccounted, 3);
  if (parsed.rows.length < 3) assert.ok(coverage.unaccounted > 0);
  const counts = {...emptyCounts(), sourceFilings:1, selectedFilings:1, downloadedFilings:1,
    parsedFilings:1, parsedRecords:parsed.rows.length, accepted:parsed.rows.length,
    archiveAfter:parsed.rows.length, unaccountedSymbolMentions:coverage.unaccounted};
  const result = assessRun({counts});
  if (coverage.unaccounted) {
    assert.equal(result.passed, false);
    assert.ok(result.failures.some(x=>x.startsWith("unaccounted_supported_symbol_mentions:")));
    assert.equal(assessRun({counts,allowCompletenessDrop:true}).passed,false,
      "a yield override cannot bypass unaccounted source rows");
  }
});

test("coverage counts skipped symbols as accounted, not fabricated accepted rows", () => {
  const text="ABC Corp (ABC) [ST] no transaction";
  assert.deepEqual(assessHouseSymbolCoverage(text,parseFilingRows(text)), {mentions:1,accounted:1,unaccounted:0});
});

test("unsupported securities and text without stock tags do not inflate coverage", () => {
  const text="Private fund [HF] and (BTC) [CT], no public stock transactions";
  assert.deepEqual(assessHouseSymbolCoverage(text,parseFilingRows(text)), {mentions:0,accounted:0,unaccounted:0});
});
