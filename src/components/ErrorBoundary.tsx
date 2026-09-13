import React from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface ErrorBoundaryState {
  hasError: boolean;
}

// Catches otherwise-unhandled render errors so a bug in one part of the
// dashboard shows a recoverable message instead of a blank white screen.
// Approved schedules and audit history live on the server, not in this
// component tree, so a reload always recovers them.
export class ErrorBoundary extends React.Component<{ children: React.ReactNode }, ErrorBoundaryState> {
  // Declared explicitly: this project has no @types/react installed, so the
  // React.Component base class resolves to an untyped `any` and `this.props`
  // wouldn't otherwise be visible to the type checker.
  props: { children: React.ReactNode };
  state: ErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('ShiftSense encountered an unhandled error:', error, info.componentStack);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6 text-center" role="alert">
          <div className="max-w-md">
            <div className="mx-auto w-12 h-12 rounded-2xl bg-rose-50 border border-rose-200 flex items-center justify-center text-rose-600 mb-4">
              <AlertTriangle className="w-6 h-6" aria-hidden="true" />
            </div>
            <h1 className="text-lg font-bold text-slate-900">Something went wrong</h1>
            <p className="mt-2 text-sm text-slate-600">
              ShiftSense hit an unexpected error and couldn&rsquo;t continue. Your approved schedules and audit
              history are safely stored on the server &mdash; reloading the page will restore your session.
            </p>
            <button
              onClick={() => window.location.reload()}
              className="mt-5 inline-flex items-center space-x-2 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold cursor-pointer"
            >
              <RefreshCw className="w-4 h-4" aria-hidden="true" />
              <span>Reload ShiftSense</span>
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
