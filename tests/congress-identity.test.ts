import assert from "node:assert/strict";
import test from "node:test";
import {
  assignRowIds,
  canonicalRowText,
  contentHash,
  docIdFromRecordId,
  type IdentityInput,
} from "../src/lib/congress-identity.ts";

function row(overrides: Partial<IdentityInput> = {}): IdentityInput {
  return {
    issuerName: "NVIDIA Corporation",
    tickerText: "NVDA",
    typeText: "P",
    amountText: "$1,001 - $15,000",
    transactionDateText: "07/01/2026",
    ownerText: "SP",
    ...overrides,
  };
}

test("regression: recognizing a new earlier row does not change later identities", () => {
  // The failure mode positional identity has. A parser that begins recognizing
  // a row it previously skipped shifts every ordinal after it, so every later
  // transaction in the filing changes id and appears to be a different record.
  const before = [row({ tickerText: "NVDA" }), row({ tickerText: "AMD" })];
  const after = [
    row({ tickerText: "MSFT" }), // newly recognized, inserted first
    row({ tickerText: "NVDA" }),
    row({ tickerText: "AMD" }),
  ];

  const idsBefore = assignRowIds("DOC1", before).map((r) => r.id);
  const idsAfter = assignRowIds("DOC1", after).map((r) => r.id);

  assert.equal(idsAfter.length, 3);
  // Both originally known rows keep exactly the ids they had.
  assert.ok(idsAfter.includes(idsBefore[0]), "NVDA row must keep its id");
  assert.ok(idsAfter.includes(idsBefore[1]), "AMD row must keep its id");
});

test("genuinely duplicated transactions in one filing stay distinct", () => {
  const ids = assignRowIds("DOC1", [row(), row()]).map((r) => r.id);
  assert.equal(new Set(ids).size, 2);
  assert.ok(ids[0].endsWith("::0"));
  assert.ok(ids[1].endsWith("::1"));
});

test("a third identical row gets the next occurrence without disturbing the first two", () => {
  const two = assignRowIds("DOC1", [row(), row()]).map((r) => r.id);
  const three = assignRowIds("DOC1", [row(), row(), row()]).map((r) => r.id);
  assert.deepEqual(three.slice(0, 2), two);
  assert.ok(three[2].endsWith("::2"));
});

test("identity is scoped to its document", () => {
  const a = assignRowIds("DOC1", [row()])[0].id;
  const b = assignRowIds("DOC2", [row()])[0].id;
  assert.notEqual(a, b);
  assert.ok(a.startsWith("DOC1::"));
  assert.ok(b.startsWith("DOC2::"));
});

test("cosmetic whitespace and case changes do not alter identity", () => {
  const tidy = contentHash(row({ issuerName: "NVIDIA Corporation" }));
  const messy = contentHash(row({ issuerName: "  nvidia   CORPORATION " }));
  assert.equal(tidy, messy);
});

test("a substantive change does alter identity", () => {
  assert.notEqual(
    contentHash(row({ amountText: "$1,001 - $15,000" })),
    contentHash(row({ amountText: "$15,001 - $50,000" }))
  );
  assert.notEqual(
    contentHash(row({ typeText: "P" })),
    contentHash(row({ typeText: "S" }))
  );
});

test("canonical text keeps every identifying field", () => {
  const text = canonicalRowText(row());
  for (const part of ["NVDA", "P", "$1,001 - $15,000", "07/01/2026", "SP"]) {
    assert.ok(text.includes(part), `canonical text must retain ${part}`);
  }
});

test("docIdFromRecordId understands current and legacy id forms", () => {
  assert.equal(docIdFromRecordId("20035136::abc123::0"), "20035136");
  assert.equal(docIdFromRecordId("20035136#3"), "20035136");
  assert.equal(docIdFromRecordId("20035136-3"), "20035136");
});
