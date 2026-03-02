/** Internal representation — never stored as a plaintext object in IndexedDB. */
export type EncryptedPayload = {
  readonly iv: Uint8Array;
  readonly ciphertext: Uint8Array;
};

/** Base64-encoded combined iv+ciphertext for IndexedDB storage. */
export type SerializedEncryptedPayload = {
  readonly data: string;
};
