"use client";
import { useState } from "react";
import Image from "next/image";
import { companyMark } from "@/lib/company-marks";

export default function CompanyMark({ ticker, cik }: { ticker: string; cik?: string }) {
  const src = companyMark(ticker, cik);
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  if (!src || failedSrc === src) return <span className="home-ticker-tile" aria-hidden="true">{ticker}</span>;
  return <span className="home-company-mark" aria-hidden="true">
    <Image src={src} alt="" width={56} height={44} unoptimized onError={() => setFailedSrc(src)} />
  </span>;
}
