import type { AmountStatus } from "./congress-schema";

export interface CongressTrade {
  id: string;
  politician: string;
  party: "D" | "R" | "?";
  chamber: "House";
  state: string;
  ticker: string;
  companyName: string;
  type: "Buy" | "Sell";
  /** Human-readable amount as disclosed, or `""` when none was disclosed. */
  amount: string;
  /** Dollar bounds, or `null` when no amount is known. Never zero for absent. */
  amountLow: number | null;
  amountHigh: number | null;
  amountStatus: AmountStatus;
  transactionDate: string;
  filedDate: string;
  daysAgo: number;
  source: string;
  isOptions?: boolean;
  committee?: string;
}
