export interface IdentifiedRecord {
  id: string;
}

export function dedupeById<T extends IdentifiedRecord>(records: T[]): T[] {
  const seen = new Set<string>();
  return records.filter((record) => {
    if (!record.id || seen.has(record.id)) return false;
    seen.add(record.id);
    return true;
  });
}

export function isOfficialHouseFilingUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return (
      url.protocol === "https:" &&
      url.hostname === "disclosures-clerk.house.gov" &&
      url.pathname.startsWith("/public_disc/ptr-pdfs/") &&
      url.pathname.endsWith(".pdf")
    );
  } catch {
    return false;
  }
}
