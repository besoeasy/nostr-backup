# nostr-backup

Backup [Nostr](https://github.com/nostr-protocol/nostr) posts and **`ipfs://` media** for one or many npubs. One command, local folder, no account.

This follows the same idea as [Originless](https://github.com/besoeasy/Originless) Nostr archive: read events from popular relays, keep only IPFS URIs (`ipfs://…`), and copy the bytes off-network.

---

## Run

```bash
npx github:besoeasy/nostr-backup npub1...
```

Many accounts:

```bash
npx github:besoeasy/nostr-backup npub1abc... npub1def...
```

Custom output folder and extra relays (popular relays are always included):

```bash
npx github:besoeasy/nostr-backup \
  --folder ./archive \
  --relays wss://my.relay,wss://another.relay \
  npub1abc...
```

---

## Docker (permanent backups every 45 minutes)

Run a scheduled, always-on backup on any server without installing Node. The container backs up on startup and then every `SCHEDULE_MINUTES` (default `45`) minutes, writing into a Docker named volume.

Create an `.env` file with the accounts to back up:

```bash
# .env  (at least one npub required)
NPUBS=npub1abc...,npub1def...
# optional
# SCHEDULE_MINUTES=45
# RELAYS=wss://my.relay,wss://another.relay
# EXTRA_GATEWAYS=http://localhost:3232
```

Then start it:

```bash
docker compose up -d --build
```

Backups land in the `nostr-backup-data` named volume (mounted at `/backup`). To also inspect them from the host, mount a local folder too (see the commented block in `docker-compose.yml`), e.g.:

```yaml
volumes:
  - nostr-backup-data:/backup
  - ./backup:/backup/host
```

Watch the logs:

```bash
docker compose logs -f
```

---

## What you get

```
backup/
└── npub1.../
    ├── events.json     ← every event found for that pubkey
    ├── metadata.json   ← profile, follows, relays, bookmarks + kind counts
    ├── media.json      ← ipfs:// objects and download results
    └── media/          ← downloaded IPFS files
```

`metadata.json` is a friendly, at-a-glance summary of the account for discovery — the latest kind-0 profile (name, picture, `nip05`, website…), the people they follow (kind 3), relay list (kind 10002), bookmarks (kind 10003), and how many events of each kind are archived:

```json
{
  "profile": { "name": "jack", "display_name": "", "about": "", "picture": "…", "banner": "", "nip05": "jack@…", "website": "", "lud16": "" },
  "profile_at": 1710000000,
  "follows": [ { "pubkey": "…", "relay": "wss://…" } ],
  "follows_at": 1710000000,
  "relays": [ { "url": "wss://relay.damus.io", "read": true, "write": false } ],
  "bookmarks": [ "…event-id…" ],
  "kinds": { "0": 1, "1": 120, "3": 1, "10002": 1 },
  "event_count": 123
}
```

Only `ipfs://` links are fetched. HTTP gateways, Blossom servers, and bare CIDs in text are ignored.

---

## Options

| Flag / env | Description |
| --- | --- |
| `<npub...>` | One or many npubs (hex pubkeys and `nprofile` also work) |
| `--folder`, `-o` / `FOLDER` | Output directory (default `./backup`) |
| `--relays`, `-r` / `RELAYS` | Extra `wss://` relays, comma-separated |
| `--gateway` / `IPFS_GATEWAYS` | Extra IPFS HTTP gateway (e.g. `http://localhost:3232` for Originless) |
| `--timeout` | Relay wait per page in ms (default `8000`) |
| `--pages` | Max history pages per npub (default `50`) |

`NPUB`, `NPUBS`, and `NOSTR_NPUBS` can supply accounts instead of (or in addition to) CLI args.

---

## Relays

Queries **all of these** by default, then any `--relays` you add:

- `wss://relay.damus.io`
- `wss://nos.lol`
- `wss://relay.nostr.band`
- `wss://relay.primal.net`
- `wss://nostr.mom`
- `wss://purplerelay.com`
- `wss://offchain.pub`
- `wss://eden.nostr.land`
- `wss://relay.snort.social`
- `wss://nostr.wine`
- `wss://purplepag.es`
- `wss://relay.nostr.bg`

Uses [`nostr-tools`](https://www.npmjs.com/package/nostr-tools) `SimplePool`. Bytes for `ipfs://` CIDs are pulled through public IPFS HTTP gateways, or a node you pass with `--gateway` (Originless on `:3232` works).
