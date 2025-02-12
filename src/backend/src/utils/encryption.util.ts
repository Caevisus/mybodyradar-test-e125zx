/**
 * @fileoverview Core encryption utility module for the smart-apparel system
 * Implements AES-256-GCM encryption with key rotation and HIPAA compliance
 * @version 1.0.0
 */

import * as crypto from 'crypto'; // latest
import { securityConfig } from '../config/security.config';
import { logger } from '../utils/logger.util';

/**
 * Data classification levels for encryption policies
 */
export enum DataClassification {
  PII = 'PII',
  MEDICAL = 'MEDICAL',
  PERFORMANCE = 'PERFORMANCE',
  SYSTEM = 'SYSTEM'
}

/**
 * Interface for encrypted data structure
 */
export interface EncryptedData {
  data: Buffer;
  iv: Buffer;
  tag: Buffer;
  keyVersion: string;
  dataClassification: DataClassification;
}

/**
 * Generates a cryptographically secure key using PBKDF2
 * @param password - Secret password for key derivation
 * @param salt - Optional salt for key derivation
 * @param version - Key version identifier
 * @returns Generated key with version information
 */
async function generateKey(
  password: string,
  salt?: Buffer,
  version?: string
): Promise<{ key: Buffer; version: string }> {
  try {
    const saltBuffer = salt || crypto.randomBytes(securityConfig.encryption.saltLength);
    const keyVersion = version || new Date().toISOString();

    const key = await new Promise<Buffer>((resolve, reject) => {
      crypto.pbkdf2(
        password,
        saltBuffer,
        securityConfig.passwords.hashIterations,
        securityConfig.encryption.keyLength / 8,
        securityConfig.passwords.hashAlgorithm,
        (err, derivedKey) => {
          if (err) reject(err);
          resolve(derivedKey);
        }
      );
    });

    logger.info('Key generated successfully', {
      module: 'encryption',
      keyVersion,
      event: 'key_generation'
    });

    return { key, version: keyVersion };
  } catch (error) {
    logger.error('Key generation failed', error as Error, {
      module: 'encryption',
      event: 'key_generation_error'
    });
    throw error;
  }
}

/**
 * Encrypts data using AES-256-GCM with data classification
 * @param data - Data to encrypt
 * @param key - Encryption key
 * @param classification - Data classification level
 * @param keyVersion - Version of the encryption key
 * @returns Encrypted data with metadata
 */
export async function encrypt(
  data: Buffer | string,
  key: Buffer,
  classification: DataClassification,
  keyVersion: string
): Promise<EncryptedData> {
  try {
    const dataBuffer = Buffer.isBuffer(data) ? data : Buffer.from(data);
    const iv = crypto.randomBytes(securityConfig.encryption.ivLength);

    const cipher = crypto.createCipheriv(
      securityConfig.encryption.algorithm,
      key,
      iv
    ) as crypto.CipherGCM;

    const encryptedData = Buffer.concat([
      cipher.update(dataBuffer),
      cipher.final()
    ]);

    const tag = cipher.getAuthTag();

    logger.info('Data encrypted successfully', {
      module: 'encryption',
      classification,
      keyVersion,
      event: 'encryption'
    });

    return {
      data: encryptedData,
      iv,
      tag,
      keyVersion,
      dataClassification: classification
    };
  } catch (error) {
    logger.error('Encryption failed', error as Error, {
      module: 'encryption',
      classification,
      event: 'encryption_error'
    });
    throw error;
  }
}

/**
 * Decrypts AES-256-GCM encrypted data
 * @param encryptedData - Encrypted data object
 * @param key - Decryption key
 * @returns Decrypted data
 */
export async function decrypt(
  encryptedData: EncryptedData,
  key: Buffer
): Promise<Buffer> {
  try {
    const decipher = crypto.createDecipheriv(
      securityConfig.encryption.algorithm,
      key,
      encryptedData.iv
    ) as crypto.DecipherGCM;

    decipher.setAuthTag(encryptedData.tag);

    const decryptedData = Buffer.concat([
      decipher.update(encryptedData.data),
      decipher.final()
    ]);

    logger.info('Data decrypted successfully', {
      module: 'encryption',
      classification: encryptedData.dataClassification,
      keyVersion: encryptedData.keyVersion,
      event: 'decryption'
    });

    return decryptedData;
  } catch (error) {
    logger.error('Decryption failed', error as Error, {
      module: 'encryption',
      classification: encryptedData.dataClassification,
      event: 'decryption_error'
    });
    throw error;
  }
}

/**
 * Implements key rotation mechanism
 * @param currentKey - Current encryption key
 * @param currentVersion - Current key version
 * @returns New key with version information
 */
export async function rotateKey(
  currentKey: Buffer,
  currentVersion: string
): Promise<{ newKey: Buffer; newVersion: string }> {
  try {
    const newVersion = new Date().toISOString();
    const salt = crypto.randomBytes(securityConfig.encryption.saltLength);
    const password = crypto.randomBytes(32).toString('hex');

    const { key: newKey } = await generateKey(password, salt, newVersion);

    logger.info('Key rotation completed', {
      module: 'encryption',
      oldVersion: currentVersion,
      newVersion,
      event: 'key_rotation'
    });

    return { newKey, newVersion };
  } catch (error) {
    logger.error('Key rotation failed', error as Error, {
      module: 'encryption',
      currentVersion,
      event: 'key_rotation_error'
    });
    throw error;
  }
}

// Validate encryption configuration on module load
(() => {
  const requiredKeyLength = 256;
  if (securityConfig.encryption.keyLength < requiredKeyLength) {
    throw new Error(`Insufficient key length. Required: ${requiredKeyLength} bits`);
  }
})();