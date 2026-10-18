/** Explicit offline maintenance; never automatically rolls back a feed. */
import { resolve } from "node:path";
import { maintainCandidate } from "../src/lib/form4/candidate-storage.ts";
const [action, path, ...flags] = process.argv.slice(2);
if (!path || !["inspect", "quarantine", "recover"].includes(action) ||
    flags.some(flag => !["--readers-stopped", "--force"].includes(flag)) ||
    (action !== "inspect" && !flags.includes("--readers-stopped")) ||
    (flags.includes("--force") && action !== "recover")) {
  throw new Error("Usage: maintain-form4-candidate.ts inspect|quarantine|recover PATH [--readers-stopped] [--force (recover only)]");
}
console.log(JSON.stringify(maintainCandidate(resolve(path), action as "inspect" | "quarantine" | "recover", { force: flags.includes("--force") })));
