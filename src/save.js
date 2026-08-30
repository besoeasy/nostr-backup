import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { gatewayUrls, mediaFilename } from "./ipfs.js";
import { summarizeMetadata } from "./metadata.js";

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

export async function downloadIpfs(ref, dest, { fetchImpl = globalThis.fetch, timeoutMs = 20000, gateways = [] } = {}) {
  const urls = gatewayUrls(ref, gateways);
  const parent = new AbortController();
  const timer = setTimeout(() => parent.abort(), timeoutMs);

  const attempt = async (url) => {
    const res = await fetchImpl(url, { signal: parent.signal, redirect: "follow" });
    if (!res.ok) throw new Error(`HTTP ${res.status} from ${url}`);
    const buf = Buffer.from(await res.arrayBuffer());
    if (!buf.length) throw new Error(`empty body from ${url}`);
    return { buf, url };
  };

  try {
    const { buf, url } = await Promise.any(urls.map((u) => attempt(u)));
    parent.abort();
    await ensureDir(path.dirname(dest));
    await writeFile(dest, buf);
    return { dest, size: buf.length, url };
  } catch (err) {
    const details = err?.errors?.map((e) => e.message).join("; ") || err.message || String(err);
    throw new Error(`failed to download ${ref.cid}: ${details}`);
  } finally {
    clearTimeout(timer);
  }
}

export async function saveNpubBackup(folder, npub, events, refs, download = downloadIpfs, log = () => {}, gateways = []) {
  const root = npubDir(folder, npub);
  const media = mediaDir(folder, npub);
  await ensureDir(media);
  await writeJson(path.join(root, "events.json"), events);
  await writeJson(path.join(root, "metadata.json"), summarizeMetadata(events));

  const manifest = [];
  for (const ref of refs) {
    const filename = mediaFilename(ref);
    const dest = path.join(media, filename);
    try {
      const result = await download(ref, dest, { gateways });
      manifest.push({
        cid: ref.cid,
        uri: ref.uri,
        filename,
        mime: ref.mime || "",
        size: result.size,
        source: result.url,
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
