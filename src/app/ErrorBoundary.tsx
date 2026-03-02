import { Component } from 'react';
import type { ErrorInfo, ReactNode } from 'react';

type Props = {
  children: ReactNode;
};

type State = {
  hasError: boolean;
};

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(_error: Error, _errorInfo: ErrorInfo): void {
    // Intentionally suppressed — no telemetry, no console output in production
  }

  render(): ReactNode {
    if (this.state.hasError) {
      return (
        <div className="flex min-h-screen items-center justify-center bg-background text-foreground">
          <div className="rounded-lg border border-border bg-card p-8 shadow-sm text-center max-w-md">
            <h1 className="text-xl font-semibold mb-2">Something went wrong</h1>
            <p className="text-muted-foreground text-sm">
              Please refresh the page. If the problem persists, clear your browser cache.
            </p>
            <button
              onClick={() => { window.location.reload(); }}
              className="mt-6 rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground hover:opacity-90 transition-opacity"
            >
              Refresh
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
