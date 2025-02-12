import { 
  encrypt, 
  decrypt, 
  DataClassification, 
  EncryptedData 
} from '../../../src/utils/encryption.util';
import { securityConfig } from '../../../src/config/security.config';
import * as crypto from 'crypto';

// Mock crypto functions for deterministic testing
jest.mock('crypto', () => ({
  ...jest.requireActual('crypto'),
  randomBytes: jest.fn(),
  createCipheriv: jest.fn(),
  createDecipheriv: jest.fn()
}));

describe('Encryption Utility', () => {
  let testKey: Buffer;
  let testIv: Buffer;
  let testTag: Buffer;
  
  beforeEach(() => {
    // Set up test key and IV
    testKey = Buffer.from('0'.repeat(32), 'hex');
    testIv = Buffer.from('0'.repeat(16), 'hex');
    testTag = Buffer.from('0'.repeat(16), 'hex');
    
    // Mock crypto functions
    (crypto.randomBytes as jest.Mock).mockImplementation((size: number) => {
      return Buffer.from('0'.repeat(size), 'hex');
    });
    
    const mockCipher = {
      update: jest.fn().mockReturnValue(Buffer.from('encrypted')),
      final: jest.fn().mockReturnValue(Buffer.from('')),
      getAuthTag: jest.fn().mockReturnValue(testTag)
    };
    
    const mockDecipher = {
      update: jest.fn().mockReturnValue(Buffer.from('decrypted')),
      final: jest.fn().mockReturnValue(Buffer.from('')),
      setAuthTag: jest.fn()
    };
    
    (crypto.createCipheriv as jest.Mock).mockReturnValue(mockCipher);
    (crypto.createDecipheriv as jest.Mock).mockReturnValue(mockDecipher);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Data Classification Encryption', () => {
    it('should encrypt PII data with correct classification', async () => {
      const testData = 'sensitive-pii-data';
      const keyVersion = new Date().toISOString();

      const encrypted = await encrypt(
        testData,
        testKey,
        DataClassification.PII,
        keyVersion
      );

      expect(encrypted).toMatchObject({
        data: expect.any(Buffer),
        iv: expect.any(Buffer),
        tag: expect.any(Buffer),
        keyVersion: expect.any(String),
        dataClassification: DataClassification.PII
      });

      expect(crypto.createCipheriv).toHaveBeenCalledWith(
        securityConfig.encryption.algorithm,
        testKey,
        expect.any(Buffer)
      );
    });

    it('should encrypt medical data with HIPAA compliance', async () => {
      const testData = 'medical-record-data';
      const keyVersion = new Date().toISOString();

      const encrypted = await encrypt(
        testData,
        testKey,
        DataClassification.MEDICAL,
        keyVersion
      );

      expect(encrypted.dataClassification).toBe(DataClassification.MEDICAL);
      expect(securityConfig.encryption.dataClassification.medical.hipaaCompliant).toBe(true);
    });

    it('should encrypt performance data with correct policy', async () => {
      const testData = 'performance-metrics';
      const keyVersion = new Date().toISOString();

      const encrypted = await encrypt(
        testData,
        testKey,
        DataClassification.PERFORMANCE,
        keyVersion
      );

      expect(encrypted.dataClassification).toBe(DataClassification.PERFORMANCE);
      expect(securityConfig.encryption.dataClassification.performance.keyRotationDays).toBe(90);
    });
  });

  describe('Key Rotation', () => {
    it('should track key version in encrypted data', async () => {
      const testData = 'test-data';
      const keyVersion = new Date().toISOString();

      const encrypted = await encrypt(
        testData,
        testKey,
        DataClassification.PII,
        keyVersion
      );

      expect(encrypted.keyVersion).toBe(keyVersion);
    });

    it('should enforce key rotation periods by classification', () => {
      expect(securityConfig.encryption.dataClassification.pii.keyRotationDays).toBe(30);
      expect(securityConfig.encryption.dataClassification.medical.keyRotationDays).toBe(30);
      expect(securityConfig.encryption.dataClassification.performance.keyRotationDays).toBe(90);
    });
  });

  describe('HIPAA Compliance', () => {
    it('should use AES-256-GCM for medical data', async () => {
      const testData = 'hipaa-data';
      const keyVersion = new Date().toISOString();

      await encrypt(
        testData,
        testKey,
        DataClassification.MEDICAL,
        keyVersion
      );

      expect(crypto.createCipheriv).toHaveBeenCalledWith(
        'AES-256-GCM',
        expect.any(Buffer),
        expect.any(Buffer)
      );
    });

    it('should enforce audit logging for medical data', () => {
      expect(securityConfig.encryption.dataClassification.medical.auditLogging).toBe(true);
    });
  });

  describe('Encryption/Decryption Operations', () => {
    it('should successfully encrypt and decrypt data', async () => {
      const testData = 'test-data';
      const keyVersion = new Date().toISOString();

      const encrypted = await encrypt(
        testData,
        testKey,
        DataClassification.PII,
        keyVersion
      );

      const decrypted = await decrypt(encrypted, testKey);
      expect(decrypted.toString()).toBe('decrypted');
    });

    it('should handle Buffer input data', async () => {
      const testData = Buffer.from('buffer-data');
      const keyVersion = new Date().toISOString();

      const encrypted = await encrypt(
        testData,
        testKey,
        DataClassification.PII,
        keyVersion
      );

      expect(encrypted.data).toBeInstanceOf(Buffer);
    });
  });

  describe('Error Handling', () => {
    it('should throw error on invalid key length', async () => {
      const invalidKey = Buffer.from('short-key');
      const testData = 'test-data';
      const keyVersion = new Date().toISOString();

      await expect(encrypt(
        testData,
        invalidKey,
        DataClassification.PII,
        keyVersion
      )).rejects.toThrow();
    });

    it('should throw error on decryption with wrong key', async () => {
      const testData = 'test-data';
      const keyVersion = new Date().toISOString();
      const wrongKey = Buffer.from('1'.repeat(32), 'hex');

      const encrypted = await encrypt(
        testData,
        testKey,
        DataClassification.PII,
        keyVersion
      );

      await expect(decrypt(encrypted, wrongKey)).rejects.toThrow();
    });
  });

  describe('Performance', () => {
    it('should complete encryption within performance threshold', async () => {
      const testData = 'performance-test-data';
      const keyVersion = new Date().toISOString();
      const startTime = Date.now();

      await encrypt(
        testData,
        testKey,
        DataClassification.PERFORMANCE,
        keyVersion
      );

      const duration = Date.now() - startTime;
      expect(duration).toBeLessThan(100); // 100ms threshold from technical spec
    });
  });
});