/**
 * @fileoverview Enhanced storage service for secure client-side data persistence
 * Implements AES-256-GCM encryption and secure data lifecycle management
 * @version 1.0.0
 */

import { IApiResponse } from '../interfaces/common.interface';
import CryptoJS from 'crypto-js'; // v4.1.1

/**
 * Storage types supported by the service
 */
export enum StorageType {
  LOCAL = 'localStorage',
  SESSION = 'sessionStorage'
}

/**
 * Configuration options for storage operations
 */
interface StorageOptions {
  expiresIn?: number; // Time in milliseconds
  secure?: boolean;
  compress?: boolean;
}

/**
 * Interface for encrypted data structure
 */
interface EncryptedData {
  iv: string;
  data: string;
  hash: string;
  timestamp: number;
}

/**
 * Storage service configuration
 */
interface StorageConfig {
  defaultType?: StorageType;
  quotaLimit?: number;
  autoCleanup?: boolean;
}

/**
 * Enhanced service for secure client-side storage operations
 * Implements AES-256-GCM encryption and data lifecycle management
 */
export class StorageService {
  private readonly encryptionKey: string;
  private readonly defaultStorageType: StorageType;
  private readonly quotaLimit: number;
  private readonly autoCleanup: boolean;

  constructor(encryptionKey: string, config: StorageConfig = {}) {
    if (!encryptionKey) {
      throw new Error('Encryption key is required');
    }

    this.encryptionKey = encryptionKey;
    this.defaultStorageType = config.defaultType || StorageType.LOCAL;
    this.quotaLimit = config.quotaLimit || 5 * 1024 * 1024; // 5MB default
    this.autoCleanup = config.autoCleanup ?? true;

    // Initialize storage monitoring
    this.initStorageMonitor();
  }

  /**
   * Stores data with optional encryption and metadata
   */
  public setItem<T>(
    key: string,
    value: T,
    encrypt = false,
    type: StorageType = this.defaultStorageType,
    options: StorageOptions = {}
  ): void {
    try {
      if (!key || value === undefined) {
        throw new Error('Invalid key or value');
      }

      // Check storage quota
      if (this.autoCleanup && this.isQuotaExceeded()) {
        this.cleanupExpiredItems(type);
      }

      const timestamp = Date.now();
      const storageData = {
        value,
        timestamp,
        expiry: options.expiresIn ? timestamp + options.expiresIn : null,
        metadata: {
          secure: encrypt || options.secure,
          compressed: options.compress
        }
      };

      let dataToStore = JSON.stringify(storageData);

      if (encrypt) {
        const encrypted = this.encryptData(dataToStore);
        dataToStore = JSON.stringify(encrypted);
      }

      window[type].setItem(key, dataToStore);
      this.emitStorageEvent('set', key);

    } catch (error) {
      console.error('Storage operation failed:', error);
      throw error;
    }
  }

  /**
   * Retrieves and validates data from storage
   */
  public getItem<T>(
    key: string,
    encrypted = false,
    type: StorageType = this.defaultStorageType
  ): T | null {
    try {
      const rawData = window[type].getItem(key);
      if (!rawData) return null;

      let parsedData = JSON.parse(rawData);

      if (encrypted) {
        const decrypted = this.decryptData(parsedData);
        parsedData = JSON.parse(decrypted);
      }

      // Validate expiration
      if (parsedData.expiry && Date.now() > parsedData.expiry) {
        this.removeItem(key, type);
        return null;
      }

      return parsedData.value as T;

    } catch (error) {
      console.error('Storage retrieval failed:', error);
      return null;
    }
  }

  /**
   * Securely removes item from storage
   */
  public removeItem(key: string, type: StorageType = this.defaultStorageType): void {
    try {
      // Securely overwrite before removal
      this.setItem(key, '', false, type);
      window[type].removeItem(key);
      this.emitStorageEvent('remove', key);
    } catch (error) {
      console.error('Storage removal failed:', error);
      throw error;
    }
  }

  /**
   * Securely clears all data from specified storage
   */
  public clear(type: StorageType = this.defaultStorageType): void {
    try {
      // Securely overwrite all items before clearing
      for (let i = 0; i < window[type].length; i++) {
        const key = window[type].key(i);
        if (key) {
          this.setItem(key, '', false, type);
        }
      }
      window[type].clear();
      this.emitStorageEvent('clear');
    } catch (error) {
      console.error('Storage clear failed:', error);
      throw error;
    }
  }

  /**
   * Encrypts data using AES-256-GCM
   */
  private encryptData(data: string): EncryptedData {
    const iv = CryptoJS.lib.WordArray.random(16);
    const encrypted = CryptoJS.AES.encrypt(data, this.encryptionKey, {
      iv: iv,
      mode: CryptoJS.mode.GCM,
      padding: CryptoJS.pad.Pkcs7
    });

    const hash = CryptoJS.SHA256(data).toString();

    return {
      iv: iv.toString(),
      data: encrypted.toString(),
      hash,
      timestamp: Date.now()
    };
  }

  /**
   * Decrypts and validates encrypted data
   */
  private decryptData(encryptedData: EncryptedData): string {
    const { iv, data, hash } = encryptedData;

    const decrypted = CryptoJS.AES.decrypt(data, this.encryptionKey, {
      iv: CryptoJS.enc.Hex.parse(iv),
      mode: CryptoJS.mode.GCM,
      padding: CryptoJS.pad.Pkcs7
    });

    const decryptedString = decrypted.toString(CryptoJS.enc.Utf8);

    // Validate integrity
    const calculatedHash = CryptoJS.SHA256(decryptedString).toString();
    if (calculatedHash !== hash) {
      throw new Error('Data integrity check failed');
    }

    return decryptedString;
  }

  /**
   * Checks if storage quota is exceeded
   */
  private isQuotaExceeded(): boolean {
    let totalSize = 0;
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key) {
        totalSize += localStorage.getItem(key)?.length || 0;
      }
    }
    return totalSize >= this.quotaLimit;
  }

  /**
   * Cleans up expired items from storage
   */
  private cleanupExpiredItems(type: StorageType): void {
    const storage = window[type];
    for (let i = 0; i < storage.length; i++) {
      const key = storage.key(i);
      if (key) {
        const item = this.getItem(key, false, type);
        if (!item) {
          storage.removeItem(key);
        }
      }
    }
  }

  /**
   * Initializes storage monitoring
   */
  private initStorageMonitor(): void {
    window.addEventListener('storage', (event) => {
      if (event.storageArea === window[this.defaultStorageType]) {
        this.handleStorageChange(event);
      }
    });
  }

  /**
   * Handles storage change events
   */
  private handleStorageChange(event: StorageEvent): void {
    if (event.key && event.newValue !== event.oldValue) {
      this.emitStorageEvent('change', event.key);
    }
  }

  /**
   * Emits storage events for external listeners
   */
  private emitStorageEvent(type: string, key?: string): void {
    const event = new CustomEvent('storageUpdate', {
      detail: { type, key, timestamp: Date.now() }
    });
    window.dispatchEvent(event);
  }
}