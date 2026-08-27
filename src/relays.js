/** Popular public relays, matching Originless plus a few high-traffic peers. */
export const POPULAR_RELAYS = [
  "wss://relay.damus.io",
  "wss://nos.lol",
  "wss://relay.nostr.band",
  "wss://relay.primal.net",
  "wss://nostr.mom",
  "wss://purplerelay.com",
  "wss://offchain.pub",
  "wss://eden.nostr.land",
  "wss://relay.snort.social",
  "wss://nostr.wine",
  "wss://purplepag.es",
  "wss://relay.nostr.bg",
];

export function normalizeRelay(url) {
  const value = String(url || "").trim();
  if (!value) return "";
  if (value.startsWith("wss://") || value.startsWith("ws://")) return value.replace(/\/+$/, "");
  return `wss://${value.replace(/\/+$/, "")}`;
}

export function mergeRelays(extra = []) {
  const seen = new Set();
  const out = [];
  for (const raw of [...POPULAR_RELAYS, ...extra]) {
    const url = normalizeRelay(raw);
    if (!url || seen.has(url)) continue;
    seen.add(url);
    out.push(url);
  }
  return out;
}
