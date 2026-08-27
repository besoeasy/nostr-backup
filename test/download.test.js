import assert from "node:assert/strict";
import { mkdtemp, readFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { downloadIpfs } from "../src/save.js";

const CID = "bafybeicg2oxl5gah64cvk44phwsr33m42x3fvwg6b2kdt6v2iylndr2mqu";

test("downloadIpfs tries gateways and writes bytes", async () => {
  const folder = await mkdtemp(path.join(os.tmpdir(), "nostr-ipfs-"));
  const dest = path.join(folder, "file.bin");
  let urls = [];
  const fetchImpl = async (url) => {
    urls.push(url);
    if (urls.length === 1) return { ok: false, status: 502 };
    return {
      ok: true,
      arrayBuffer: async () => Buffer.from("hello-ipfs"),
    };
  };
  const result = await downloadIpfs({ cid: CID, uri: `ipfs://${CID}` }, dest, { fetchImpl });
  assert.equal(result.size, 10);
  assert.equal(await readFile(dest, "utf8"), "hello-ipfs");
  assert.ok(urls.some((url) => url.includes(CID)));
});

test("downloadIpfs rejects sha256 mismatch", async () => {
  const folder = await mkdtemp(path.join(os.tmpdir(), "nostr-ipfs-"));
  const dest = path.join(folder, "file.bin");
  await assert.rejects(
    downloadIpfs(
      { cid: CID, sha256: "0".repeat(64) },
      dest,
      {
        fetchImpl: async () => ({
          ok: true,
          arrayBuffer: async () => Buffer.from("hello-ipfs"),
        }),
      },
    ),
    /sha256 mismatch/,
  );
});
