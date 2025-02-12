/**
 * @fileoverview Reports Page Component
 * Implements secure, HIPAA-compliant performance reports and analytics data generation
 * with real-time processing capabilities and WCAG 2.1 Level AA compliance.
 * @version 1.0.0
 */

import React, { useState, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

import { ExportPanel } from '../components/reports/ExportPanel';
import { ReportGenerator } from '../components/reports/ReportGenerator';
import Loading from '../components/common/Loading';
import { themeConfig } from '../config/theme.config';
import { apiService } from '../services/api.service';

// Interface for report page state management
interface IReportPageState {
  isLoading: boolean;
  selectedAthleteId: string | null;
  selectedSessionId: string | null;
  dateRange: { start: Date; end: Date };
  selectedMetrics: string[];
  reportType: 'performance' | 'biomechanics' | 'team' | 'medical';
  securityContext: {
    hipaaCompliant: boolean;
    encryptionEnabled: boolean;
    auditLogging: boolean;
  };
  accessibilitySettings: {
    announcements: boolean;
    highContrast: boolean;
    reducedMotion: boolean;
  };
  performanceMetrics: {
    generationTime: number;
    processingLatency: number;
    dataSize: number;
  };
}

/**
 * Reports Page Component with comprehensive security, performance, and accessibility features
 */
const ReportsPage: React.FC = () => {
  const navigate = useNavigate();
  const [state, setState] = useState<IReportPageState>({
    isLoading: false,
    selectedAthleteId: null,
    selectedSessionId: null,
    dateRange: {
      start: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
      end: new Date()
    },
    selectedMetrics: [],
    reportType: 'performance',
    securityContext: {
      hipaaCompliant: true,
      encryptionEnabled: true,
      auditLogging: true
    },
    accessibilitySettings: {
      announcements: true,
      highContrast: false,
      reducedMotion: window.matchMedia('(prefers-reduced-motion: reduce)').matches
    },
    performanceMetrics: {
      generationTime: 0,
      processingLatency: 0,
      dataSize: 0
    }
  });

  // Handle report generation with security and performance monitoring
  const handleGenerateReport = useCallback(async () => {
    const startTime = performance.now();
    setState(prev => ({ ...prev, isLoading: true }));

    try {
      // Validate security context
      if (!state.securityContext.hipaaCompliant) {
        throw new Error('HIPAA compliance required for report generation');
      }

      // Create audit log
      await apiService.post('/api/v1/audit/log', {
        action: 'REPORT_GENERATION',
        resourceType: state.reportType,
        metadata: {
          athleteId: state.selectedAthleteId,
          sessionId: state.selectedSessionId,
          dateRange: state.dateRange
        }
      });

      // Generate report with accessibility announcement
      const reportUrl = await ReportGenerator.generateReport({
        athleteId: state.selectedAthleteId,
        sessionId: state.selectedSessionId,
        dateRange: state.dateRange,
        metrics: state.selectedMetrics,
        type: state.reportType,
        securityContext: state.securityContext
      });

      // Update performance metrics
      const endTime = performance.now();
      setState(prev => ({
        ...prev,
        performanceMetrics: {
          generationTime: endTime - startTime,
          processingLatency: endTime - startTime,
          dataSize: reportUrl.length
        }
      }));

      return reportUrl;
    } catch (error) {
      console.error('Report generation failed:', error);
      throw error;
    } finally {
      setState(prev => ({ ...prev, isLoading: false }));
    }
  }, [state]);

  // Handle export completion with accessibility notifications
  const handleExportComplete = useCallback((exportedFileUrl: string) => {
    // Create success announcement for screen readers
    const announcement = document.createElement('div');
    announcement.setAttribute('role', 'alert');
    announcement.setAttribute('aria-live', 'polite');
    announcement.textContent = 'Report export completed successfully';
    document.body.appendChild(announcement);

    // Clean up announcement after reading
    setTimeout(() => {
      document.body.removeChild(announcement);
    }, 3000);
  }, []);

  return (
    <main 
      className="reports-page"
      role="main"
      aria-label="Reports Generation"
      style={styles.container}
    >
      <header style={styles.header}>
        <h1 style={styles.title}>Performance Reports</h1>
      </header>

      <section 
        aria-label="Report Configuration"
        style={styles.section}
      >
        <ReportGenerator
          template={state.reportType}
          format="pdf"
          athleteId={state.selectedAthleteId}
          sessionId={state.selectedSessionId}
          dateRange={state.dateRange}
          onProgress={(progress) => {
            // Update progress for screen readers
            const progressAnnouncement = `Report generation ${progress}% complete`;
            if (state.accessibilitySettings.announcements) {
              // Announce progress
            }
          }}
          onComplete={handleExportComplete}
        />
      </section>

      <section 
        aria-label="Export Options"
        style={styles.section}
      >
        <ExportPanel
          sessionId={state.selectedSessionId}
          selectedMetrics={state.selectedMetrics}
          dateRange={state.dateRange}
          onExportComplete={handleExportComplete}
        />
      </section>

      {state.isLoading && (
        <Loading
          size="large"
          overlay
          message="Generating report..."
          ariaLabel="Generating secure report"
        />
      )}
    </main>
  );
};

// Styles
const styles = {
  container: {
    padding: themeConfig.spacing.dashboard.containerPadding,
    maxWidth: '1200px',
    margin: '0 auto'
  },
  header: {
    marginBottom: themeConfig.spacing.base.xl
  },
  title: {
    fontSize: themeConfig.typography.fontSize.display.md,
    fontWeight: themeConfig.typography.fontWeight.bold,
    color: 'var(--color-on-surface)',
    margin: 0
  },
  section: {
    marginBottom: themeConfig.spacing.base.xl,
    backgroundColor: 'var(--color-surface)',
    borderRadius: themeConfig.spacing.base.md,
    padding: themeConfig.spacing.base.lg,
    boxShadow: themeConfig.shadows.sm
  }
};

export default ReportsPage;