function splitList(value) {
  if (!value) return [];
  return String(value)
    .split(/[\s,;]+/)
    .map((part) => part.trim())
    .filter(Boolean);
}

function takeValue(argv, index, flag) {
  const next = argv[index + 1];
  if (!next || next.startsWith("-")) {
    throw new Error(`${flag} requires a value`);
  }
  return next;
}

export function parseArgs(argv, env = process.env) {
  const positional = [];
  const extraRelays = [];
  let folder = env.FOLDER || env.OUTPUT_DIR || env.OUT || "backup";
  let maxWait = Number(env.MAX_WAIT || 8000);
  let maxPages = Number(env.PAGES || 50);
  let help = false;

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--help" || arg === "-h") {
      help = true;
      continue;
    }
    if (arg === "--folder" || arg === "-o" || arg === "--out") {
      folder = takeValue(argv, i, arg);
      i++;
      continue;
    }
    if (arg.startsWith("--folder=")) {
      folder = arg.slice("--folder=".length);
      continue;
    }
    if (arg === "--relays" || arg === "-r" || arg === "--relay") {
      extraRelays.push(...splitList(takeValue(argv, i, arg)));
      i++;
      continue;
    }
    if (arg.startsWith("--relays=")) {
      extraRelays.push(...splitList(arg.slice("--relays=".length)));
      continue;
    }
    if (arg === "--timeout" || arg === "--max-wait") {
      maxWait = Number(takeValue(argv, i, arg));
      i++;
      continue;
    }
    if (arg === "--pages") {
      maxPages = Number(takeValue(argv, i, arg));
      i++;
      continue;
    }
    if (arg.startsWith("-")) {
      throw new Error(`unknown option: ${arg}`);
    }
    positional.push(arg);
  }

  extraRelays.push(...splitList(env.RELAYS || env.NOSTR_RELAYS || ""));
  const envNpubs = splitList(env.NPUB || env.NPUBS || env.NOSTR_NPUBS || "");
  const npubs = [...positional, ...envNpubs];

  return {
    help,
    folder,
    extraRelays,
    npubs,
    maxWait: Number.isFinite(maxWait) && maxWait > 0 ? maxWait : 8000,
    maxPages: Number.isFinite(maxPages) && maxPages > 0 ? maxPages : 50,
  };
}

export const USAGE = `Backup Nostr events and ipfs:// media for one or many npubs.

Usage:
  npx github:besoeasy/nostr-backup <npub...> [options]

Examples:
  npx github:besoeasy/nostr-backup npub1abc...
  npx github:besoeasy/nostr-backup npub1abc... npub1def...
  npx github:besoeasy/nostr-backup --folder ./archive --relays wss://my.relay npub1abc...

Options:
  --folder, -o <dir>     Output folder (default: ./backup)
  --relays, -r <urls>    Extra relays, comma-separated (added to popular relays)
  --timeout <ms>         Relay wait per page (default: 8000)
  --pages <n>            Max history pages per npub (default: 50)
  --help, -h

Env:
  NPUB / NPUBS / NOSTR_NPUBS
  RELAYS / NOSTR_RELAYS
  FOLDER / OUTPUT_DIR

Layout:
  <folder>/<npub>/events.json
  <folder>/<npub>/media.json
  <folder>/<npub>/media/<file>
`;
