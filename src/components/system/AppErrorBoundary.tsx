import { Component, type ErrorInfo, type ReactNode } from 'react';
import { AlertTriangle, Home, RefreshCw } from 'lucide-react';
import { Link } from 'react-router-dom';

interface AppErrorBoundaryProps {
  children: ReactNode;
}

interface AppErrorBoundaryState {
  hasError: boolean;
}

export class AppErrorBoundary extends Component<AppErrorBoundaryProps, AppErrorBoundaryState> {
  state: AppErrorBoundaryState = {
    hasError: false,
  };

  static getDerivedStateFromError(): AppErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(_error: Error, _errorInfo: ErrorInfo) {
    // Keep room for external logging integration (Sentry/ELK/etc).
  }

  private handleRetry = () => {
    this.setState({ hasError: false });
  };

  render() {
    if (!this.state.hasError) {
      return this.props.children;
    }

    return (
      <div className="app-background flex min-h-screen items-center justify-center px-4 py-8">
        <section className="surface-glow w-full max-w-xl p-8 text-center">
          <span className="mx-auto inline-flex h-12 w-12 items-center justify-center rounded-[var(--radius-control)] bg-[color-mix(in_srgb,var(--color-danger)_12%,transparent)] text-[var(--color-danger)]">
            <AlertTriangle className="h-5 w-5" />
          </span>
          <h1 className="mt-4 font-[var(--font-family-display)] text-[1.7rem] font-semibold tracking-[-0.018em] text-[var(--color-text)]">
            Unexpected UI Error
          </h1>
          <p className="mt-2 text-sm leading-relaxed text-[var(--color-text-muted)]">
            Something broke while rendering this page. Try again or return to the homepage.
          </p>

          <div className="mt-6 flex flex-col justify-center gap-2 sm:flex-row">
            <button
              type="button"
              onClick={this.handleRetry}
              className="inline-flex h-10 items-center justify-center gap-2 rounded-[var(--radius-control)] bg-[var(--color-primary)] px-4 text-sm font-medium text-white transition-[transform,background-color] duration-200 active:scale-[0.98] hover:bg-[var(--color-primary-hover)]"
            >
              <RefreshCw className="h-4 w-4" />
              Retry
            </button>
            <Link
              to="/"
              className="inline-flex h-10 items-center justify-center gap-2 rounded-[var(--radius-control)] border border-[color-mix(in_srgb,var(--color-border)_62%,transparent)] bg-[var(--color-surface)] px-4 text-sm font-medium text-[var(--color-text)] transition-[transform,background-color] duration-200 active:scale-[0.98] hover:bg-[var(--color-surface-2)]"
            >
              <Home className="h-4 w-4" />
              Home
            </Link>
          </div>
        </section>
      </div>
    );
  }
}
