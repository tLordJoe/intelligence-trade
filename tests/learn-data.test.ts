import assert from "node:assert/strict";
import test from "node:test";
import { learnEntries } from "../src/lib/learn-data.ts";

test("Academy launches with the five required foundation guides", () => {
  assert.equal(learnEntries.length, 5);
  assert.deepEqual(
    new Set(learnEntries.map((entry) => entry.slug)),
    new Set([
      "what-is-form-4",
      "what-is-form-13f",
      "what-is-congressional-periodic-transaction-report",
      "what-is-a-corporate-insider",
      "transaction-date-vs-filing-date",
    ]),
  );
});

test("Academy slugs are unique and search-friendly", () => {
  const slugs = learnEntries.map((entry) => entry.slug);
  assert.equal(new Set(slugs).size, slugs.length);
  for (const slug of slugs) {
    assert.match(slug, /^[a-z0-9]+(?:-[a-z0-9]+)*$/);
  }
});

test("every Academy guide has primary sources and explicit limitations", () => {
  for (const entry of learnEntries) {
    assert.ok(entry.quickAnswer.length >= 100, `${entry.slug} needs a substantive quick answer`);
    assert.ok(entry.takeaways.length >= 3, `${entry.slug} needs key takeaways`);
    assert.ok(entry.limitations.length >= 3, `${entry.slug} needs explicit limitations`);
    assert.ok(entry.sources.length >= 2, `${entry.slug} needs at least two primary sources`);
    assert.match(entry.reviewedAt, /^\d{4}-\d{2}-\d{2}$/);
    assert.match(entry.publishedAt, /^\d{4}-\d{2}-\d{2}$/);
    for (const source of entry.sources) {
      const host = new URL(source.url).hostname;
      assert.ok(
        host === "www.sec.gov" || host === "disclosures-clerk.house.gov" || host === "www.investor.gov" || host === "ethics.house.gov",
        `${entry.slug} contains a non-primary source: ${host}`,
      );
      assert.match(source.verifiedAt, /^\d{4}-\d{2}-\d{2}$/);
    }
  }
});

test("filing guides state the timing and interpretation distinctions readers need", () => {
  const form4 = learnEntries.find((entry) => entry.slug === "what-is-form-4");
  const form13f = learnEntries.find((entry) => entry.slug === "what-is-form-13f");
  const ptr = learnEntries.find((entry) => entry.slug === "what-is-congressional-periodic-transaction-report");
  assert.match(form4?.quickAnswer ?? "", /two business days/i);
  assert.match(form13f?.quickAnswer ?? "", /quarter-end, not.*real-time/i);
  assert.match(ptr?.quickAnswer ?? "", /30 days.*45 days/i);
  assert.match(ptr?.quickAnswer ?? "", /spouse.*dependent child/i);
  assert.doesNotMatch(ptr?.quickAnswer ?? "", /spouses, and dependent children to report/i);
});

test("every related Academy link resolves to a known guide", () => {
  const slugs = new Set(learnEntries.map((entry) => entry.slug));
  for (const entry of learnEntries) {
    for (const relatedSlug of entry.relatedSlugs) {
      assert.ok(slugs.has(relatedSlug), `${entry.slug} links to missing guide ${relatedSlug}`);
      assert.notEqual(relatedSlug, entry.slug);
    }
  }
});
