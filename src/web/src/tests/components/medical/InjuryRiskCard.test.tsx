import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe, toHaveNoViolations } from 'jest-axe';
import { expect, describe, it, beforeEach, jest } from '@jest/globals';

import InjuryRiskCard from '../../../components/medical/InjuryRiskCard';
import { IInjuryRiskAssessment, InjuryRiskLevel } from '../../../interfaces/medical.interface';

// Add jest-axe matchers
expect.extend(toHaveNoViolations);

/**
 * Creates comprehensive mock injury risk assessment data with HIPAA compliance metadata
 */
const createMockAssessment = (overrides?: Partial<IInjuryRiskAssessment>): IInjuryRiskAssessment => ({
  athleteId: '123e4567-e89b-12d3-a456-426614174000',
  riskLevel: InjuryRiskLevel.MEDIUM,
  riskFactors: ['Muscle imbalance', 'High impact load'],
  biomechanicalMetrics: {
    muscleLoad: {
      quadriceps: 85,
      hamstrings: 75
    },
    jointAngles: {
      knee: 15,
      ankle: 10
    },
    forceDistribution: {
      left: 48,
      right: 52
    }
  },
  recommendations: [
    'Reduce training intensity',
    'Focus on balance exercises'
  ],
  assessmentDate: new Date(),
  hipaaCompliance: {
    phi: false,
    securityLevel: 'sensitive',
    dataRetentionPeriod: 2555, // 7 years in days
    lastAccessedBy: '123e4567-e89b-12d3-a456-426614174001',
    lastAccessedAt: new Date(),
    authorizedRoles: ['MEDICAL_STAFF', 'COACH']
  },
  auditTrail: [{
    id: '123e4567-e89b-12d3-a456-426614174002',
    userId: '123e4567-e89b-12d3-a456-426614174001',
    action: 'view',
    timestamp: new Date(),
    ipAddress: '127.0.0.1',
    userAgent: 'jest-test'
  }],
  ...overrides
});

describe('InjuryRiskCard Component', () => {
  let mockAssessment: IInjuryRiskAssessment;
  let mockOnRecommendationClick: jest.Mock;
  let mockOnMetricThresholdChange: jest.Mock;
  let mockOnAnomalyDetected: jest.Mock;

  beforeEach(() => {
    mockAssessment = createMockAssessment();
    mockOnRecommendationClick = jest.fn();
    mockOnMetricThresholdChange = jest.fn();
    mockOnAnomalyDetected = jest.fn();
  });

  it('renders risk level with correct accessibility attributes', () => {
    render(
      <InjuryRiskCard 
        assessment={mockAssessment}
        onRecommendationClick={mockOnRecommendationClick}
      />
    );

    const riskLevel = screen.getByRole('status');
    expect(riskLevel).toHaveAttribute('aria-label', `Current risk level: ${mockAssessment.riskLevel}`);
    expect(riskLevel).toHaveTextContent(mockAssessment.riskLevel.toUpperCase());
  });

  it('displays biomechanical metrics with correct formatting', () => {
    render(<InjuryRiskCard assessment={mockAssessment} />);

    Object.entries(mockAssessment.biomechanicalMetrics.muscleLoad).forEach(([muscle, value]) => {
      const metricElement = screen.getByRole('meter', { name: new RegExp(muscle, 'i') });
      expect(metricElement).toHaveAttribute('aria-valuenow', String(value));
      expect(metricElement).toHaveTextContent(`${value.toFixed(1)}%`);
    });
  });

  it('handles recommendation clicks correctly', async () => {
    render(
      <InjuryRiskCard 
        assessment={mockAssessment}
        onRecommendationClick={mockOnRecommendationClick}
      />
    );

    const recommendation = screen.getByText(mockAssessment.recommendations[0]);
    await userEvent.click(recommendation);
    expect(mockOnRecommendationClick).toHaveBeenCalledWith(mockAssessment.recommendations[0]);
  });

  it('updates metrics in real-time within latency requirements', async () => {
    const { rerender } = render(<InjuryRiskCard assessment={mockAssessment} />);

    const startTime = performance.now();
    const updatedAssessment = {
      ...mockAssessment,
      biomechanicalMetrics: {
        ...mockAssessment.biomechanicalMetrics,
        muscleLoad: {
          quadriceps: 90,
          hamstrings: 80
        }
      }
    };

    rerender(<InjuryRiskCard assessment={updatedAssessment} />);
    const renderTime = performance.now() - startTime;

    expect(renderTime).toBeLessThan(100); // Verify <100ms latency requirement
    expect(screen.getByText('90.0%')).toBeInTheDocument();
  });

  it('handles HIPAA compliance metadata correctly', () => {
    render(<InjuryRiskCard assessment={mockAssessment} />);

    const lastUpdated = screen.getByText(/Last updated:/i);
    expect(lastUpdated).toHaveAttribute('aria-hidden', 'true');
    expect(lastUpdated).toHaveTextContent(
      new Date(mockAssessment.hipaaCompliance.lastAccessedAt).toLocaleString()
    );
  });

  it('detects and reports anomalies', async () => {
    render(
      <InjuryRiskCard 
        assessment={mockAssessment}
        onAnomalyDetected={mockOnAnomalyDetected}
        refreshInterval={100}
      />
    );

    await waitFor(() => {
      expect(mockOnAnomalyDetected).toHaveBeenCalled();
    }, { timeout: 150 });
  });

  it('maintains accessibility standards', async () => {
    const { container } = render(<InjuryRiskCard assessment={mockAssessment} />);
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('renders risk factors with appropriate styling', () => {
    render(<InjuryRiskCard assessment={mockAssessment} />);

    mockAssessment.riskFactors.forEach(factor => {
      const riskFactor = screen.getByText(factor);
      expect(riskFactor).toHaveClass('bg-gray-200', 'dark:bg-gray-700');
    });
  });

  it('handles keyboard navigation correctly', async () => {
    render(
      <InjuryRiskCard 
        assessment={mockAssessment}
        onRecommendationClick={mockOnRecommendationClick}
      />
    );

    const recommendation = screen.getByText(mockAssessment.recommendations[0]);
    await userEvent.tab();
    expect(recommendation).toHaveFocus();
    await userEvent.keyboard('{enter}');
    expect(mockOnRecommendationClick).toHaveBeenCalled();
  });

  it('updates chart visualization correctly', async () => {
    const { rerender } = render(<InjuryRiskCard assessment={mockAssessment} />);

    const canvas = screen.getByRole('img', { name: /risk trend chart/i });
    expect(canvas).toBeInTheDocument();

    const updatedAssessment = {
      ...mockAssessment,
      historicalTrends: [
        { timestamp: '2023-01-01', riskScore: 0.5 },
        { timestamp: '2023-01-02', riskScore: 0.7 }
      ]
    };

    rerender(<InjuryRiskCard assessment={updatedAssessment} />);
    expect(canvas).toBeInTheDocument();
  });
});