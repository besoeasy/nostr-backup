import { parseArgs, USAGE } from "./args.js";
import { backupNpubs } from "./backup.js";

const args = (() => {
  try {
    return parseArgs(process.argv.slice(2));
  } catch (err) {
    console.error(err.message);
    console.error(USAGE);
    process.exit(1);
  }
})();

if (args.help) {
  console.log(USAGE);
  process.exit(0);
}

if (!args.npubs.length) {
  console.error("pass one or more npubs");
  console.error(USAGE);
  process.exit(1);
}

try {
  const summary = await backupNpubs({
    npubs: args.npubs,
    folder: args.folder,
    extraRelays: args.extraRelays,
    extraGateways: args.extraGateways,
    maxWait: args.maxWait,
    maxPages: args.maxPages,
  });
  console.log("done");
  for (const row of summary) {
    console.log(
      `${row.npub}: ${row.events} events, ${row.saved}/${row.ipfs} ipfs files -> ${row.dir}`,
    );
  }
  process.exit(0);
} catch (err) {
  console.error(err.message || err);
  process.exit(1);
}
