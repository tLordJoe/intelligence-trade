import type { FilingReference } from "./parse.ts";
import { date } from "./parse.ts";
export interface SubmissionColumns { accessionNumber: string[]; filingDate: string[]; form: string[] }
export function references(columns: SubmissionColumns, cik: string, from: string, to: string): FilingReference[] {
  date(from); date(to); if (from > to || !/^\d{10}$/.test(cik)) throw new Error("Invalid collection window");
  if (!Array.isArray(columns.accessionNumber) || columns.filingDate?.length !== columns.accessionNumber.length || columns.form?.length !== columns.accessionNumber.length) throw new Error("Incomplete submissions columns");
  return columns.accessionNumber.flatMap((accession,i) => {
    const filedDate = date(columns.filingDate[i]), form = columns.form[i];
    if (filedDate < from || filedDate > to || !["13F-HR","13F-HR/A","13F-NT","13F-NT/A"].includes(form)) return [];
    if (!/^\d{10}-\d{2}-\d{6}$/.test(accession)) throw new Error("Invalid SEC accession");
    return [{ accession, cik, filedDate, form: form as FilingReference["form"] }];
  });
}
export function allowedSecUrl(raw: string): string {
  const url = new URL(raw);
  if (url.protocol !== "https:" || url.username || url.password || url.search || url.hash ||
      !((url.hostname === "data.sec.gov" && /^\/submissions\/CIK\d{10}(?:-submissions-\d+)?\.json$/.test(url.pathname)) ||
        (url.hostname === "www.sec.gov" && /^\/Archives\/edgar\/data\/\d+\/\d{18}\/\d{10}-\d{2}-\d{6}\.txt$/.test(url.pathname)))) throw new Error("Unapproved SEC source URL");
  return url.href;
}
/** Sequential collector, <=2 requests/sec, no redirects, retries or silent truncation. */
export class SecReader {
  private last = 0;
  async read(raw: string): Promise<Buffer> {
    const url = allowedSecUrl(raw), wait = Math.max(0, this.last + 550 - Date.now());
    if (wait) await new Promise(resolve => setTimeout(resolve,wait));
    this.last = Date.now();
    const response = await fetch(url, { redirect: "error", signal: AbortSignal.timeout(45000), headers: { "User-Agent": "Outfox Markets contact hello@outfoxmarkets.com", Accept: "application/json,text/plain" } });
    if (!response.ok) throw new Error(`SEC ${response.status}; collection incomplete`);
    const reader = response.body?.getReader(); if (!reader) throw new Error("Empty SEC response");
    const chunks: Uint8Array[] = []; let size = 0;
    while (true) { const part = await reader.read(); if (part.done) break; size += part.value.length;
      if (size > 48 * 1024 * 1024) { await reader.cancel(); throw new Error("SEC response too large"); } chunks.push(part.value); }
    return Buffer.concat(chunks);
  }
}
