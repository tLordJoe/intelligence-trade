/** Discovery labels, not a claim that these are anyone's personal trades. */
export const featuredManagers = [
  { cik: "0001336528", name: "Pershing Square Capital Management", investor: "Bill Ackman" },
  { cik: "0002026053", name: "Pershing Square Inc.", investor: "Bill Ackman" },
  { cik: "0001541617", name: "Altimeter Capital Management", investor: "Brad Gerstner" },
  { cik: "0001656456", name: "Appaloosa", investor: "David Tepper" },
  { cik: "0001040273", name: "Third Point", investor: "Daniel Loeb" },
  { cik: "0001536411", name: "Duquesne Family Office", investor: "Stanley Druckenmiller" },
  { cik: "0001647251", name: "TCI Fund Management", investor: "Chris Hohn" },
] as const;
export const managerSearchLabel = (cik: string) => {
  const manager = featuredManagers.find(m => m.cik === cik);
  return manager ? `${manager.name} ${manager.investor}` : "";
};
