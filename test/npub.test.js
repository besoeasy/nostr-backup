import assert from "node:assert/strict";
import test from "node:test";
import { decodePubkey, encodeNpub, uniqueNpubs } from "../src/npub.js";

const JACK = "npub180cvv07tjdrrgpa0j7j7tmnyl2yr6yr7l8j4s3evf6u64th6gkwsyjh6w6";
const JACK_HEX = "3bf0c63fcb93463407af97a5e5ee64fa883d107ef9e558472c4eb9aaaefa459d";

test("decodes npub and hex", () => {
  assert.equal(decodePubkey(JACK), JACK_HEX);
  assert.equal(decodePubkey(JACK_HEX), JACK_HEX);
  assert.equal(encodeNpub(JACK_HEX), JACK);
});

test("dedupes mixed npub and hex", () => {
  assert.deepEqual(uniqueNpubs([JACK, JACK_HEX, JACK]), [JACK]);
});

test("rejects garbage", () => {
  assert.throws(() => decodePubkey("not-a-key"));
});
