/**
 * @fileoverview HIPAA-compliant injury risk assessment card component
 * Displays real-time biomechanical metrics and risk analysis with interactive features
 * @version 1.0.0
 */

import React, { useEffect, useRef, useMemo, useCallback } from 'react';
import classNames from 'classnames'; // ^2.3.0
import Chart from 'chart.js/auto'; // ^4.0.0

import Card from '../common/Card';
import { IInjuryRiskAssessment } from '../../interfaces/medical.interface';
import { AnalyticsService } from '../../services/analytics.service';

// Default refresh interval in milliseconds
const DEFAULT_REFRESH_INTERVAL = 1000;

// Risk level color mapping with WCAG 2.1 AA compliant contrast ratios
const RISK_LEVEL_COLORS = {
  low: 'bg-green-500 dark:bg-green-600',
  medium: 'bg-yellow-500 dark:bg-yellow-600',
  high: 'bg-red-500 dark:bg-red-600'
} as const;

interface InjuryRiskCardProps {
  assessment: IInjuryRiskAssessment;
  className?: string;
  onRecommendationClick?: (recommendation: string) => void;
  refreshInterval?: number;
  onMetricThresholdChange?: (metric: string, value: number) => void;
  onAnomalyDetected?: (anomaly: IAnomalyData) => void;
}

/**
 * Formats metric values with appropriate units and precision
 */
const formatMetricValue = (value: number, unit: string, threshold?: number): string => {
  const precision = unit === '%' ? 1 : 2;
  const formattedValue = value.toFixed(precision);
  const thresholdIndicator = threshold && value > threshold ? ' ⚠️' : '';
  return `${formattedValue}${unit}${thresholdIndicator}`;
};

/**
 * Returns appropriate color class for risk level with animation support
 */
const getRiskLevelColor = (riskLevel: string, animate: boolean = false): string => {
  const baseColor = RISK_LEVEL_COLORS[riskLevel.toLowerCase()] || RISK_LEVEL_COLORS.low;
  return classNames(baseColor, {
    'animate-pulse': animate && riskLevel === 'high'
  });
};

/**
 * Enhanced injury risk assessment card with real-time updates and HIPAA compliance
 */
const InjuryRiskCard: React.FC<InjuryRiskCardProps> = ({
  assessment,
  className,
  onRecommendationClick,
  refreshInterval = DEFAULT_REFRESH_INTERVAL,
  onMetricThresholdChange,
  onAnomalyDetected
}) => {
  const chartRef = useRef<Chart | null>(null);
  const analyticsService = useMemo(() => new AnalyticsService(), []);

  // Process real-time data updates
  useEffect(() => {
    const intervalId = setInterval(async () => {
      try {
        const anomalies = await analyticsService.detectAnomalies(assessment.biomechanicalMetrics);
        if (Object.keys(anomalies).length > 0 && onAnomalyDetected) {
          onAnomalyDetected(anomalies);
        }
      } catch (error) {
        console.error('Error detecting anomalies:', error);
      }
    }, refreshInterval);

    return () => clearInterval(intervalId);
  }, [assessment, refreshInterval, onAnomalyDetected, analyticsService]);

  // Initialize and update trend chart
  useEffect(() => {
    if (!chartRef.current) {
      const ctx = document.getElementById('riskTrendChart') as HTMLCanvasElement;
      chartRef.current = new Chart(ctx, {
        type: 'line',
        data: {
          labels: assessment.historicalTrends.map(trend => trend.timestamp),
          datasets: [{
            label: 'Risk Level',
            data: assessment.historicalTrends.map(trend => trend.riskScore),
            borderColor: '#4B5563',
            tension: 0.4
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            tooltip: {
              enabled: true,
              mode: 'index',
              intersect: false
            }
          }
        }
      });
    }

    return () => {
      if (chartRef.current) {
        chartRef.current.destroy();
        chartRef.current = null;
      }
    };
  }, [assessment.historicalTrends]);

  // Render risk level indicator
  const renderRiskLevel = useCallback(() => {
    const colorClass = getRiskLevelColor(assessment.riskLevel, true);
    return (
      <div 
        className={classNames('rounded-lg p-4 text-white text-center', colorClass)}
        role="status"
        aria-label={`Current risk level: ${assessment.riskLevel}`}
      >
        <h3 className="text-lg font-semibold">Risk Level</h3>
        <p className="text-2xl font-bold">{assessment.riskLevel.toUpperCase()}</p>
      </div>
    );
  }, [assessment.riskLevel]);

  // Render biomechanical metrics
  const renderMetrics = useCallback(() => {
    return (
      <div className="grid grid-cols-2 gap-4 mt-4">
        {Object.entries(assessment.biomechanicalMetrics).map(([metric, value]) => (
          <div 
            key={metric}
            className="bg-gray-100 dark:bg-gray-800 rounded p-3"
            role="meter"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={value}
          >
            <h4 className="text-sm font-medium text-gray-600 dark:text-gray-300">
              {metric}
            </h4>
            <p className="text-lg font-semibold">
              {formatMetricValue(value, '%')}
            </p>
          </div>
        ))}
      </div>
    );
  }, [assessment.biomechanicalMetrics]);

  // Render recommendations
  const renderRecommendations = useCallback(() => {
    return (
      <div className="mt-4">
        <h3 className="text-lg font-semibold mb-2">Recommendations</h3>
        <ul className="space-y-2">
          {assessment.recommendations.map((recommendation, index) => (
            <li 
              key={index}
              className="bg-blue-50 dark:bg-blue-900 p-3 rounded cursor-pointer hover:bg-blue-100 dark:hover:bg-blue-800 transition-colors"
              onClick={() => onRecommendationClick?.(recommendation)}
              role="button"
              tabIndex={0}
            >
              {recommendation}
            </li>
          ))}
        </ul>
      </div>
    );
  }, [assessment.recommendations, onRecommendationClick]);

  return (
    <Card
      className={classNames('injury-risk-card', className)}
      elevation={2}
      role="region"
      ariaLabel="Injury Risk Assessment"
    >
      {/* HIPAA compliance metadata */}
      <div className="text-xs text-gray-500 mb-2" aria-hidden="true">
        Last updated: {new Date(assessment.hipaaCompliance.lastAccessedAt).toLocaleString()}
      </div>

      {renderRiskLevel()}
      {renderMetrics()}

      <div className="mt-4 h-48">
        <canvas id="riskTrendChart" />
      </div>

      {renderRecommendations()}

      {/* Risk factors */}
      <div className="mt-4">
        <h3 className="text-lg font-semibold mb-2">Risk Factors</h3>
        <div className="flex flex-wrap gap-2">
          {assessment.riskFactors.map((factor, index) => (
            <span 
              key={index}
              className="bg-gray-200 dark:bg-gray-700 px-2 py-1 rounded text-sm"
            >
              {factor}
            </span>
          ))}
        </div>
      </div>
    </Card>
  );
};

// Display name for debugging
InjuryRiskCard.displayName = 'InjuryRiskCard';

export default InjuryRiskCard;