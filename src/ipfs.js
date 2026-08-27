const CID_V0 = /^Qm[1-9A-HJ-NP-Za-km-z]{44}$/;
const CID_V1 = /^b[a-z2-7]{50,}$/i;
const IPFS_URI_RE = /ipfs:\/\/[^\s"'<>)\]\\,;]+/gi;

export const IPFS_GATEWAYS = [
  "https://ipfs.io/ipfs/",
  "https://dweb.link/ipfs/",
  "https://cloudflare-ipfs.com/ipfs/",
  "https://gateway.pinata.cloud/ipfs/",
];

export function validCID(value) {
  const cid = String(value || "").trim();
  if (CID_V0.test(cid)) return true;
  if (CID_V1.test(cid) && (cid.toLowerCase().startsWith("baf") || cid.toLowerCase().startsWith("bag") || cid.toLowerCase().startsWith("b"))) {
    return cid.length >= 50 && cid.length <= 120;
  }
  return false;
}

export function parseIpfsUri(raw) {
  const text = String(raw || "").trim().replace(/[.,;]+$/, "");
  if (!text.toLowerCase().startsWith("ipfs://")) return null;
  let rest = text.slice("ipfs://".length);
  rest = rest.replace(/^ipfs\//i, "");
  const qIndex = rest.indexOf("?");
  const pathPart = qIndex >= 0 ? rest.slice(0, qIndex) : rest;
  const query = qIndex >= 0 ? rest.slice(qIndex + 1) : "";
  const segments = pathPart.split("/").filter(Boolean);
  if (!segments.length) return null;
  const cid = segments[0];
  if (!validCID(cid)) return null;
  const subpath = segments.slice(1).join("/");
  const params = new URLSearchParams(query);
  const filename = params.get("filename") || (subpath ? subpath.split("/").pop() : "") || "";
  return {
    cid,
    uri: `ipfs://${[cid, subpath].filter(Boolean).join("/")}`,
    subpath,
    filename,
    mime: "",
    sha256: "",
  };
}

function addRef(map, ref, extra = {}) {
  if (!ref) return;
  const current = map.get(ref.cid) || { ...ref };
  for (const [key, value] of Object.entries({ ...ref, ...extra })) {
    if (value && !current[key]) current[key] = value;
  }
  map.set(ref.cid, current);
}

function parseImeta(parts) {
  const fields = {};
  for (const part of parts) {
    const text = String(part || "").trim();
    const space = text.indexOf(" ");
    if (space < 0) continue;
    fields[text.slice(0, space).toLowerCase()] = text.slice(space + 1).trim();
  }
  const url = fields.url || "";
  const ref = parseIpfsUri(url);
  if (!ref) return null;
  ref.mime = fields.m || "";
  ref.sha256 = /^[0-9a-f]{64}$/i.test(fields.x || "") ? fields.x.toLowerCase() : "";
  ref.filename = fields.filename || fields.name || ref.filename;
  return ref;
}

function scanText(text, map) {
  if (!text) return;
  const matches = String(text).match(IPFS_URI_RE) || [];
  for (const match of matches) {
    addRef(map, parseIpfsUri(match));
  }
}

/** Collect ipfs:// references only. HTTP gateways and bare CIDs are ignored. */
export function extractIpfsRefs(event) {
  const map = new Map();
  scanText(event?.content, map);

  const tags = Array.isArray(event?.tags) ? event.tags : [];
  let fileUrl = "";
  let fileMime = "";
  let fileSha = "";
  let fileName = "";

  for (const tag of tags) {
    if (!Array.isArray(tag) || tag.length < 2) continue;
    const name = tag[0];
    if (name === "imeta") {
      addRef(map, parseImeta(tag.slice(1)));
      continue;
    }
    if (name === "url") {
      fileUrl = tag[1];
      addRef(map, parseIpfsUri(tag[1]));
      continue;
    }
    if (name === "m") fileMime = tag[1];
    if (name === "x" && /^[0-9a-f]{64}$/i.test(tag[1] || "")) fileSha = tag[1].toLowerCase();
    if (name === "filename" || name === "name") fileName = tag[1];
    for (const part of tag.slice(1)) scanText(part, map);
  }

  if (fileUrl) {
    addRef(map, parseIpfsUri(fileUrl), {
      mime: fileMime,
      sha256: fileSha,
      filename: fileName,
    });
  } else if (map.size && (fileMime || fileSha || fileName)) {
    for (const ref of map.values()) {
      if (!ref.mime) ref.mime = fileMime;
      if (!ref.sha256) ref.sha256 = fileSha;
      if (!ref.filename) ref.filename = fileName;
    }
  }

  return [...map.values()];
}

export function extractIpfsRefsFromEvents(events) {
  const map = new Map();
  for (const event of events) {
    for (const ref of extractIpfsRefs(event)) {
      addRef(map, { ...ref, eventId: event.id, kind: event.kind });
      const stored = map.get(ref.cid);
      if (!stored.eventIds) stored.eventIds = [];
      if (event.id && !stored.eventIds.includes(event.id)) stored.eventIds.push(event.id);
    }
  }
  return [...map.values()];
}

export function gatewayUrls(ref) {
  const path = ref.subpath ? `${ref.cid}/${ref.subpath}` : ref.cid;
  const suffix = ref.filename && !ref.subpath ? `?filename=${encodeURIComponent(ref.filename)}` : "";
  return IPFS_GATEWAYS.map((base) => `${base}${path}${suffix}`);
}

export function mediaFilename(ref) {
  const cid = ref.cid;
  const name = String(ref.filename || "").split(/[\\/]/).pop() || "";
  const safe = name.replace(/[^a-zA-Z0-9._-]+/g, "_").replace(/^[.]+/, "");
  if (safe && safe !== cid) return `${cid}-${safe}`;
  const mimeExt = {
    "image/jpeg": ".jpg",
    "image/jpg": ".jpg",
    "image/png": ".png",
    "image/gif": ".gif",
    "image/webp": ".webp",
    "video/mp4": ".mp4",
    "audio/mpeg": ".mp3",
  }[String(ref.mime || "").toLowerCase()];
  return mimeExt ? `${cid}${mimeExt}` : cid;
}
