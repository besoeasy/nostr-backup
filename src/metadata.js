const HEX64 = /^[0-9a-f]{64}$/;

/** The most recent event of a given kind, newest first, stable tie-break. */
export function latestEvent(events, kind) {
  const matches = (events || [])
    .filter((e) => e && e.kind === kind && typeof e.created_at === "number")
    .sort(
      (a, b) =>
        b.created_at - a.created_at ||
        String(b.id || "").localeCompare(String(a.id || "")),
    );
  return matches[0] || null;
}

function safeJson(text) {
  if (!text) return null;
  try {
    const parsed = JSON.parse(text);
    return parsed && typeof parsed === "object" ? parsed : null;
  } catch {
    return null;
  }
}

/** Profile fields from a kind-0 event, flattened and de-nulled. */
export function parseProfile(event) {
  const raw = safeJson(event?.content);
  if (!raw) return null;
  const pick = (k) => (raw[k] == null ? "" : String(raw[k]));
  return {
    name: pick("name") || pick("display_name"),
    display_name: pick("display_name"),
    about: pick("about"),
    picture: pick("picture"),
    banner: pick("banner"),
    nip05: pick("nip05"),
    website: pick("website"),
    lud16: pick("lud16"),
  };
}

/** People the account follows (kind 3 `p` tags). */
export function followList(event) {
  const seen = new Set();
  const out = [];
  for (const tag of event?.tags || []) {
    if (!Array.isArray(tag) || String(tag[0]) !== "p") continue;
    const pubkey = String(tag[1] || "").toLowerCase();
    if (!HEX64.test(pubkey) || seen.has(pubkey)) continue;
    seen.add(pubkey);
    out.push({ pubkey, relay: String(tag[2] || "") });
  }
  return out;
}

function matchesRelay(tag) {
  const name = String(tag?.[0] || "").toLowerCase();
  return name === "r" || name === "relay";
}

/** Relays the account shares (kind 10002 `r` tags, falling back to kind 3 hints). */
export function relayList(event) {
  const seen = new Set();
  const out = [];
  for (const tag of event?.tags || []) {
    if (!Array.isArray(tag) || !matchesRelay(tag)) continue;
    const url = String(tag[1] || "").trim().replace(/\/+$/, "");
    if (!url || seen.has(url)) continue;
    seen.add(url);
    const mark = String(tag[2] || "");
    out.push({
      url,
      read: /read/i.test(mark),
      write: /write/i.test(mark),
    });
  }
  return out;
}

/** bookmark event (kind 10003) `e` tags */
export function bookmarkIds(event) {
  const out = [];
  for (const tag of event?.tags || []) {
    if (Array.isArray(tag) && String(tag[0]) === "e" && tag[1]) out.push(tag[1]);
  }
  return out;
}

/** how many events of each kind are archived (discovery of what's in the backup) */
export function kindCounts(events) {
  const counts = {};
  for (const e of events || []) {
    const kind = e?.kind;
    if (kind == null) continue;
    counts[kind] = (counts[kind] || 0) + 1;
  }
  return counts;
}

/**
 * Derive a friendly metadata + discovery summary from an author's events.
 * Pure: no I/O, safe to run over any event list.
 */
export function summarizeMetadata(events) {
  const profileEvent = latestEvent(events, 0);
  const contactsEvent = latestEvent(events, 3);
  const relaysEvent = latestEvent(events, 10002);
  const bookmarksEvent = latestEvent(events, 10003);

  const profile = parseProfile(profileEvent);
  const relays = relayList(relaysEvent);
  const contactsRelays = relayList(contactsEvent);

  return {
    profile,
    profile_at: profileEvent?.created_at ?? null,
    follows: followList(contactsEvent),
    follows_at: contactsEvent?.created_at ?? null,
    relays: relays.length ? relays : contactsRelays,
    bookmarks: bookmarkIds(bookmarksEvent),
    bookmark_ids_at: bookmarksEvent?.created_at ?? null,
    kinds: kindCounts(events),
    event_count: (events || []).length,
  };
}
