/** The fetcher refuses anything that is not a documented source. */
import assert from "node:assert/strict";
import test from "node:test";

import { ALLOWED_HOSTS, FetchRefused, fetchAllowed } from "../scripts/image-library/net.ts";

test("only documented hosts are allowed, over https", async () => {
  await assert.rejects(fetchAllowed("https://evil.example/logo.svg"), FetchRefused);
  await assert.rejects(fetchAllowed("http://upload.wikimedia.org/x.svg"), FetchRefused);
  await assert.rejects(fetchAllowed("https://upload.wikimedia.org.evil.example/x.svg"), FetchRefused);
  await assert.rejects(fetchAllowed("file:///etc/passwd"), FetchRefused);
});

test("the allow list is exactly the sources the memo documents", () => {
  assert.deepEqual([...ALLOWED_HOSTS].sort(), [
    "cdn.simpleicons.org", "commons.wikimedia.org", "data.sec.gov", "query.wikidata.org", "raw.githubusercontent.com",
    "unitedstates.github.io", "upload.wikimedia.org", "www.sec.gov", "www.wikidata.org",
  ]);
});
