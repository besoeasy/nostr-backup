import { nip19 } from "nostr-tools";

const HEX64 = /^[0-9a-f]{64}$/i;

export function decodePubkey(input) {
  const value = String(input || "").trim();
  if (!value) {
    throw new Error("empty npub");
  }
  if (HEX64.test(value)) {
    return value.toLowerCase();
  }
  const decoded = nip19.decode(value);
  if (decoded.type === "npub") {
    return decoded.data;
  }
  if (decoded.type === "nprofile") {
    return decoded.data.pubkey;
  }
  throw new Error(`expected npub, got ${decoded.type}`);
}

export function encodeNpub(pubkeyHex) {
  return nip19.npubEncode(decodePubkey(pubkeyHex));
}

export function uniqueNpubs(inputs) {
  const seen = new Set();
  const out = [];
  for (const raw of inputs) {
    const npub = encodeNpub(raw);
    if (seen.has(npub)) continue;
    seen.add(npub);
    out.push(npub);
  }
  return out;
}
