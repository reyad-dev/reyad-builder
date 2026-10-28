import { Component, type ErrorInfo, type ReactNode } from 'react';

export interface AppErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
}

interface AppErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

/**
 * Top-level React Error Boundary.
 * Catches unhandled runtime exceptions in the component tree,
 * logs diagnostics, and displays a graceful fallback screen with recovery actions.
 */
export class AppErrorBoundary extends Component<AppErrorBoundaryProps, AppErrorBoundaryState> {
  public override state: AppErrorBoundaryState = {
    hasError: false,
    error: null,
    errorInfo: null
  };

  public static getDerivedStateFromError(error: Error): Partial<AppErrorBoundaryState> {
    return { hasError: true, error };
  }

  public override componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    this.setState({ errorInfo });

    // Optional consumer callback for error telemetry
    this.props.onError?.(error, errorInfo);

    // Console logging for diagnostics
    if (process.env.NODE_ENV !== 'test') {
      console.error('Unhandled application error captured by AppErrorBoundary:', error, errorInfo);
    }
  }

  public handleReload = (): void => {
    window.location.reload();
  };

  public handleReset = (): void => {
    this.setState({ hasError: false, error: null, errorInfo: null });
  };

  public override render(): ReactNode {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div
          data-testid="app-error-boundary-fallback"
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            minHeight: '100vh',
            padding: '2rem',
            background: 'linear-gradient(180deg, #f8fafc 0%, #f1f5f9 100%)',
            color: '#0f172a',
            fontFamily: "'Alexandria', 'Cairo', 'Inter', -apple-system, sans-serif"
          }}
        >
          <div
            style={{
              maxWidth: '640px',
              width: '100%',
              backgroundColor: '#ffffff',
              border: '1px solid #e2e8f0',
              borderRadius: '16px',
              padding: '2.5rem',
              boxShadow: '0 20px 45px -10px rgba(15, 23, 42, 0.12)'
            }}
          >
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                padding: '4px 12px',
                backgroundColor: '#fef2f2',
                color: '#b91c1c',
                border: '1px solid #fecaca',
                borderRadius: '9999px',
                fontSize: '0.85rem',
                fontWeight: 600,
                marginBottom: '1rem'
              }}
            >
              Application Error • حدث خطأ غير متوقع
            </div>

            <h1
              style={{
                fontSize: '1.75rem',
                fontWeight: 700,
                marginBottom: '0.75rem',
                letterSpacing: '-0.025em',
                color: '#0f172a'
              }}
            >
              Something went wrong
            </h1>

            <p
              style={{
                color: '#475569',
                fontSize: '0.95rem',
                lineHeight: 1.6,
                marginBottom: '1.5rem'
              }}
            >
              The application encountered an unexpected error. You can attempt to recover by
              resetting the view or reloading the workspace.
            </p>

            {this.state.error && (
              <pre
                data-testid="error-message"
                style={{
                  backgroundColor: '#0f172a',
                  border: '1px solid #334155',
                  padding: '1rem',
                  borderRadius: '8px',
                  fontSize: '0.82rem',
                  color: '#fda4af',
                  fontFamily: 'JetBrains Mono, monospace',
                  overflowX: 'auto',
                  marginBottom: '1.5rem',
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-word'
                }}
              >
                {this.state.error.message}
              </pre>
            )}

            <div style={{ display: 'flex', gap: '12px' }}>
              <button
                type="button"
                onClick={this.handleReset}
                style={{
                  padding: '0.65rem 1.25rem',
                  borderRadius: '8px',
                  backgroundColor: '#10b981',
                  color: '#ffffff',
                  fontWeight: 600,
                  fontSize: '0.9rem',
                  border: 'none',
                  cursor: 'pointer',
                  transition: 'background-color 150ms ease'
                }}
              >
                Try Again
              </button>
              <button
                type="button"
                onClick={this.handleReload}
                style={{
                  padding: '0.65rem 1.25rem',
                  borderRadius: '8px',
                  backgroundColor: '#ffffff',
                  color: '#334155',
                  fontWeight: 600,
                  fontSize: '0.9rem',
                  border: '1px solid #cbd5e1',
                  cursor: 'pointer',
                  transition: 'background-color 150ms ease'
                }}
              >
                Reload Page
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
