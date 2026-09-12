/**
 * Client-side Ed25519 Cryptographic Utilities for P2P Energy Marketplace
 * Uses native Web Crypto API (SubtleCrypto) supported in all modern browsers and Node 18+.
 */

export interface KeyPairResult {
  publicKeyHex: string;
  privateKey: CryptoKey;
  publicKey: CryptoKey;
}

/**
 * Converts an ArrayBuffer to a lowercase hex string
 */
export function bufferToHex(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * Converts a hex string to a Uint8Array
 */
export function hexToBytes(hex: string): Uint8Array {
  const cleanHex = hex.trim();
  const bytes = new Uint8Array(cleanHex.length / 2);
  for (let i = 0; i < cleanHex.length; i += 2) {
    bytes[i / 2] = parseInt(cleanHex.substring(i, i + 2), 16);
  }
  return bytes;
}

// Local storage key for persistent user keypair demo
const KEY_STORAGE_PREFIX = "p2p_energy_ed25519_key_";

/**
 * Generates an Ed25519 KeyPair using Web Crypto API.
 */
export async function generateEd25519KeyPair(): Promise<{
  publicKeyHex: string;
  keyPair: CryptoKeyPair;
}> {
  const keyPair = (await window.crypto.subtle.generateKey(
    {
      name: "Ed25519",
    },
    true, // extractable for exporting public key
    ["sign", "verify"]
  )) as CryptoKeyPair;

  const rawPub = await window.crypto.subtle.exportKey("raw", keyPair.publicKey);
  const publicKeyHex = bufferToHex(rawPub);

  return { publicKeyHex, keyPair };
}

/**
 * Signs a message byte array or SHA-256 hash using the Ed25519 private key.
 * Returns 64-byte signature formatted as 128-char hex string.
 */
export async function signWithEd25519(
  privateKey: CryptoKey,
  dataToSign: Uint8Array | ArrayBuffer
): Promise<string> {
  const dataBuffer: BufferSource = dataToSign instanceof Uint8Array ? (dataToSign.buffer as ArrayBuffer) : dataToSign;
  const signature = await window.crypto.subtle.sign(
    {
      name: "Ed25519",
    },
    privateKey,
    dataBuffer
  );
  return bufferToHex(signature);
}

/**
 * Verifies an Ed25519 signature in the browser.
 */
export async function verifyWithEd25519(
  publicKey: CryptoKey,
  signatureBytes: Uint8Array,
  data: Uint8Array
): Promise<boolean> {
  return await window.crypto.subtle.verify(
    {
      name: "Ed25519",
    },
    publicKey,
    signatureBytes.buffer as ArrayBuffer,
    data.buffer as ArrayBuffer
  );
}

// In-memory key store for the active session to avoid exposing private keys
const sessionKeyStore: Record<string, { keyPair: CryptoKeyPair; publicKeyHex: string }> = {};

export function setSessionKeyPair(userId: string, keyPair: CryptoKeyPair, publicKeyHex?: string) {
  sessionKeyStore[userId] = {
    keyPair,
    publicKeyHex: publicKeyHex || "",
  };
}

export function getSessionKeyPair(userId: string): CryptoKeyPair | null {
  return sessionKeyStore[userId]?.keyPair || null;
}

export function getSessionPublicKey(userId: string): string | null {
  return sessionKeyStore[userId]?.publicKeyHex || null;
}
