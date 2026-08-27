import assert from "node:assert/strict";
import http from "node:http";
import { mkdtemp, readFile, readdir } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { backupNpubs } from "../src/backup.js";

const JACK = "npub180cvv07tjdrrgpa0j7j7tmnyl2yr6yr7l8j4s3evf6u64th6gkwsyjh6w6";
const CID = "QmT78zSuBmuS4z925WZfrqQ1qHaJ56DQa4vsV1FAu6ikGj";
const PAYLOAD = Buffer.from("hello from local ipfs gateway");

function startGateway() {
  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      const url = new URL(req.url, "http://127.0.0.1");
      if (url.pathname === `/ipfs/${CID}`) {
        res.writeHead(200, { "content-type": "text/plain" });
        res.end(PAYLOAD);
        return;
      }
      res.writeHead(404);
      res.end("no");
    });
    server.listen(0, "127.0.0.1", () => {
      resolve({ server, port: server.address().port });
    });
  });
}

test("downloads ipfs:// media from a custom gateway into folder/npub/media", async () => {
  const { server, port } = await startGateway();
  const folder = await mkdtemp(path.join(os.tmpdir(), "nostr-gw-"));
  const gateway = `http://127.0.0.1:${port}/ipfs/`;
  try {
    const summary = await backupNpubs({
      npubs: [JACK],
      folder,
      extraGateways: [gateway],
      querySync: async () => [
        {
          id: "evt-ipfs",
          pubkey: "3bf0c63fcb93463407af97a5e5ee64fa883d107ef9e558472c4eb9aaaefa459d",
          created_at: 1,
          kind: 1,
          tags: [["imeta", `url ipfs://${CID}`, "m text/plain", "filename hello.txt"]],
          content: `see ipfs://${CID}`,
          sig: "x",
        },
      ],
      log: () => {},
    });
    assert.equal(summary[0].saved, 1);
    const files = await readdir(path.join(folder, JACK, "media"));
    assert.equal(files.length, 1);
    const body = await readFile(path.join(folder, JACK, "media", files[0]));
    assert.equal(body.toString(), PAYLOAD.toString());
  } finally {
    server.close();
  }
});
