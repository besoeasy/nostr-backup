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

## What you get

```
backup/
└── npub1.../
    ├── events.json    ← every event found for that pubkey
    ├── media.json     ← ipfs:// objects and download results
    └── media/         ← downloaded IPFS files
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
