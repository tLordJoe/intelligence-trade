"use client";
import { useState } from "react";
import Image from "next/image";

/**
 * Renders a company or sponsor mark, or the ticker tile when there is none.
 *
 * The mark is resolved on the server through `@/lib/image-library` and passed
 * in as `src`; this component never consults the catalog, so the catalog stays
 * out of client bundles. A failed load falls back to the same tile a missing
 * mark uses, so a broken file and an absent file look identical to a reader.
 */
export default function CompanyMark({ ticker, src }: { ticker: string; src?: string | null }) {
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  if (!src || failedSrc === src) return <span className="home-ticker-tile" aria-hidden="true">{ticker}</span>;
  return <span className="home-company-mark" aria-hidden="true">
    <Image src={src} alt="" width={56} height={44} unoptimized onError={() => setFailedSrc(src)} />
  </span>;
}
