/**
 * @fileoverview Root application component implementing secure authentication flows,
 * Material Design 3.0 theming, and real-time alert management for the smart-apparel system.
 * @version 1.0.0
 */

import React, { useEffect } from 'react';
import { BrowserRouter } from 'react-router-dom'; // v6.0.0
import { ThemeProvider, CssBaseline } from '@mui/material'; // v5.0.0
import { AlertProvider } from './contexts/AlertContext';
import { AuthProvider } from './contexts/AuthContext';
import MainLayout from './components/layout/MainLayout';
import { themeConfig } from './config/theme.config';

/**
 * Root application component with comprehensive provider setup
 * and security configuration
 */
const App: React.FC = React.memo(() => {
  /**
   * Configure Content Security Policy
   */
  useEffect(() => {
    // Only in production to allow development tools
    if (process.env.NODE_ENV === 'production') {
      const meta = document.createElement('meta');
      meta.httpEquiv = 'Content-Security-Policy';
      meta.content = `
        default-src 'self';
        script-src 'self' 'unsafe-inline';
        style-src 'self' 'unsafe-inline';
        img-src 'self' data: https:;
        connect-src 'self' ${process.env.VITE_API_URL} ${process.env.VITE_WEBSOCKET_URL};
        font-src 'self';
        object-src 'none';
        media-src 'self';
        frame-src 'none';
        base-uri 'self';
        form-action 'self';
        frame-ancestors 'none';
        upgrade-insecure-requests;
      `.replace(/\s+/g, ' ').trim();
      document.head.appendChild(meta);
    }
  }, []);

  /**
   * Configure performance monitoring
   */
  useEffect(() => {
    if (process.env.NODE_ENV === 'production') {
      // Report Web Vitals
      const reportWebVitals = async (metric: any) => {
        try {
          await fetch('/api/metrics', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(metric)
          });
        } catch (error) {
          console.error('Failed to report web vitals:', error);
        }
      };

      // Initialize performance observer
      const observer = new PerformanceObserver((list) => {
        list.getEntries().forEach((entry) => {
          reportWebVitals({
            name: entry.name,
            value: entry.startTime,
            rating: 'good'
          });
        });
      });

      observer.observe({ entryTypes: ['largest-contentful-paint', 'first-input'] });

      return () => observer.disconnect();
    }
  }, []);

  return (
    <React.StrictMode>
      <ErrorBoundary>
        <BrowserRouter>
          <ThemeProvider theme={themeConfig}>
            <CssBaseline />
            <AuthProvider>
              <AlertProvider>
                <MainLayout>
                  {/* Routes will be rendered here by MainLayout */}
                </MainLayout>
              </AlertProvider>
            </AuthProvider>
          </ThemeProvider>
        </BrowserRouter>
      </ErrorBoundary>
    </React.StrictMode>
  );
});

/**
 * Error boundary component for graceful error handling
 */
class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; error: Error | null }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    // Log error to monitoring service
    console.error('Application error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div role="alert" aria-live="assertive">
          <h1>Something went wrong</h1>
          <p>Please try refreshing the page or contact support if the issue persists.</p>
          {process.env.NODE_ENV === 'development' && (
            <pre>{this.state.error?.toString()}</pre>
          )}
        </div>
      );
    }

    return this.props.children;
  }
}

// Set display name for debugging
App.displayName = 'App';

export default App;