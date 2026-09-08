/**
 * What we are permitted to do with a dataset.
 *
 * Rights are **not a boolean**. "Licensed: true" collapses four independent
 * permissions into one bit and, worse, gives an unexamined dataset the same
 * shape as an examined one — there is no way to say "nobody has checked". The
 * states below keep those apart, and `unknown` is a first-class answer.
 *
 * The whole module fails closed. A permission is granted only when it is
 * explicitly present in `grants`; absence, emptiness and `unknown` all mean
 * refuse. Nothing here infers a right from a source being public, free, or
 * easy to fetch.
 */

export type DataRight =
  /** May be used inside Outfox for research and development. Not shown to anyone. */
  | "internal-only"
  /** May be rendered to the public in Outfox's own product. */
  | "public-display-authorized"
  /** May be handed onward — API responses, exports, downloads, syndication. */
  | "redistribution-authorized"
  /** Values computed from it may be published, not just the raw values. */
  | "derived-analytics-authorized"
  /** Nobody has established what is permitted. Treated as permitting nothing. */
  | "unknown";

export const ALL_DATA_RIGHTS: DataRight[] = [
  "internal-only",
  "public-display-authorized",
  "redistribution-authorized",
  "derived-analytics-authorized",
  "unknown",
];

export interface DataRights {
  /**
   * The rights actually established for this dataset.
   *
   * An empty list and `["unknown"]` mean the same thing operationally — no
   * permission — but they are recorded differently because they describe
   * different situations: nothing granted, versus nothing examined.
   */
  grants: DataRight[];
  /** Why we believe these rights hold. Free text, but expected to cite something. */
  basis: string;
  /** When the rights were last established, so a stale review is visible. */
  reviewedAt: string;
  /** Who established them. */
  reviewedBy: string;
}

export interface RightsDecision {
  allowed: boolean;
  /** Present whenever `allowed` is false. Written for a reader, not a log. */
  reason: string;
}

/** Rights for a dataset nobody has examined. The safe default everywhere. */
export function unknownRights(basis: string): DataRights {
  return {
    grants: ["unknown"],
    basis,
    reviewedAt: "",
    reviewedBy: "",
  };
}

function hasGrant(rights: DataRights, right: DataRight): boolean {
  return rights.grants.includes(right);
}

/**
 * Whether a specific right is established.
 *
 * `unknown` anywhere in the list poisons the whole set: a dataset that is part
 * examined and part not has not been examined.
 */
export function permits(rights: DataRights, right: DataRight): RightsDecision {
  if (rights.grants.length === 0) {
    return { allowed: false, reason: "No rights have been established for this data source." };
  }
  if (hasGrant(rights, "unknown")) {
    return {
      allowed: false,
      reason:
        "The rights for this data source have not been established, so it cannot be used.",
    };
  }
  if (!hasGrant(rights, right)) {
    return { allowed: false, reason: describeMissingRight(right) };
  }
  return { allowed: true, reason: "" };
}

/** Convenience for the commonest gate. Public display, failing closed. */
export function permitsPublicDisplay(rights: DataRights): RightsDecision {
  return permits(rights, "public-display-authorized");
}

function describeMissingRight(right: DataRight): string {
  switch (right) {
    case "public-display-authorized":
      return "This data source is not authorized for public display.";
    case "redistribution-authorized":
      return "This data source is not authorized for redistribution.";
    case "derived-analytics-authorized":
      return "This data source is not authorized for published derived analysis.";
    case "internal-only":
      return "This data source is not authorized even for internal use.";
    case "unknown":
      return "The rights for this data source have not been established.";
  }
}

/**
 * Rights for data Outfox generated itself.
 *
 * The only category in this codebase that can be granted everything without a
 * licence conversation, because there is no counterparty: it was produced from
 * a seed and an equation. It is still not market data, and callers must label
 * it as demonstration output — a right to display is not a right to mislead.
 */
export function selfGeneratedRights(basis: string, reviewedAt: string): DataRights {
  return {
    grants: [
      "public-display-authorized",
      "redistribution-authorized",
      "derived-analytics-authorized",
    ],
    basis,
    reviewedAt,
    reviewedBy: "Outfox Markets",
  };
}
