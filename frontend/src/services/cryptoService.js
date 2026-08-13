// Client-side End-to-End Encryption Engine using Web Crypto API

const DB_NAME = "ZyloCryptoDB";
const STORE_NAME = "private_keys";

// --- Binary/Base64 Converters ---
const arrayBufferToBase64 = (buffer) => {
  let binary = '';
  const bytes = new Uint8Array(buffer);
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return window.btoa(binary);
};

const base64ToArrayBuffer = (base64) => {
  const binaryString = window.atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes.buffer;
};

// --- Key Management & Persistence ---

export const savePrivateKeyLocally = async (userId, privateKeyBase64) => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = (e) => {
      e.target.result.createObjectStore(STORE_NAME);
    };
    request.onsuccess = (e) => {
      const db = e.target.result;
      const tx = db.transaction(STORE_NAME, "readwrite");
      const store = tx.objectStore(STORE_NAME);
      store.put(privateKeyBase64, userId);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    };
    request.onerror = () => reject(request.error);
  });
};

export const loadPrivateKeyLocally = async (userId) => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = (e) => {
      e.target.result.createObjectStore(STORE_NAME);
    };
    request.onsuccess = (e) => {
      const db = e.target.result;
      const tx = db.transaction(STORE_NAME, "readonly");
      const store = tx.objectStore(STORE_NAME);
      const getReq = store.get(userId);
      getReq.onsuccess = () => resolve(getReq.result);
      getReq.onerror = () => reject(getReq.error);
    };
    request.onerror = () => reject(request.error);
  });
};

// --- Cryptographic Operations ---

// 1. Generate ECDH Keypair (P-256 curve)
export const generateKeyPair = async () => {
  const keyPair = await window.crypto.subtle.generateKey(
    { name: "ECDH", namedCurve: "P-256" },
    true, // extractable
    ["deriveKey"]
  );

  // Export public key to SPKI base64
  const spki = await window.crypto.subtle.exportKey("spki", keyPair.publicKey);
  const publicKeyBase64 = arrayBufferToBase64(spki);

  // Export private key to PKCS8 base64
  const pkcs8 = await window.crypto.subtle.exportKey("pkcs8", keyPair.privateKey);
  const privateKeyBase64 = arrayBufferToBase64(pkcs8);

  return { publicKey: publicKeyBase64, privateKey: privateKeyBase64 };
};

// 2. Import ECDH Public Key from base64
export const importPublicKey = async (publicKeyBase64) => {
  return window.crypto.subtle.importKey(
    "spki",
    base64ToArrayBuffer(publicKeyBase64),
    { name: "ECDH", namedCurve: "P-256" },
    true,
    []
  );
};

// 3. Import ECDH Private Key from base64
export const importPrivateKey = async (privateKeyBase64) => {
  return window.crypto.subtle.importKey(
    "pkcs8",
    base64ToArrayBuffer(privateKeyBase64),
    { name: "ECDH", namedCurve: "P-256" },
    true,
    ["deriveKey"]
  );
};

// 4. Derive Shared AES-GCM-256 Symmetric Key
export const deriveSharedKey = async (myPrivateKeyObj, otherPublicKeyObj) => {
  return window.crypto.subtle.deriveKey(
    { name: "ECDH", public: otherPublicKeyObj },
    myPrivateKeyObj,
    { name: "AES-GCM", length: 256 },
    false, // not extractable (highly secure)
    ["encrypt", "decrypt"]
  );
};

// 5. Encrypt plaintext using AES-GCM-256 key
export const encryptMessage = async (plaintext, aesKey) => {
  const iv = window.crypto.getRandomValues(new Uint8Array(12));
  const encoded = new TextEncoder().encode(plaintext);
  
  const ciphertextBuffer = await window.crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    aesKey,
    encoded
  );

  return {
    ciphertext: arrayBufferToBase64(ciphertextBuffer),
    iv: arrayBufferToBase64(iv)
  };
};

// 6. Decrypt ciphertext using AES-GCM-256 key and IV
export const decryptMessage = async (ciphertextBase64, ivBase64, aesKey) => {
  const ciphertext = base64ToArrayBuffer(ciphertextBase64);
  const iv = base64ToArrayBuffer(ivBase64);

  const decryptedBuffer = await window.crypto.subtle.decrypt(
    { name: "AES-GCM", iv },
    aesKey,
    ciphertext
  );

  return new TextDecoder().decode(decryptedBuffer);
};
