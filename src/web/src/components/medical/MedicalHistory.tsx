import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { format } from 'date-fns';
import { FixedSizeList as VirtualizedList } from 'react-window';
import { ErrorBoundary } from 'react-error-boundary';
import Table from '../common/Table';
import { WebSocketService } from '../../services/websocket.service';

// HIPAA compliance metadata interface
interface IAuditMetadata {
  accessReason: string;
  accessedBy: string;
  accessTimestamp: Date;
  encryptionVersion: string;
}

// Medical history data interfaces
interface IMedicalRecord {
  id: string;
  date: Date;
  type: 'injury' | 'treatment' | 'assessment';
  description: string;
  provider: string;
  severity?: 'low' | 'medium' | 'high';
  status: 'active' | 'resolved';
  relatedMetrics?: Record<string, number>;
  encryptedFields: string[];
  lastModified: Date;
}

interface IMedicalHistory {
  records: IMedicalRecord[];
  riskAssessments: {
    score: number;
    factors: string[];
    lastUpdated: Date;
  };
  alerts: {
    id: string;
    type: string;
    message: string;
    timestamp: Date;
  }[];
}

// Component props interface
interface MedicalHistoryProps {
  athleteId: string;
  onError: (error: Error) => void;
  encryptionKey: string;
  auditMetadata: IAuditMetadata;
}

// Custom hook for managing medical history data
const useMedicalHistory = (athleteId: string, encryptionKey: string) => {
  const [data, setData] = useState<IMedicalHistory | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());

  const wsService = useMemo(() => new WebSocketService(), []);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        // Initial data fetch would go here
        // Implement actual data fetching logic

        // Set up WebSocket subscription for real-time updates
        const unsubscribe = wsService.subscribeSensorData(
          athleteId,
          (data) => {
            // Process and decrypt incoming data
            // Update medical history state
            setLastUpdate(new Date());
          },
          { priority: 'high' }
        );

        return () => {
          unsubscribe();
          wsService.disconnect();
        };
      } catch (err) {
        setError(err as Error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [athleteId, encryptionKey, wsService]);

  return { data, loading, error, lastUpdate };
};

// Main component
const MedicalHistory: React.FC<MedicalHistoryProps> = ({
  athleteId,
  onError,
  encryptionKey,
  auditMetadata
}) => {
  const { data, loading, error, lastUpdate } = useMedicalHistory(athleteId, encryptionKey);

  // Audit logging function
  const logAccess = useCallback((action: string, recordId?: string) => {
    // Implement HIPAA-compliant audit logging
    console.log('Access logged:', {
      ...auditMetadata,
      action,
      recordId,
      timestamp: new Date()
    });
  }, [auditMetadata]);

  // Table columns configuration
  const columns = useMemo(() => [
    {
      id: 'date',
      header: 'Date',
      accessor: 'date',
      cell: (value: Date) => format(value, 'MM/dd/yyyy'),
      sortable: true
    },
    {
      id: 'type',
      header: 'Type',
      accessor: 'type',
      sortable: true
    },
    {
      id: 'description',
      header: 'Description',
      accessor: 'description',
      cell: (value: string, record: IMedicalRecord) => {
        // Decrypt sensitive information if encrypted
        if (record.encryptedFields.includes('description')) {
          // Implement actual decryption logic
          return value;
        }
        return value;
      }
    },
    {
      id: 'provider',
      header: 'Provider',
      accessor: 'provider',
      sortable: true
    },
    {
      id: 'status',
      header: 'Status',
      accessor: 'status',
      cell: (value: string) => (
        <span className={`status-badge status-badge--${value.toLowerCase()}`}>
          {value}
        </span>
      )
    }
  ], []);

  // Error handling
  useEffect(() => {
    if (error) {
      onError(error);
    }
  }, [error, onError]);

  // Render loading state
  if (loading) {
    return <div className="medical-history__loading">Loading medical history...</div>;
  }

  // Render error state
  if (error) {
    return (
      <div className="medical-history__error">
        Error loading medical history. Please try again.
      </div>
    );
  }

  return (
    <ErrorBoundary
      fallback={<div>Error displaying medical history</div>}
      onError={onError}
    >
      <div className="medical-history">
        <div className="medical-history__header">
          <h2>Medical History</h2>
          <span className="medical-history__last-update">
            Last updated: {format(lastUpdate, 'MM/dd/yyyy HH:mm:ss')}
          </span>
        </div>

        {data?.riskAssessments && (
          <div className="medical-history__risk-assessment">
            <h3>Risk Assessment</h3>
            <div className="risk-score">
              Score: {data.riskAssessments.score}
            </div>
            <div className="risk-factors">
              {data.riskAssessments.factors.map((factor, index) => (
                <div key={index} className="risk-factor">
                  {factor}
                </div>
              ))}
            </div>
          </div>
        )}

        {data?.alerts && data.alerts.length > 0 && (
          <div className="medical-history__alerts">
            <h3>Active Alerts</h3>
            {data.alerts.map(alert => (
              <div key={alert.id} className="alert-item">
                <span className="alert-type">{alert.type}</span>
                <span className="alert-message">{alert.message}</span>
                <span className="alert-timestamp">
                  {format(alert.timestamp, 'HH:mm:ss')}
                </span>
              </div>
            ))}
          </div>
        )}

        <div className="medical-history__records">
          <h3>Medical Records</h3>
          <Table
            data={data?.records || []}
            columns={columns}
            sortable
            virtualized
            aria-label="Medical history records"
            onSort={(columnId, direction) => {
              logAccess('sort_records', columnId);
            }}
          />
        </div>
      </div>
    </ErrorBoundary>
  );
};

export default MedicalHistory;