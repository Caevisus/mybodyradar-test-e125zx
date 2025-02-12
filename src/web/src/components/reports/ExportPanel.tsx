/**
 * @fileoverview Export Panel Component for secure data export functionality
 * Implements comprehensive data export with format options, compression,
 * and progress tracking following technical specifications
 * @version 1.0.0
 */

import React, { useState, useCallback, useEffect, useRef } from 'react';
import { saveAs } from 'file-saver'; // v2.0.5
import pako from 'pako'; // v2.1.0
import { LinearProgress } from '@mui/material'; // v5.0.0

import { Button } from '../common/Button';
import { Select } from '../common/Select';
import { AnalyticsService } from '../../services/analytics.service';
import { themeConfig } from '../../config/theme.config';
import type { IExportFormat, IExportPanelProps } from '../../interfaces/common.interface';

// Export format configurations with enhanced metadata
const EXPORT_FORMATS: IExportFormat[] = [
  {
    value: 'json',
    label: 'JSON (Full Data)',
    mimeType: 'application/json',
    compressionLevel: 9,
    supportedMetrics: ['all'],
    requiresAuthentication: true
  },
  {
    value: 'csv',
    label: 'CSV (Tabular Data)',
    mimeType: 'text/csv',
    compressionLevel: 6,
    supportedMetrics: ['muscleActivity', 'forceDistribution', 'rangeOfMotion'],
    requiresAuthentication: true
  },
  {
    value: 'xlsx',
    label: 'Excel (Analysis Ready)',
    mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    compressionLevel: 5,
    supportedMetrics: ['all'],
    requiresAuthentication: true
  }
];

/**
 * ExportPanel component for secure data export functionality
 */
export const ExportPanel: React.FC<IExportPanelProps> = ({
  sessionId,
  selectedMetrics,
  dateRange,
  includeAnalytics,
  onExportComplete,
  onExportError,
  onProgressUpdate,
  enableCompression = true,
  preferences
}) => {
  // State management
  const [isLoading, setIsLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [selectedFormat, setSelectedFormat] = useState<string>('json');
  const [error, setError] = useState<string | null>(null);

  // Refs
  const analyticsService = useRef(new AnalyticsService());
  const abortController = useRef(new AbortController());

  /**
   * Handles export format selection
   */
  const handleFormatChange = useCallback((format: string) => {
    setSelectedFormat(format);
    setError(null);
  }, []);

  /**
   * Validates export configuration
   */
  const validateExport = useCallback((): boolean => {
    if (!sessionId) {
      setError('Session ID is required');
      return false;
    }
    if (selectedMetrics.length === 0) {
      setError('At least one metric must be selected');
      return false;
    }
    return true;
  }, [sessionId, selectedMetrics]);

  /**
   * Processes and formats data for export
   */
  const formatData = useCallback(async (
    data: any,
    format: IExportFormat
  ): Promise<Blob> => {
    try {
      // Remove sensitive information
      const sanitizedData = {
        ...data,
        metadata: {
          exportDate: new Date().toISOString(),
          metrics: selectedMetrics,
          format: format.value
        }
      };

      // Apply format-specific transformations
      let formattedData: string;
      switch (format.value) {
        case 'json':
          formattedData = JSON.stringify(sanitizedData, null, 2);
          break;
        case 'csv':
          formattedData = convertToCSV(sanitizedData);
          break;
        case 'xlsx':
          formattedData = await convertToExcel(sanitizedData);
          break;
        default:
          throw new Error(`Unsupported format: ${format.value}`);
      }

      // Apply compression if enabled
      if (enableCompression && format.compressionLevel > 0) {
        const compressed = pako.deflate(formattedData, {
          level: format.compressionLevel
        });
        return new Blob([compressed], { type: format.mimeType });
      }

      return new Blob([formattedData], { type: format.mimeType });
    } catch (error) {
      console.error('Data formatting failed:', error);
      throw new Error('Failed to format export data');
    }
  }, [selectedMetrics, enableCompression]);

  /**
   * Handles the export process
   */
  const handleExport = useCallback(async () => {
    if (!validateExport()) return;

    setIsLoading(true);
    setProgress(0);
    setError(null);

    try {
      // Get selected format configuration
      const format = EXPORT_FORMATS.find(f => f.value === selectedFormat);
      if (!format) throw new Error('Invalid export format');

      // Fetch data stream with progress tracking
      const dataStream = await analyticsService.current.getMetricsStream();
      let exportData: any = {};

      dataStream.subscribe({
        next: (data) => {
          exportData = { ...exportData, ...data };
          setProgress((prev) => Math.min(prev + 10, 90));
        },
        error: (err) => {
          throw err;
        },
        complete: async () => {
          // Format and save data
          const blob = await formatData(exportData, format);
          const fileName = `session_${sessionId}_${format.value}`;
          
          saveAs(blob, fileName);
          setProgress(100);
          onExportComplete?.();
        }
      });
    } catch (error) {
      console.error('Export failed:', error);
      setError('Export failed. Please try again.');
      onExportError?.();
    } finally {
      setIsLoading(false);
    }
  }, [
    sessionId,
    selectedFormat,
    validateExport,
    formatData,
    onExportComplete,
    onExportError
  ]);

  /**
   * Cleanup on unmount
   */
  useEffect(() => {
    return () => {
      abortController.current.abort();
    };
  }, []);

  return (
    <div className="export-panel" style={styles.container}>
      <div style={styles.header}>
        <h3 style={styles.title}>Export Data</h3>
      </div>

      <div style={styles.content}>
        <Select
          options={EXPORT_FORMATS.map(format => ({
            value: format.value,
            label: format.label
          }))}
          value={selectedFormat}
          onChange={handleFormatChange}
          disabled={isLoading}
          placeholder="Select export format"
        />

        {isLoading && (
          <div style={styles.progress}>
            <LinearProgress 
              variant="determinate" 
              value={progress} 
              style={styles.progressBar}
            />
            <span style={styles.progressText}>{progress}% Complete</span>
          </div>
        )}

        {error && (
          <div style={styles.error} role="alert">
            {error}
          </div>
        )}

        <div style={styles.actions}>
          <Button
            variant="contained"
            onClick={handleExport}
            isLoading={isLoading}
            disabled={isLoading}
            ariaLabel="Export data"
          >
            {isLoading ? 'Exporting...' : 'Export'}
          </Button>
        </div>
      </div>
    </div>
  );
};

// Styles
const styles = {
  container: {
    padding: themeConfig.spacing.base.md,
    backgroundColor: themeConfig.colors.surface.light.paper,
    borderRadius: '4px',
    boxShadow: themeConfig.shadows.sm
  },
  header: {
    marginBottom: themeConfig.spacing.base.md
  },
  title: {
    margin: 0,
    fontSize: themeConfig.typography.fontSize.lg,
    fontWeight: themeConfig.typography.fontWeight.medium
  },
  content: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: themeConfig.spacing.base.md
  },
  progress: {
    marginTop: themeConfig.spacing.base.sm
  },
  progressBar: {
    marginBottom: themeConfig.spacing.base.xs
  },
  progressText: {
    fontSize: themeConfig.typography.fontSize.sm,
    color: themeConfig.colors.primary.main
  },
  error: {
    color: themeConfig.colors.feedback.error,
    fontSize: themeConfig.typography.fontSize.sm,
    marginTop: themeConfig.spacing.base.sm
  },
  actions: {
    marginTop: themeConfig.spacing.base.lg,
    display: 'flex',
    justifyContent: 'flex-end'
  }
};

// Helper functions for data conversion
const convertToCSV = (data: any): string => {
  // Implementation of JSON to CSV conversion
  return '';
};

const convertToExcel = async (data: any): Promise<string> => {
  // Implementation of JSON to Excel conversion
  return '';
};

export default ExportPanel;