/**
 * Whether the comparison preview may be shown, and where.
 *
 * Deliberately importable without touching any data. It reads the active
 * source's *description* — its kind and its rights — and never its values, so
 * a page can decide not to show the preview without first loading the several
 * hundred kilobytes it has decided not to show.
 *
 * Two independent gates, both failing closed.
 *
 *   1. **Rights.** No explicit public-display grant, no display. Unknown counts
 *      as absent.
 *
 *   2. **Environment.** Demonstration data is not production content. It is
 *      served in development and on preview deployments, and on production only
 *      when someone has deliberately turned it on. Being permitted to display
 *      generated data is not the same as it belonging on the live site.
 *
 * They are separate because they answer different questions — "may we?" and
 * "should this be here?" — and either alone would let the other's failure past.
 */

import {
  DEMONSTRATION_PROVIDER_ID, DEMONSTRATION_RIGHTS,
} from "./providers/demonstration-meta.ts";
import { permitsPublicDisplay, type DataRights } from "./rights.ts";

/** The part of a provider this module needs. Never its data. */
export interface ProviderDescriptor {
  id: string;
  kind: "demonstration" | "licensed";
  rights: DataRights;
}

/**
 * The active source, described without being loaded.
 *
 * Kept in step with `data.ts`'s `activeProvider` by
 * `tests/fund-rights.test.ts`, which compares the two.
 */
export const ACTIVE_PROVIDER_DESCRIPTOR: ProviderDescriptor = {
  id: DEMONSTRATION_PROVIDER_ID,
  kind: "demonstration",
  rights: DEMONSTRATION_RIGHTS,
};

export interface PreviewAccess {
  allowed: boolean;
  /** Present whenever `allowed` is false, written to be shown to a reader. */
  reason: string;
  /** True when whatever is displayed must carry the demonstration label. */
  demonstration: boolean;
}

export interface EnvironmentInput {
  /** Vercel's deployment environment, or undefined when running locally. */
  deploymentEnvironment?: string;
  /** Explicit opt-in for production. Anything other than "1" is off. */
  productionOptIn?: string;
}

export function evaluatePreviewAccess(
  env: EnvironmentInput,
  provider: ProviderDescriptor = ACTIVE_PROVIDER_DESCRIPTOR
): PreviewAccess {
  const demonstration = provider.kind === "demonstration";

  const rights = permitsPublicDisplay(provider.rights);
  if (!rights.allowed) {
    return { allowed: false, reason: rights.reason, demonstration };
  }

  if (demonstration && env.deploymentEnvironment === "production" && env.productionOptIn !== "1") {
    return {
      allowed: false,
      demonstration,
      reason:
        "This comparison currently runs on generated demonstration data, which is not " +
        "published on the live site. It is available on preview deployments, and can be " +
        "enabled here deliberately once someone decides it should be.",
    };
  }

  return { allowed: true, reason: "", demonstration };
}

/** Read the gate from the process environment. Server-side only. */
export function previewAccessFromEnv(): PreviewAccess {
  return evaluatePreviewAccess({
    deploymentEnvironment: process.env.VERCEL_ENV,
    productionOptIn: process.env.ENABLE_DEMONSTRATION_COMPARE,
  });
}
