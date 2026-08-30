import assert from "node:assert/strict";
import { mkdtemp, readFile, readdir } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { fetchAllEvents } from "../src/fetch.js";
import { mergeRelays, POPULAR_RELAYS } from "../src/relays.js";
import { saveNpubBackup } from "../src/save.js";
import { backupNpubs } from "../src/backup.js";

const JACK = "npub180cvv07tjdrrgpa0j7j7tmnyl2yr6yr7l8j4s3evf6u64th6gkwsyjh6w6";
const FIAT = "npub1sg6plzptd64u62a878hep2kev88swjh3tw00gjsfl8f237lmu63q0uf63m";
const CID = "bafybeicg2oxl5gah64cvk44phwsr33m42x3fvwg6b2kdt6v2iylndr2mqu";

test("popular relays stay on the list and custom relays are added", () => {
  const relays = mergeRelays(["wss://custom.relay/", "relay.damus.io"]);
  assert.ok(relays.includes("wss://relay.damus.io"));
  assert.ok(relays.includes("wss://custom.relay"));
  assert.ok(relays.length > POPULAR_RELAYS.length || relays.includes("wss://custom.relay"));
  assert.equal(relays.filter((url) => url.includes("relay.damus.io")).length, 1);
});

test("fetchAllEvents pages and dedupes", async () => {
  const pages = [
    [
      { id: "2", created_at: 200, content: "b" },
      { id: "1", created_at: 100, content: "a" },
    ],
    [{ id: "1", created_at: 100, content: "a" }],
  ];
  const events = await fetchAllEvents({
    pubkey: "abc",
    querySync: async () => pages.shift() || [],
  });
  assert.equal(events.length, 2);
  assert.deepEqual(events.map((e) => e.id), ["2", "1"]);
});

test("save layout is folder/npub/media", async () => {
  const folder = await mkdtemp(path.join(os.tmpdir(), "nostr-backup-"));
  const events = [{ id: "evt1", kind: 1, content: `ipfs://${CID}`, tags: [] }];
  await saveNpubBackup(
    folder,
    JACK,
    events,
    [{ cid: CID, uri: `ipfs://${CID}`, filename: "photo.jpg", eventIds: ["evt1"] }],
    async (_ref, dest) => {
      const { writeFile } = await import("node:fs/promises");
      await writeFile(dest, "bytes");
      return { dest, size: 5, url: "https://ipfs.io/ipfs/" + CID };
    },
  );
  const listing = await readdir(path.join(folder, JACK, "media"));
  assert.deepEqual(listing, [`${CID}-photo.jpg`]);
  const savedEvents = JSON.parse(await readFile(path.join(folder, JACK, "events.json"), "utf8"));
  assert.equal(savedEvents.length, 1);
  const manifest = JSON.parse(await readFile(path.join(folder, JACK, "media.json"), "utf8"));
  assert.equal(manifest[0].ok, true);
});

test("backupNpubs handles one and many accounts", async () => {
  const folder = await mkdtemp(path.join(os.tmpdir(), "nostr-backup-"));
  const querySync = async (_relays, filter) => {
    const author = filter.authors[0];
    return [
      {
        id: author.slice(0, 8),
        pubkey: author,
        created_at: 1,
        kind: 1,
        tags: [],
        content: `hello ipfs://${CID}`,
        sig: "x",
      },
    ];
  };
  const download = async (_ref, dest) => {
    const { writeFile, mkdir } = await import("node:fs/promises");
    await mkdir(path.dirname(dest), { recursive: true });
    await writeFile(dest, "img");
    return { dest, size: 3, url: "gateway" };
  };

  const one = await backupNpubs({
    npubs: [JACK],
    folder,
    querySync,
    download,
    log: () => {},
  });
  assert.equal(one.length, 1);
  assert.equal(one[0].events, 1);
  assert.equal(one[0].ipfs, 1);

  const many = await backupNpubs({
    npubs: [JACK, FIAT],
    folder,
    querySync,
    download,
    log: () => {},
  });
  assert.equal(many.length, 2);
  const dirs = await readdir(folder);
  assert.ok(dirs.includes(JACK));
  assert.ok(dirs.includes(FIAT));
});
