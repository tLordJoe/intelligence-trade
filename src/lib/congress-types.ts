export interface CongressTrade {
  id: string;
  politician: string;
  party: "D" | "R" | "?";
  chamber: "House";
  state: string;
  ticker: string;
  companyName: string;
  type: "Buy" | "Sell";
  amount: string;
  transactionDate: string;
  filedDate: string;
  daysAgo: number;
  committee?: string;
}
