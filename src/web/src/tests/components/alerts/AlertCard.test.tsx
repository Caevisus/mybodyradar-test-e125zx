import React from 'react';
import { render, fireEvent, screen, within } from '@testing-library/react';
import { axe, toHaveNoViolations } from 'jest-axe';
import userEvent from '@testing-library/user-event';
import { createMatchMedia } from '@testing-library/react-hooks';
import AlertCard from '../../../components/alerts/AlertCard';
import { IAlert } from '../../../interfaces/alert.interface';
import { ALERT_SEVERITY_COLORS } from '../../../constants/alert.constants';

expect.extend(toHaveNoViolations);

// Mock framer-motion to avoid animation issues in tests
jest.mock('framer-motion', () => ({
  motion: { div: 'div' },
  AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

describe('AlertCard', () => {
  // Mock data setup
  const mockAlert: IAlert = {
    id: 'test-alert-123',
    type: 'BIOMECHANICAL',
    category: 'INJURY_RISK',
    severity: 'HIGH',
    status: 'ACTIVE',
    sessionId: 'session-123',
    timestamp: new Date('2023-01-01T12:00:00Z'),
    message: 'High impact detected on right knee',
    details: {
      threshold: 800,
      currentValue: 850,
      location: 'Right Knee',
      recommendations: ['Reduce training intensity'],
      confidenceScore: 0.92,
      sensorData: {
        sensorId: 'sensor-123',
        timestamp: Date.now(),
        readings: [],
        metadata: {
          calibrationVersion: '1.0',
          processingSteps: [],
          quality: 95
        }
      }
    }
  };

  const mockCallbacks = {
    onAcknowledge: jest.fn(),
    onDismiss: jest.fn(),
    onViewDetails: jest.fn()
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Rendering', () => {
    it('should render alert card with all required elements', () => {
      render(<AlertCard alert={mockAlert} {...mockCallbacks} />);

      expect(screen.getByRole('alert')).toBeInTheDocument();
      expect(screen.getByText(mockAlert.message)).toBeInTheDocument();
      expect(screen.getByText(`Location: ${mockAlert.details.location}`)).toBeInTheDocument();
      expect(screen.getByText(`Confidence: ${(mockAlert.details.confidenceScore! * 100).toFixed(1)}%`)).toBeInTheDocument();
    });

    it('should apply correct severity color', () => {
      render(<AlertCard alert={mockAlert} {...mockCallbacks} />);
      
      const header = screen.getByRole('alert').querySelector('.alert-card__header');
      expect(header).toHaveStyle({ color: ALERT_SEVERITY_COLORS[mockAlert.severity] });
    });

    it('should render timestamp when showTimestamp is true', () => {
      render(<AlertCard alert={mockAlert} showTimestamp {...mockCallbacks} />);
      
      const timestamp = screen.getByLabelText('Alert time');
      expect(timestamp).toBeInTheDocument();
      expect(timestamp).toHaveTextContent(/12:00:00/);
    });

    it('should not render timestamp when showTimestamp is false', () => {
      render(<AlertCard alert={mockAlert} showTimestamp={false} {...mockCallbacks} />);
      
      expect(screen.queryByLabelText('Alert time')).not.toBeInTheDocument();
    });
  });

  describe('Interactions', () => {
    it('should call onAcknowledge when acknowledge button is clicked', async () => {
      render(<AlertCard alert={mockAlert} {...mockCallbacks} />);
      
      const acknowledgeButton = screen.getByRole('button', { name: /acknowledge/i });
      await userEvent.click(acknowledgeButton);
      
      expect(mockCallbacks.onAcknowledge).toHaveBeenCalledWith(mockAlert.id);
    });

    it('should call onDismiss when dismiss button is clicked', async () => {
      render(<AlertCard alert={mockAlert} {...mockCallbacks} />);
      
      const dismissButton = screen.getByRole('button', { name: /dismiss/i });
      await userEvent.click(dismissButton);
      
      expect(mockCallbacks.onDismiss).toHaveBeenCalledWith(mockAlert.id);
    });

    it('should call onViewDetails when view details button is clicked', async () => {
      render(<AlertCard alert={mockAlert} {...mockCallbacks} />);
      
      const viewDetailsButton = screen.getByRole('button', { name: /view details/i });
      await userEvent.click(viewDetailsButton);
      
      expect(mockCallbacks.onViewDetails).toHaveBeenCalledWith(mockAlert.id);
    });

    it('should handle keyboard navigation', async () => {
      render(<AlertCard alert={mockAlert} {...mockCallbacks} />);
      
      const buttons = screen.getAllByRole('button');
      await userEvent.tab();
      
      expect(buttons[0]).toHaveFocus();
      
      await userEvent.keyboard('{enter}');
      expect(mockCallbacks.onViewDetails).toHaveBeenCalled();
    });
  });

  describe('Accessibility', () => {
    it('should have no accessibility violations', async () => {
      const { container } = render(<AlertCard alert={mockAlert} {...mockCallbacks} />);
      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });

    it('should have correct ARIA labels', () => {
      render(<AlertCard alert={mockAlert} {...mockCallbacks} />);
      
      expect(screen.getByRole('alert')).toHaveAttribute(
        'aria-label',
        `${mockAlert.severity} alert: ${mockAlert.message}`
      );
      
      expect(screen.getByLabelText(`Severity: ${mockAlert.severity}`)).toBeInTheDocument();
      expect(screen.getByLabelText(`Alert type: ${mockAlert.type}`)).toBeInTheDocument();
    });

    it('should support custom accessibility label', () => {
      const customLabel = 'Custom alert label';
      render(<AlertCard alert={mockAlert} accessibilityLabel={customLabel} {...mockCallbacks} />);
      
      expect(screen.getByRole('alert')).toHaveAttribute('aria-label', customLabel);
    });
  });

  describe('Responsive Behavior', () => {
    it('should adapt layout for mobile viewport', () => {
      window.matchMedia = createMatchMedia(320);
      render(<AlertCard alert={mockAlert} {...mockCallbacks} />);
      
      const card = screen.getByRole('alert');
      expect(card).toHaveClass('alert-card--mobile');
    });

    it('should adapt layout for tablet viewport', () => {
      window.matchMedia = createMatchMedia(768);
      render(<AlertCard alert={mockAlert} {...mockCallbacks} />);
      
      const card = screen.getByRole('alert');
      expect(card).toHaveClass('alert-card--tablet');
    });

    it('should adapt layout for desktop viewport', () => {
      window.matchMedia = createMatchMedia(1024);
      render(<AlertCard alert={mockAlert} {...mockCallbacks} />);
      
      const card = screen.getByRole('alert');
      expect(card).toHaveClass('alert-card--desktop');
    });
  });

  describe('Animation', () => {
    it('should render with animation when animateTransitions is true', () => {
      render(<AlertCard alert={mockAlert} animateTransitions {...mockCallbacks} />);
      
      expect(screen.getByRole('alert').parentElement).toHaveStyle({
        opacity: '1',
        transform: 'translateY(0px)'
      });
    });

    it('should render without animation when animateTransitions is false', () => {
      render(<AlertCard alert={mockAlert} animateTransitions={false} {...mockCallbacks} />);
      
      expect(screen.getByRole('alert').parentElement).not.toHaveStyle({
        opacity: '1',
        transform: 'translateY(0px)'
      });
    });
  });

  describe('Error Handling', () => {
    it('should handle failed acknowledge action gracefully', async () => {
      const errorCallback = jest.fn().mockRejectedValue(new Error('Network error'));
      render(<AlertCard alert={mockAlert} onAcknowledge={errorCallback} />);
      
      const acknowledgeButton = screen.getByRole('button', { name: /acknowledge/i });
      await userEvent.click(acknowledgeButton);
      
      expect(console.error).toHaveBeenCalledWith('Failed to acknowledge alert:', expect.any(Error));
    });

    it('should handle failed dismiss action gracefully', async () => {
      const errorCallback = jest.fn().mockRejectedValue(new Error('Network error'));
      render(<AlertCard alert={mockAlert} onDismiss={errorCallback} />);
      
      const dismissButton = screen.getByRole('button', { name: /dismiss/i });
      await userEvent.click(dismissButton);
      
      expect(console.error).toHaveBeenCalledWith('Failed to dismiss alert:', expect.any(Error));
    });
  });
});