// lib/crypto/index.ts

// Configurable constants
export const PBKDF2_ITERATIONS = 600000;
export const ENCRYPTION_VERSION = 1;

/**
 * Utility to convert between Uint8Array and Base64 (for DB storage)
 */
export function bufferToBase64(buffer: Uint8Array): string {
  return btoa(String.fromCharCode(...buffer));
}

export function base64ToBuffer(base64: string): Uint8Array {
  const binary_string = atob(base64);
  const len = binary_string.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binary_string.charCodeAt(i);
  }
  return bytes;
}

/**
 * Generate a random Salt or IV
 */
export function generateRandomBytes(length: number): Uint8Array {
  const bytes = new Uint8Array(length);
  window.crypto.getRandomValues(bytes);
  return bytes;
}

/**
 * Derive the Key Encryption Key (KEK) from a password and salt using PBKDF2
 */
export async function deriveKek(password: string, salt: Uint8Array): Promise<CryptoKey> {
  const enc = new TextEncoder();
  const keyMaterial = await window.crypto.subtle.importKey(
    "raw",
    enc.encode(password),
    { name: "PBKDF2" },
    false,
    ["deriveBits", "deriveKey"]
  );

  return window.crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt: salt as BufferSource,
      iterations: PBKDF2_ITERATIONS,
      hash: "SHA-256",
    },
    keyMaterial,
    { name: "AES-GCM", length: 256 },
    true,
    ["wrapKey", "unwrapKey", "encrypt", "decrypt"]
  );
}

/**
 * Generate a random Master Encryption Key (MEK) for file encryption
 */
export async function generateMek(): Promise<CryptoKey> {
  return window.crypto.subtle.generateKey(
    {
      name: "AES-GCM",
      length: 256,
    },
    true, // Must be extractable to wrap it
    ["encrypt", "decrypt"]
  );
}

/**
 * Wrap the MEK using the KEK
 */
export async function wrapMek(mek: CryptoKey, kek: CryptoKey, iv: Uint8Array): Promise<Uint8Array> {
  const wrapped = await window.crypto.subtle.wrapKey(
    "raw",
    mek,
    kek,
    {
      name: "AES-GCM",
      iv: iv as BufferSource
    }
  );
  return new Uint8Array(wrapped);
}

/**
 * Unwrap the MEK using the KEK
 */
export async function unwrapMek(wrappedMek: Uint8Array, kek: CryptoKey, iv: Uint8Array): Promise<CryptoKey> {
  return window.crypto.subtle.unwrapKey(
    "raw",
    wrappedMek as BufferSource,
    kek,
    {
      name: "AES-GCM",
      iv: iv as BufferSource
    },
    {
      name: "AES-GCM",
      length: 256
    },
    true,
    ["encrypt", "decrypt"]
  );
}

/**
 * Encrypt a File using the MEK
 * Format: [1 byte version] [12 bytes IV] [Ciphertext]
 */
export async function encryptFile(file: File, mek: CryptoKey): Promise<Blob> {
  const iv = generateRandomBytes(12);
  const fileBuffer = await file.arrayBuffer();

  const ciphertext = await window.crypto.subtle.encrypt(
    {
      name: "AES-GCM",
      iv: iv as BufferSource
    },
    mek,
    fileBuffer
  );

  const version = new Uint8Array([ENCRYPTION_VERSION]);
  return new Blob([version as unknown as BlobPart, iv as unknown as BlobPart, ciphertext as unknown as BlobPart], { type: 'application/octet-stream' });
}

/**
 * Decrypt a File using the MEK
 */
export async function decryptFile(blob: Blob, mek: CryptoKey, originalMimeType: string): Promise<Blob> {
  const buffer = await blob.arrayBuffer();
  
  // Read version
  const version = new Uint8Array(buffer, 0, 1)[0];
  if (version !== ENCRYPTION_VERSION) {
    throw new Error("Unsupported encryption version or unencrypted file");
  }

  // Read IV
  const iv = new Uint8Array(buffer, 1, 12);
  
  // Read Ciphertext
  const ciphertext = new Uint8Array(buffer, 13);

  const decryptedBuffer = await window.crypto.subtle.decrypt(
    {
      name: "AES-GCM",
      iv: iv as BufferSource
    },
    mek,
    ciphertext as BufferSource
  );

  return new Blob([decryptedBuffer], { type: originalMimeType });
}
