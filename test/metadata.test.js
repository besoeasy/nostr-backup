import assert from "node:assert/strict";
import test from "node:test";
import {
  bookmarkIds,
  followList,
  kindCounts,
  latestEvent,
  parseProfile,
  relayList,
  summarizeMetadata,
} from "../src/metadata.js";

const A = "a".repeat(64);
const B = "b".repeat(64);
const C = "c".repeat(64);

function evt({ id, kind = 1, created_at, content = "", tags = [] }) {
  return { id, pubkey: A, kind, created_at, content, tags, sig: "sig" };
}

test("latestEvent picks the newest of a kind", () => {
  const latest = latestEvent(
    [
      evt({ id: "old", kind: 0, created_at: 1 }),
      evt({ id: "new", kind: 0, created_at: 5 }),
      evt({ id: "note", kind: 1, created_at: 9 }),
    ],
    0,
  );
  assert.equal(latest.id, "new");
});

test("parseProfile flattens kind-0 fields and tolerates bad JSON", () => {
  const p = parseProfile(
    evt({ kind: 0, created_at: 1, content: JSON.stringify({ name: "Jack", picture: "x.jpg", nip05: "jack@x.com" }) }),
  );
  assert.equal(p.name, "Jack");
  assert.equal(p.picture, "x.jpg");
  assert.equal(p.nip05, "jack@x.com");
  assert.equal(p.about, "");
  assert.equal(parseProfile(evt({ kind: 0, content: "{not json" })), null);
});

test("followList parses kind-3 p tags and dedupes", () => {
  const f = followList(
    evt({ kind: 3, created_at: 2, tags: [["p", A, "wss://relay.a"], ["p", B], ["p", B], ["p", "not-hex"]] }),
  );
  assert.deepEqual(f, [
    { pubkey: A, relay: "wss://relay.a" },
    { pubkey: B, relay: "" },
  ]);
});

test("relayList parses kind-10002 r tags with read/write marks", () => {
  const r = relayList(
    evt({ kind: 10002, created_at: 3, tags: [["r", "wss://a.com/", "read"], ["r", "wss://b.com"], ["r", "wss://a.com"]] }),
  );
  assert.deepEqual(r, [
    { url: "wss://a.com", read: true, write: false },
    { url: "wss://b.com", read: false, write: false },
  ]);
});

test("bookmarkIds collects e tags", () => {
  const b = bookmarkIds(evt({ kind: 10003, tags: [["e", "ev1"], ["e", "ev2"], ["t", "x"]] }));
  assert.deepEqual(b, ["ev1", "ev2"]);
});

test("kindCounts tallies archived events", () => {
  const counts = kindCounts([
    evt({ kind: 1, created_at: 1, id: "1" }),
    evt({ kind: 1, created_at: 2, id: "2" }),
    evt({ kind: 3, created_at: 3, id: "3" }),
    { id: "nokind" },
  ]);
  assert.deepEqual(counts, { 1: 2, 3: 1 });
});

test("summarizeMetadata builds a complete discovery summary", () => {
  const events = [
    evt({ id: "0", kind: 0, created_at: 5, content: JSON.stringify({ name: "Jack", nip05: "jack@x" }) }),
    evt({ id: "3", kind: 3, created_at: 4, tags: [["p", B], ["r", "wss://hint.com"]] }),
    evt({ id: "10002", kind: 10002, created_at: 6, tags: [["r", "wss://official.com", "read"]] }),
    evt({ id: "1a", kind: 1, created_at: 1 }),
    evt({ id: "1b", kind: 1, created_at: 2 }),
  ];
  const s = summarizeMetadata(events);
  assert.equal(s.profile.name, "Jack");
  assert.equal(s.profile_at, 5);
  assert.deepEqual(s.follows, [{ pubkey: B, relay: "" }]);
  assert.deepEqual(s.relays, [{ url: "wss://official.com", read: true, write: false }]);
  assert.deepEqual(s.kinds, { 0: 1, 3: 1, 10002: 1, 1: 2 });
  assert.equal(s.event_count, 5);
});

test("relays falls back to kind-3 relay hints when no 10002 event", () => {
  const s = summarizeMetadata([
    evt({ id: "3", kind: 3, created_at: 4, tags: [["p", B], ["r", "wss://hint.com"]] }),
  ]);
  assert.deepEqual(s.relays, [{ url: "wss://hint.com", read: false, write: false }]);
});

test("empty profile stays null, empty follows/relays", () => {
  const s = summarizeMetadata([evt({ id: "1", kind: 1, created_at: 1 })]);
  assert.equal(s.profile, null);
  assert.deepEqual(s.follows, []);
  assert.deepEqual(s.relays, []);
  assert.deepEqual(s.bookmarks, []);
  assert.equal(s.event_count, 1);
});

test("metadata summary is written by saveNpubBackup", async () => {
  const { mkdtemp, readFile } = await import("node:fs/promises");
  const os = await import("node:os");
  const path = await import("node:path");
  const { saveNpubBackup } = await import("../src/save.js");
  const folder = await mkdtemp(path.join(os.tmpdir(), "nostr-meta-"));
  const events = [
    evt({ id: "0", kind: 0, created_at: 2, content: JSON.stringify({ name: "Jack" }) }),
    evt({ id: "1", kind: 1, created_at: 1 }),
  ];
  await saveNpubBackup(folder, A, events, [], async () => ({}));
  const meta = JSON.parse(await readFile(path.join(folder, A, "metadata.json"), "utf8"));
  assert.equal(meta.profile.name, "Jack");
  assert.equal(meta.event_count, 2);
});
