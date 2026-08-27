import assert from "node:assert/strict";
import test from "node:test";
import { parseArgs, USAGE } from "../src/args.js";

test("parses one or many npubs", () => {
  const one = parseArgs(["npub1abc"], {});
  assert.deepEqual(one.npubs, ["npub1abc"]);
  const many = parseArgs(["npub1abc", "npub1def"], {});
  assert.deepEqual(many.npubs, ["npub1abc", "npub1def"]);
});

test("folder and extra relays can be added", () => {
  const args = parseArgs(
    ["--folder", "./archive", "--relays", "wss://custom.relay,wss://other.relay", "npub1abc"],
    {},
  );
  assert.equal(args.folder, "./archive");
  assert.deepEqual(args.extraRelays, ["wss://custom.relay", "wss://other.relay"]);
});

test("pages flag", () => {
  assert.equal(parseArgs(["--pages", "1", "npub1abc"], {}).maxPages, 1);
});

test("env npubs and relays merge in", () => {
  const args = parseArgs(["npub1cli"], {
    NPUBS: "npub1env",
    RELAYS: "wss://env.relay",
    FOLDER: "from-env",
  });
  assert.deepEqual(args.npubs, ["npub1cli", "npub1env"]);
  assert.deepEqual(args.extraRelays, ["wss://env.relay"]);
  assert.equal(args.folder, "from-env");
});

test("help flag", () => {
  assert.equal(parseArgs(["--help"], {}).help, true);
  assert.match(USAGE, /npx github:besoeasy\/nostr-backup/);
});

test("unknown option throws", () => {
  assert.throws(() => parseArgs(["--nope"], {}), /unknown option/);
});
