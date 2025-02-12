/**
 * @fileoverview Enterprise-grade client-side storage utilities with encryption, versioning, and error handling
 * Implements AES-256-GCM encryption for secure data persistence with comprehensive type safety
 * @version 1.0.0
 */

import CryptoJS from 'crypto-js'; // v4.1.1
import type { IApiResponse } from '../interfaces/common.interface';

// Global configuration constants
const STORAGE_PREFIX = 'smart_apparel_';
const STORAGE_VERSION = '1.0';
const MAX_STORAGE_SIZE = 5 * 1024 * 1024; // 5MB limit
const RETRY_ATTEMPTS = 3;
const RETRY_DELAY = 100; // ms

// Encryption configuration
const ENCRYPTION_KEY = process.env.VITE_STORAGE_ENCRYPTION_KEY;
if (!ENCRYPTION_KEY) {
  throw new Error('Storage encryption key not configured');
}

/**
 * Storage item metadata interface for versioning and tracking
 */
interface IStorageMetadata {
  version: string;
  timestamp: number;
  encrypted: boolean;
  iv?: string;
  checksum?: string;
}

/**
 * Storage item wrapper interface with metadata
 */
interface IStorageWrapper<T> {
  data: T;
  metadata: IStorageMetadata;
}

/**
 * Stores data in localStorage with encryption and versioning support
 * @param key - Storage key
 * @param value - Data to store
 * @param encrypt - Whether to encrypt the data
 * @returns Promise resolving with operation status
 */
export async function setStorageItem<T>(
  key: string,
  value: T,
  encrypt: boolean = false
): Promise<IApiResponse<void>> {
  try {
    if (!key || value === undefined) {
      throw new Error('Invalid storage parameters');
    }

    // Check storage quota
    if (localStorage.length > 0 && JSON.stringify(value).length > MAX_STORAGE_SIZE) {
      throw new Error('Storage quota exceeded');
    }

    const prefixedKey = `${STORAGE_PREFIX}${key}`;
    let storageValue: IStorageWrapper<T | string> = {
      data: value,
      metadata: {
        version: STORAGE_VERSION,
        timestamp: Date.now(),
        encrypted: encrypt
      }
    };

    if (encrypt) {
      const encryptedData = await encryptData(value);
      storageValue.data = encryptedData.data;
      storageValue.metadata.iv = encryptedData.iv;
      storageValue.metadata.checksum = CryptoJS.SHA256(JSON.stringify(value)).toString();
    }

    // Implement retry mechanism
    let attempts = 0;
    while (attempts < RETRY_ATTEMPTS) {
      try {
        localStorage.setItem(prefixedKey, JSON.stringify(storageValue));
        break;
      } catch (error) {
        attempts++;
        if (attempts === RETRY_ATTEMPTS) throw error;
        await new Promise(resolve => setTimeout(resolve, RETRY_DELAY));
      }
    }

    return {
      success: true,
      data: void 0,
      timestamp: new Date(),
      latency: 0,
      requestId: crypto.randomUUID()
    };
  } catch (error) {
    return {
      success: false,
      data: void 0,
      error: {
        code: 'STORAGE_ERROR',
        message: error instanceof Error ? error.message : 'Storage operation failed',
        details: {},
        timestamp: new Date()
      },
      timestamp: new Date(),
      latency: 0,
      requestId: crypto.randomUUID()
    };
  }
}

/**
 * Retrieves and optionally decrypts data from localStorage
 * @param key - Storage key
 * @param encrypted - Whether the data is encrypted
 * @returns Promise resolving with retrieved value or null
 */
export async function getStorageItem<T>(
  key: string,
  encrypted: boolean = false
): Promise<IApiResponse<T | null>> {
  try {
    const prefixedKey = `${STORAGE_PREFIX}${key}`;
    const storedValue = localStorage.getItem(prefixedKey);

    if (!storedValue) {
      return {
        success: true,
        data: null,
        timestamp: new Date(),
        latency: 0,
        requestId: crypto.randomUUID()
      };
    }

    const wrapper: IStorageWrapper<T | string> = JSON.parse(storedValue);

    // Validate version
    if (wrapper.metadata.version !== STORAGE_VERSION) {
      throw new Error('Storage version mismatch');
    }

    if (wrapper.metadata.encrypted && encrypted) {
      if (!wrapper.metadata.iv) {
        throw new Error('Encryption IV missing');
      }

      const decryptedData = await decryptData<T>({
        data: wrapper.data as string,
        iv: wrapper.metadata.iv
      });

      // Verify data integrity
      const checksum = CryptoJS.SHA256(JSON.stringify(decryptedData)).toString();
      if (checksum !== wrapper.metadata.checksum) {
        throw new Error('Data integrity check failed');
      }

      return {
        success: true,
        data: decryptedData,
        timestamp: new Date(),
        latency: 0,
        requestId: crypto.randomUUID()
      };
    }

    return {
      success: true,
      data: wrapper.data as T,
      timestamp: new Date(),
      latency: 0,
      requestId: crypto.randomUUID()
    };
  } catch (error) {
    return {
      success: false,
      data: null,
      error: {
        code: 'STORAGE_ERROR',
        message: error instanceof Error ? error.message : 'Storage retrieval failed',
        details: {},
        timestamp: new Date()
      },
      timestamp: new Date(),
      latency: 0,
      requestId: crypto.randomUUID()
    };
  }
}

/**
 * Removes item from localStorage with metadata cleanup
 * @param key - Storage key
 * @returns Promise resolving with operation status
 */
export async function removeStorageItem(key: string): Promise<IApiResponse<void>> {
  try {
    const prefixedKey = `${STORAGE_PREFIX}${key}`;
    
    let attempts = 0;
    while (attempts < RETRY_ATTEMPTS) {
      try {
        localStorage.removeItem(prefixedKey);
        break;
      } catch (error) {
        attempts++;
        if (attempts === RETRY_ATTEMPTS) throw error;
        await new Promise(resolve => setTimeout(resolve, RETRY_DELAY));
      }
    }

    return {
      success: true,
      data: void 0,
      timestamp: new Date(),
      latency: 0,
      requestId: crypto.randomUUID()
    };
  } catch (error) {
    return {
      success: false,
      data: void 0,
      error: {
        code: 'STORAGE_ERROR',
        message: error instanceof Error ? error.message : 'Storage removal failed',
        details: {},
        timestamp: new Date()
      },
      timestamp: new Date(),
      latency: 0,
      requestId: crypto.randomUUID()
    };
  }
}

/**
 * Clears all app-specific storage items
 * @returns Promise resolving when clear is complete
 */
export async function clearStorage(): Promise<IApiResponse<void>> {
  try {
    const keys = Object.keys(localStorage);
    const appKeys = keys.filter(key => key.startsWith(STORAGE_PREFIX));

    for (const key of appKeys) {
      let attempts = 0;
      while (attempts < RETRY_ATTEMPTS) {
        try {
          localStorage.removeItem(key);
          break;
        } catch (error) {
          attempts++;
          if (attempts === RETRY_ATTEMPTS) throw error;
          await new Promise(resolve => setTimeout(resolve, RETRY_DELAY));
        }
      }
    }

    return {
      success: true,
      data: void 0,
      timestamp: new Date(),
      latency: 0,
      requestId: crypto.randomUUID()
    };
  } catch (error) {
    return {
      success: false,
      data: void 0,
      error: {
        code: 'STORAGE_ERROR',
        message: error instanceof Error ? error.message : 'Storage clear failed',
        details: {},
        timestamp: new Date()
      },
      timestamp: new Date(),
      latency: 0,
      requestId: crypto.randomUUID()
    };
  }
}

/**
 * Encrypts data using AES-256-GCM with secure IV generation
 * @param data - Data to encrypt
 * @returns Encrypted data with IV
 */
async function encryptData<T>(data: T): Promise<{ data: string; iv: string }> {
  const iv = CryptoJS.lib.WordArray.random(16);
  const stringData = typeof data === 'string' ? data : JSON.stringify(data);
  
  const encrypted = CryptoJS.AES.encrypt(stringData, ENCRYPTION_KEY!, {
    iv: iv,
    mode: CryptoJS.mode.GCM,
    padding: CryptoJS.pad.Pkcs7
  });

  return {
    data: encrypted.toString(),
    iv: iv.toString()
  };
}

/**
 * Decrypts AES-256-GCM encrypted data
 * @param encryptedData - Encrypted data with IV
 * @returns Decrypted data
 */
async function decryptData<T>({ data, iv }: { data: string; iv: string }): Promise<T> {
  const decrypted = CryptoJS.AES.decrypt(data, ENCRYPTION_KEY!, {
    iv: CryptoJS.enc.Hex.parse(iv),
    mode: CryptoJS.mode.GCM,
    padding: CryptoJS.pad.Pkcs7
  });

  const decryptedString = decrypted.toString(CryptoJS.enc.Utf8);
  return JSON.parse(decryptedString);
}