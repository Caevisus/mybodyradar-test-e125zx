import { jest, describe, beforeEach, afterEach, test, expect } from '@jest/globals'; // v29.0.0
import { performance } from 'perf_hooks'; // native

import { MedicalService } from '../../services/medical.service';
import { InjuryRiskLevel } from '../../interfaces/medical.interface';
import { ApiService } from '../../services/api.service';
import { AnalyticsService } from '../../services/analytics.service';
import { apiConfig } from '../../config/api.config';

// Mock services
jest.mock('../../services/api.service');
jest.mock('../../services/analytics.service');

describe('MedicalService', () => {
  let medicalService: MedicalService;
  let mockApiService: jest.Mocked<ApiService>;
  let mockAnalyticsService: jest.Mocked<AnalyticsService>;
  let mockEncryptionService: jest.Mocked<any>;
  let mockAuditLogger: jest.Mocked<any>;

  const mockAthleteId = 'test-athlete-123';
  const mockUserId = 'test-user-456';

  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();

    // Setup mock services
    mockApiService = {
      get: jest.fn(),
      post: jest.fn(),
      put: jest.fn(),
      delete: jest.fn()
    } as any;

    mockAnalyticsService = {
      detectAnomalies: jest.fn()
    } as any;

    mockEncryptionService = {
      encrypt: jest.fn(),
      decrypt: jest.fn(),
      validateEncryption: jest.fn()
    };

    mockAuditLogger = {
      logAccess: jest.fn(),
      logModification: jest.fn(),
      logError: jest.fn()
    };

    // Initialize service with mocks
    medicalService = new MedicalService(
      mockApiService,
      mockAnalyticsService,
      mockEncryptionService,
      mockAuditLogger
    );

    // Mock getCurrentUserId
    jest.spyOn(medicalService as any, 'getCurrentUserId')
      .mockReturnValue(mockUserId);

    // Mock getClientIp
    jest.spyOn(medicalService as any, 'getClientIp')
      .mockResolvedValue('127.0.0.1');
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('getRiskAssessment', () => {
    const mockRiskAssessment = {
      athleteId: mockAthleteId,
      riskLevel: InjuryRiskLevel.MEDIUM,
      confidenceScore: 0.85,
      lastUpdated: new Date()
    };

    test('should retrieve and decrypt risk assessment with HIPAA compliance', async () => {
      // Setup mocks
      mockApiService.get.mockResolvedValue({
        data: mockRiskAssessment,
        success: true,
        timestamp: new Date(),
        requestId: 'test-request'
      });

      mockEncryptionService.decrypt.mockResolvedValue(mockRiskAssessment);

      // Execute test
      const result = await medicalService.getRiskAssessment(mockAthleteId);

      // Verify API call
      expect(mockApiService.get).toHaveBeenCalledWith(
        `${apiConfig.endpoints.ANALYTICS.BIOMECHANICS}/${mockAthleteId}/risk`,
        {},
        { deduplicate: false }
      );

      // Verify decryption
      expect(mockEncryptionService.decrypt).toHaveBeenCalledWith(mockRiskAssessment);

      // Verify audit logging
      expect(mockAuditLogger.logAccess).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: mockUserId,
          action: 'view',
          ipAddress: '127.0.0.1'
        })
      );

      // Verify response structure
      expect(result).toEqual(expect.objectContaining({
        data: mockRiskAssessment,
        hipaaCompliance: expect.objectContaining({
          phi: true,
          securityLevel: 'sensitive'
        }),
        auditRecord: expect.any(Object)
      }));
    });

    test('should handle errors and log them appropriately', async () => {
      const mockError = new Error('API Error');
      mockApiService.get.mockRejectedValue(mockError);

      await expect(medicalService.getRiskAssessment(mockAthleteId))
        .rejects.toThrow('API Error');

      expect(mockAuditLogger.logError).toHaveBeenCalledWith(
        expect.any(Object),
        mockError
      );
    });
  });

  describe('processRealTimeMetrics', () => {
    const mockMetrics = {
      muscleLoad: { quadriceps: 0.8 },
      forceDistribution: { knee: 120 }
    };

    test('should process metrics within 100ms latency requirement', async () => {
      // Setup mocks
      mockAnalyticsService.detectAnomalies.mockResolvedValue({
        quadriceps: 2.1,
        knee: 1.5
      });

      mockEncryptionService.encrypt.mockResolvedValue({
        encryptedData: 'encrypted',
        metadata: { algorithm: 'AES-256-GCM' }
      });

      // Start performance measurement
      const startTime = performance.now();

      // Execute test
      await medicalService.processRealTimeMetrics(mockAthleteId, mockMetrics);

      // Verify processing time
      const processingTime = performance.now() - startTime;
      expect(processingTime).toBeLessThan(100);

      // Verify anomaly detection
      expect(mockAnalyticsService.detectAnomalies).toHaveBeenCalledWith({
        muscleLoad: mockMetrics.muscleLoad,
        forceDistribution: mockMetrics.forceDistribution
      });

      // Verify encryption
      expect(mockEncryptionService.encrypt).toHaveBeenCalledWith(
        expect.objectContaining({
          athleteId: mockAthleteId,
          biomechanicalMetrics: mockMetrics
        })
      );
    });

    test('should handle and log processing errors', async () => {
      const mockError = new Error('Processing Error');
      mockAnalyticsService.detectAnomalies.mockRejectedValue(mockError);

      await expect(medicalService.processRealTimeMetrics(mockAthleteId, mockMetrics))
        .rejects.toThrow('Processing Error');

      expect(mockAuditLogger.logError).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'modify',
          changes: { metrics: mockMetrics, error: mockError }
        })
      );
    });
  });

  describe('updateTreatmentPlan', () => {
    const mockTreatmentPlan = {
      id: 'plan-123',
      athleteId: mockAthleteId,
      encryptedData: 'encrypted-plan-data',
      accessControl: { authorizedRoles: ['medical_staff'] }
    };

    test('should update treatment plan with versioning and audit trail', async () => {
      // Setup mocks
      mockEncryptionService.encrypt.mockResolvedValue({
        encryptedData: 'new-encrypted-data',
        metadata: { version: '2.0' }
      });

      // Execute test
      await medicalService.updateTreatmentPlan(mockTreatmentPlan);

      // Verify encryption
      expect(mockEncryptionService.encrypt).toHaveBeenCalledWith(mockTreatmentPlan);

      // Verify API call
      expect(mockApiService.put).toHaveBeenCalledWith(
        `${apiConfig.endpoints.ANALYTICS.BIOMECHANICS}/treatment`,
        expect.objectContaining({ encryptedData: 'new-encrypted-data' })
      );

      // Verify audit logging
      expect(mockAuditLogger.logModification).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'modify',
          changes: mockTreatmentPlan
        })
      );
    });
  });

  describe('getMedicalHistory', () => {
    test('should retrieve encrypted medical history with audit logging', async () => {
      const mockHistory = {
        athleteId: mockAthleteId,
        encryptedData: 'encrypted-history',
        hipaaCompliance: { phi: true }
      };

      mockApiService.get.mockResolvedValue({
        data: mockHistory,
        success: true
      });

      mockEncryptionService.decrypt.mockResolvedValue(mockHistory);

      const result = await medicalService.getMedicalHistory(mockAthleteId);

      expect(mockApiService.get).toHaveBeenCalledWith(
        `${apiConfig.endpoints.ANALYTICS.BIOMECHANICS}/${mockAthleteId}/history`
      );

      expect(mockEncryptionService.decrypt).toHaveBeenCalledWith(mockHistory);

      expect(result).toEqual(expect.objectContaining({
        data: mockHistory,
        hipaaCompliance: expect.any(Object),
        auditRecord: expect.any(Object)
      }));
    });
  });
});