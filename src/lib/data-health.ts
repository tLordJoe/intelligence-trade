import { isOfficialHouseFilingUrl } from "./congress-utils.ts";

interface HealthTrade {
  id: string;
  transactionDate: string;
  filedDate: string;
  source: string;
}

export interface DatasetHealth {
  status: "ok" | "error";
  recordCount: number;
  updatedAt: string;
  issues: string[];
}

const DAY_MS = 86_400_000;

export function assessHouseDataset(
  trades: HealthTrade[],
  updatedAt: string,
  now = Date.now()
): DatasetHealth {
  const issues: string[] = [];
  const updated = Date.parse(updatedAt);

  if (!trades.length) issues.push("dataset is empty");
  if (!Number.isFinite(updated)) issues.push("updatedAt is invalid");
  else if (now - updated > 14 * DAY_MS) issues.push("dataset is more than 14 days old");

  const ids = new Set<string>();
  for (const trade of trades) {
    if (!trade.id) issues.push("record is missing an id");
    else if (ids.has(trade.id)) issues.push(`duplicate id: ${trade.id}`);
    else ids.add(trade.id);

    if (!/^\d{4}-\d{2}-\d{2}$/.test(trade.transactionDate)) {
      issues.push(`invalid transaction date: ${trade.id || "unknown"}`);
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(trade.filedDate)) {
      issues.push(`invalid filing date: ${trade.id || "unknown"}`);
    }
    if (!isOfficialHouseFilingUrl(trade.source)) {
      issues.push(`unverified source: ${trade.id || "unknown"}`);
    }
  }

  return {
    status: issues.length ? "error" : "ok",
    recordCount: trades.length,
    updatedAt,
    issues: [...new Set(issues)],
  };
}
