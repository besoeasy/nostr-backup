function withTimeout(promise, ms) {
  let timer;
  return Promise.race([
    Promise.resolve(promise),
    new Promise((_, reject) => {
      timer = setTimeout(() => reject(new Error(`query timed out after ${ms}ms`)), ms);
    }),
  ]).finally(() => clearTimeout(timer));
}

export async function fetchAllEvents({
  querySync,
  relays,
  pubkey,
  pageSize = 200,
  maxPages = 50,
  maxWait = 8000,
} = {}) {
  if (typeof querySync !== "function") {
    throw new Error("querySync is required");
  }
  if (!pubkey) {
    throw new Error("pubkey is required");
  }

  const byId = new Map();
  let until = Math.floor(Date.now() / 1000);

  for (let page = 0; page < maxPages; page++) {
    const filter = {
      authors: [pubkey],
      until,
      limit: pageSize,
    };
    let events = [];
    try {
      events = (await withTimeout(querySync(relays, filter, { maxWait }), maxWait + 4000)) || [];
    } catch {
      events = [];
    }
    if (!events.length) break;

    let newestNew = 0;
    let minTs = until;
    for (const event of events) {
      if (!event?.id) continue;
      if (!byId.has(event.id)) {
        byId.set(event.id, event);
        newestNew++;
      }
      if (event.created_at < minTs) minTs = event.created_at;
    }
    if (newestNew === 0) break;
    until = minTs - 1;
  }

  return [...byId.values()].sort((a, b) => b.created_at - a.created_at);
}
