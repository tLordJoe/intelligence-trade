/**
 * Rights, and the gates that read them.
 *
 * The property under test throughout is that everything fails closed. A dataset
 * nobody has looked at must be indistinguishable, to every caller, from one
 * that has been examined and refused.
 */

import assert from "node:assert/strict";
import test from "node:test";

import { ACTIVE_PROVIDER_DESCRIPTOR, evaluatePreviewAccess } from "../src/lib/funds/access.ts";
import { activeProvider } from "../src/lib/funds/data.ts";
import { assertDisplayable, getDisplayableSeries, type FundDataProvider } from "../src/lib/funds/provider.ts";
import {
  ALL_DATA_RIGHTS, permits, permitsPublicDisplay, selfGeneratedRights, unknownRights,
  type DataRights,
} from "../src/lib/funds/rights.ts";
import { unavailable, type Availability, type PriceSeries } from "../src/lib/funds/types.ts";

function rights(grants: DataRights["grants"]): DataRights {
  return { grants, basis: "test", reviewedAt: "2026-01-01", reviewedBy: "test" };
}

function providerWith(overrides: Partial<FundDataProvider>): FundDataProvider {
  const base: FundDataProvider = {
    id: "test",
    displayName: "Test provider",
    kind: "demonstration",
    rights: rights(["public-display-authorized"]),
    provenance: {
      sourceId: "test", sourceName: "Test", kind: "demonstration",
      rights: rights(["public-display-authorized"]),
      producedAt: "2026-01-01T00:00:00.000Z", method: "Fixture.",
      demonstrationLabel: "Demonstration data — not actual market performance.",
    },
    supportedBases: ["price_return"],
    listSymbols: () => ["AAA"],
    getLegalIdentity: () => null,
    getPriceSeries: (): Availability<PriceSeries> =>
      unavailable<PriceSeries>("source_not_connected", "stub"),
    getExpenses: (symbol) => ({
      symbol,
      expenseRatioPercent: unavailable<number>("source_not_connected"),
    }),
    getHoldings: () => unavailable("source_not_connected"),
    getOverlays: () => [],
  };
  return { ...base, ...overrides };
}

// --- the states themselves ---------------------------------------------------

test("rights are an explicit set of states, not a boolean", () => {
  assert.deepEqual(ALL_DATA_RIGHTS, [
    "internal-only",
    "public-display-authorized",
    "redistribution-authorized",
    "derived-analytics-authorized",
    "unknown",
  ]);
});

test("unknown rights permit nothing at all", () => {
  const unknown = unknownRights("nobody has checked");
  for (const right of ALL_DATA_RIGHTS) {
    assert.equal(permits(unknown, right).allowed, false, `${right} must be refused`);
  }
});

test("an empty grant list permits nothing", () => {
  const empty = rights([]);
  assert.equal(permitsPublicDisplay(empty).allowed, false);
  assert.ok(permitsPublicDisplay(empty).reason.length > 0);
});

test("unknown mixed into a real grant poisons the whole set", () => {
  const partial = rights(["public-display-authorized", "unknown"]);
  assert.equal(permitsPublicDisplay(partial).allowed, false);
});

test("internal-only does not imply public display", () => {
  assert.equal(permitsPublicDisplay(rights(["internal-only"])).allowed, false);
});

test("public display does not imply redistribution or derived analysis", () => {
  const display = rights(["public-display-authorized"]);
  assert.equal(permits(display, "public-display-authorized").allowed, true);
  assert.equal(permits(display, "redistribution-authorized").allowed, false);
  assert.equal(permits(display, "derived-analytics-authorized").allowed, false);
});

test("self-generated data grants everything, and records why", () => {
  const own = selfGeneratedRights("generated from a seed", "2026-01-01");
  assert.equal(permitsPublicDisplay(own).allowed, true);
  assert.equal(permits(own, "redistribution-authorized").allowed, true);
  assert.ok(!own.grants.includes("unknown"));
  assert.ok(own.basis.length > 0);
});

test("every refusal carries a reason a reader could be shown", () => {
  for (const grants of [[], ["unknown"], ["internal-only"]] as DataRights["grants"][]) {
    const decision = permitsPublicDisplay(rights(grants));
    assert.equal(decision.allowed, false);
    assert.ok(decision.reason.length > 20, `reason too thin for ${JSON.stringify(grants)}`);
  }
});

// --- the provider gate -------------------------------------------------------

test("a provider with unknown rights is not displayable", () => {
  const provider = providerWith({ rights: unknownRights("not examined") });
  assert.equal(assertDisplayable(provider).allowed, false);
});

test("public rendering fails closed when display rights are unknown", () => {
  const provider = providerWith({ rights: unknownRights("not examined") });
  const result = getDisplayableSeries(provider, "AAA", "price_return");
  assert.equal(result.status, "unavailable");
  if (result.status !== "unavailable") return;
  assert.equal(result.reason, "rights_not_established");
});

test("an unsupported basis is refused rather than silently substituted", () => {
  const provider = providerWith({ supportedBases: ["price_return"] });
  const result = getDisplayableSeries(provider, "AAA", "total_return");
  assert.equal(result.status, "unavailable");
  if (result.status !== "unavailable") return;
  assert.equal(result.reason, "basis_not_supplied");
});

// --- the environment gate ----------------------------------------------------

test("demonstration data is withheld on production without an explicit opt-in", () => {
  const access = evaluatePreviewAccess({ deploymentEnvironment: "production" });
  assert.equal(access.allowed, false);
  assert.ok(access.reason.toLowerCase().includes("live site"));
});

test("an opt-in other than 1 does not count as authorization", () => {
  for (const value of ["", "0", "true", "yes", "TRUE"]) {
    const access = evaluatePreviewAccess({
      deploymentEnvironment: "production",
      productionOptIn: value,
    });
    assert.equal(access.allowed, false, `"${value}" must not authorize production`);
  }
});

test("demonstration data is available on preview deployments", () => {
  assert.equal(evaluatePreviewAccess({ deploymentEnvironment: "preview" }).allowed, true);
});

test("demonstration data is available locally, where there is no deployment", () => {
  assert.equal(evaluatePreviewAccess({}).allowed, true);
});

test("production shows it only when someone has turned it on deliberately", () => {
  const access = evaluatePreviewAccess({
    deploymentEnvironment: "production",
    productionOptIn: "1",
  });
  assert.equal(access.allowed, true);
});

test("the access decision always reports that the data is a demonstration", () => {
  for (const env of [{}, { deploymentEnvironment: "production" }, { deploymentEnvironment: "preview" }]) {
    assert.equal(evaluatePreviewAccess(env).demonstration, true);
  }
});

// --- the descriptor and the provider must not drift --------------------------

test("the lightweight descriptor describes the provider actually in use", () => {
  // `access.ts` reads the descriptor so it can decide without loading the data.
  // If the two fell out of step, the gate would be deciding about a source that
  // is not the one being served.
  assert.equal(ACTIVE_PROVIDER_DESCRIPTOR.id, activeProvider.id);
  assert.equal(ACTIVE_PROVIDER_DESCRIPTOR.kind, activeProvider.kind);
  assert.deepEqual(ACTIVE_PROVIDER_DESCRIPTOR.rights, activeProvider.rights);
});
