import { SimplePool, useWebSocketImplementation } from "nostr-tools/pool";
import WebSocket from "ws";
import { decodePubkey, encodeNpub, uniqueNpubs } from "./npub.js";
import { mergeRelays } from "./relays.js";
import { fetchAllEvents } from "./fetch.js";
import { extractIpfsRefsFromEvents } from "./ipfs.js";
import { saveNpubBackup } from "./save.js";

useWebSocketImplementation(WebSocket);

export async function backupNpubs({
  npubs,
  folder = "backup",
  extraRelays = [],
  maxWait = 8000,
  maxPages = 50,
  querySync,
  download,
  log = console.log,
} = {}) {
  const accounts = uniqueNpubs(npubs);
  if (!accounts.length) {
    throw new Error("pass one or more npubs");
  }

  const relays = mergeRelays(extraRelays);
  const pool = querySync ? null : new SimplePool();
  const query =
    querySync ||
    ((urls, filter, params) => pool.querySync(urls, filter, params));

  log(`relays: ${relays.length}`);
  const summary = [];

  try {
    for (const npub of accounts) {
      const pubkey = decodePubkey(npub);
      log(`fetching ${npub}`);
      const events = await fetchAllEvents({
        querySync: query,
        relays,
        pubkey,
        maxWait,
        maxPages,
      });
      const refs = extractIpfsRefsFromEvents(events);
      log(`${npub}: ${events.length} events, ${refs.length} ipfs:// objects`);
      const saved = await saveNpubBackup(folder, encodeNpub(pubkey), events, refs, download, log);
      summary.push({
        npub,
        events: events.length,
        ipfs: refs.length,
        saved: saved.manifest.filter((item) => item.ok).length,
        failed: saved.manifest.filter((item) => !item.ok).length,
        dir: saved.root,
      });
    }
  } finally {
    if (pool) {
      try {
        pool.close(relays);
        pool.destroy();
      } catch {
        // ignore pool close races
      }
    }
  }

  return summary;
}
