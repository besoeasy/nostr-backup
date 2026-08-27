import { createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { gatewayUrls, mediaFilename } from "./ipfs.js";

export async function ensureDir(dir) {
  await mkdir(dir, { recursive: true });
  return dir;
}

export async function writeJson(file, data) {
  await ensureDir(path.dirname(file));
  await writeFile(file, JSON.stringify(data, null, 2) + "\n", "utf8");
}

export function npubDir(folder, npub) {
  return path.join(folder, npub);
}

export function mediaDir(folder, npub) {
  return path.join(folder, npub, "media");
}

async function sha256Buffer(buf) {
  return createHash("sha256").update(buf).digest("hex");
}

export async function downloadIpfs(ref, dest, { fetchImpl = globalThis.fetch, timeoutMs = 30000 } = {}) {
  const urls = gatewayUrls(ref);
  let lastError = null;

  for (const url of urls) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetchImpl(url, { signal: controller.signal, redirect: "follow" });
      if (!res.ok) {
        lastError = new Error(`HTTP ${res.status} from ${url}`);
        continue;
      }
      const buf = Buffer.from(await res.arrayBuffer());
      if (!buf.length) {
        lastError = new Error(`empty body from ${url}`);
        continue;
      }
      const sha256 = await sha256Buffer(buf);
      if (ref.sha256 && ref.sha256 !== sha256) {
        lastError = new Error(`sha256 mismatch for ${ref.cid}`);
        continue;
      }
      await ensureDir(path.dirname(dest));
      await writeFile(dest, buf);
      return { dest, size: buf.length, sha256, url, verified: Boolean(ref.sha256) };
    } catch (err) {
      lastError = err;
    } finally {
      clearTimeout(timer);
    }
  }

  throw lastError || new Error(`failed to download ${ref.cid}`);
}

export async function saveNpubBackup(folder, npub, events, refs, download = downloadIpfs, log = () => {}) {
  const root = npubDir(folder, npub);
  const media = mediaDir(folder, npub);
  await ensureDir(media);
  await writeJson(path.join(root, "events.json"), events);

  const manifest = [];
  for (const ref of refs) {
    const filename = mediaFilename(ref);
    const dest = path.join(media, filename);
    try {
      const result = await download(ref, dest);
      manifest.push({
        cid: ref.cid,
        uri: ref.uri,
        filename,
        mime: ref.mime || "",
        size: result.size,
        sha256: result.sha256,
        source: result.url,
        verified: result.verified,
        eventIds: ref.eventIds || [],
        ok: true,
      });
      log(`saved ${npub}/media/${filename} (${result.size} bytes)`);
    } catch (err) {
      manifest.push({
        cid: ref.cid,
        uri: ref.uri,
        filename,
        eventIds: ref.eventIds || [],
        ok: false,
        error: err.message || String(err),
      });
      log(`failed ${ref.uri}: ${err.message || err}`);
    }
  }

  await writeJson(path.join(root, "media.json"), manifest);
  return { root, media, manifest };
}
