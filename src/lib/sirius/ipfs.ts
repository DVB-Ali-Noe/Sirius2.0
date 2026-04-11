const PINATA_PIN_JSON_URL = "https://api.pinata.cloud/pinning/pinJSONToIPFS";
const PINATA_PIN_FILE_URL = "https://api.pinata.cloud/pinning/pinFileToIPFS";
const PINATA_GATEWAY = "https://gateway.pinata.cloud/ipfs";

function getJwt(): string | null {
  return process.env.PINATA_JWT ?? null;
}

export function isPinataConfigured(): boolean {
  return getJwt() !== null;
}

export interface PinResult {
  cid: string;
  size: number;
  pinnedAt: number;
}

export async function pinJson(obj: unknown, name: string): Promise<PinResult> {
  const jwt = getJwt();

  if (!jwt) {
    const json = JSON.stringify(obj);
    const cid = `mock-${simpleHash(json)}`;
    mockStore.set(cid, Buffer.from(json));
    return { cid, size: json.length, pinnedAt: Date.now() };
  }

  const res = await fetch(PINATA_PIN_JSON_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${jwt}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      pinataContent: obj,
      pinataMetadata: { name },
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Pinata pinJSON failed: ${res.status} ${text}`);
  }

  const data = (await res.json()) as { IpfsHash: string; PinSize: number };
  return {
    cid: data.IpfsHash,
    size: data.PinSize,
    pinnedAt: Date.now(),
  };
}

export async function pinBuffer(
  buffer: Buffer,
  name: string,
  contentType: string = "application/octet-stream"
): Promise<PinResult> {
  const jwt = getJwt();

  if (!jwt) {
    const cid = `mock-${simpleHash(buffer.toString("base64"))}`;
    mockStore.set(cid, buffer);
    return { cid, size: buffer.length, pinnedAt: Date.now() };
  }

  const blob = new Blob([new Uint8Array(buffer)], { type: contentType });
  const form = new FormData();
  form.append("file", blob, name);
  form.append("pinataMetadata", JSON.stringify({ name }));

  const res = await fetch(PINATA_PIN_FILE_URL, {
    method: "POST",
    headers: { Authorization: `Bearer ${jwt}` },
    body: form,
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Pinata pinFile failed: ${res.status} ${text}`);
  }

  const data = (await res.json()) as { IpfsHash: string; PinSize: number };
  return {
    cid: data.IpfsHash,
    size: data.PinSize,
    pinnedAt: Date.now(),
  };
}

export async function fetchFromIpfs(cid: string): Promise<Buffer> {
  if (cid.startsWith("mock-")) {
    const buf = mockStore.get(cid);
    if (!buf) throw new Error(`Mock IPFS: CID not found: ${cid}`);
    return buf;
  }

  const res = await fetch(`${PINATA_GATEWAY}/${cid}`);
  if (!res.ok) {
    throw new Error(`IPFS fetch failed: ${res.status}`);
  }

  const arrayBuffer = await res.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

const mockStore = new Map<string, Buffer>();

function simpleHash(s: string): string {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = ((h << 5) - h + s.charCodeAt(i)) | 0;
  }
  return Math.abs(h).toString(16).padStart(8, "0") + Date.now().toString(16);
}
