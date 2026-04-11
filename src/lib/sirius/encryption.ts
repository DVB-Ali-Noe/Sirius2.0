import {
  randomBytes,
  createCipheriv,
  createDecipheriv,
  createHash,
} from "crypto";

const ALGO = "aes-256-gcm";
const KEY_LENGTH = 32;
const IV_LENGTH = 12;
const TAG_LENGTH = 16;

export interface EncryptedPayload {
  ciphertext: string;
  iv: string;
  tag: string;
}

export function generateMasterKey(): Buffer {
  return randomBytes(KEY_LENGTH);
}

export function deriveKey(masterKey: Buffer, context: string): Buffer {
  return createHash("sha256")
    .update(masterKey)
    .update(context)
    .digest();
}

export function encrypt(plaintext: Buffer, key: Buffer): EncryptedPayload {
  if (key.length !== KEY_LENGTH) {
    throw new Error(`Invalid key length: expected ${KEY_LENGTH}, got ${key.length}`);
  }

  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGO, key, iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const tag = cipher.getAuthTag();

  return {
    ciphertext: ciphertext.toString("base64"),
    iv: iv.toString("base64"),
    tag: tag.toString("base64"),
  };
}

export function decrypt(payload: EncryptedPayload, key: Buffer): Buffer {
  if (key.length !== KEY_LENGTH) {
    throw new Error(`Invalid key length: expected ${KEY_LENGTH}, got ${key.length}`);
  }

  const iv = Buffer.from(payload.iv, "base64");
  const tag = Buffer.from(payload.tag, "base64");
  const ciphertext = Buffer.from(payload.ciphertext, "base64");

  if (iv.length !== IV_LENGTH) {
    throw new Error("Invalid IV length");
  }
  if (tag.length !== TAG_LENGTH) {
    throw new Error("Invalid auth tag length");
  }

  const decipher = createDecipheriv(ALGO, key, iv);
  decipher.setAuthTag(tag);

  return Buffer.concat([decipher.update(ciphertext), decipher.final()]);
}

export function encodeKey(key: Buffer): string {
  return key.toString("base64");
}

export function decodeKey(encoded: string): Buffer {
  const key = Buffer.from(encoded, "base64");
  if (key.length !== KEY_LENGTH) {
    throw new Error("Invalid encoded key");
  }
  return key;
}
