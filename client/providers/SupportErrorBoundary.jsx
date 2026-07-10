'use client';

import { Component } from 'react';
import { AlertTriangle } from 'lucide-react';

export default class SupportErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    // eslint-disable-next-line no-console
    console.error('[SupportErrorBoundary]', error, info);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center min-h-[50vh] text-center px-6">
          <div className="w-14 h-14 rounded-full bg-error/10 flex items-center justify-center mb-4">
            <AlertTriangle className="w-6 h-6 text-error" />
          </div>
          <h2 className="text-lg font-bold mb-1">Something broke in Support Center</h2>
          <p className="text-sm text-base-content/60 max-w-sm mb-5">
            This section hit an unexpected error. Your ticket data is safe — try reloading this view.
          </p>
          <button type="button" onClick={this.handleReset} className="btn btn-primary">
            Try again
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
