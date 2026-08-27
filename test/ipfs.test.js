import assert from "node:assert/strict";
import test from "node:test";
import {
  extractIpfsRefs,
  extractIpfsRefsFromEvents,
  parseIpfsUri,
  mediaFilename,
  validCID,
} from "../src/ipfs.js";

const CID = "bafybeicg2oxl5gah64cvk44phwsr33m42x3fvwg6b2kdt6v2iylndr2mqu";
const QID = "QmZtmD2qtMeK4B6usxBaTm2WpuFiHg8wf5YDrQj83b27Bm";

test("parses ipfs:// CIDv0 and v1", () => {
  assert.equal(parseIpfsUri(`ipfs://${CID}`).cid, CID);
  assert.equal(parseIpfsUri(`ipfs://${QID}`).cid, QID);
  assert.equal(parseIpfsUri(`ipfs://ipfs/${CID}`).cid, CID);
  assert.equal(parseIpfsUri(`ipfs://${CID}?filename=photo.jpg`).filename, "photo.jpg");
  assert.equal(parseIpfsUri(`ipfs://${CID}/dir/photo.jpg`).subpath, "dir/photo.jpg");
  assert.equal(parseIpfsUri("https://ipfs.io/ipfs/" + CID), null);
});

test("only ipfs:// is extracted, not gateways or bare CIDs", () => {
  const refs = extractIpfsRefs({
    kind: 1,
    content: `gateway https://ipfs.io/ipfs/${CID} bare ${QID} native ipfs://${QID}`,
  });
  assert.equal(refs.length, 1);
  assert.equal(refs[0].cid, QID);
  assert.equal(refs[0].uri, `ipfs://${QID}`);
});

test("reads imeta and url tags", () => {
  const sha = "a".repeat(64);
  const refs = extractIpfsRefs({
    kind: 1,
    content: "",
    tags: [
      ["imeta", `url ipfs://${CID}`, "m image/jpeg", `x ${sha}`, "filename shot.jpg"],
    ],
  });
  assert.equal(refs.length, 1);
  assert.equal(refs[0].mime, "image/jpeg");
  assert.equal(refs[0].sha256, sha);
  assert.equal(refs[0].filename, "shot.jpg");
});

test("ignores blossom/http fallbacks", () => {
  const refs = extractIpfsRefs({
    kind: 1,
    content: "",
    tags: [
      ["imeta", "url https://blossom.primal.net/photo.jpg", "fallback https://ipfs.io/ipfs/" + CID],
      ["url", "https://dweb.link/ipfs/" + CID],
    ],
  });
  assert.equal(refs.length, 0);
});

test("kind 1063 ipfs url tag", () => {
  const refs = extractIpfsRefs({
    kind: 1063,
    tags: [
      ["url", `ipfs://${CID}`],
      ["m", "image/png"],
      ["filename", "file.png"],
    ],
  });
  assert.equal(refs[0].cid, CID);
  assert.equal(refs[0].mime, "image/png");
  assert.equal(refs[0].filename, "file.png");
});

test("dedupes refs across events", () => {
  const refs = extractIpfsRefsFromEvents([
    { id: "a", content: `ipfs://${CID}` },
    { id: "b", content: `see ipfs://${CID}?filename=x.png` },
  ]);
  assert.equal(refs.length, 1);
  assert.deepEqual(refs[0].eventIds, ["a", "b"]);
});

test("media filename stays unique per cid", () => {
  assert.equal(mediaFilename({ cid: CID, filename: "shot.jpg" }), `${CID}-shot.jpg`);
  assert.equal(mediaFilename({ cid: CID, mime: "image/png" }), `${CID}.png`);
  assert.ok(validCID(CID));
  assert.ok(validCID(QID));
  assert.equal(validCID("notacid"), false);
});
