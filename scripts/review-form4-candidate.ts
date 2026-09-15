#!/usr/bin/env node --experimental-strip-types
import { resolve } from "node:path";
import { loadInsiderCandidateReview } from "../src/lib/form4/candidate-review.ts";

try {
  const result = loadInsiderCandidateReview(resolve(import.meta.dirname, ".."));
  console.log(JSON.stringify(result, null, 2));
  if (result.blockers.length) process.exitCode = 1;
} catch (error) {
  console.error(`Candidate review refused: ${(error as Error).message}`);
  process.exitCode = 1;
}
